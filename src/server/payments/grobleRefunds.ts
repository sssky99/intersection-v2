import { createAdminClient } from "./grobleContext";
import { eventStatus } from "./groblePaymentDetails";
import type { WebhookEnvelope } from "./grobleVerification";

export async function processPaymentRefunded(
  envelope: WebhookEnvelope,
  key: string,
) {
  const { data, error } = await createAdminClient().rpc("apply_groble_refund", {
    p_event_id: envelope.id,
  });
  if (error) throw error;
  await eventStatus(key, {
    processing_status: "processed",
    matched_user_id: data.user_id,
    payment_kind: data.payment_kind,
    payment_amount: data.amount,
    last_error: null,
    processed_at: new Date().toISOString(),
  });
  return "processed";
}
