import type { MembershipPlan } from "@/features/membership/membershipTypes";
import { reportMetaPurchase } from "@/lib/metaConversions";
import { createAdminClient } from "./grobleContext";
import { eventStatus, objectParts } from "./groblePaymentDetails";
import { WebhookEnvelope } from "./grobleVerification";

export type MatchedMembershipPayment = {
  status: "matched";
  userId: string;
  intentId: number | string;
  plan: MembershipPlan;
  creditAmount: number;
};

export type PaymentKind =
  | "one_time"
  | "membership_initial"
  | "membership_upgrade"
  | "membership_renewal";

export type PaymentTransactionRow = {
  id: number | string;
  user_id: string | null;
  payment_kind: PaymentKind | "unknown";
  amount: number;
  occurred_at: string;
  application_group_id: string | null;
  membership_payment_intent_id: number | string | null;
};

type MembershipPaymentResult = {
  outcome: "applied" | "already_applied" | "cancelled";
  payment_kind: PaymentKind;
  transaction_id: number;
};

export async function processMembershipPayment({
  envelope,
  idempotencyKey,
  details,
  match,
}: {
  envelope: WebhookEnvelope;
  idempotencyKey: string;
  details: ReturnType<typeof objectParts>;
  match: MatchedMembershipPayment;
}) {
  if (
    details.finalAmount === null ||
    !Number.isSafeInteger(details.finalAmount)
  ) {
    throw new Error("Membership payment amount is missing or invalid.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_membership_payment", {
    p_user_id: match.userId,
    p_intent_id: match.intentId,
    p_event_id: envelope.id,
    p_merchant_uid: details.merchantUid,
    p_amount: details.finalAmount,
    p_paid_at:
      details.purchasedAt ?? envelope.occurredAt ?? new Date().toISOString(),
    p_buyer_name: details.buyerName,
  });
  if (error) throw error;
  const result = data as MembershipPaymentResult | null;
  if (!result?.transaction_id || !result.payment_kind)
    throw new Error("Membership payment result is missing.");
  // If acknowledgement fails, redelivery reads the durable receipt rather than
  // extending the period again. Advertising delivery stays outside the DB transaction.
  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_membership_payment_intent_id: match.intentId,
    payment_kind: result.payment_kind,
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  if (result.outcome !== "cancelled")
    await reportMetaPurchase(admin, envelope.id);
  return "processed";
}

export async function syncProfileNameFromPayment({
  userId,
  buyerName,
}: {
  userId: string;
  buyerName: string | null;
}) {
  const normalizedBuyerName = buyerName?.trim();
  if (!normalizedBuyerName) return;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("name,nickname")
    .eq("user_id", userId)
    .maybeSingle<{ name: string | null; nickname: string | null }>();
  if (profileError) throw profileError;
  if (!profile) return;

  const currentName = profile.name?.trim() ?? "";
  if (currentName === normalizedBuyerName) return;

  const nickname = profile.nickname?.trim() || currentName || null;
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      name: normalizedBuyerName,
      nickname,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updateError) throw updateError;
}

export async function processMembershipPaymentCancelled(
  envelope: WebhookEnvelope,
  idempotencyKey: string,
) {
  const details = objectParts(envelope.object);
  if (!details.merchantUid) {
    await eventStatus(idempotencyKey, {
      processing_status: "unmatched",
      processed_at: new Date().toISOString(),
    });
    return "unmatched";
  }

  const admin = createAdminClient();
  const { data: transactions, error: transactionLookupError } = await admin
    .from("payment_transactions")
    .select(
      "id,user_id,payment_kind,amount,occurred_at,application_group_id,membership_payment_intent_id",
    )
    .eq("provider", "groble")
    .eq("merchant_uid", details.merchantUid)
    .in("payment_kind", [
      "membership_initial",
      "membership_upgrade",
      "membership_renewal",
    ])
    .limit(2)
    .returns<PaymentTransactionRow[]>();
  if (transactionLookupError) throw transactionLookupError;

  if ((transactions ?? []).length !== 1) {
    const status =
      (transactions ?? []).length === 0 ? "unmatched" : "ambiguous";
    await eventStatus(idempotencyKey, {
      processing_status: status,
      merchant_uid: details.merchantUid,
      processed_at: new Date().toISOString(),
    });
    return status;
  }

  const transaction = transactions![0];
  const cancelledAt =
    details.cancelledAt ?? envelope.occurredAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const { error } = await admin.rpc("cancel_membership_payment", {
    p_transaction_id: transaction.id,
    p_cancelled_at: cancelledAt,
  });
  if (error) throw error;

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: transaction.user_id,
    matched_membership_payment_intent_id:
      transaction.membership_payment_intent_id,
    payment_kind: transaction.payment_kind,
    payment_amount: transaction.amount,
    processed_at: updatedAt,
  });
  return "processed";
}
export {
  eventStatus,
  normalizePhone,
  number,
  objectParts,
} from "./groblePaymentDetails";
