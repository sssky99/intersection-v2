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
type PaymentIntentMatchRow = {
  intent_id: number | string;
  application_group_id: string;
};
type MembershipIntentMatchRow = {
  intent_id: number | string;
  plan: "one_month" | "three_months" | "six_months";
  credit_amount: number;
};
type MatchedMembershipPayment = {
  status: "matched";
  userId: string;
  intentId: number | string;
  plan: "one_month" | "three_months" | "six_months";
  creditAmount: number;
};
type PaymentKind =
  | "one_time"
  | "membership_initial"
  | "membership_upgrade"
  | "membership_renewal";
type PaymentTransactionRow = {
  id: number | string;
  user_id: string | null;
  payment_kind: PaymentKind | "unknown";
  amount: number;
  application_group_id: string | null;
  membership_payment_intent_id: number | string | null;
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

async function pendingMembershipMatch({
  buyerPhone,
  finalAmount,
  paidAt,
}: {
  buyerPhone: string | null;
  finalAmount: number | null;
  paidAt: string | null;
}) {
  if (!buyerPhone || finalAmount === null || !paidAt) {
    return {
      status: "unmatched" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  const paidAtDate = new Date(paidAt);
  if (!Number.isFinite(paidAtDate.getTime())) {
    return {
      status: "unmatched" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
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
    return {
      status: "unmatched" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }
  if (profiles.length > 1) {
    return {
      status: "ambiguous" as const,
      userId: null,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  const userId = profiles[0].user_id;
  const { data: intents, error: intentError } = await admin.rpc(
    "match_membership_payment_intent",
    {
      p_user_id: userId,
      p_paid_at: paidAtDate.toISOString(),
      p_amount: finalAmount,
    },
  );
  if (intentError) throw intentError;

  const matches = (intents ?? []) as MembershipIntentMatchRow[];
  if (matches.length > 1) {
    return {
      status: "ambiguous" as const,
      userId,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }
  if (matches.length === 0) {
    return {
      status: "unmatched" as const,
      userId,
      intentId: null,
      plan: null,
      creditAmount: 0,
    };
  }

  return {
    status: "matched" as const,
    userId,
    intentId: matches[0].intent_id,
    plan: matches[0].plan,
    creditAmount: matches[0].credit_amount,
  };
}

async function pendingApplicationMatch({
  buyerPhone,
  finalAmount,
  paidAt,
}: {
  buyerPhone: string | null;
  finalAmount: number | null;
  paidAt: string | null;
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
  if (paidAt) {
    const paidAtDate = new Date(paidAt);
    if (Number.isFinite(paidAtDate.getTime())) {
      const { data: paymentIntents, error: paymentIntentError } =
        await admin.rpc("match_meeting_date_payment_intent", {
          p_user_id: userId,
          p_paid_at: paidAtDate.toISOString(),
          p_amount: finalAmount,
        });
      if (paymentIntentError) throw paymentIntentError;

      const intentMatches = (paymentIntents ?? []) as PaymentIntentMatchRow[];
      if (intentMatches.length > 1) {
        return {
          status: "ambiguous" as const,
          userId,
          groupId: null,
          intentId: null,
        };
      }
      if (intentMatches.length === 1) {
        return {
          status: "matched" as const,
          userId,
          groupId: intentMatches[0].application_group_id,
          intentId: intentMatches[0].intent_id,
        };
      }
    }
  }

  const { count: paymentIntentCount, error: paymentIntentHistoryError } =
    await admin
      .from("meeting_date_payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
  if (paymentIntentHistoryError) throw paymentIntentHistoryError;
  if ((paymentIntentCount ?? 0) > 0) {
    return {
      status: "unmatched" as const,
      userId,
      groupId: null,
      intentId: null,
    };
  }

  // Compatibility for applications created before payment-intent tracking:
  // only auto-match when exactly one eligible application group exists.
  const { data: applications, error: applicationError } = await admin
    .from("meeting_date_applications")
    .select("application_group_id,user_id,deposit_amount,created_at")
    .eq("user_id", userId)
    .eq("deposit_status", "payment_pending")
    .eq("deposit_amount", finalAmount)
    .in("status", [...activeApplicationStatuses])
    .limit(20)
    .returns<ApplicationRow[]>();
  if (applicationError) throw applicationError;

  const applicationGroups = new Set(
    (applications ?? []).map((application) => application.application_group_id),
  );
  if (applicationGroups.size === 0) {
    return {
      status: "unmatched" as const,
      userId,
      groupId: null,
      intentId: null,
    };
  }
  if (applicationGroups.size > 1) {
    return {
      status: "ambiguous" as const,
      userId,
      groupId: null,
      intentId: null,
    };
  }

  return {
    status: "matched" as const,
    userId,
    groupId: Array.from(applicationGroups)[0],
    intentId: null,
  };
}

async function membershipPaymentKind({
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

async function processMembershipPayment({
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

  const { error: transactionError } = await admin
    .from("payment_transactions")
    .upsert(
      {
        provider: "groble",
        provider_event_id: envelope.id,
        merchant_uid: details.merchantUid,
        user_id: match.userId,
        payment_kind: paymentKind,
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.intentId)
    .eq("user_id", match.userId);
  if (intentUpdateError) throw intentUpdateError;

  await syncProfileNameFromPayment({
    userId: match.userId,
    buyerName: details.buyerName,
  });

  const eventName =
    paymentKind === "membership_upgrade"
      ? "subscription_upgraded"
      : paymentKind === "membership_renewal"
        ? "subscription_renewed"
        : "subscription_started";
  const { error: analyticsError } = await admin.from("user_events").insert({
    profile_id: match.userId,
    event_name: eventName,
    path: "/api/webhooks/groble",
    metadata: {
      provider: "groble",
      merchant_uid: details.merchantUid,
      membership_payment_intent_id: match.intentId,
      plan: match.plan,
      payment_kind: paymentKind,
      amount: details.finalAmount,
      credit_amount: match.creditAmount,
      event_id: envelope.id,
    },
    created_at: paidAt,
  });
  if (analyticsError) throw analyticsError;

  await eventStatus(idempotencyKey, {
    processing_status: "processed",
    merchant_uid: details.merchantUid,
    matched_user_id: match.userId,
    matched_membership_payment_intent_id: match.intentId,
    payment_kind: paymentKind,
    payment_amount: details.finalAmount,
    processed_at: new Date().toISOString(),
  });
  return "processed";
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
  const paymentOccurredAt = details.purchasedAt ?? envelope.occurredAt;
  const membershipMatch = await pendingMembershipMatch({
    ...details,
    paidAt: paymentOccurredAt,
  });
  const match = await pendingApplicationMatch({
    ...details,
    paidAt: paymentOccurredAt,
  });

  if (
    membershipMatch.status === "ambiguous" ||
    (membershipMatch.status === "matched" && match.status === "matched")
  ) {
    await eventStatus(idempotencyKey, {
      processing_status: "ambiguous",
      matched_user_id: membershipMatch.userId,
      processed_at: new Date().toISOString(),
    });
    return "ambiguous";
  }
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
      payment_intent_id: match.intentId,
      payment_kind: "one_time",
      amount: details.finalAmount,
      event_id: envelope.id,
    },
    created_at: paidAt,
  });
  if (analyticsError) throw analyticsError;

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
    .eq(
      "groble_merchant_uid",
      details.merchantUid,
    )
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
    payment_kind: "one_time",
    payment_amount: details.finalAmount,
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
