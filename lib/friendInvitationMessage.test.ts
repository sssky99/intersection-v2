import { describe, expect, it } from "vitest";
import { buildFriendInvitationMessage, friendInvitationDeadline } from "./friendInvitationMessage";

const input = {
  recipientName: "민예지", inviterName: "김형우", eventDate: "2026-09-18",
  eventTime: "19:00:00", eventTitle: "디너 &\n교집합 시크릿 아지트",
  invitationUrl: "https://interv2.netlify.app/meetings?event=example",
};
describe("friend invitation SMS template", () => {
  it("personalizes the complete approved copy", () => {
    expect(buildFriendInvitationMessage(input)).toBe(`[교집합 초대장 도착]

안녕하세요 민예지님, 친구 분이신 김형우님의 초대가 도착했어요.

9/18 [디너 & 교집합 시크릿 아지트]에 함께하여 김형우님과 색다른 하루를 맞이할 수 있어요!

초대는 9/17일 오후 7시에 마감됩니다.

https://interv2.netlify.app/meetings?event=example

위 링크를 눌러 초대를 수락하고 김형우님과 함께 새로운 사람들을 만나보세요!`);
  });
  it("omits the unknown recipient name", () => {
    expect(buildFriendInvitationMessage({ ...input, recipientName: null })).toContain("안녕하세요, 친구 분이신 김형우님");
  });
  it("handles year boundaries and nonzero minutes in Korean time", () => {
    expect(buildFriendInvitationMessage({ ...input, eventDate: "2027-01-01", eventTime: "00:30" })).toContain("12/31일 오전 12시 30분에 마감됩니다.");
    expect(friendInvitationDeadline("2027-01-01", "00:30").toISOString()).toBe("2026-12-30T15:30:00.000Z");
  });
  it("rejects an invalid schedule instead of sending misleading deadlines", () => {
    expect(() => friendInvitationDeadline("2026-09-18", "25:00")).toThrow();
  });
});
