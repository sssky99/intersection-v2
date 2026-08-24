import { NextResponse } from "next/server";
import { preferenceProfileVersion } from "@/data/preferenceQuestions";
import { safelyRecordServerFunnelEvent } from "@/lib/funnelAnalytics";
import { findLoginBlock } from "@/lib/loginBlocklist";
import { nextOnboardingPath } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";

export const dynamic = "force-dynamic";

type ProfileErrorCode =
  | "ACCOUNT_BLOCKED"
  | "PROFILE_UNAUTHORIZED"
  | "PROFILE_INVALID_PHONE"
  | "PROFILE_LOOKUP_FAILED"
  | "PROFILE_CREATE_FAILED";

function profileError(errorCode: ProfileErrorCode, status: number) {
  return NextResponse.json({ errorCode }, { status });
}

function localPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  return digits;
}

function displayPhone(value: string) {
  return value.replace(/^(010)(\d{4})(\d{4})$/, "$1-$2-$3");
}

function existingUserNextPath(profile: ProfileRow) {
  const nextPath = nextOnboardingPath(profile);
  return nextPath.startsWith("/meetings") ? "/meetings?tab=browse" : nextPath;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { analyticsSessionId?: unknown }
    | null;
  const supabase = await createClient({ timeoutMs: 3000 });
  const authResult = await supabase.auth.getUser().catch((error: unknown) => {
    console.error("[phone-auth] user lookup timed out", error);
    return null;
  });
  if (!authResult) {
    return profileError("PROFILE_LOOKUP_FAILED", 503);
  }
  const user = authResult.data.user;
  if (!user || !user.phone) {
    return profileError("PROFILE_UNAUTHORIZED", 401);
  }

  const blocked = await findLoginBlock({
    userId: user.id,
    phone: user.phone,
    timeoutMs: 500,
  }).catch((error: unknown) => {
    console.error("[phone-auth] blocklist lookup failed after OTP", error);
    return null;
  });
  if (blocked) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return profileError("ACCOUNT_BLOCKED", 403);
  }

  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();
  if (lookupError) {
    console.error("[phone-auth] profile lookup after verification failed", lookupError.code);
    return profileError("PROFILE_LOOKUP_FAILED", 503);
  }

  if (existingProfile) {
    await safelyRecordServerFunnelEvent({
      sessionId: body?.analyticsSessionId,
      profileId: user.id,
      eventName: "otp_verified",
      path: "/api/auth/phone/complete",
      metadata: { login_type: existingProfile.profile_completed ? "existing" : "new" },
    });
    return NextResponse.json({
      loginType: existingProfile.profile_completed ? "existing" : "new",
      nextPath: existingUserNextPath(existingProfile),
    });
  }

  const normalizedPhone = localPhone(user.phone);
  if (!/^010\d{8}$/.test(normalizedPhone)) {
    return profileError("PROFILE_INVALID_PHONE", 400);
  }

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      provider: "phone",
      kakao_id: null,
      phone: displayPhone(normalizedPhone),
      phone_normalized: normalizedPhone,
      questions_completed: false,
      profile_completed: false,
      meeting_guidelines_agreed: false,
      profile_experience_version: preferenceProfileVersion,
    })
    .select("*")
    .single<ProfileRow>();

  if (createError || !createdProfile) {
    if (createError?.code === "23505") {
      const { data: concurrentProfile, error: concurrentLookupError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle<ProfileRow>();
      if (!concurrentLookupError && concurrentProfile) {
        await safelyRecordServerFunnelEvent({
          sessionId: body?.analyticsSessionId,
          profileId: user.id,
          eventName: "otp_verified",
          path: "/api/auth/phone/complete",
          metadata: { login_type: "existing" },
        });
        return NextResponse.json({
          loginType: "existing",
          nextPath: existingUserNextPath(concurrentProfile),
        });
      }
    }
    console.error("[phone-auth] profile bootstrap failed", createError?.code);
    return profileError("PROFILE_CREATE_FAILED", 503);
  }

  await safelyRecordServerFunnelEvent({
    sessionId: body?.analyticsSessionId,
    profileId: user.id,
    eventName: "otp_verified",
    path: "/api/auth/phone/complete",
    metadata: { login_type: "new" },
  });

  return NextResponse.json({
    loginType: "new",
    nextPath: nextOnboardingPath(createdProfile, { startQuestions: true }),
  });
}
