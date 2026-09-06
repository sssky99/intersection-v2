import { grobleCompletedPaymentKind } from "@/lib/groblePaymentEvent";
import { reportMetaPurchase } from "@/lib/metaConversions";
import { createAdminClient } from "./grobleContext";
import {
  ApplicationRow,
  existingApplicationMatch,
  existingMembershipMatch,
  pendingApplicationMatch,
  pendingMembershipMatch,
} from "./grobleMatching";
import {
  PaymentTransactionRow,
  processMembershipPayment,
  syncProfileNameFromPayment,
} from "./grobleMembership";
import { eventStatus, objectParts } from "./groblePaymentDetails";
import { WebhookEnvelope } from "./grobleVerification";

export async function processPaymentCompleted(
  envelope: WebhookEnvelope,
  idempotencyKey: string,
) {
  const details = objectParts(envelope.object);
  const paymentOccurredAt = details.purchasedAt ?? envelope.occurredAt;
  const completedPaymentKind = grobleCompletedPaymentKind(envelope.type);

  if (completedPaymentKind === "membership") {
    const membershipMatch =
      (await existingMembershipMatch(envelope.id)) ??
      (await pendingMembershipMatch({
        ...details,
        paidAt: paymentOccurredAt,
      }));

    if (
      membershipMatch.status === "matched" &&
      membershipMatch.userId &&
      membershipMatch.intentId !== null &&
      membershipMatch.plan
    ) {
      return processMembershipPayment({
        envelope,
        idempotencyKey,
        details,
        match: {
          ...membershipMatch,
          status: "matched",
          userId: membershipMatch.userId,
          intentId: membershipMatch.intentId,
          plan: membershipMatch.plan,
        },
      });
    }

    await eventStatus(idempotencyKey, {
      processing_status: membershipMatch.status,
      matched_user_id: membershipMatch.userId,
      processed_at: new Date().toISOString(),
    });
    return membershipMatch.status;
  }

  const match =
    (await existingApplicationMatch(envelope.id)) ??
    (await pendingApplicationMatch({
      ...details,
      paidAt: paymentOccurredAt,
    }));

  if (match.status !== "matched" || !match.userId || !match.groupId) {
    await eventStatus(idempotencyKey, {
      processing_status: match.status,
      matched_user_id: match.userId,
      processed_at: new Date().toISOString(),
    });
    return match.status;
  }

  const paidAt = paymentOccurredAt ?? new Date().toISOString();
  const admin = createAdminClient();
  const { error: transactionError } = await admin
    .from("payment_transactions")
    .upsert(
      {
        provider: "groble",
        provider_event_id: envelope.id,
        merchant_uid: details.merchantUid,
        user_id: match.userId,
        payment_kind: "one_time",
        product_code: "meeting_date_ticket",
        amount: details.finalAmount,
        status: "completed",
        occurred_at: paidAt,
        application_group_id: match.groupId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_event_id" },
    );
  if (transactionError) throw transactionError;

  const { error: advanceError } = await admin.rpc(
    "advance_paid_meeting_applications",
    {
      p_user_id: match.userId,
      p_group_id: match.groupId,
      p_application_id: null,
      p_merchant_uid: details.merchantUid,
      p_event_id: envelope.id,
      p_paid_at: paidAt,
      p_confirm_deposit: true,
    },
  );
  if (advanceError) throw advanceError;

  const { data: paidApplications, error: paidApplicationsError } = await admin
    .from("meeting_date_applications")
    .select("assigned_ticket_instance_id")
    .eq("application_group_id", match.groupId)
    .eq("user_id", match.userId)
    .not("assigned_ticket_instance_id", "is", null)
    .returns<Array<{ assigned_ticket_instance_id: string | null }>>();
  if (paidApplicationsError) throw paidApplicationsError;

  const paidTicketIds = Array.from(
    new Set(
      (paidApplications ?? [])
        .map((row) => row.assigned_ticket_instance_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (paidTicketIds.length > 0) {
    const { data: paidTicketInstances, error: paidTicketInstancesError } =
      await admin
        .from("ticket_instances")
        .select("id,template_id")
        .in("id", paidTicketIds)
        .returns<Array<{ id: string; template_id: string }>>();
    if (paidTicketInstancesError) throw paidTicketInstancesError;

    const { data: existingInteractions, error: existingInteractionsError } =
      await admin
        .from("ticket_user_interactions")
        .select("ticket_instance_id,opened_at,responded_at,payment_started_at")
        .eq("user_id", match.userId)
        .in("ticket_instance_id", paidTicketIds)
        .returns<
          Array<{
            ticket_instance_id: string;
            opened_at: string | null;
            responded_at: string | null;
            payment_started_at: string | null;
          }>
        >();
    if (existingInteractionsError) throw existingInteractionsError;
    const existingInteractionMap = new Map(
      (existingInteractions ?? []).map((row) => [row.ticket_instance_id, row]),
    );

    const { error: interactionError } = await admin
      .from("ticket_user_interactions")
      .upsert(
        (paidTicketInstances ?? []).map((ticket) => {
          const existing = existingInteractionMap.get(ticket.id);
          return {
            user_id: match.userId,
            ticket_instance_id: ticket.id,
            ticket_template_id: ticket.template_id,
            status: "payment_confirmed",
            opened_at: existing?.opened_at ?? paidAt,
            responded_at: existing?.responded_at ?? paidAt,
            payment_started_at: existing?.payment_started_at ?? paidAt,
            payment_confirmed_at: paidAt,
            updated_at: new Date().toISOString(),
          };
        }),
        { onConflict: "user_id,ticket_instance_id" },
      );
    if (interactionError) throw interactionError;
  }

  await syncProfileNameFromPayment({
    userId: match.userId,
    buyerName: details.buyerName,
  });

  if (match.intentId !== null) {
    const { error: intentUpdateError } = await admin
      .from("meeting_date_payment_intents")
      .update({
        status: "completed",
        ended_at: paidAt,
        completed_at: paidAt,
        groble_payment_event_id: envelope.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.intentId)
      .eq("user_id", match.userId);
    if (intentUpdateError) throw intentUpdateError;
  }

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_application_group_id: match.groupId,
    matched_payment_intent_id: match.intentId,
    payment_kind: "one_time",
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  await reportMetaPurchase(admin, envelope.id);
  return "processed";
}

export async function processCancelRequested(
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
      "id,user_id,payment_kind,amount,application_group_id,membership_payment_intent_id",
    )
    .eq("provider", "groble")
    .eq("merchant_uid", details.merchantUid)
    .limit(2)
    .returns<PaymentTransactionRow[]>();
  if (transactionLookupError) throw transactionLookupError;

  if ((transactions ?? []).length > 1) {
    await eventStatus(idempotencyKey, {
      processing_status: "ambiguous",
      merchant_uid: details.merchantUid,
      processed_at: new Date().toISOString(),
    });
    return "ambiguous";
  }

  const transaction = transactions?.[0] ?? null;
  if (transaction) {
    const cancelRequestedAt =
      details.cancelRequestedAt ??
      envelope.occurredAt ??
      new Date().toISOString();
    const { error: transactionUpdateError } = await admin
      .from("payment_transactions")
      .update({
        status: "cancel_requested",
        cancel_requested_at: cancelRequestedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);
    if (transactionUpdateError) throw transactionUpdateError;

    if (transaction.payment_kind !== "one_time") {
      await eventStatus(idempotencyKey, {
        processing_status: "processed",
        merchant_uid: details.merchantUid,
        matched_user_id: transaction.user_id,
        matched_membership_payment_intent_id:
          transaction.membership_payment_intent_id,
        payment_kind: transaction.payment_kind,
        payment_amount: transaction.amount,
        processed_at: new Date().toISOString(),
      });
      return "processed";
    }
  }

  const { data: rows, error: lookupError } = await admin
    .from("meeting_date_applications")
    .select("application_group_id,user_id,deposit_amount,created_at")
    .eq("groble_merchant_uid", details.merchantUid)
    .limit(20)
    .returns<ApplicationRow[]>();
  if (lookupError) throw lookupError;

  const matches = new Map<string, ApplicationRow>();
  for (const row of rows ?? []) {
    matches.set(`${row.user_id}:${row.application_group_id}`, row);
  }
  if (matches.size !== 1) {
    const status = matches.size === 0 ? "unmatched" : "ambiguous";
    await eventStatus(idempotencyKey, {
      processing_status: status,
      merchant_uid: details.merchantUid,
      processed_at: new Date().toISOString(),
    });
    return status;
  }

  const match = Array.from(matches.values())[0];
  const { error: updateError } = await admin
    .from("meeting_date_applications")
    .update({
      deposit_status: "refund_pending",
      payment_cancel_requested_at:
        details.cancelRequestedAt ??
        envelope.occurredAt ??
        new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("application_group_id", match.application_group_id)
    .eq("user_id", match.user_id);
  if (updateError) throw updateError;

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.user_id,
    matched_application_group_id: match.application_group_id,
    payment_kind: "one_time",
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  return "processed";
}

export async function processOneTimePaymentCancelled(
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
    .select("id,user_id,payment_kind,amount,application_group_id")
    .eq("provider", "groble")
    .eq("merchant_uid", details.merchantUid)
    .eq("payment_kind", "one_time")
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
  const { error: cancellationError } = await admin.rpc(
    "cancel_one_time_payment",
    {
      p_transaction_id: transaction.id,
      p_cancelled_at: cancelledAt,
    },
  );
  if (cancellationError) throw cancellationError;

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: transaction.user_id,
    matched_application_group_id: transaction.application_group_id,
    payment_kind: "one_time",
    payment_amount: transaction.amount,
    processed_at: updatedAt,
  });
  return "processed";
}
