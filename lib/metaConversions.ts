import "server-only";

import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type JsonRecord = Record<string, unknown>;

type PaymentKind =
  | "one_time"
  | "membership_initial"
  | "membership_upgrade"
  | "membership_renewal"
  | "unknown";

type PaymentTransaction = {
  id: number | string;
  provider: string;
  provider_event_id: string;
  user_id: string | null;
  payment_kind: PaymentKind;
  product_code: string;
  amount: number;
  currency: string;
  occurred_at: string;
  membership_payment_intent_id: number | string | null;
};

type AcquisitionContext = {
  landing_path?: unknown;
  meta_fbp?: unknown;
  meta_fbc?: unknown;
  meta_user_agent?: unknown;
};

type MetaPurchaseEventInput = {
  provider: string;
  providerEventId: string;
  userId: string;
  phone: string | null;
  productCode: string;
  amount: number;
  currency: string;
  occurredAt: string;
  acquisitionContext: AcquisitionContext | null;
};

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeMetaPhone(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.startsWith("82") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `82${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
}

function metaCookie(value: unknown) {
  const normalized = text(value);
  return normalized && /^fb\.\d+\.\d+\..+$/i.test(normalized)
    ? normalized
    : null;
}

function eventSourceUrl(acquisitionContext: AcquisitionContext | null) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredOrigin) return null;

  try {
    const origin = new URL(configuredOrigin).origin;
    const landingPath = text(acquisitionContext?.landing_path, 240);
    return new URL(landingPath || "/meetings", origin).toString();
  } catch {
    return null;
  }
}

export function buildMetaPurchaseEvent(input: MetaPurchaseEventInput) {
  const eventTime = new Date(input.occurredAt).getTime();
  const normalizedPhone = normalizeMetaPhone(input.phone);
  const fbp = metaCookie(input.acquisitionContext?.meta_fbp);
  const fbc = metaCookie(input.acquisitionContext?.meta_fbc);
  const clientUserAgent = text(input.acquisitionContext?.meta_user_agent);
  const sourceUrl = eventSourceUrl(input.acquisitionContext);

  return {
    event_name: "Purchase",
    event_time: Number.isFinite(eventTime)
      ? Math.floor(eventTime / 1000)
      : Math.floor(Date.now() / 1000),
    event_id: `purchase:${input.provider}:${input.providerEventId}`,
    action_source: "website",
    ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
    user_data: {
      external_id: [sha256(input.userId)],
      ...(normalizedPhone ? { ph: [sha256(normalizedPhone)] } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
      ...(clientUserAgent ? { client_user_agent: clientUserAgent } : {}),
    },
    custom_data: {
      value: input.amount,
      currency: input.currency || "KRW",
      content_type: "product",
      content_ids: [input.productCode],
      order_id: input.providerEventId,
    },
  };
}

function metaConfig() {
  const datasetId =
    process.env.META_DATASET_ID?.trim() ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  if (!datasetId || !accessToken || !/^v\d+\.\d+$/.test(graphVersion)) return null;
  return {
    datasetId,
    accessToken,
    graphVersion,
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || null,
  };
}

async function acquisitionContextForPayment(
  admin: AdminClient,
  payment: PaymentTransaction,
) {
  if (payment.payment_kind === "one_time") {
    const { data, error } = await admin
      .from("meeting_date_payment_intents")
      .select("acquisition_context")
      .eq("groble_payment_event_id", payment.provider_event_id)
      .maybeSingle<{ acquisition_context: AcquisitionContext | null }>();
    if (error) throw error;
    return data?.acquisition_context ?? null;
  }

  if (payment.membership_payment_intent_id !== null) {
    const { data, error } = await admin
      .from("membership_payment_intents")
      .select("acquisition_context")
      .eq("id", payment.membership_payment_intent_id)
      .maybeSingle<{ acquisition_context: AcquisitionContext | null }>();
    if (error) throw error;
    return data?.acquisition_context ?? null;
  }

  return null;
}

function responseJson(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed : { message: value };
  } catch {
    return { message: value.slice(0, 1000) };
  }
}

export async function reportMetaPurchase(
  admin: AdminClient,
  providerEventId: string,
) {
  try {
    const { data: payment, error: paymentError } = await admin
      .from("payment_transactions")
      .select(
        "id,provider,provider_event_id,user_id,payment_kind,product_code,amount,currency,occurred_at,membership_payment_intent_id",
      )
      .eq("provider", "groble")
      .eq("provider_event_id", providerEventId)
      .eq("status", "completed")
      .maybeSingle<PaymentTransaction>();
    if (paymentError) throw paymentError;
    if (
      !payment?.user_id ||
      payment.payment_kind === "unknown" ||
      payment.payment_kind === "membership_renewal"
    ) {
      return;
    }

    const [{ data: profile, error: profileError }, acquisitionContext] =
      await Promise.all([
        admin
          .from("profiles")
          .select("phone")
          .eq("user_id", payment.user_id)
          .maybeSingle<{ phone: string | null }>(),
        acquisitionContextForPayment(admin, payment),
      ]);
    if (profileError) throw profileError;

    const event = buildMetaPurchaseEvent({
      provider: payment.provider,
      providerEventId: payment.provider_event_id,
      userId: payment.user_id,
      phone: profile?.phone ?? null,
      productCode: payment.product_code,
      amount: payment.amount,
      currency: payment.currency,
      occurredAt: payment.occurred_at,
      acquisitionContext,
    });
    const payload = { data: [event] };

    const { data: existing, error: existingError } = await admin
      .from("meta_conversion_events")
      .select("id,delivery_status,attempt_count")
      .eq("event_id", event.event_id)
      .maybeSingle<{
        id: number | string;
        delivery_status: string;
        attempt_count: number;
      }>();
    if (existingError) throw existingError;
    if (existing?.delivery_status === "sent") return;

    const { data: stored, error: storeError } = await admin
      .from("meta_conversion_events")
      .upsert(
        {
          event_id: event.event_id,
          event_name: event.event_name,
          source_provider: payment.provider,
          source_event_id: payment.provider_event_id,
          user_id: payment.user_id,
          payment_transaction_id: payment.id,
          payload,
          delivery_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" },
      )
      .select("id,attempt_count")
      .single<{ id: number | string; attempt_count: number }>();
    if (storeError) throw storeError;

    const config = metaConfig();
    if (!config) {
      await admin
        .from("meta_conversion_events")
        .update({
          last_error: "Meta Conversions API is not configured.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", stored.id);
      return;
    }

    const attemptedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.datasetId)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            access_token: config.accessToken,
            ...(config.testEventCode
              ? { test_event_code: config.testEventCode }
              : {}),
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawResponse = await response.text();
    const providerResponse = responseJson(rawResponse) as JsonRecord;
    if (!response.ok) {
      const metaError =
        providerResponse.error && typeof providerResponse.error === "object"
          ? (providerResponse.error as JsonRecord).message
          : null;
      throw new Error(
        typeof metaError === "string"
          ? `Meta CAPI: ${metaError}`
          : `Meta CAPI request failed with ${response.status}.`,
      );
    }

    const { error: deliveredError } = await admin
      .from("meta_conversion_events")
      .update({
        delivery_status: "sent",
        attempt_count: stored.attempt_count + 1,
        last_attempt_at: attemptedAt,
        delivered_at: new Date().toISOString(),
        last_error: null,
        provider_response: providerResponse,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stored.id);
    if (deliveredError) throw deliveredError;
  } catch (error) {
    console.error("[meta-conversions] Purchase delivery failed", error);
    const eventId = `purchase:groble:${providerEventId}`;
    const adminError =
      error instanceof Error ? error.message.slice(0, 1000) : "Unknown error";
    const { data: stored } = await admin
      .from("meta_conversion_events")
      .select("id,attempt_count")
      .eq("event_id", eventId)
      .maybeSingle<{ id: number | string; attempt_count: number }>();
    if (!stored) return;

    await admin
      .from("meta_conversion_events")
      .update({
        delivery_status: "failed",
        attempt_count: stored.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: adminError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stored.id)
      .then(() => undefined);
  }
}
