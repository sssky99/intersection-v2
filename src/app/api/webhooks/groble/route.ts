import { NextResponse } from "next/server";
import { handleVerifiedGrobleWebhook } from "../../../../server/payments/grobleDelivery";
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

  return handleVerifiedGrobleWebhook(envelope, idempotencyKey);
}
