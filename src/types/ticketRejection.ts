export const ticketRejectionReasonIds = [
  "time_mismatch",
  "region_too_far",
  "alcohol_burden",
  "activity_not_interested",
  "want_other_activity",
  "not_sure",
] as const;

export type TicketRejectionReasonId =
  (typeof ticketRejectionReasonIds)[number];

export const ticketRejectionReasonLabels: Record<
  TicketRejectionReasonId,
  string
> = {
  time_mismatch: "시간이 안맞아요.",
  region_too_far: "지역이 조금 멀어요.",
  alcohol_burden: "술자리는 조금 부담스러워요.",
  activity_not_interested: "활동이 마음에 들지 않아요.",
  want_other_activity: "다른 활동을 더 보고 싶어요.",
  not_sure: "아직 확신이 안들어요.",
};

export function isTicketRejectionReasonId(
  value: unknown,
): value is TicketRejectionReasonId {
  return (
    typeof value === "string" &&
    ticketRejectionReasonIds.includes(value as TicketRejectionReasonId)
  );
}
