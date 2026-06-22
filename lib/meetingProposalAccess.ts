import { displayMembershipStatus } from "@/features/membership/membershipTypes";

export type MeetingProposalProfileRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  public_intro: string | null;
  public_emoji: string | null;
  membership_status: string | null;
  membership_end_date: string | null;
};

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
