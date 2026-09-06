export type WaitlistStatus =
  | "waitlisted"
  | "approved"
  | "on_hold"
  | "not_selected"
  | "cancelled"
  | "payment_pending"
  | "feedback_done"
  | "completed";


export const waitlistStatuses: WaitlistStatus[] = [
  "waitlisted",
  "approved",
  "on_hold",
  "not_selected",
  "cancelled",
  "payment_pending",
  "feedback_done",
  "completed",
];


export function isWaitlistStatus(value: unknown): value is WaitlistStatus {
  return (
    typeof value === "string" &&
    waitlistStatuses.includes(value as WaitlistStatus)
  );
}
