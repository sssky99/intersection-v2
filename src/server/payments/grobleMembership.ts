import {
  calculateMembershipEndDate,
  hasCurrentMembershipAccess,
  todayKoreaDateString,
  type MembershipPlan,
} from "@/features/membership/membershipTypes";
import { incrementMembershipApplicationCounter } from "@/lib/membershipApplicationCounter";
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

export type MembershipProfileRow = {
  membership_status: string | null;
  membership_plan: MembershipPlan | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  membership_updated_at: string | null;
};

export async function membershipPaymentKind({
  userId,
  creditAmount,
}: {
  userId: string;
  creditAmount: number;
}): Promise<PaymentKind> {
  if (creditAmount > 0) return "membership_upgrade";

  const { count, error } = await createAdminClient()
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("payment_kind", [
      "membership_initial",
      "membership_upgrade",
      "membership_renewal",
    ]);
  if (error) throw error;
  return (count ?? 0) > 0 ? "membership_renewal" : "membership_initial";
}

export function addDateOnlyDays(value: string, days: number) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function sameInstant(left: string | null, right: string) {
  if (!left) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime === rightTime
  );
}

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
  if (details.finalAmount === null) {
    throw new Error("Membership payment amount is missing.");
  }

  const paidAt =
    details.purchasedAt ?? envelope.occurredAt ?? new Date().toISOString();
  const paymentKind = await membershipPaymentKind({
    userId: match.userId,
    creditAmount: match.creditAmount,
  });
  const admin = createAdminClient();
  const { data: existingTransaction, error: existingTransactionError } =
    await admin
      .from("payment_transactions")
      .select("payment_kind")
      .eq("provider", "groble")
      .eq("provider_event_id", envelope.id)
      .maybeSingle<{ payment_kind: PaymentKind }>();
  if (existingTransactionError) throw existingTransactionError;
  const resolvedPaymentKind = existingTransaction?.payment_kind ?? paymentKind;
  const { data: membershipIntent, error: membershipIntentError } = await admin
    .from("membership_payment_intents")
    .select("meeting_date_application_id,opened_at")
    .eq("id", match.intentId)
    .eq("user_id", match.userId)
    .single<{
      meeting_date_application_id: number | string | null;
      opened_at: string;
    }>();
  if (membershipIntentError) throw membershipIntentError;

  let linkedApplicationId = membershipIntent.meeting_date_application_id;
  if (linkedApplicationId === null) {
    const openedAt = new Date(membershipIntent.opened_at);
    if (Number.isFinite(openedAt.getTime())) {
      const compatibilityWindowStart = new Date(
        openedAt.getTime() - 15 * 60 * 1000,
      ).toISOString();
      const { data: compatibilityApplications, error: compatibilityError } =
        await admin
          .from("meeting_date_applications")
          .select("id")
          .eq("user_id", match.userId)
          .eq("status", "payment_pending")
          .eq("deposit_status", "payment_pending")
          .gte("created_at", compatibilityWindowStart)
          .lte("created_at", membershipIntent.opened_at)
          .order("created_at", { ascending: false })
          .limit(2)
          .returns<Array<{ id: number | string }>>();
      if (compatibilityError) throw compatibilityError;
      if (compatibilityApplications?.length === 1) {
        linkedApplicationId = compatibilityApplications[0].id;
      }
    }
  }

  const { error: transactionError } = await admin
    .from("payment_transactions")
    .upsert(
      {
        provider: "groble",
        provider_event_id: envelope.id,
        merchant_uid: details.merchantUid,
        user_id: match.userId,
        payment_kind: resolvedPaymentKind,
        product_code: `membership:${match.plan}`,
        amount: details.finalAmount,
        status: "completed",
        occurred_at: paidAt,
        membership_payment_intent_id: match.intentId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_event_id" },
    );
  if (transactionError) throw transactionError;

  const { error: intentUpdateError } = await admin
    .from("membership_payment_intents")
    .update({
      status: "completed",
      ended_at: paidAt,
      completed_at: paidAt,
      groble_payment_event_id: envelope.id,
      meeting_date_application_id: linkedApplicationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.intentId)
    .eq("user_id", match.userId);
  if (intentUpdateError) throw intentUpdateError;

  let linkedTicketInstanceId: string | null = null;
  let linkedMeetingDate: string | null = null;
  if (linkedApplicationId !== null) {
    const { data: linkedApplication, error: linkedApplicationError } =
      await admin
        .from("meeting_date_applications")
        .select("id,status,meeting_date,assigned_ticket_instance_id")
        .eq("id", linkedApplicationId)
        .eq("user_id", match.userId)
        .maybeSingle<{
          id: number | string;
          status: string;
          meeting_date: string;
          assigned_ticket_instance_id: string | null;
        }>();
    if (linkedApplicationError) throw linkedApplicationError;
    if (!linkedApplication) {
      throw new Error("Linked meeting date application was not found.");
    }

    linkedTicketInstanceId = linkedApplication.assigned_ticket_instance_id;
    linkedMeetingDate = linkedApplication.meeting_date;
    const { error: advanceError } = await admin.rpc(
      "advance_paid_meeting_applications",
      {
        p_user_id: match.userId,
        p_group_id: null,
        p_application_id: linkedApplication.id,
        p_merchant_uid: details.merchantUid,
        p_event_id: envelope.id,
        p_paid_at: paidAt,
        p_confirm_deposit: false,
      },
    );
    if (advanceError) throw advanceError;
  }

  const { data: membershipProfile, error: membershipProfileError } = await admin
    .from("profiles")
    .select(
      "membership_status,membership_plan,membership_start_date,membership_end_date,membership_updated_at",
    )
    .eq("user_id", match.userId)
    .single<MembershipProfileRow>();
  if (membershipProfileError) throw membershipProfileError;

  const alreadyApplied = sameInstant(
    membershipProfile.membership_updated_at,
    paidAt,
  );
  const previouslyActive = hasCurrentMembershipAccess({
    status: membershipProfile.membership_status,
    startDate: membershipProfile.membership_start_date,
    endDate: membershipProfile.membership_end_date,
  });
  const paidAtDate = new Date(paidAt);
  const paidDate = todayKoreaDateString(
    Number.isFinite(paidAtDate.getTime()) ? paidAtDate : new Date(),
  );
  const isRenewal =
    resolvedPaymentKind === "membership_renewal" &&
    previouslyActive &&
    Boolean(membershipProfile.membership_end_date);
  const periodBaseDate = isRenewal
    ? addDateOnlyDays(membershipProfile.membership_end_date!, 1)
    : (linkedMeetingDate ?? paidDate);
  const membershipStartDate = isRenewal
    ? (membershipProfile.membership_start_date ?? paidDate)
    : periodBaseDate;
  const membershipEndDate = alreadyApplied
    ? (membershipProfile.membership_end_date ??
      calculateMembershipEndDate(periodBaseDate, match.plan))
    : calculateMembershipEndDate(periodBaseDate, match.plan);

  const { error: membershipUpdateError } = await admin
    .from("profiles")
    .update({
      membership_status: "active",
      membership_plan: match.plan,
      membership_start_date: membershipStartDate,
      membership_end_date: membershipEndDate,
      membership_updated_at: paidAt,
    })
    .eq("user_id", match.userId);
  if (membershipUpdateError) throw membershipUpdateError;

  if (!previouslyActive && !alreadyApplied) {
    await incrementMembershipApplicationCounter(admin, match.userId);
  }

  const ticketInteractionQuery = admin
    .from("ticket_user_interactions")
    .select(
      "ticket_instance_id,ticket_template_id,opened_at,responded_at,payment_started_at",
    )
    .eq("user_id", match.userId);
  const {
    data: pendingTicketInteraction,
    error: pendingTicketInteractionError,
  } = linkedTicketInstanceId
    ? await ticketInteractionQuery
        .eq("ticket_instance_id", linkedTicketInstanceId)
        .maybeSingle<{
          ticket_instance_id: string;
          ticket_template_id: string;
          opened_at: string | null;
          responded_at: string | null;
          payment_started_at: string | null;
        }>()
    : await ticketInteractionQuery
        .eq("status", "payment_pending")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          ticket_instance_id: string;
          ticket_template_id: string;
          opened_at: string | null;
          responded_at: string | null;
          payment_started_at: string | null;
        }>();
  if (pendingTicketInteractionError) throw pendingTicketInteractionError;

  if (pendingTicketInteraction) {
    const { error: interactionError } = await admin
      .from("ticket_user_interactions")
      .upsert(
        {
          user_id: match.userId,
          ticket_instance_id: pendingTicketInteraction.ticket_instance_id,
          ticket_template_id: pendingTicketInteraction.ticket_template_id,
          status: "payment_confirmed",
          opened_at: pendingTicketInteraction.opened_at ?? paidAt,
          responded_at: pendingTicketInteraction.responded_at ?? paidAt,
          payment_started_at:
            pendingTicketInteraction.payment_started_at ?? paidAt,
          payment_confirmed_at: paidAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,ticket_instance_id" },
      );
    if (interactionError) throw interactionError;
  }

  await syncProfileNameFromPayment({
    userId: match.userId,
    buyerName: details.buyerName,
  });

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_membership_payment_intent_id: match.intentId,
    payment_kind: resolvedPaymentKind,
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
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

  const { error: transactionUpdateError } = await admin
    .from("payment_transactions")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAt,
      updated_at: updatedAt,
    })
    .eq("id", transaction.id);
  if (transactionUpdateError) throw transactionUpdateError;

  if (transaction.membership_payment_intent_id !== null) {
    const { error: intentUpdateError } = await admin
      .from("membership_payment_intents")
      .update({
        status: "cancelled",
        ended_at: cancelledAt,
        updated_at: updatedAt,
      })
      .eq("id", transaction.membership_payment_intent_id);
    if (intentUpdateError) throw intentUpdateError;
  }

  // A refund for an older membership payment must not revoke a membership that
  // was activated by a newer payment. membership_updated_at is set to the
  // transaction occurrence time whenever a membership payment is applied.
  if (transaction.user_id) {
    const { data: profile, error: profileLookupError } = await admin
      .from("profiles")
      .select("membership_updated_at")
      .eq("user_id", transaction.user_id)
      .maybeSingle<{ membership_updated_at: string | null }>();
    if (profileLookupError) throw profileLookupError;

    if (
      profile &&
      sameInstant(profile.membership_updated_at, transaction.occurred_at)
    ) {
      const { error: membershipUpdateError } = await admin
        .from("profiles")
        .update({
          membership_status: "cancelled",
          membership_updated_at: cancelledAt,
        })
        .eq("user_id", transaction.user_id)
        .eq("membership_updated_at", profile.membership_updated_at!);
      if (membershipUpdateError) throw membershipUpdateError;
    }
  }

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
