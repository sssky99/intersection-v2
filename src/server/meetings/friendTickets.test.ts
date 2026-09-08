import { beforeEach, expect, it, vi } from "vitest";
import type { UserTicket } from "@/types/ticket";
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], reads: 0 }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => {
  const result = { data: table === "profiles" ? [{ photo_url: "friend-photo" }] : state.rows, error: null };
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "update"]) query[method] = () => query;
  query.maybeSingle = async () => ({ data: { phone_normalized: "01011112222" }, error: null });
  query.limit = async () => { state.reads++; return result; };
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
} }) }));
vi.mock("@/lib/solapi", () => ({ readFriendSms: vi.fn(), friendSmsDelivered: vi.fn(() => false) }));
import { attachFriendTickets, ticketApplication } from "./friendTickets";
const application = { id: 7, event_id: "event", assigned_ticket_instance_id: "group", ticket_participation_id: 99 };
const ticket = { waitlistId: "application:7", ticket: { id: "event" } } as UserTicket;
beforeEach(() => { state.reads = 0; state.rows = [{ id: "invite", inviter_id: "sender", application_id: 7, event_id: "event", friend_phone: "01011112222", status: "sent" }]; });
it("preserves friend details when reopening an unassigned ticket", async () => {
  const result = await attachFriendTickets([ticket], [application], "sender");
  expect(result[0].friendInvitation).toEqual({ photoUrl: "friend-photo" });
});
it("also shows the inviter on the receiving friend's ticket", async () => {
  const result = await attachFriendTickets([ticket], [application], "recipient");
  expect(result[0].friendInvitation?.photoUrl).toBe("friend-photo");
});
it("keeps the sender's friend layout but does not read photos for unconfirmed delivery", async () => {
  state.rows[0].status = "unknown";
  expect((await attachFriendTickets([ticket], [application], "sender"))[0].friendInvitation).toEqual({ photoUrl: null });
  expect(state.reads).toBe(0);
  expect((await attachFriendTickets([ticket], [application], "recipient"))[0].friendInvitation).toBeUndefined();
});
it("matches the original application after group assignment and excludes unrelated tickets", () => {
  expect(ticketApplication({ ...ticket, waitlistId: "99" }, [application])).toBe(application);
  expect(ticketApplication({ ...ticket, waitlistId: "other", ticket: { id: "other" } } as UserTicket, [application])).toBeUndefined();
});
