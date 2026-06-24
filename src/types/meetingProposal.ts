import type { VibeScores } from "@/components/vibe/vibeGraphConfig";
import type { MeetingPlace } from "@/types/place";
import type { Gender } from "@/types/user";

export type MeetingProposalStatus =
  | "pending_review"
  | "approved"
  | "converted_to_ticket"
  | "rejected";

export type MeetingProposalImageSource = "pexels" | "user_upload";
export type MeetingProposalImageSelectionMethod = "auto" | "manual";

export type MeetingProposalCoverImage = {
  imageUrl: string | null;
  imageSource: MeetingProposalImageSource;
  imageSelectionMethod: MeetingProposalImageSelectionMethod;
  pexelsPhotoId?: string | null;
  pexelsPageUrl?: string | null;
  photographer?: string | null;
  photographerUrl?: string | null;
  imageReviewModel?: string | null;
};

export type MeetingProposalInput = {
  imageUrl?: string | null;
  coverImage?: MeetingProposalCoverImage | null;
  title: string;
  activityDescription: string;
  eventDate: string;
  eventTime: string;
  region: string;
  specificPlace?: string | null;
  place?: MeetingPlace | null;
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
  gender?: Gender | null;
  birthYear?: string | number | null;
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
  pending_review: "공개 검토 중",
  approved: "검토 승인됨",
  converted_to_ticket: "공개 중",
  rejected: "검토 반려됨",
};
