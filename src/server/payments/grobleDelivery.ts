import { grobleCancelledPaymentKind } from "@/lib/groblePaymentEvent";
import { NextResponse } from "next/server";
import { createAdminClient, webhookScope } from "./grobleContext";
import { processMembershipPaymentCancelled } from "./grobleMembership";
import { eventStatus, objectParts } from "./groblePaymentDetails";
import {
  processCancelRequested,
  processOneTimePaymentCancelled,
  processPaymentCompleted,
} from "./groblePayments";
import { WebhookEnvelope } from "./grobleVerification";
import { processPaymentRefunded } from "./grobleRefunds";

export async function handleVerifiedGrobleWebhook(
  envelope: WebhookEnvelope,
  idempotencyKey: string,
) {
  const details = objectParts(envelope.object);
  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("groble_webhook_events")
    .insert({
      event_id: envelope.id,
      idempotency_key: idempotencyKey,
      event_type: envelope.type,
      schema_version: envelope.version,
      occurred_at: envelope.occurredAt,
      merchant_uid: details.merchantUid,
      buyer_phone_normalized: details.buyerPhone,
      payload: envelope.payload,
    });

  if (insertError && insertError.code !== "23505") {
    console.error("[groble-webhook] event insert failed", insertError);
    return NextResponse.json(
      { error: "Event could not be stored." },
      { status: 500 },
    );
  }

  const token = crypto.randomUUID();
  const { data: claims, error: claimError } = await admin.rpc(
    "claim_groble_webhook_event",
    {
      p_event_id: envelope.id,
      p_idempotency_key: idempotencyKey,
      p_token: token,
    },
  );
  const claim = claims?.[0] as
    | { outcome: string; event_key: string | null }
    | undefined;
  if (claimError || !claim) {
    return NextResponse.json(
      { error: "Event could not be claimed." },
      { status: 500 },
    );
  }
  if (claim.outcome === "done")
    return NextResponse.json({ ok: true, duplicate: true });
  if (claim.outcome === "busy") {
    return NextResponse.json(
      { error: "Event is still processing." },
      {
        status: 503,
        headers: { "Retry-After": "30" },
      },
    );
  }
  if (claim.outcome !== "claimed" || !claim.event_key) {
    return NextResponse.json(
      { error: "Conflicting event identity." },
      { status: 409 },
    );
  }
  const eventKey = claim.event_key;
  const event = envelope;
  // Abort this worker's DB requests well before its five-minute claim expires.
  return webhookScope.run(
    { token, signal: AbortSignal.timeout(60_000) },
    async () => {
      try {
        let status: string;
        if (
          event.type === "payment.completed" ||
          event.type === "subscription_payment.completed"
        ) {
          status = await processPaymentCompleted(event, eventKey);
        } else if (
          event.type === "payment.refunded" ||
          event.type === "subscription_payment.refunded"
        ) {
          status = await processPaymentRefunded(event, eventKey);
        } else if (event.type === "payment.cancel_requested") {
          status = await processCancelRequested(event, eventKey);
        } else if (grobleCancelledPaymentKind(event.type) === "one_time") {
          status = await processOneTimePaymentCancelled(event, eventKey);
        } else if (grobleCancelledPaymentKind(event.type) === "membership") {
          status = await processMembershipPaymentCancelled(event, eventKey);
        } else {
          status = "ignored";
          await eventStatus(eventKey, {
            processing_status: status,
            processed_at: new Date().toISOString(),
          });
        }

        return NextResponse.json({ ok: true, status });
      } catch (error) {
        console.error("[groble-webhook] processing failed", error);
        await eventStatus(eventKey, {
          processing_status: "failed",
          last_error: paymentErrorMessage(error),
        }).catch(() => undefined);
        return NextResponse.json(
          { error: "Webhook processing failed." },
          { status: 500 },
        );
      }
    },
  );
}

export function paymentErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? error.message
        : null;
  return typeof message === "string" ? message.slice(0, 1000) : "Unknown error";
}
