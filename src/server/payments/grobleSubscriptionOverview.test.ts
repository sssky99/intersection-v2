import { describe, expect, it } from "vitest";
import {
  projectGrobleSubscriptions,
  reconcileGrobleMemberships,
  type GrobleLedgerEntry,
  type GrobleMemberAccess,
  type GrobleMembershipEffect,
  type GrobleSnapshotRow,
  type GrobleSubscriptionEvent,
} from "./grobleSubscriptionOverview";

const baseline: GrobleSnapshotRow[] = [
  { order: "first", externalId: "firstId", round: 1, payment: "paid", state: "open", buyerGroup: 1 },
  { order: "another", externalId: "anotherId", round: 1, payment: "paid", state: "ending", buyerGroup: 1 },
];
const activation = "2026-10-24T09:00:00.380+09:00";
type EventOptions = {
  round?: number;
  day?: number;
  ref?: string | null;
  activeSince?: string;
  partial?: boolean;
  amount?: number;
};

function event(
  type: string,
  order: string,
  { round = 1, day = 24, ref = "verified-ref", activeSince = activation, partial, amount = 20000 }: EventOptions = {},
): GrobleSubscriptionEvent {
  const time = `2026-11-${day}T09:00:00+09:00`;
  return {
    event_id: `${type}-${order}-${day}`,
    merchant_uid: order,
    event_type: type,
    occurred_at: time,
    buyer_phone_normalized: "01000000001",
    payload: { data: { object: {
      merchantUid: order,
      sellerReference: ref,
      content: { id: "pMT39R" },
      pricing: { finalAmount: 20000 },
      subscription: {
        activatedAt: activeSince,
        currentRound: round,
        refundedRound: round,
        billingReason: round === 1 ? "INITIAL" : "RENEWAL",
      },
      refund: { partialRefund: partial, amount, refundedAt: time },
    } } },
  };
}

const first = event("subscription_payment.completed", "first");
const another = event("subscription_payment.completed", "another", {
  ref: "another-ref", activeSince: "2026-10-25T09:00:00+09:00",
});

describe("paid members with a current entitlement", () => {
  it("counts the same current member once and excludes refunds, missing dates, future starts, expiry and archived accounts", () => {
    const date = "2026-11-24";
    const order = (id: string, payment: "paid" | "refunded" | "partial" = "paid") => ({
      externalId: null, order: id, round: 1, state: "ending" as const, payment,
      buyer: "Provider name", nextBillingDate: null,
    });
    const cases = [
      ["01", "current", "paid"],
      ["09", "current", "paid"],
      ["02", "refunded", "refunded"],
      ["03", "future", "paid"],
      ["04", "expired", "paid"],
      ["05", "archived", "paid"],
      ["06", "undated", "paid"],
      ["07", "partial", "partial"],
      ["08", "mismatch", "paid"],
    ] as const;
    const ledger: GrobleLedgerEntry[] = cases.map(([id, user], index) => ({
      id: index + 1, merchant_uid: id, user_id: user, status: "completed",
    }));
    const effects: GrobleMembershipEffect[] = ledger.map(({ id, merchant_uid, user_id }) => ({
      transaction_id: id, merchant_uid, user_id: user_id === "mismatch" ? "current" : user_id!,
      cancelled_at: user_id === "refunded" ? date : null,
    }));
    const profiles: GrobleMemberAccess[] = [...new Set(cases.map(([, user]) => user))].map((user) => ({
      user_id: user, name: "Member name", membership_status: "active",
      membership_start_date: user === "future" ? "2026-11-25" : "2026-11-01",
      membership_end_date: user === "expired" ? "2026-11-23" : user === "undated" ? null
        : user === "future" ? "2026-12-24" : date,
      archived_at: user === "archived" ? date : null,
    }));
    const { subscribers, rows } = reconcileGrobleMemberships(
      [...cases.map(([id, , payment]) => order(id, payment)), order("unmatched")],
      ledger, effects, profiles, date,
    );
    expect(subscribers).toEqual([
      { ...order("09"), memberName: "Member name", accessEndsOn: date, orderCount: 2 },
    ]);
    expect(rows).toContainEqual({ ...order("unmatched"), membership: "missing" });
    expect(rows).toContainEqual({ ...order("08"), membership: "review" });
    expect(rows).toContainEqual({ ...order("02", "refunded"), membership: "refunded" });
  });
});
const renew = event("subscription_payment.completed", "renewal", {
  round: 2, activeSince: "2026-10-24T09:00:00+09:00",
});

describe("Groble seller subscription overview", () => {
  it("counts the same buyer once, even when two real subscriptions appear", () => {
    const result = projectGrobleSubscriptions(baseline, [first, another], []);
    expect(result).toMatchObject({ paidBuyers: 1, paidSubscriptions: 2, unresolvedEvents: 0 });
    expect(result.rows).toContainEqual(expect.objectContaining({ order: "another", state: "ending" }));
  });

  it("replaces the latest paid order on renewal and ignores duplicate deliveries and refunds of older rounds", () => {
    const refund = event("subscription_payment.refunded", "first", { day: 25, partial: false, ref: null });
    const result = projectGrobleSubscriptions(baseline, [first, another], [refund, renew, renew]);
    expect(result).toMatchObject({ paidBuyers: 1, paidSubscriptions: 2, unresolvedEvents: 0 });
    expect(result.rows).toContainEqual(expect.objectContaining({ order: "renewal", payment: "paid", externalId: "firstId" }));
    expect(result.rows.map(({ order }) => order)).not.toContain("first");
  });

  it("shows a failed attempt and scheduled cancellation, and removes a subscription only when terminated", () => {
    const failed = event("subscription_payment.failed", "failed-attempt", { round: 2 });
    const scheduled = event("subscription.cancel_requested", "first", { day: 25 });
    const terminated = event("subscription.terminated", "first", { day: 26 });
    const project = (events: GrobleSubscriptionEvent[]) =>
      projectGrobleSubscriptions(baseline, [first, another], events);
    expect(project([failed]).rows).toContainEqual(expect.objectContaining({ order: "first", state: "past_due" }));
    expect(project([scheduled, failed]).rows).toContainEqual(expect.objectContaining({ order: "first", state: "ending" }));
    expect(project([terminated, scheduled, failed])).toMatchObject({
      paidBuyers: 1, paidSubscriptions: 1, unresolvedEvents: 0, rows: [expect.objectContaining({ order: "another" })],
    });
  });

  it("excludes a fully refunded latest payment without ending the subscription", () => {
    const half = event("subscription_payment.refunded", "renewal", { day: 25, round: 2, partial: true, amount: 10000, ref: null });
    const rest = event("subscription_payment.refunded", "renewal", { day: 26, round: 2, partial: true, amount: 10000, ref: null });
    const project = (events: GrobleSubscriptionEvent[]) =>
      projectGrobleSubscriptions(baseline, [first, another], events);
    expect(project([renew, half, { ...half, event_id: "partial-redelivery" }]).paidSubscriptions).toBe(2);
    expect(project([rest, half, renew]).paidSubscriptions).toBe(1);
    expect(project([rest, half, renew]).rows).toContainEqual(
      expect.objectContaining({ order: "renewal", state: "open", payment: "refunded" }),
    );
  });

  it("shows an unlinked first purchase but holds an unknown renewal for review", () => {
    const noReference = event("subscription_payment.completed", "new-guest", { ref: null });
    const unknown = event("subscription_payment.completed", "unknown-renewal", { round: 2, ref: null });
    const result = projectGrobleSubscriptions(baseline, [first, another], [noReference, unknown]);
    expect(result).toMatchObject({ paidBuyers: 1, paidSubscriptions: 3, unresolvedEvents: 1 });
    expect(result.rows).toContainEqual(expect.objectContaining({ order: "new-guest", externalId: null }));
    expect(result.rows.map(({ order }) => order)).not.toContain("unknown-renewal");
  });
});
