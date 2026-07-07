import type { MeetingChatMember } from "@/types/chat";

export function chatOperatorUserId() {
  return process.env.CHAT_OPERATOR_USER_ID?.trim() || null;
}

export function chatOperatorMember(isSelf = false): MeetingChatMember | null {
  const id = chatOperatorUserId();
  if (!id) return null;

  return {
    id,
    nickname: process.env.CHAT_OPERATOR_NICKNAME?.trim() || "교집합",
    emoji: process.env.CHAT_OPERATOR_EMOJI?.trim() || "교",
    isSelf,
    role: "operator",
  };
}

export function isChatOperatorUserId(userId: string | null | undefined) {
  const operatorId = chatOperatorUserId();
  return Boolean(operatorId && userId === operatorId);
}
