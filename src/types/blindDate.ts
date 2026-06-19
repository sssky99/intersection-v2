export type BlindDateOfferStatus =
  | "pending_admin"
  | "offered"
  | "waiting_response"
  | "scheduled"
  | "needs_reschedule"
  | "declined"
  | "expired"
  | "cancelled"
  | "completed";

export type BlindDateResponseStatus = "pending" | "yes" | "no";

export type BlindDateSourceType = "mutual_feedback" | "test";

export type BlindDateTemplate = {
  id: string;
  title: string;
  image_url: string | null;
  short_description: string | null;
  time_label: string | null;
  region: string | null;
  guide_text: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type BlindDatePublicTemplate = {
  id: string;
  title: string;
  imageUrl: string | null;
  shortDescription: string | null;
  timeLabel: string | null;
  region: string | null;
  guideText: string | null;
};

export type BlindDateUserOffer = {
  id: string;
  status: BlindDateOfferStatus;
  template: BlindDatePublicTemplate;
  timeLabel: string;
  region: string;
  candidateDates: string[];
  expiresAt: string;
  createdAt: string;
  ownResponse: BlindDateResponseStatus;
  ownAvailableDates: string[];
  scheduledDate: string | null;
  isExpired: boolean;
};

export type BlindDateAdminProfile = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  phone: string | null;
  is_test_participant?: boolean | null;
};

export type BlindDateAdminOffer = {
  id: string;
  status: BlindDateOfferStatus;
  source_type: BlindDateSourceType;
  participant_a_id: string;
  participant_b_id: string;
  template_id: string | null;
  time_label: string;
  region: string;
  candidate_dates: string[];
  a_response: BlindDateResponseStatus;
  b_response: BlindDateResponseStatus;
  a_available_dates: string[];
  b_available_dates: string[];
  scheduled_date: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  participantA: BlindDateAdminProfile | null;
  participantB: BlindDateAdminProfile | null;
  template: BlindDateTemplate | null;
  is_test: boolean;
};

export type BlindDateMutualCandidate = {
  id: string;
  participantA: BlindDateAdminProfile | null;
  participantB: BlindDateAdminProfile | null;
  participantAId: string;
  participantBId: string;
  ticketLabel: string;
  occurredDate: string;
  feedbackAId: string;
  feedbackBId: string;
  ticketInstanceId: string | null;
  ticketTemplateId: string | null;
  aSelectedB: boolean;
  bSelectedA: boolean;
  hasNegativeFeedback: boolean;
  hasNoShowOrMannerIssue: boolean;
  alreadyOffered: boolean;
};
