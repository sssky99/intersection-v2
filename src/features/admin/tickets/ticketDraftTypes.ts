"use client";
import {
  type PlaceVisibility,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";
import type { MeetingPlace } from "@/types/place";

export type TicketCourseStepDraft = {
  id: string;
  order: number;
  title: string;
  activityType: string;
  imageUrl: string;
  placeName: string;
  address: string;
  place: MeetingPlace | null;
  openOffsetMinutes: string;
  isMainActivity: boolean;
};

export type TicketDraft = {
  templateKind: "experience" | "question_sample";
  title: string;
  shortDescription: string;
  detailSummary: string;
  detailActivities: string;
  detailFlow: string;
  detailGoodFor: string;
  detailNotice: string;
  stagePaymentPendingText: string;
  stageWaitlistedText: string;
  stageAppliedText: string;
  stageApprovedText: string;
  stagePreStartText: string;
  stageInProgressText: string;
  stageFeedbackOpenText: string;
  feedbackTitle: string;
  feedbackBody: string;
  imageUrl: string;
  courseSteps: TicketCourseStepDraft[];
  moodTags: string;
  activityType: string;
  recommendationCopy: string;
  recommendationPreferredActivities: string[];
  recommendationRecentInterests: string[];
  eventDate: string;
  eventTime: string;
  region: string;
  placeName: string;
  address: string;
  place: MeetingPlace | null;
  atmosphereGenderMood: string;
  atmosphereAgeBandId: string;
  operationCode: string;
  operationNote: string;
  placeVisibility: PlaceVisibility;
  visibility: TicketVisibility;
  questionOrder: string;
  remainingSeatLabelCount: string;
  minimumParticipantCount: string;
  maxParticipantCount: string;
};
