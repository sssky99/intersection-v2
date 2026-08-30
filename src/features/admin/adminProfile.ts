import {
  displayMembershipStatus,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";
import type {
  RedFlagManualFlags,
  RedFlagReason,
} from "@/features/admin/redFlags";

export type AdminProfileAnswer = {
  user_id: string;
  question_order: number;
  category?: string | null;
  question_type?: string | null;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
  updated_at?: string | null;
};

export type AdminAlgorithmParameter = {
  user_id: string;
  question_order: number;
  mode: "similar" | "different";
  position: number;
  updated_at: string | null;
};

export type AdminPaymentTransaction = {
  id: number;
  payment_kind: string | null;
  product_code: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  occurred_at: string | null;
  created_at: string | null;
};

export type AdminProfile = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  gender: string | null;
  birth_year: string | number | null;
  mbti: string | null;
  phone: string | null;
  archived_at?: string | null;
  archived_reason?: string | null;
  photo_url: string | null;
  public_intro: string | null;
  public_intro_model?: string | null;
  conversation_result_code?: string | null;
  conversation_result_version?: string | null;
  conversation_result_calculated_at?: string | null;
  conversation_result_source?: string | null;
  conversation_result_confidence?: number | null;
  created_at: string | null;
  profile_completed: boolean | null;
  questions_completed: boolean | null;
  questions_completed_at?: string | null;
  basic_info_completed_at?: string | null;
  profile_completed_at?: string | null;
  profile_experience_version?: string | null;
  profile_archetype_id?: string | null;
  profile_archetype_version?: string | null;
  profile_archetype_assigned_at?: string | null;
  is_test_participant?: boolean | null;
  membership_status?: MembershipStatus | null;
  membership_plan?: string | null;
  membership_start_date?: string | null;
  membership_end_date?: string | null;
  membership_purchase_clicked_at?: string | null;
  membership_updated_at?: string | null;
  matching_precision_bonus?: number | null;
  operator_rating?: number | null;
  operator_rating_updated_at?: string | null;
  red_flag_score?: number;
  red_flag_reasons?: RedFlagReason[];
  red_flag_manual_flags?: RedFlagManualFlags;
  red_flag_reviewed_at?: string | null;
  score_temperature?: number | null;
  score_texture?: number | null;
  score_tone?: number | null;
  score_rhythm?: number | null;
  answers?: AdminProfileAnswer[];
  algorithm_parameters?: AdminAlgorithmParameter[];
  active_membership?: boolean;
  expired_membership?: boolean;
  one_time_paid?: boolean;
  has_payment?: boolean;
  payment_history?: AdminPaymentTransaction[];
  details_loaded?: boolean;
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
    operator_rating: profile.operator_rating ?? null,
    operator_rating_updated_at: profile.operator_rating_updated_at ?? null,
    red_flag_score: profile.red_flag_score ?? 0,
    red_flag_reasons: profile.red_flag_reasons ?? [],
    red_flag_manual_flags: profile.red_flag_manual_flags ?? {},
    red_flag_reviewed_at: profile.red_flag_reviewed_at ?? null,
    answers: profile.answers ?? [],
    algorithm_parameters: profile.algorithm_parameters ?? [],
    active_membership: hasActiveMembership(profile),
    expired_membership: hasExpiredMembership(profile),
    one_time_paid: profile.one_time_paid ?? false,
    has_payment: profile.has_payment ?? false,
    payment_history: profile.payment_history ?? [],
    details_loaded: profile.details_loaded ?? false,
  };
}
