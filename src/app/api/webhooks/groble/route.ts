import { grobleCancelledPaymentKind } from "@/lib/groblePaymentEvent";
import { NextResponse } from "next/server";
import {
  createAdminClient,
  webhookScope,
} from "../../../../server/payments/grobleContext";
import { processMembershipPaymentCancelled } from "../../../../server/payments/grobleMembership";
import {
  eventStatus,
  objectParts,
} from "../../../../server/payments/groblePaymentDetails";
import {
  processCancelRequested,
  processOneTimePaymentCancelled,
  processPaymentCompleted,
} from "../../../../server/payments/groblePayments";
import {
  parseEnvelope,
  verifySignature,
  WebhookEnvelope,
} from "../../../../server/payments/grobleVerification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxBodyBytes = 1024 * 1024;
const signatureToleranceSeconds = 5 * 60;

function validTimestamp(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return false;
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp)) return false;
  return (
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) <=
    signatureToleranceSeconds
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const rawBody = await request.text().catch(() => "");
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const timestamp = request.headers.get("x-groble-timestamp");
  const signatures = [
    request.headers.get("x-groble-signature"),
    request.headers.get("x-groble-signature-previous"),
  ].filter((value): value is string => Boolean(value));
  const idempotencyKey = request.headers
    .get("x-groble-idempotency-key")
    ?.trim();

  if (
    !validTimestamp(timestamp) ||
    signatures.length === 0 ||
    !idempotencyKey
  ) {
    return NextResponse.json(
      { error: "Invalid webhook headers." },
      { status: 401 },
    );
  }

  try {
    if (!verifySignature({ rawBody, timestamp: timestamp!, signatures })) {
      return NextResponse.json(
        { error: "Invalid signature." },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("[groble-webhook] signature configuration error", error);
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  let envelope: WebhookEnvelope | null = null;
  try {
    envelope = parseEnvelope(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }
  if (!envelope) {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

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
          last_error:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Unknown error",
        }).catch(() => undefined);
        return NextResponse.json(
          { error: "Webhook processing failed." },
          { status: 500 },
        );
      }
    },
  );
}
