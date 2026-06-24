import { displayMembershipStatus } from "@/features/membership/membershipTypes";
import type { Gender } from "@/types/user";

export type MeetingProposalProfileRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  gender?: Gender | string | null;
  birth_year?: string | number | null;
  public_intro: string | null;
  public_emoji: string | null;
  membership_status: string | null;
  membership_end_date: string | null;
  is_test_participant?: boolean | null;
};

export const meetingProposalRequirementMessage =
  "최소 모임에 한 번 이상 참여한 멤버부터\n모임을 제안할 수 있어요.";

export const meetingProposalEligibleParticipationStatuses = [
  "feedback_done",
] as const;

export function meetingProposalDisplayName(
  profile: Pick<MeetingProposalProfileRow, "name" | "nickname">,
) {
  const nickname = profile.nickname?.trim();
  if (nickname) return nickname;

  const korean = (profile.name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || "멤버";
}

export function hasActiveProposalMembership(
  profile: Pick<
    MeetingProposalProfileRow,
    "membership_status" | "membership_end_date"
  >,
) {
  return (
    displayMembershipStatus({
      status: profile.membership_status,
      endDate: profile.membership_end_date,
    }) === "active"
  );
}

export function isMeetingProposalParticipationStatus(
  status: string | null | undefined,
) {
  return Boolean(
    status &&
      (meetingProposalEligibleParticipationStatuses as readonly string[]).includes(
        status,
      ),
  );
}

export function hasMeetingProposalParticipation(
  participationCount: number | null | undefined,
) {
  return typeof participationCount === "number" && participationCount >= 1;
}

export function isMeetingProposalOperator(
  profile: Pick<MeetingProposalProfileRow, "is_test_participant">,
) {
  return profile.is_test_participant === true;
}

export function safeMeetingProposalFilename(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  const stem = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || "image"}${extension.toLowerCase()}`;
}
