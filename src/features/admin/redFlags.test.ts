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
        answer(201, "club"),
        answer(624, "5"),
        answer(605, "4"),
        answer(610, "1"),
        answer(501, "6"),
        answer(628, "2"),
      ],
      participations: [],
    });

    expect(result.score).toBe(3.5);
    expect(result.reasons.map((reason) => reason.id)).toEqual([
      "prefers_club_over_picnic",
      "lateness",
      "finds_faults",
      "group_conversation_low",
      "inappropriate_humor",
      "second_date_rate",
    ]);
  });

  it("does not flag the picnic choice", () => {
    const result = calculateRedFlagAssessment({
      answers: [answer(201, "picnic")],
      participations: [],
    });

    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("applies self-perception and relationship-risk answer weights", () => {
    const result = calculateRedFlagAssessment({
      answers: [
        answer(21, "1"),
        answer(22, "1"),
        answer(23, "physical_attraction_importance_scale_5"),
        answer(24, "1"),
        answer(602, "1"),
        answer(616, "1"),
        answer(617, "7"),
        answer(619, "7"),
        answer(620, "7"),
        answer(629, "7"),
      ],
      participations: [],
    });

    expect(result.score).toBe(7);
    expect(result.reasons.map((reason) => reason.id)).toEqual([
      "self_attractiveness_extreme",
      "self_intelligence_extreme",
      "physical_attraction_very_important",
      "differing_values_discomfort",
      "low_trust",
      "low_interest_signal_awareness",
      "difficulty_relying_on_others",
      "fear_of_not_being_loved",
      "frequent_loneliness",
      "highly_selective_relationships",
    ]);
  });

  it("applies the lower edge weights without flagging neutral answers", () => {
    const result = calculateRedFlagAssessment({
      answers: [
        answer(21, "2"),
        answer(22, "10"),
        answer(24, "2"),
        answer(602, "2"),
        answer(616, "2"),
        answer(617, "6"),
        answer(619, "6"),
        answer(620, "6"),
        answer(629, "6"),
      ],
      participations: [],
    });

    expect(result.score).toBe(2);
    expect(result.reasons.map((reason) => reason.id)).toEqual([
      "self_attractiveness_extreme",
      "self_intelligence_extreme",
      "differing_values_discomfort",
    ]);
  });

  it("flags a self-attractiveness score of 10 by 0.5", () => {
    const result = calculateRedFlagAssessment({
      answers: [answer(21, "10")],
      participations: [],
    });

    expect(result.score).toBe(0.5);
  });

  it("adds 0.3 for ISTP without flagging other MBTI values", () => {
    const istp = calculateRedFlagAssessment({
      answers: [answer(31, "ISTP")],
      participations: [],
    });
    const other = calculateRedFlagAssessment({
      answers: [answer(31, "ENFP")],
      participations: [],
    });

    expect(istp.score).toBe(0.3);
    expect(istp.reasons[0]?.id).toBe("mbti_istp");
    expect(other.score).toBe(0);
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

  it("supports a manual adjustment without allowing a negative total", () => {
    const adjusted = calculateRedFlagAssessment({
      answers: [answer(624, "7")],
      participations: [],
      manualAdjustment: -1.5,
    });
    expect(adjusted.score).toBe(0.5);
    expect(adjusted.manualAdjustment).toBe(-1.5);

    const floored = calculateRedFlagAssessment({
      answers: [],
      participations: [],
      manualAdjustment: -5,
    });
    expect(floored.score).toBe(0);
  });
});
