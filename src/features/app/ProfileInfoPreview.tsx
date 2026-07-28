"use client";

import { useState } from "react";
import { PreferenceProfileTab } from "@/features/app/PreferenceProfileTab";
import type { ProfileRow } from "@/types/profile";

const initialPreviewProfile = {
  user_id: "local-profile-info-preview",
  provider: "local_preview",
  kakao_id: null,
  name: "김교집",
  nickname: "교집",
  phone: "01012345678",
  phone_normalized: "01012345678",
  gender: "여성",
  birth_year: "1997",
  mbti: "ENFP",
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

export function ProfileInfoPreview() {
  const [profile, setProfile] = useState<ProfileRow>(initialPreviewProfile);

  return (
    <div className="min-h-dvh bg-[#F3F0E8]">
      <PreferenceProfileTab
        profile={profile}
        loggingOut={false}
        logoutError={null}
        participationCount={2}
        preferredActivities={["meal", "culture", "reading"]}
        recentInterests={["travel", "coffee", "movie"]}
        onProfileUpdated={setProfile}
        onLogout={async () => undefined}
        previewMode
      />
    </div>
  );
}
