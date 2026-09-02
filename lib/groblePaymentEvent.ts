export type GrobleCompletedPaymentKind = "one_time" | "membership";
export type GrobleCancelledPaymentKind = "one_time" | "membership";

export function grobleCompletedPaymentKind(
  eventType: string,
): GrobleCompletedPaymentKind | null {
  if (eventType === "payment.completed") return "one_time";
  if (eventType === "subscription_payment.completed") return "membership";
  return null;
}

export function grobleCancelledPaymentKind(
  eventType: string,
): GrobleCancelledPaymentKind | null {
  if (eventType === "payment.cancelled") return "one_time";
  if (eventType === "subscription_payment.cancelled") return "membership";
  return null;
}
