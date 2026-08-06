import { NextResponse } from "next/server";
import { usesPreferenceProfile } from "@/data/preferenceQuestions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile || !usesPreferenceProfile(profile)) {
    return NextResponse.json(
      { error: "Preference profile is unavailable." },
      { status: 409 },
    );
  }

  const updates: Partial<ProfileRow> = {};
  if (body && "publicEmoji" in body) {
    const publicEmoji = text(body.publicEmoji);
    if (!publicEmoji || publicEmoji.length > 16) {
      return NextResponse.json({ error: "Invalid emoji." }, { status: 400 });
    }
    updates.public_emoji = publicEmoji;
  }

  if (body && "name" in body) {
    const name = text(body.name);
    const phone = text(body.phone);
    const phoneNormalized = normalizePhone(phone);
    const gender = text(body.gender);
    const birthYear = text(body.birthYear);
    const mbti = text(body.mbti).toUpperCase();
    const year = Number(birthYear);

    if (
      name.length <= 1 ||
      phoneNormalized.length !== 11 ||
      (gender !== "여성" && gender !== "남성") ||
      !/^\d{4}$/.test(birthYear) ||
      year < 1980 ||
      year > 2007 ||
      !mbti ||
      mbti.length > 20
    ) {
      return NextResponse.json(
        { error: "Profile information is incomplete." },
        { status: 400 },
      );
    }

    updates.name = name;
    updates.phone = phone;
    updates.phone_normalized = phoneNormalized;
    updates.gender = gender;
    updates.birth_year = birthYear;
    updates.mbti = mbti;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  }

  const { data: updatedProfile, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select("*")
    .single<ProfileRow>();
  if (error) {
    console.error("Preference profile update failed:", error.message);
    return NextResponse.json({ error: "Profile could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ profile: updatedProfile });
}
