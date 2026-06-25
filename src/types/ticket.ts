import type { Gender } from "@/types/user";
import type { MeetingPlace } from "@/types/place";
import type {
  MeetingAtmosphereAgeBandId,
  MeetingAtmosphereGenderMood,
} from "@/lib/meetingAtmosphere";

export const MEETING_MIN_PARTICIPANT_COUNT = 3;
export const MEETING_MAX_PARTICIPANT_COUNT = 6;

export type TicketStageCopy = {
  paymentPending?: string | null;
  waitlisted?: string | null;
  applied?: string | null;
  approved?: string | null;
  preStart?: string | null;
  inProgress?: string | null;
  feedbackOpen?: string | null;
  feedbackTitle?: string | null;
  feedbackBody?: string | null;
};

export type GatheringTicket = {
  id: string;
  templateId: string;
  proposalId?: string | null;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  area: string;
  moodTags: string[];
  activityType?: string | null;
  imageUrl?: string;
  remainingSeatCount?: number;
  minimumParticipantCount?: number;
  maxParticipantCount?: number;
  peopleHint: string;
  reason: string;
  recommendationName?: string;
  recommendationRank?: number;
  recommendationReasons?: string[];
  detailSummary?: string;
  detailActivities?: string[];
  detailFlow?: string[];
  detailGoodFor?: string[];
  detailNotice?: string;
  place?: TicketPlace | null;
  stageCopy?: TicketStageCopy | null;
  proposerLabel?: string;
  proposerProfile?: {
    userId?: string | null;
    displayName: string;
    publicIntro?: string | null;
    publicEmoji?: string | null;
    gender?: Gender | null;
    birthYear?: string | number | null;
  };
  atmosphere?: {
    ageBandId?: MeetingAtmosphereAgeBandId | null;
    genderMood?: MeetingAtmosphereGenderMood | null;
    defaultAgeBandId?: MeetingAtmosphereAgeBandId | null;
    defaultGenderMood?: MeetingAtmosphereGenderMood | null;
    ageBandOverrideId?: MeetingAtmosphereAgeBandId | null;
    genderMoodOverride?: MeetingAtmosphereGenderMood | null;
  } | null;
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
  category?: string | null;
  roadAddress?: string | null;
  jibunAddress?: string | null;
  mapx?: number | null;
  mapy?: number | null;
  link?: string | null;
  source?: MeetingPlace["source"] | null;
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

export type UserTicketsResponse = {
  tickets: UserTicket[];
  participationCount: number;
  proposalParticipationCount: number;
  totalCount?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
};

export type WaitlistRegistration = {
  ticket: GatheringTicket;
  status: "waitlisted" | "payment_pending";
};
