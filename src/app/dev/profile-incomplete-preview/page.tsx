import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { preferenceProfileVersion } from "@/data/preferenceQuestions";
import { AppHome } from "@/features/app/AppHome";
import type { ProfileRow } from "@/types/profile";

const incompleteProfile = {
  user_id: "profile-incomplete-preview",
  provider: "local_preview",
  kakao_id: null,
  name: null,
  nickname: null,
  phone: null,
  phone_normalized: null,
  gender: null,
  birth_year: null,
  mbti: null,
  photo_url: null,
  details_seen_at: null,
  browse_seen_at: null,
  profile_completed: false,
  questions_completed: true,
  profile_experience_version: preferenceProfileVersion,
  profile_archetype_id: "idealist",
  profile_archetype_version: "profile-archetypes-v1",
  profile_archetype_assigned_at: new Date().toISOString(),
  is_test_participant: true,
  public_intro: null,
  public_emoji: null,
  public_intro_generated_at: null,
  public_intro_revealed_generated_at: null,
  public_intro_model: null,
  last_profile_regenerated_at: null,
  profile_regeneration_started_at: null,
  profile_regeneration_questions_completed_at: null,
  meeting_guidelines_agreed: false,
  meeting_guidelines_agreed_at: null,
  membership_status: null,
  membership_plan: null,
  membership_start_date: null,
  membership_end_date: null,
  membership_purchase_clicked_at: null,
  membership_updated_at: null,
  matching_precision_bonus: 0,
  conversation_result_code: null,
  conversation_result_version: null,
  conversation_result_calculated_at: null,
  conversation_result_source: null,
  conversation_result_confidence: null,
  score_temperature: null,
  score_texture: null,
  score_tone: null,
  score_rhythm: null,
  community_guidelines_agreed: false,
  community_guidelines_agreed_at: null,
} satisfies ProfileRow;

export default async function ProfileIncompletePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const tab = Array.isArray(params?.tab) ? params.tab[0] : params?.tab;

  return (
    <MobileFrame>
      <AppHome
        userId="profile-incomplete-preview"
        profile={incompleteProfile}
        initialTab={tab === "profile" ? "profile" : "recommend"}
        guestMode
      />
    </MobileFrame>
  );
}
