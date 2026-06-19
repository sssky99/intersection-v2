import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/profile";

const REGENERATION_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function nextRegenerationDate(lastRegeneratedAt: string | null) {
  if (!lastRegeneratedAt) return null;
  const last = new Date(lastRegeneratedAt);
  if (!Number.isFinite(last.getTime())) return null;
  return new Date(last.getTime() + REGENERATION_COOLDOWN_MS);
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "user_id,profile_completed,is_test_participant,last_profile_regenerated_at",
    )
    .eq("user_id", user.id)
    .single<
      Pick<
        ProfileRow,
        | "user_id"
        | "profile_completed"
        | "is_test_participant"
        | "last_profile_regenerated_at"
      >
    >();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (!profile.profile_completed) {
    return NextResponse.json(
      { error: "Profile is not completed yet." },
      { status: 409 },
    );
  }

  const nextAvailableAt = nextRegenerationDate(profile.last_profile_regenerated_at);
  if (
    profile.is_test_participant !== true &&
    nextAvailableAt &&
    nextAvailableAt.getTime() > Date.now()
  ) {
    return NextResponse.json(
      {
        error: "프로필 새로 만들기는 한 달에 한 번만 가능해요.",
        nextAvailableAt: nextAvailableAt.toISOString(),
      },
      { status: 429 },
    );
  }

  const now = new Date().toISOString();
  const { error: draftDeleteError } = await admin
    .from("profile_regeneration_answers")
    .delete()
    .eq("user_id", user.id);

  if (draftDeleteError) {
    console.error("[profile regeneration start] draft cleanup failed", draftDeleteError);
    return NextResponse.json(
      { error: "Regeneration draft could not be prepared." },
      { status: 500 },
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      profile_regeneration_started_at: now,
      profile_regeneration_questions_completed_at: null,
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[profile regeneration start] profile update failed", updateError);
    return NextResponse.json(
      { error: "Regeneration could not be started." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, startedAt: now });
}
