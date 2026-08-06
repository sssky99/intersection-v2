import { NextResponse } from "next/server";
import { usesPreferenceProfile } from "@/data/preferenceQuestions";
import { assignedProfileEmoji } from "@/lib/profileEmoji";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name);
  const phone = text(body?.phone);
  const phoneNormalized = normalizePhone(phone);
  const gender = text(body?.gender);
  const birthYear = text(body?.birthYear);
  const mbti = text(body?.mbti).toUpperCase();
  const photoUrl = text(body?.photoUrl);
  const year = Number(birthYear);

  if (name.length <= 1 || phoneNormalized.length !== 11 || !gender ||
      !/^\d{4}$/.test(birthYear) || year < 1980 || year > 2007 ||
      !mbti || mbti.length > 20 || !photoUrl) {
    return NextResponse.json({ error: "Profile information is incomplete." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("profile_experience_version,public_emoji")
    .eq("user_id", user.id)
    .maybeSingle<{
      profile_experience_version: string | null;
      public_emoji: string | null;
    }>();
  const { error } = await admin.from("profiles").update({
    name,
    phone,
    phone_normalized: phoneNormalized,
    gender,
    birth_year: birthYear,
    mbti,
    photo_url: photoUrl,
    profile_completed: true,
    basic_info_completed_at: new Date().toISOString(),
    profile_completed_at: new Date().toISOString(),
    ...(profile && usesPreferenceProfile(profile) && !profile.public_emoji
      ? { public_emoji: assignedProfileEmoji(user.id) }
      : {}),
  }).eq("user_id", user.id);

  if (error) {
    console.error("Onboarding profile completion failed:", error.message);
    return NextResponse.json({ error: "Profile could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
