import type { Gender } from "@/types/user";

export type ProfileRow = {
  user_id: string;
  provider: string | null;
  kakao_id: string | null;
  name: string | null;
  phone: string | null;
  phone_normalized: string | null;
  gender: Gender | null;
  birth_year: string | number | null;
  mbti: string | null;
  photo_url: string | null;
  details_seen_at: string | null;
  browse_seen_at: string | null;
  profile_completed: boolean | null;
  questions_completed: boolean | null;
  public_intro: string | null;
  public_intro_generated_at: string | null;
  public_intro_model: string | null;
  launch_notification_requested: boolean | null;
  launch_notification_requested_at: string | null;
  meeting_guidelines_agreed: boolean | null;
  meeting_guidelines_agreed_at: string | null;
  membership_status: string | null;
  membership_plan: string | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  membership_purchase_clicked_at: string | null;
  membership_updated_at: string | null;
  // Legacy fields kept while the existing app shell is being phased out.
  community_guidelines_agreed: boolean | null;
  community_guidelines_agreed_at: string | null;
};
