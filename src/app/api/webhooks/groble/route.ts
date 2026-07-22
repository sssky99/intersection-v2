import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxBodyBytes = 1024 * 1024;
const signatureToleranceSeconds = 5 * 60;
const activeApplicationStatuses = [
  "payment_pending",
  "waitlisted",
  "on_hold",
  "approved",
] as const;

type JsonRecord = Record<string, unknown>;
type WebhookEnvelope = {
  id: string;
  type: string;
  version: string | null;
  occurredAt: string | null;
  object: JsonRecord;
  payload: JsonRecord;
};
type ProfileRow = {
  user_id: string;
};
type ApplicationRow = {
  application_group_id: string;
  user_id: string;
  deposit_amount: number;
  created_at: string;
};

function jsonRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePhone(value: unknown) {
  let digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

function parseEnvelope(rawBody: string): WebhookEnvelope | null {
  const parsed = jsonRecord(JSON.parse(rawBody) as unknown);
  const data = jsonRecord(parsed?.data);
  const object = jsonRecord(data?.object);
  const id = text(parsed?.id);
  const type = text(parsed?.type);

  if (!parsed || !object || !id || !type) return null;

  return {
    id,
    type,
    version: text(parsed.version),
    occurredAt: text(parsed.occurredAt),
    object,
    payload: parsed,
  };
}

function validTimestamp(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return false;
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= signatureToleranceSeconds;
}

function matchesSignature(signature: string, expected: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const actualBuffer = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected.toLowerCase(), "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function verifySignature({
  rawBody,
  timestamp,
  signatures,
}: {
  rawBody: string;
  timestamp: string;
  signatures: string[];
}) {
  const secrets = [
    process.env.GROBLE_WEBHOOK_SECRET,
    process.env.GROBLE_WEBHOOK_SECRET_PREVIOUS,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (secrets.length === 0) {
    throw new Error("GROBLE_WEBHOOK_SECRET is not configured.");
  }

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");
    return signatures.some((signature) => matchesSignature(signature, expected));
  });
}

function objectParts(object: JsonRecord) {
  const buyer = jsonRecord(object.buyer);
  const pricing = jsonRecord(object.pricing);
  const payment = jsonRecord(object.payment);
  const cancelRequest = jsonRecord(object.cancelRequest);

  return {
    merchantUid: text(object.merchantUid),
    buyerPhone: normalizePhone(buyer?.phoneNumber),
    buyerName:
      text(buyer?.name) ??
      text(buyer?.fullName) ??
      text(buyer?.buyerName) ??
      text(object.buyerName),
    finalAmount: number(pricing?.finalAmount),
    purchasedAt: text(payment?.purchasedAt),
    cancelRequestedAt: text(cancelRequest?.requestedAt),
  };
}

async function eventStatus(
  idempotencyKey: string,
  values: Record<string, unknown>,
) {
  const { error } = await createAdminClient()
    .from("groble_webhook_events")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("idempotency_key", idempotencyKey);
  if (error) throw error;
}

async function pendingApplicationMatch({
  buyerPhone,
  finalAmount,
}: {
  buyerPhone: string | null;
  finalAmount: number | null;
}) {
  if (!buyerPhone || finalAmount === null) {
    return { status: "unmatched" as const, userId: null, groupId: null };
  }

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id")
    .eq("phone_normalized", buyerPhone)
    .limit(2)
    .returns<ProfileRow[]>();
  if (profileError) throw profileError;
  if (!profiles || profiles.length === 0) {
    return { status: "unmatched" as const, userId: null, groupId: null };
  }
  if (profiles.length > 1) {
    return { status: "ambiguous" as const, userId: null, groupId: null };
  }

  const userId = profiles[0].user_id;
  const { data: applications, error: applicationError } = await admin
    .from("meeting_date_applications")
    .select("application_group_id,user_id,deposit_amount,created_at")
    .eq("user_id", userId)
    .eq("deposit_status", "payment_pending")
    .eq("deposit_amount", finalAmount)
    .in("status", [...activeApplicationStatuses])
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<ApplicationRow[]>();
  if (applicationError) throw applicationError;

  const latestGroupId = applications?.[0]?.application_group_id ?? null;
  if (!latestGroupId) {
    return { status: "unmatched" as const, userId, groupId: null };
  }

  // A previous cancelled payment can leave an older application in
  // payment_pending. The query is newest-first, so bind a new payment to the
  // most recently created eligible application group.
  return { status: "matched" as const, userId, groupId: latestGroupId };
}

async function syncProfileNameFromPayment({
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

async function processPaymentCompleted(
  envelope: WebhookEnvelope,
  idempotencyKey: string,
) {
  const details = objectParts(envelope.object);
  const match = await pendingApplicationMatch(details);

  if (match.status !== "matched" || !match.userId || !match.groupId) {
    await eventStatus(idempotencyKey, {
      processing_status: match.status,
      matched_user_id: match.userId,
      processed_at: new Date().toISOString(),
    });
    return match.status;
  }

  const paidAt = details.purchasedAt ?? envelope.occurredAt ?? new Date().toISOString();
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("meeting_date_applications")
    .update({
      status: "waitlisted",
      deposit_status: "confirmed",
      deposit_confirmed_at: paidAt,
      groble_merchant_uid: details.merchantUid,
      groble_payment_event_id: envelope.id,
      updated_at: new Date().toISOString(),
    })
    .eq("application_group_id", match.groupId)
    .eq("user_id", match.userId);
  if (updateError) throw updateError;

  await syncProfileNameFromPayment({
    userId: match.userId,
    buyerName: details.buyerName,
  });

  const { error: analyticsError } = await admin.from("user_events").insert({
    profile_id: match.userId,
    event_name: "payment_completed",
    path: "/api/webhooks/groble",
    metadata: {
      provider: "groble",
      merchant_uid: details.merchantUid,
      application_group_id: match.groupId,
      amount: details.finalAmount,
      event_id: envelope.id,
    },
    created_at: paidAt,
  });
  if (analyticsError) throw analyticsError;

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_application_group_id: match.groupId,
    processed_at: new Date().toISOString(),
  });
  return "processed";
}

async function processCancelRequested(
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
        details.cancelRequestedAt ?? envelope.occurredAt ?? new Date().toISOString(),
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
    processed_at: new Date().toISOString(),
  });
  return "processed";
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
  const idempotencyKey = request.headers.get("x-groble-idempotency-key")?.trim();

  if (!validTimestamp(timestamp) || signatures.length === 0 || !idempotencyKey) {
    return NextResponse.json({ error: "Invalid webhook headers." }, { status: 401 });
  }

  try {
    if (!verifySignature({ rawBody, timestamp: timestamp!, signatures })) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } catch (error) {
    console.error("[groble-webhook] signature configuration error", error);
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  let envelope: WebhookEnvelope | null = null;
  try {
    envelope = parseEnvelope(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  if (!envelope) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const details = objectParts(envelope.object);
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("groble_webhook_events").insert({
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
    return NextResponse.json({ error: "Event could not be stored." }, { status: 500 });
  }

  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("groble_webhook_events")
      .select("processing_status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<{ processing_status: string }>();
    if (existingError) {
      return NextResponse.json({ error: "Event could not be checked." }, { status: 500 });
    }
    if (existing?.processing_status !== "failed") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  try {
    let status: string;
    if (envelope.type === "payment.completed") {
      status = await processPaymentCompleted(envelope, idempotencyKey);
    } else if (envelope.type === "payment.cancel_requested") {
      status = await processCancelRequested(envelope, idempotencyKey);
    } else {
      status = "ignored";
      await eventStatus(idempotencyKey, {
        processing_status: status,
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("[groble-webhook] processing failed", error);
    await eventStatus(idempotencyKey, {
      processing_status: "failed",
      last_error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
