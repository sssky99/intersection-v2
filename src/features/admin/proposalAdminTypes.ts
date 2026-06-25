import type { VibeScores } from "@/components/vibe/vibeGraphConfig";
import type {
  MeetingAtmosphereAgeBandId,
  MeetingAtmosphereGenderMood,
} from "@/lib/meetingAtmosphere";
import type { MeetingPlace } from "@/types/place";
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
  place: MeetingPlace | null;
  atmosphereGenderMood: MeetingAtmosphereGenderMood | null;
  atmosphereAgeBandId: MeetingAtmosphereAgeBandId | null;
  atmosphereDefaultGenderMood: MeetingAtmosphereGenderMood | null;
  atmosphereDefaultAgeBandId: MeetingAtmosphereAgeBandId | null;
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
  changeRequests: ProposalChangeRequest[];
};

export type ProposalChangeRequest = {
  id: string;
  type: "edit" | "cancel";
  body: string;
  status: "pending_review" | "reviewed" | "approved" | "rejected";
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
