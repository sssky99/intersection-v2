import type { AdminProfile } from "@/features/admin/adminProfile";
import type {
  MeetingAtmosphereAgeBandId,
  MeetingAtmosphereGenderMood,
} from "@/lib/meetingAtmosphere";
import type { MeetingPlace } from "@/types/place";
import type { TicketStageCopy } from "@/types/ticket";

export type AdminTicketCourseStep = {
  id: string;
  order: number;
  title: string | null;
  activityType: string | null;
  imageUrl: string | null;
  placeName: string | null;
  address: string | null;
  place: MeetingPlace | null;
  openOffsetMinutes: number;
  isMainActivity: boolean;
};

export type TicketVisibility =
  | "draft"
  | "test_only"
  | "public"
  | "invite_only"
  | "question"
  | "closed"
  | "archived";

export type PlaceVisibility = "hidden" | "confirmed_only";

export type TicketTemplateScores = {
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
};

export type TicketParticipation = {
  id: number | string;
  ticket_instance_id: string;
  user_id: string;
  status: string;
  applied_at: string | null;
  confirmed_at: string | null;
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
  place_payload: MeetingPlace | null;
  operation_code: string | null;
  operation_note: string | null;
  place_visibility: PlaceVisibility;
  visibility: TicketVisibility;
  remaining_seat_label_count: number;
  minimum_participant_count: number;
  max_participant_count: number;
  created_at: string;
  updated_at: string;
  participant_count: number;
  waitlist_count: number;
  participants: TicketParticipation[];
};

export type AdminTicketTemplate = TicketTemplateScores & {
  id: string;
  template_kind: "experience" | "question_sample";
  lifecycle_status: "active" | "archived";
  title: string;
  short_description: string | null;
  detail_summary: string | null;
  detail_activities: string[];
  detail_flow: string[];
  detail_good_for: string[];
  detail_notice: string | null;
  stage_copy: TicketStageCopy | null;
  image_url: string | null;
  course_steps: AdminTicketCourseStep[];
  mood_tags: string[];
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  atmosphere_gender_mood: MeetingAtmosphereGenderMood | null;
  atmosphere_age_band_id: MeetingAtmosphereAgeBandId | null;
  atmosphere_default_gender_mood: MeetingAtmosphereGenderMood | null;
  atmosphere_default_age_band_id: MeetingAtmosphereAgeBandId | null;
  visibility: TicketVisibility;
  question_order: number | null;
  created_at: string;
  updated_at: string;
  instances: AdminTicketInstance[];
  instance_count: number;
  participant_count: number;
  waitlist_count: number;
};

export const ticketVisibilities: TicketVisibility[] = [
  "draft",
  "test_only",
  "public",
  "invite_only",
  "question",
  "closed",
  "archived",
];

export const ticketVisibilityLabels: Record<TicketVisibility, string> = {
  draft: "미공개",
  test_only: "운영자에게만 공개",
  public: "전체 공개",
  invite_only: "초대 전용",
  question: "샘플 티켓",
  closed: "마감",
  archived: "보관",
};

export const placeVisibilities: PlaceVisibility[] = [
  "hidden",
  "confirmed_only",
];

export const placeVisibilityLabels: Record<PlaceVisibility, string> = {
  hidden: "비공개",
  confirmed_only: "확정 멤버에게 24시간 전 공개",
};

export function isTicketVisibility(value: unknown): value is TicketVisibility {
  return ticketVisibilities.includes(value as TicketVisibility);
}

export function isPlaceVisibility(value: unknown): value is PlaceVisibility {
  return placeVisibilities.includes(value as PlaceVisibility);
}
