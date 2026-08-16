export type GrobleCompletedPaymentKind = "one_time" | "membership";

export function grobleCompletedPaymentKind(
  eventType: string,
): GrobleCompletedPaymentKind | null {
  if (eventType === "payment.completed") return "one_time";
  if (eventType === "subscription_payment.completed") return "membership";
  return null;
}
