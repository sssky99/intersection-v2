export type MeetingEventVisibility =
  | "draft"
  | "test_only"
  | "public"
  | "closed"
  | "archived";

export type AdminMeetingProgram = {
  id: string;
  title: string;
};
export type AdminMeetingEvent = {
  id: string;
  program_id: string;
  title: string;
  short_description: string | null;
  event_date: string;
  starts_at: string;
  region: string;
  visibility: MeetingEventVisibility;
  application_opens_at: string | null;
  application_closes_at: string | null;
  capacity: number;
  confirmed_application_count: number;
  price_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type AdminMeetingGroup = {
  id: string;
  event_id: string;
  code: string;
  title: string;
  capacity: number;
  status: "draft" | "ready" | "confirmed" | "cancelled";
  operation_note: string | null;
  assigned_count: number;
};

export type AdminMeetingEventsData = {
  programs: AdminMeetingProgram[];
  events: AdminMeetingEvent[];
  groups: AdminMeetingGroup[];
};
