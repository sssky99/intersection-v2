import { createAdminClient, webhookScope } from "./grobleContext";
import { JsonRecord, jsonRecord, text } from "./grobleVerification";

export function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizePhone(value: unknown) {
  let digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

export function objectParts(object: JsonRecord) {
  const buyer = jsonRecord(object.buyer);
  const pricing = jsonRecord(object.pricing);
  const payment = jsonRecord(object.payment);
  const cancelRequest = jsonRecord(object.cancelRequest);

  return {
    merchantUid: text(object.merchantUid),
    sellerReference: text(object.sellerReference),
    buyerPhone: normalizePhone(buyer?.phoneNumber),
    buyerName:
      text(buyer?.name) ??
      text(buyer?.fullName) ??
      text(buyer?.buyerName) ??
      text(object.buyerName),
    finalAmount: number(pricing?.finalAmount),
    purchasedAt: text(payment?.purchasedAt),
    cancelRequestedAt: text(cancelRequest?.requestedAt),
    cancelledAt:
      text(payment?.cancelledAt) ??
      text(cancelRequest?.completedAt) ??
      text(object.cancelledAt),
  };
}

export async function eventStatus(
  idempotencyKey: string,
  values: Record<string, unknown>,
) {
  const token = webhookScope.getStore()?.token;
  if (!token) throw new Error("Webhook processing claim is missing.");
  const { data, error } = await createAdminClient()
    .from("groble_webhook_events")
    .update({
      ...values,
      processing_lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("idempotency_key", idempotencyKey)
    .eq("processing_token", token)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Webhook processing claim was lost.");
}
