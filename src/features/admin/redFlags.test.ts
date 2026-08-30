import { describe, expect, it } from "vitest";
import type { AdminProfileAnswer } from "@/features/admin/adminProfile";
import { calculateRedFlagAssessment } from "@/features/admin/redFlags";

function answer(
  questionOrder: number,
  answerValue: string | null,
  options: Partial<AdminProfileAnswer> = {},
): AdminProfileAnswer {
  return {
    user_id: "00000000-0000-0000-0000-000000000001",
    question_order: questionOrder,
    question_type: "single_choice",
    category: "성향",
    answer_value: answerValue,
    answer_values: null,
    answer_text: null,
    other_text: null,
    ...options,
  };
}

describe("calculateRedFlagAssessment", () => {
  it("applies the requested structured-answer weights", () => {
    const result = calculateRedFlagAssessment({
      answers: [
        answer(624, "5"),
        answer(605, "4"),
        answer(610, "1"),
        answer(501, "6"),
        answer(628, "2"),
      ],
      participations: [],
    });

    expect(result.score).toBe(3);
    expect(result.reasons.map((reason) => reason.id)).toEqual([
      "lateness",
      "finds_faults",
      "group_conversation_low",
      "inappropriate_humor",
      "second_date_rate",
    ]);
  });

  it("uses the one-character penalty instead of stacking short-answer penalties", () => {
    const result = calculateRedFlagAssessment({
      answers: [
        answer(19, null, { question_type: "text", answer_text: "네" }),
        answer(20, null, { question_type: "text", answer_text: "ㅋ" }),
      ],
      participations: [],
    });

    expect(result.score).toBe(5);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]?.id).toBe("one_character_answer");
  });

  it("adds no-show, same-day cancellation, and manual review reasons", () => {
    const result = calculateRedFlagAssessment({
      answers: [],
      participations: [
        {
          status: "feedback_done",
          arrival_status: "no_show",
          cancelled_at: null,
          event_date: "2026-08-29",
        },
        {
          status: "cancelled",
          arrival_status: null,
          cancelled_at: "2026-08-29T01:00:00.000Z",
          event_date: "2026-08-29",
        },
      ],
      manualFlags: {
        contradictory_answers: true,
        derogatory_hateful_or_sexual: true,
      },
    });

    expect(result.score).toBe(5.5);
    expect(result.reasons.map((reason) => reason.id)).toEqual([
      "no_show_history",
      "same_day_cancellation_history",
      "contradictory_answers",
      "derogatory_hateful_or_sexual",
    ]);
  });
});
