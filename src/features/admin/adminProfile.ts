import {
  displayMembershipStatus,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";

export type AdminProfile = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  gender: string | null;
  birth_year: string | number | null;
  mbti: string | null;
  phone: string | null;
  photo_url: string | null;
  public_intro: string | null;
  public_emoji?: string | null;
  public_intro_model?: string | null;
  created_at: string | null;
  profile_completed: boolean | null;
  questions_completed: boolean | null;
  is_test_participant?: boolean | null;
  membership_status?: MembershipStatus | null;
  membership_plan?: string | null;
  membership_start_date?: string | null;
  membership_end_date?: string | null;
  membership_purchase_clicked_at?: string | null;
  membership_updated_at?: string | null;
  matching_precision_bonus?: number | null;
  score_temperature?: number | null;
  score_texture?: number | null;
  score_tone?: number | null;
  score_rhythm?: number | null;
  active_membership?: boolean;
  expired_membership?: boolean;
};

export function hasActiveMembership(profile: AdminProfile) {
  // TODO: 실제 membership 테이블이 생기면 profiles 컬럼 대신 그 연결 기준으로 수정.
  return (
    displayMembershipStatus({
      status: profile.membership_status,
      endDate: profile.membership_end_date,
    }) === "active"
  );
}

export function hasExpiredMembership(profile: AdminProfile) {
  return (
    displayMembershipStatus({
      status: profile.membership_status,
      endDate: profile.membership_end_date,
    }) === "expired"
  );
}

export function normalizeAdminProfile(profile: AdminProfile): AdminProfile {
  return {
    ...profile,
    nickname: profile.nickname ?? null,
    is_test_participant: profile.is_test_participant ?? false,
    matching_precision_bonus: profile.matching_precision_bonus ?? 0,
    active_membership: hasActiveMembership(profile),
    expired_membership: hasExpiredMembership(profile),
  };
}
