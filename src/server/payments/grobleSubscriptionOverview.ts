import { jsonRecord, text } from "./grobleVerification";
import { hasMembershipAccessOnDate } from "@/features/membership/membershipTypes";

export const grobleMembershipProduct = "pMT39R";
export const grobleSubscriptionEvents = [
  "subscription_payment.completed",
  "subscription_payment.refunded",
  "subscription_payment.failed",
  "subscription.cancel_requested",
  "subscription.terminated",
] as const;

type SubscriptionState = "open" | "ending" | "past_due" | "terminated";
type PaymentState = "paid" | "requested" | "partial" | "refunded";

export type GrobleSnapshotRow = {
  order: string;
  externalId: string;
  round: number;
  state: "open" | "ending";
  payment: PaymentState;
  buyerGroup: number;
};

export type GrobleSubscriptionEvent = {
  event_id: string;
  event_type: string;
  merchant_uid: string | null;
  buyer_phone_normalized: string | null;
  occurred_at: string | null;
  payload: unknown;
  received_at?: string;
  processing_status?: string;
};

type Row = {
  externalId: string | null;
  order: string;
  round: number;
  state: SubscriptionState;
  payment: PaymentState;
  buyer: string | null;
  nextBillingDate: string | null;
  reference: string | null;
  activation: number;
  buyerKey: string;
  amount: number;
  partialRefunds: Map<string, number>;
};

function parse(event: GrobleSubscriptionEvent) {
  const object = jsonRecord(jsonRecord(jsonRecord(event.payload)?.data)?.object);
  const sub = jsonRecord(object?.subscription);
  const refund = jsonRecord(object?.refund);
  return {
    product: text(jsonRecord(object?.content)?.id),
    reference: text(object?.sellerReference),
    activation: Date.parse(text(sub?.activatedAt) ?? ""),
    round: typeof sub?.currentRound === "number" ? sub.currentRound : 0,
    order: text(object?.merchantUid) === event.merchant_uid ? event.merchant_uid : null,
    buyer: text(jsonRecord(object?.buyer)?.displayName),
    nextBillingDate: text(sub?.nextBillingDate),
    amount: Number(jsonRecord(object?.pricing)?.finalAmount ?? 0),
    refundAt: text(refund?.refundedAt),
    refundAmount: Number(refund?.amount ?? 0),
    partial: refund?.partialRefund === true,
    full: refund?.partialRefund === false,
    refundedRound: Number(sub?.refundedRound ?? 0),
    initial: sub?.billingReason === "INITIAL",
  };
}

export function projectGrobleSubscriptions(
  snapshot: GrobleSnapshotRow[],
  sourcePayments: GrobleSubscriptionEvent[],
  laterEvents: GrobleSubscriptionEvent[],
) {
  const sources = new Map(sourcePayments.filter((e) =>
    e.event_type === "subscription_payment.completed").map((e) => [e.merchant_uid, e]));
  const rows: Row[] = snapshot.map((entry) => {
    const source = sources.get(entry.order);
    const original = source ? parse(source) : null;
    return {
      ...entry,
      buyer: original?.buyer ?? null,
      reference: original?.reference ?? null,
      activation: original?.activation ?? NaN,
      buyerKey: source?.buyer_phone_normalized ?? `snapshot:${entry.buyerGroup}`,
      amount: original?.amount ?? 0,
      nextBillingDate: entry.state === "open" ? original?.nextBillingDate ?? null : null,
      partialRefunds: new Map(),
    };
  });
  const byOrder = new Map(rows.map((row) => [row.order, row]));
  const review = new Set<string>();
  const seen = new Set<string>();
  const sorted = [...laterEvents].sort((a, b) =>
    (Date.parse(a.occurred_at ?? "") || 0) - (Date.parse(b.occurred_at ?? "") || 0)
    || grobleSubscriptionEvents.indexOf(a.event_type as typeof grobleSubscriptionEvents[number])
    - grobleSubscriptionEvents.indexOf(b.event_type as typeof grobleSubscriptionEvents[number]));

  for (const event of sorted) {
    if (seen.has(event.event_id)) continue;
    seen.add(event.event_id);
    const parsed = parse(event);
    if (parsed.product !== grobleMembershipProduct) continue;
    if (!parsed.order || !event.occurred_at) {
      review.add(event.event_id);
      continue;
    }
    const matches = parsed.reference
      ? rows.filter((row) => row.reference === parsed.reference
          && Math.abs(row.activation - parsed.activation) < 1000)
      : [];
    const knownOrder = byOrder.get(parsed.order);
    if (matches.length > 1 || (knownOrder && matches.length === 1 && knownOrder !== matches[0])) {
      review.add(event.event_id);
      continue;
    }
    const row = knownOrder ?? matches[0];

    if (event.event_type === "subscription_payment.completed") {
      if (knownOrder) continue;
      if (parsed.round === 1 && parsed.initial && !row) {
        const created: Row = {
          externalId: null, order: parsed.order, round: 1, state: "open", payment: "paid",
          reference: parsed.reference, activation: parsed.activation, buyer: parsed.buyer,
          buyerKey: event.buyer_phone_normalized ?? `order:${parsed.order}`,
          amount: parsed.amount, nextBillingDate: parsed.nextBillingDate,
          partialRefunds: new Map(),
        };
        rows.push(created);
        byOrder.set(created.order, created);
      } else if (row && row.state !== "terminated" && parsed.round > row.round) {
        row.order = parsed.order;
        row.round = parsed.round;
        row.payment = "paid";
        row.state = "open";
        row.amount = parsed.amount;
        row.buyer = parsed.buyer ?? row.buyer;
        row.nextBillingDate = parsed.nextBillingDate;
        row.partialRefunds.clear();
        byOrder.set(row.order, row);
      } else {
        review.add(event.event_id);
      }
      continue;
    }

    if (!row) {
      review.add(event.event_id);
      continue;
    }
    if (event.event_type === "subscription_payment.refunded") {
      // A refund is for one charge. Older rounds cannot change the current payment.
      if (row.order !== parsed.order || row.round !== parsed.refundedRound) continue;
      if (parsed.full && parsed.refundAmount === row.amount && row.amount > 0) {
        row.payment = "refunded";
      } else if (parsed.partial && parsed.refundAt && parsed.refundAmount > 0 && row.amount > 0) {
        row.partialRefunds.set(parsed.refundAt, parsed.refundAmount);
        const refunded = [...row.partialRefunds.values()].reduce((sum, amount) => sum + amount, 0);
        if (row.payment !== "refunded") row.payment = refunded >= row.amount ? "refunded" : "partial";
      } else {
        review.add(event.event_id);
      }
    } else if (event.event_type === "subscription.terminated") {
      row.state = "terminated";
      row.nextBillingDate = null;
    } else if (row.state !== "terminated" && event.event_type === "subscription.cancel_requested") {
      row.state = "ending";
      row.nextBillingDate = null;
    } else if (row.state !== "terminated" && row.state !== "ending"
        && event.event_type === "subscription_payment.failed") {
      row.state = "past_due";
      row.nextBillingDate = null;
    }
  }

  const active = rows.filter((row) => row.state !== "terminated");
  const paid = active.filter((row) => row.payment !== "refunded");
  const paidBuyers = new Set(paid.map((row) => row.buyerKey)).size;
  return {
    paidBuyers,
    paidSubscriptions: paid.length,
    unresolvedEvents: review.size,
    rows: active.map(({ externalId, order, round, state, payment, buyer, nextBillingDate }) =>
      ({ externalId, order, round, state, payment, buyer, nextBillingDate }))
      .sort((a, b) => b.order.localeCompare(a.order)),
  };
}

type Order = ReturnType<typeof projectGrobleSubscriptions>["rows"][number];
export type GrobleLedgerEntry = {
  id: number;
  merchant_uid: string;
  user_id: string | null;
  status: string;
};
export type GrobleMembershipEffect = {
  transaction_id: number;
  merchant_uid: string;
  user_id: string;
  cancelled_at: string | null;
};
export type GrobleMemberAccess = {
  user_id: string;
  name: string | null;
  membership_status: string | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  archived_at: string | null;
};
type MembershipResult = "applied" | "unlinked" | "missing" | "review" | "refunded";
type AccessStatus = "active" | "scheduled" | "ended" | "inactive";

export function grobleSeriesReference(event: GrobleSubscriptionEvent) {
  return parse(event).reference;
}

export function unpostedGrobleRounds(
  latest: GrobleSubscriptionEvent,
  series: GrobleSubscriptionEvent[],
  accountedOrders: ReadonlySet<string>,
) {
  const anchor = parse(latest);
  if (!anchor.reference || !latest.buyer_phone_normalized || !Number.isFinite(anchor.activation)) return [];
  const rounds = new Map<string, { order: string; round: number; paidAt: string | null; amount: number }>();
  for (const event of series) {
    const charge = parse(event);
    if (
      event.event_type !== "subscription_payment.completed" ||
      !charge.order || !charge.round || charge.round > anchor.round ||
      accountedOrders.has(charge.order) ||
      charge.product !== grobleMembershipProduct ||
      charge.reference !== anchor.reference ||
      !(Math.abs(charge.activation - anchor.activation) < 1000) ||
      event.buyer_phone_normalized !== latest.buyer_phone_normalized
    ) continue;
    rounds.set(charge.order, {
      order: charge.order,
      round: charge.round,
      paidAt: event.occurred_at,
      amount: charge.amount,
    });
  }
  return [...rounds.values()].sort((a, b) => a.round - b.round || a.order.localeCompare(b.order));
}

export function reconcileGrobleMemberships(
  orders: Order[],
  ledger: GrobleLedgerEntry[],
  effects: GrobleMembershipEffect[],
  profiles: GrobleMemberAccess[],
  date: string,
) {
  const byOrder = new Map<string, GrobleLedgerEntry[]>();
  for (const payment of ledger) {
    const matches = byOrder.get(payment.merchant_uid) ?? [];
    matches.push(payment);
    byOrder.set(payment.merchant_uid, matches);
  }
  const effectsByTransaction = new Map(effects.map((entry) => [entry.transaction_id, entry]));
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const subscribers = new Map<string, Order & {
    memberName: string | null;
    accessEndsOn: string | null;
    orderCount: number;
  }>();

  const rows = orders.map((row) => {
    const payments = byOrder.get(row.order) ?? [];
    const transaction = payments[0];
    const effect = transaction ? effectsByTransaction.get(transaction.id) : undefined;
    const receiptApplies = Boolean(
      effect && effect.user_id === transaction.user_id &&
      effect.merchant_uid === row.order && !effect.cancelled_at,
    );
    let membership: MembershipResult;
    if (payments.length > 1) membership = "review";
    else if (row.payment === "refunded") membership = receiptApplies ? "review" : "refunded";
    else if (!transaction) membership = "missing";
    else if (!transaction.user_id) membership = "unlinked";
    else if (!["completed", "cancel_requested"].includes(transaction.status) || !receiptApplies) {
      membership = "review";
    } else membership = "applied";

    const profile = transaction?.user_id ? profilesByUser.get(transaction.user_id) : undefined;
    const active = Boolean(
      profile && !profile.archived_at && hasMembershipAccessOnDate({
        status: profile.membership_status,
        startDate: profile.membership_start_date,
        endDate: profile.membership_end_date,
        date,
      }),
    );
    let access: AccessStatus | null = null;
    if (membership === "applied") {
      access = active ? "active" : "inactive";
      if (!active && profile?.membership_status === "active" && !profile.archived_at) {
        if (profile.membership_start_date && profile.membership_start_date > date) access = "scheduled";
        else if (profile.membership_end_date && profile.membership_end_date < date) access = "ended";
      }
    }
    if (
      membership === "applied" && (row.payment === "paid" || row.payment === "requested") &&
      profile && active
    ) {
      const existing = subscribers.get(profile.user_id);
      if (existing && existing.order.localeCompare(row.order) > 0) {
        existing.orderCount += 1;
      } else {
        subscribers.set(profile.user_id, {
          ...row,
          memberName: profile.name ?? row.buyer,
          accessEndsOn: profile.membership_end_date,
          orderCount: (existing?.orderCount ?? 0) + 1,
        });
      }
    }
    return { ...row, membership, access };
  });

  return {
    rows,
    subscribers: [...subscribers.values()].sort((a, b) => b.order.localeCompare(a.order)),
  };
}
