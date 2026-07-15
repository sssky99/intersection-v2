import type { ConversationResultCode } from "@/data/conversationResults";

export const conversationResultVersion = "v1";

type StoredConversationAnswer = {
  question_order: number;
  answer_value: string | null;
};

const axes = [
  { orders: [1, 2, 3, 4], left: "O", right: "I", tieBreaker: 2 },
  { orders: [5, 6, 7, 8], left: "L", right: "Q", tieBreaker: 5 },
  { orders: [9, 10, 11, 12], left: "H", right: "W", tieBreaker: 9 },
  { orders: [13, 14, 15, 16], left: "C", right: "E", tieBreaker: 13 },
] as const;

export function calculateConversationResultCode(
  rows: StoredConversationAnswer[],
): ConversationResultCode | null {
  const answers = new Map(
    rows.map((row) => [row.question_order, row.answer_value]),
  );

  const code = axes.map(({ orders, left, right, tieBreaker }) => {
    const values = orders.map((order) => answers.get(order));
    if (values.some((value) => value !== left && value !== right)) return null;

    const leftCount = values.filter((value) => value === left).length;
    const rightCount = values.length - leftCount;
    if (leftCount === rightCount) {
      return answers.get(tieBreaker) === left ? left : right;
    }
    return leftCount > rightCount ? left : right;
  });

  return code.some((value) => value === null)
    ? null
    : (code.join("") as ConversationResultCode);
}
