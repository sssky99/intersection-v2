import type { VibeScores } from "@/components/vibe/vibeGraphConfig";

export type MeetingProposalStatus =
  | "pending_review"
  | "approved"
  | "converted_to_ticket"
  | "rejected";

export type MeetingProposalInput = {
  imageUrl?: string | null;
  title: string;
  activityDescription: string;
  eventDate: string;
  eventTime: string;
  region: string;
  specificPlace?: string | null;
  userHashtags?: string[];
};

export type MeetingProposalDraft = {
  title: string;
  shortDescription: string;
  hashtags: string[];
  activities: string[];
  vibe: VibeScores;
  flow: string[];
};

export type MeetingProposalPublicProfile = {
  userId?: string | null;
  displayName: string;
  publicIntro?: string | null;
  publicEmoji?: string | null;
};

export type MeetingProposal = MeetingProposalInput &
  MeetingProposalDraft & {
    id: string;
    proposerId: string;
    proposerMembershipStatus: string | null;
    proposerProfile: MeetingProposalPublicProfile;
    proposerRoleAgreed: boolean;
    status: MeetingProposalStatus;
    adminNote: string | null;
    rejectionReason: string | null;
    convertedTemplateId: string | null;
    convertedInstanceId: string | null;
    convertedAt: string | null;
    submittedAt: string;
    createdAt: string;
    updatedAt: string;
  };

export const meetingProposalStatuses: MeetingProposalStatus[] = [
  "pending_review",
  "approved",
  "converted_to_ticket",
  "rejected",
];

export const meetingProposalStatusLabels: Record<
  MeetingProposalStatus,
  string
> = {
  pending_review: "검토 중",
  approved: "초대장으로 준비 중",
  converted_to_ticket: "초대장으로 열렸어요",
  rejected: "이번에는 반영이 어려워요",
};
