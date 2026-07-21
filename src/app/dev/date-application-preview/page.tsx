import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { AppHome } from "@/features/app/AppHome";
import type { ProfileRow } from "@/types/profile";

const previewProfile = {
  user_id: "local-date-application-preview",
  provider: "local_preview",
  kakao_id: null,
  name: "하늘",
  nickname: "하늘",
  phone: null,
  phone_normalized: null,
  gender: null,
  birth_year: null,
  mbti: null,
  photo_url: null,
  details_seen_at: null,
  browse_seen_at: null,
  profile_completed: true,
  questions_completed: true,
  is_test_participant: true,
  public_intro: null,
  public_emoji: null,
  public_intro_generated_at: null,
  public_intro_revealed_generated_at: null,
  public_intro_model: null,
  last_profile_regenerated_at: null,
  profile_regeneration_started_at: null,
  profile_regeneration_questions_completed_at: null,
  meeting_guidelines_agreed: true,
  meeting_guidelines_agreed_at: null,
  membership_status: "active",
  membership_plan: null,
  membership_start_date: null,
  membership_end_date: null,
  membership_purchase_clicked_at: null,
  membership_updated_at: null,
  matching_precision_bonus: null,
  conversation_result_code: null,
  conversation_result_version: null,
  conversation_result_calculated_at: null,
  conversation_result_source: null,
  conversation_result_confidence: null,
  score_temperature: null,
  score_texture: null,
  score_tone: null,
  score_rhythm: null,
  community_guidelines_agreed: true,
  community_guidelines_agreed_at: null,
} satisfies ProfileRow;

export default function DateApplicationPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <MobileFrame>
      <AppHome
        userId={previewProfile.user_id}
        profile={previewProfile}
        initialTab="recommend"
      />
    </MobileFrame>
  );
}
