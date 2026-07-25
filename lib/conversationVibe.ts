import type {
  VibeAxis,
  VibeScores,
} from "@/components/vibe/vibeGraphConfig";
import type { ConversationResultCode } from "@/data/conversationResults";

export const conversationVibeAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
] as const satisfies readonly VibeAxis[];

export const conversationAxisLabelOverrides = {
  temperature: {
    label: "낯선 자리의 시작",
    leftLabel: "Observe",
    rightLabel: "Initiate",
    summaryLabel: "관찰 · 주도",
  },
  texture: {
    label: "대화를 여는 방식",
    leftLabel: "Listening",
    rightLabel: "Questioning",
    summaryLabel: "경청 · 질문",
  },
  tone: {
    label: "차이를 다루는 방식",
    leftLabel: "Harmony",
    rightLabel: "Wonder",
    summaryLabel: "조화 · 탐구",
  },
  rhythm: {
    label: "만남의 분위기",
    leftLabel: "Conversation",
    rightLabel: "Experience",
    summaryLabel: "대화 · 경험",
  },
} as const;

function conversationAxisScore(
  answerValueForOrder: (order: number) => unknown,
  orders: number[],
  left: string,
  right: string,
  fallback: string | undefined,
) {
  const values = orders.map(answerValueForOrder);
  if (values.every((value) => value === left || value === right)) {
    const rightCount = values.filter((value) => value === right).length;
    const leftCount = values.length - rightCount;
    return ((rightCount - leftCount) / values.length) * 100;
  }
  if (fallback === left) return -65;
  if (fallback === right) return 65;
  return 0;
}

export function conversationVibeScores(
  answerValueForOrder: (order: number) => unknown,
  code: ConversationResultCode,
): VibeScores {
  return {
    temperature: conversationAxisScore(
      answerValueForOrder,
      [1, 2, 3, 4],
      "O",
      "I",
      code[0],
    ),
    texture: conversationAxisScore(
      answerValueForOrder,
      [5, 6, 7, 8],
      "L",
      "Q",
      code[1],
    ),
    tone: conversationAxisScore(
      answerValueForOrder,
      [9, 10, 11, 12],
      "H",
      "W",
      code[2],
    ),
    rhythm: conversationAxisScore(
      answerValueForOrder,
      [13, 14, 15, 16],
      "C",
      "E",
      code[3],
    ),
  };
}
