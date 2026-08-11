import { NextResponse } from "next/server";
import { preferenceProfileVersion } from "@/data/preferenceQuestions";
import { nextOnboardingPath } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";

export const dynamic = "force-dynamic";

function localPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  return digits;
}

function displayPhone(value: string) {
  return value.replace(/^(010)(\d{4})(\d{4})$/, "$1-$2-$3");
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.phone) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();
  if (lookupError) {
    console.error("[phone-auth] profile lookup after verification failed", lookupError.code);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
  }

  if (existingProfile) {
    return NextResponse.json({
      loginType: "existing",
      nextPath: nextOnboardingPath(existingProfile),
    });
  }

  const normalizedPhone = localPhone(user.phone);
  if (!/^010\d{8}$/.test(normalizedPhone)) {
    return NextResponse.json({ error: "Invalid verified phone" }, { status: 400 });
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
    console.error("[phone-auth] profile bootstrap failed", createError?.code);
    return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    loginType: "new",
    nextPath: nextOnboardingPath(createdProfile, { startQuestions: true }),
  });
}
