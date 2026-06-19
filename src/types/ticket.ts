import type { Gender } from "@/types/user";

export type GatheringTicket = {
  id: string;
  templateId: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  area: string;
  moodTags: string[];
  imageUrl?: string;
  remainingSeatCount?: number;
  peopleHint: string;
  reason: string;
  detailSummary?: string;
  detailActivities?: string[];
  detailGoodFor?: string[];
  detailNotice?: string;
  vibeScores?: {
    temperature?: number | null;
    texture?: number | null;
    tone?: number | null;
    rhythm?: number | null;
    alcohol?: number | null;
    romance?: number | null;
  };
};

export type AvailableDate = {
  id: string;
  date: string;
  label: string;
  tickets: GatheringTicket[];
};

export type UserTicketStatus =
  | "payment_pending"
  | "waitlisted"
  | "approved"
  | "in_progress"
  | "feedback_open";

export type HiddenUserTicketStatus =
  | "feedback_done"
  | "cancelled"
  | "not_selected"
  | "completed";

export type TicketArrivalStatus =
  | "on_time"
  | "late_10"
  | "late_20"
  | "late_30_plus";

export type TicketProgressStep =
  | "applied"
  | "approved"
  | "pre_start"
  | "in_progress"
  | "feedback";

export type TicketMemberIntro = {
  id: string;
  name: string | null;
  nickname: string | null;
  gender: Gender | null;
  emoji: string;
  publicIntro: string | null;
  arrivalStatus: TicketArrivalStatus | null;
  arrivalStatusUpdatedAt: string | null;
  isSelf: boolean;
};

export type TicketPlace = {
  name: string | null;
  address: string | null;
};

export type UserTicket = {
  id: string;
  waitlistId: string;
  ticket: GatheringTicket;
  rawStatus: string;
  status: UserTicketStatus;
  statusLabel: string;
  progressStep: TicketProgressStep;
  progressIndex: number;
  meetingStartAt: string | null;
  arrivalOpensAt: string | null;
  feedbackOpensAt: string | null;
  canSetArrival: boolean;
  arrivalStatus: TicketArrivalStatus | null;
  arrivalStatusUpdatedAt: string | null;
  place: TicketPlace | null;
  members: TicketMemberIntro[];
};

export type WaitlistRegistration = {
  ticket: GatheringTicket;
  status: "waitlisted" | "payment_pending";
};
