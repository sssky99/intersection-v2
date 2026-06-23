import type { VibeScores } from "@/components/vibe/vibeGraphConfig";
import type {
  MeetingProposalStatus,
  MeetingProposalPublicProfile,
} from "@/types/meetingProposal";

export type AdminMeetingProposal = {
  id: string;
  proposerId: string;
  proposerMembershipStatus: string | null;
  proposerCurrentMembershipStatus: string | null;
  proposerProfile: MeetingProposalPublicProfile;
  imageUrl: string | null;
  originalImageUrl: string | null;
  title: string;
  activityDescription: string;
  eventDate: string;
  eventTime: string;
  region: string;
  specificPlace: string | null;
  hashtags: string[];
  shortDescription: string;
  activities: string[];
  vibe: VibeScores;
  flow: string[];
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
