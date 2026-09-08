import { describe, expect, it } from "vitest";
import { friendApplicationIds, type WaitlistFriendInvitation } from "./friendApplications";

const applications = [
  { id: 1, user_id: "sender", event_id: "event-a" },
  { id: 2, user_id: "recipient", event_id: "event-a" },
  { id: 3, user_id: "recipient", event_id: "event-b" },
  { id: 4, user_id: "solo", event_id: "event-a" },
];
const profiles = [{ user_id: "recipient", phone: "010-1234-5678" }];
const invitation: WaitlistFriendInvitation = { application_id: 1, inviter_id: "sender", event_id: "event-a", friend_phone: "01012345678", status: "sent" };

describe("friend application badges", () => {
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
