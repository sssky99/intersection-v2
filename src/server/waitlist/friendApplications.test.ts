import { describe, expect, it } from "vitest";
import { friendApplicationIds, friendApplicationNames, type WaitlistFriendInvitation } from "./friendApplications";

const applications = [
  { id: 1, user_id: "sender", event_id: "event-a" },
  { id: 2, user_id: "recipient", event_id: "event-a" },
  { id: 3, user_id: "recipient", event_id: "event-b" },
  { id: 4, user_id: "solo", event_id: "event-a" },
];
const profiles = [{ user_id: "recipient", phone: "010-1234-5678" }];
const invitation: WaitlistFriendInvitation = { application_id: 1, inviter_id: "sender", event_id: "event-a", friend_phone: "01012345678", status: "sent" };

describe("friend application badges", () => {
  it("shows the counterpart's name on each side, even before the friend applies", () => {
    const namedProfiles = [{ ...profiles[0], name: "박동훈" }, { user_id: "sender", phone: "01099998888", name: "문하늘" }];
    expect([...friendApplicationNames(applications, namedProfiles, [invitation])]).toEqual([["1", "박동훈"], ["2", "문하늘"]]);
    expect(friendApplicationNames([applications[0]], namedProfiles, [invitation]).get("1")).toBe("박동훈");
  });
  it("does not guess a name when matching accounts have different names", () => {
    const ambiguous = [{ ...profiles[0], name: "A" }, { user_id: "duplicate", phone: profiles[0].phone, name: "B" }];
    expect(friendApplicationNames(applications, ambiguous, [invitation]).get("1")).toBe("이름 미확인");
  });
  it("marks both friends only for the invited event", () => {
    expect([...friendApplicationIds(applications, profiles, [invitation])]).toEqual(["1", "2"]);
  });
  it("keeps sender intent visible but does not mark a recipient before delivery", () => {
    expect([...friendApplicationIds(applications, profiles, [{ ...invitation, status: "failed" }])]).toEqual(["1"]);
  });
  it("does not carry the sender badge to a changed event or unrelated application", () => {
    expect([...friendApplicationIds([{ ...applications[0], event_id: "event-b" }, { ...applications[0], id: 5 }], profiles, [invitation])]).toEqual([]);
  });
  it("keeps ordinary applications unmarked without a real invitation", () => {
    expect(friendApplicationIds(applications, profiles, []).size).toBe(0);
  });
});
