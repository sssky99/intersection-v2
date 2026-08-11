import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { preferenceProfileVersion } from "@/data/preferenceQuestions";
import { nextOnboardingPath } from "@/lib/onboarding";
import { isSameOriginRequest, requestActorKey } from "@/lib/requestGuards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";

export const dynamic = "force-dynamic";

const rateLimitWindowMs = 10 * 60 * 1000;
const maxRequestsPerWindow = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function localPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  return digits;
}

function displayPhone(value: string) {
  return value.replace(/^(010)(\d{4})(\d{4})$/, "$1-$2-$3");
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = localPhone(value);
  return /^010\d{8}$/.test(normalized) ? normalized : null;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

async function signInWithoutOtp(phone: string) {
  const admin = createAdminClient();
  // 번호만 아는 사람이 기존 계정에 접근하지 못하도록 매번 별도 임시 계정을 만든다.
  const email = `phone-bypass-${randomUUID()}@otp-bypass.invalid`;

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: {
        phone,
        phone_verification_bypassed: true,
      },
    },
  });
  if (linkError) throw linkError;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { phone?: unknown; bypassOtp?: unknown }
    | null;
  const bypassPhone = body?.bypassOtp === true ? normalizePhone(body.phone) : null;

  if (body?.bypassOtp === true) {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!bypassPhone) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }
    if (isRateLimited(requestActorKey(request))) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "600" } },
      );
    }

    try {
      // TEMP: 전화번호 OTP가 복구되면 이 자동 세션 생성 분기를 제거한다.
      await signInWithoutOtp(bypassPhone);
    } catch (error) {
      console.error(
        "[phone-auth] temporary OTP bypass failed",
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json({ error: "Sign-in unavailable" }, { status: 503 });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (!user.phone && !bypassPhone)) {
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

  const normalizedPhone = bypassPhone ?? localPhone(user.phone);
  if (!/^010\d{8}$/.test(normalizedPhone)) {
    return NextResponse.json({ error: "Invalid verified phone" }, { status: 400 });
  }

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      provider: bypassPhone ? "phone_unverified" : "phone",
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
