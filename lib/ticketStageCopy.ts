import type { TicketStageCopy } from "@/types/ticket";

export const ticketStageCopyKeys = [
  "paymentPending",
  "waitlisted",
  "applied",
  "approved",
  "preStart",
  "inProgress",
  "feedbackOpen",
  "feedbackTitle",
  "feedbackBody",
] as const;

export type TicketStageCopyKey = (typeof ticketStageCopyKeys)[number];

export const defaultTicketStageCopy: Record<TicketStageCopyKey, string> = {
  paymentPending:
    "참가비 입금 확인이 완료되면 배정 대기 상태로 전환돼요. 운영자가 확인한 뒤 참여 확정 여부를 안내합니다.",
  waitlisted:
    "신청이 완료됐어요. 참여 확정 안내는 모임 시작 24시간 전부터 확인할 수 있어요.",
  applied:
    "신청이 완료됐어요. 참여 확정 안내는 모임 시작 24시간 전부터 확인할 수 있어요.",
  approved:
    "참여가 확정되었어요. 오늘의 장소와 모임 안내, 함께할 멤버 정보를 확인할 수 있어요.",
  preStart:
    "모임 시작 3시간 전 안내가 열렸어요. 오늘의 장소를 바로 확인하고 도착 상태를 남겨주세요.",
  inProgress:
    "모임이 진행 중이에요. 도착 상태와 장소를 확인하고, 모임 후 피드백 안내를 확인할 수 있어요.",
  feedbackOpen:
    "피드백 작성이 열렸어요. 남겨주신 피드백은 다음 자리의 큐레이션을 더 잘 맞추는 데 참고돼요.",
  feedbackTitle: "피드백 작성 ✒️",
  feedbackBody:
    "남겨주신 피드백은 철저히 익명이 보장되며, 다음 {owner} 큐레이션 정확성을 높이는데 사용됩니다.",
};

function copyText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sanitizeTicketStageCopy(value: unknown): TicketStageCopy {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;

  return Object.fromEntries(
    ticketStageCopyKeys.map((key) => [key, copyText(source[key])]),
  ) as TicketStageCopy;
}

export function ticketStageText(
  stageCopy: TicketStageCopy | null | undefined,
  key: TicketStageCopyKey,
) {
  const customValue = copyText(stageCopy?.[key]);
  return customValue ?? defaultTicketStageCopy[key];
}

export function ticketFeedbackBodyText(
  stageCopy: TicketStageCopy | null | undefined,
  owner: string,
) {
  return ticketStageText(stageCopy, "feedbackBody")
    .replaceAll("{owner}", owner)
    .replaceAll("{feedbackOwner}", owner);
}
