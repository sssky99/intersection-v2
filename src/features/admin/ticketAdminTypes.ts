import type { AdminProfile } from "@/features/admin/adminProfile";
import type { TicketStageCopy } from "@/types/ticket";

export type TicketVisibility =
  | "draft"
  | "test_only"
  | "public"
  | "question"
  | "closed"
  | "archived";

export type PlaceVisibility = "hidden" | "confirmed_only" | "public";

export type TicketTemplateScores = {
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
};

export type TicketAssignment = {
  id: string;
  ticket_instance_id: string;
  profile_id: string;
  assigned_at: string;
  profile: AdminProfile | null;
};

export type AdminTicketWaitlistEntry = {
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string;
};

export type AdminTicketInstance = {
  id: string;
  template_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
  operation_code: string | null;
  operation_note: string | null;
  place_visibility: PlaceVisibility;
  visibility: TicketVisibility;
  remaining_seat_label_count: number;
  created_at: string;
  updated_at: string;
  assignment_count: number;
  waitlist_count: number;
  assignments: TicketAssignment[];
};

export type AdminTicketTemplate = TicketTemplateScores & {
  id: string;
  title: string;
  short_description: string | null;
  detail_summary: string | null;
  detail_activities: string[];
  detail_flow: string[];
  detail_good_for: string[];
  detail_notice: string | null;
  stage_copy: TicketStageCopy | null;
  image_url: string | null;
  mood_tags: string[];
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
  place_visibility: PlaceVisibility;
  operation_code: string | null;
  operation_note: string | null;
  remaining_seat_label_count: number;
  max_participant_count: number;
  visibility: TicketVisibility;
  question_order: number | null;
  proposal_id: string | null;
  proposal_proposer_id: string | null;
  proposer_user_id: string | null;
  proposer_display_name: string | null;
  proposer_public_intro: string | null;
  proposer_public_emoji: string | null;
  created_at: string;
  updated_at: string;
  instances: AdminTicketInstance[];
  instance_count: number;
  assignment_count: number;
  waitlist_count: number;
};

export const ticketVisibilities: TicketVisibility[] = [
  "draft",
  "test_only",
  "public",
  "question",
  "closed",
  "archived",
];

export const ticketVisibilityLabels: Record<TicketVisibility, string> = {
  draft: "미공개",
  test_only: "운영자에게만 공개",
  public: "전체 공개",
  question: "샘플 티켓",
  closed: "마감",
  archived: "보관",
};

export const placeVisibilities: PlaceVisibility[] = [
  "hidden",
  "confirmed_only",
  "public",
];

export const placeVisibilityLabels: Record<PlaceVisibility, string> = {
  hidden: "비공개",
  confirmed_only: "확정 멤버에게만 공개",
  public: "전체 공개",
};

export function isTicketVisibility(value: unknown): value is TicketVisibility {
  return ticketVisibilities.includes(value as TicketVisibility);
}

export function isPlaceVisibility(value: unknown): value is PlaceVisibility {
  return placeVisibilities.includes(value as PlaceVisibility);
}
