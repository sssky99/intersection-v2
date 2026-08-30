import type { AdminProfileAnswer } from "@/features/admin/adminProfile";

export const redFlagManualRules = [
  {
    key: "contradictory_answers",
    label: "답변끼리 모순됨",
    score: 0.5,
  },
  {
    key: "derogatory_hateful_or_sexual",
    label: "타인 비하·혐오·성적 대상화 표현",
    score: 2,
  },
  {
    key: "group_generalization_or_attack",
    label: "특정 집단을 일반화하거나 공격함",
    score: 0.5,
  },
  {
    key: "absolute_preference",
    label: "자기 취향을 절대적인 기준처럼 표현함",
    score: 0.5,
  },
  {
    key: "boundary_disrespect",
    label: "상대의 거절이나 불편함을 존중하지 않을 가능성",
    score: 0.5,
  },
] as const;

export type RedFlagManualKey = (typeof redFlagManualRules)[number]["key"];
export type RedFlagManualFlags = Partial<Record<RedFlagManualKey, boolean>>;

export type RedFlagParticipation = {
  status: string | null;
  arrival_status: string | null;
  cancelled_at: string | null;
  event_date: string | null;
};

export type RedFlagReason = {
  id: string;
  label: string;
  score: number;
  source: "answer" | "history" | "manual";
  detail?: string | null;
  questionOrder?: number | null;
};

export type RedFlagAssessment = {
  score: number;
  reasons: RedFlagReason[];
  manualFlags: RedFlagManualFlags;
  manualAdjustment: number;
  reviewedAt: string | null;
};

function answerForOrder(answers: AdminProfileAnswer[], order: number) {
  return answers.find((answer) => answer.question_order === order);
}

function numericAnswer(answers: AdminProfileAnswer[], order: number) {
  const value = answerForOrder(answers, order)?.answer_value;
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function responseText(answer: AdminProfileAnswer) {
  return (
    answer.answer_text?.trim() ||
    answer.other_text?.trim() ||
    (answer.question_type === "text" ? answer.answer_value?.trim() : "") ||
    ""
  );
}

function meaningfulCharacterCount(value: string) {
  return Array.from(value.replace(/[\s\p{P}\p{S}]/gu, "")).length;
}

function sameSeoulDate(iso: string | null, eventDate: string | null) {
  if (!iso || !eventDate) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const seoulDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return seoulDate === eventDate;
}

function addStructuredAnswerReasons(
  reasons: RedFlagReason[],
  answers: AdminProfileAnswer[],
) {
  const selfAttractiveness = numericAnswer(answers, 21);
  const selfAttractivenessScore =
    selfAttractiveness === 1
      ? 2
      : selfAttractiveness === 2
        ? 1
        : selfAttractiveness === 10
          ? 0.5
          : 0;
  if (selfAttractivenessScore) {
    reasons.push({
      id: "self_attractiveness_extreme",
      label: "자신의 매력에 대한 극단적 평가",
      score: selfAttractivenessScore,
      source: "answer",
      detail: `10점 척도 중 ${selfAttractiveness}점 선택`,
      questionOrder: 21,
    });
  }

  const selfIntelligence = numericAnswer(answers, 22);
  if (selfIntelligence === 1 || selfIntelligence === 10) {
    reasons.push({
      id: "self_intelligence_extreme",
      label: "자신의 지적 능력에 대한 극단적 평가",
      score: 0.5,
      source: "answer",
      detail: `10점 척도 중 ${selfIntelligence}점 선택`,
      questionOrder: 22,
    });
  }

  if (
    answerForOrder(answers, 23)?.answer_value ===
    "physical_attraction_importance_scale_5"
  ) {
    reasons.push({
      id: "physical_attraction_very_important",
      label: "첫인상의 외적 끌림을 매우 중요하게 봄",
      score: 0.5,
      source: "answer",
      detail: "‘처음 느껴지는 끌림이 정말 중요해요’ 선택",
      questionOrder: 23,
    });
  }

  const differingValuesComfort = numericAnswer(answers, 24);
  const differingValuesScore =
    differingValuesComfort === 1 ? 1 : differingValuesComfort === 2 ? 0.5 : 0;
  if (differingValuesScore) {
    reasons.push({
      id: "differing_values_discomfort",
      label: "다른 가치관과 생각을 나누는 데 불편함",
      score: differingValuesScore,
      source: "answer",
      detail: `7점 척도 중 ${differingValuesComfort}점 선택`,
      questionOrder: 24,
    });
  }

  if (answerForOrder(answers, 31)?.answer_value?.toUpperCase() === "ISTP") {
    reasons.push({
      id: "mbti_istp",
      label: "MBTI가 ISTP임",
      score: 0.3,
      source: "answer",
      detail: "MBTI 문항에서 ISTP 선택",
      questionOrder: 31,
    });
  }

  if (answerForOrder(answers, 201)?.answer_value === "club") {
    reasons.push({
      id: "prefers_club_over_picnic",
      label: "피크닉보다 클럽을 선호함",
      score: 0.5,
      source: "answer",
      detail: "클럽·한강 피크닉 문항에서 ‘클럽’ 선택",
      questionOrder: 201,
    });
  }

  const lateness = numericAnswer(answers, 624);
  const latenessScore = lateness === 5 ? 0.5 : lateness === 6 ? 1 : lateness === 7 ? 2 : 0;
  if (latenessScore) {
    reasons.push({
      id: "lateness",
      label: "모임 지각 성향",
      score: latenessScore,
      source: "answer",
      detail: `7점 척도 중 ${lateness}점 선택`,
      questionOrder: 624,
    });
  }

  const faults = numericAnswer(answers, 605);
  const faultsScore = faults === 4 ? 0.5 : faults === 5 ? 1 : 0;
  if (faultsScore) {
    reasons.push({
      id: "finds_faults",
      label: "다른 사람의 단점을 찾는 편",
      score: faultsScore,
      source: "answer",
      detail: `5점 척도 중 ${faults}점 선택`,
      questionOrder: 605,
    });
  }

  if (numericAnswer(answers, 602) === 1) {
    reasons.push({
      id: "low_trust",
      label: "다른 사람을 신뢰하기 어려움",
      score: 0.5,
      source: "answer",
      detail: "5점 척도 중 1점 선택",
      questionOrder: 602,
    });
  }

  if (numericAnswer(answers, 610) === 1) {
    reasons.push({
      id: "group_conversation_low",
      label: "그룹 자리에서 거의 말하지 않음",
      score: 0.5,
      source: "answer",
      detail: "7점 척도 중 1점 선택",
      questionOrder: 610,
    });
  }

  if (numericAnswer(answers, 616) === 1) {
    reasons.push({
      id: "low_interest_signal_awareness",
      label: "상대의 호감 신호를 알아차리기 어려움",
      score: 0.5,
      source: "answer",
      detail: "7점 척도 중 1점 선택",
      questionOrder: 616,
    });
  }

  const highRiskSevenPointAnswers = [
    [617, "difficulty_relying_on_others", "다른 사람에게 의지하기 어려움"],
    [619, "fear_of_not_being_loved", "진심으로 사랑받지 못할까 걱정함"],
    [620, "frequent_loneliness", "외로움을 매우 자주 느낌"],
    [629, "highly_selective_relationships", "가까이 지낼 사람을 매우 까다롭게 고름"],
  ] as const;
  for (const [questionOrder, id, label] of highRiskSevenPointAnswers) {
    if (numericAnswer(answers, questionOrder) !== 7) continue;
    reasons.push({
      id,
      label,
      score: 0.5,
      source: "answer",
      detail: "7점 척도 중 7점 선택",
      questionOrder,
    });
  }

  const humor = numericAnswer(answers, 501);
  const humorScore = humor === 6 ? 0.5 : humor === 7 ? 1 : 0;
  if (humorScore) {
    reasons.push({
      id: "inappropriate_humor",
      label: "정치적으로 부적절한 유머 선호",
      score: humorScore,
      source: "answer",
      detail: `7점 척도 중 ${humor}점 선택`,
      questionOrder: 501,
    });
  }

  const secondDateRate = numericAnswer(answers, 628);
  const secondDateScore = secondDateRate === 1 ? 2 : secondDateRate === 2 ? 1 : 0;
  if (secondDateScore) {
    reasons.push({
      id: "second_date_rate",
      label: "첫 데이트가 두 번째 데이트로 이어지는 빈도가 낮음",
      score: secondDateScore,
      source: "answer",
      detail: `7점 척도 중 ${secondDateRate}점 선택`,
      questionOrder: 628,
    });
  }
}

function addShortAnswerReason(
  reasons: RedFlagReason[],
  answers: AdminProfileAnswer[],
) {
  const shortAnswers = answers
    .filter(
      (answer) =>
        answer.question_type === "text" &&
        answer.question_order !== 708 &&
        responseText(answer),
    )
    .map((answer) => ({
      answer,
      text: responseText(answer),
      length: meaningfulCharacterCount(responseText(answer)),
    }))
    .filter(({ length }) => length >= 1 && length <= 3);

  const oneCharacter = shortAnswers.find(({ length }) => length === 1);
  if (oneCharacter) {
    reasons.push({
      id: "one_character_answer",
      label: "한 글자로 작성한 서술형 답변",
      score: 5,
      source: "answer",
      detail: `문항 ${oneCharacter.answer.question_order} · “${oneCharacter.text}”`,
      questionOrder: oneCharacter.answer.question_order,
    });
    return;
  }

  const twoOrThreeCharacters = shortAnswers.find(
    ({ length }) => length === 2 || length === 3,
  );
  if (twoOrThreeCharacters) {
    reasons.push({
      id: "very_short_answer",
      label: "2~3글자로 작성한 서술형 답변",
      score: 1,
      source: "answer",
      detail: `문항 ${twoOrThreeCharacters.answer.question_order} · “${twoOrThreeCharacters.text}”`,
      questionOrder: twoOrThreeCharacters.answer.question_order,
    });
  }
}

function addHistoryReasons(
  reasons: RedFlagReason[],
  participations: RedFlagParticipation[],
) {
  const noShows = participations.filter(
    (participation) => participation.arrival_status === "no_show",
  );
  if (noShows.length > 0) {
    reasons.push({
      id: "no_show_history",
      label: "과거 노쇼 이력",
      score: noShows.length * 2,
      source: "history",
      detail: `${noShows.length}회 × 2점`,
    });
  }

  const sameDayCancellations = participations.filter(
    (participation) =>
      participation.status === "cancelled" &&
      sameSeoulDate(participation.cancelled_at, participation.event_date),
  );
  if (sameDayCancellations.length > 0) {
    reasons.push({
      id: "same_day_cancellation_history",
      label: "과거 당일 취소 이력",
      score: sameDayCancellations.length,
      source: "history",
      detail: `${sameDayCancellations.length}회 × 1점`,
    });
  }
}

export function normalizeRedFlagManualFlags(value: unknown): RedFlagManualFlags {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    redFlagManualRules.map((rule) => [rule.key, record[rule.key] === true]),
  ) as RedFlagManualFlags;
}

export function calculateRedFlagAssessment({
  answers,
  participations,
  manualFlags,
  manualAdjustment = 0,
  reviewedAt = null,
}: {
  answers: AdminProfileAnswer[];
  participations: RedFlagParticipation[];
  manualFlags?: RedFlagManualFlags | null;
  manualAdjustment?: number | null;
  reviewedAt?: string | null;
}): RedFlagAssessment {
  const normalizedManualFlags = normalizeRedFlagManualFlags(manualFlags);
  const reasons: RedFlagReason[] = [];

  addStructuredAnswerReasons(reasons, answers);
  addShortAnswerReason(reasons, answers);
  addHistoryReasons(reasons, participations);

  for (const rule of redFlagManualRules) {
    if (!normalizedManualFlags[rule.key]) continue;
    reasons.push({
      id: rule.key,
      label: rule.label,
      score: rule.score,
      source: "manual",
    });
  }

  const normalizedManualAdjustment =
    typeof manualAdjustment === "number" &&
    Number.isFinite(manualAdjustment) &&
    manualAdjustment >= -5 &&
    manualAdjustment <= 5
      ? Math.round(manualAdjustment * 2) / 2
      : 0;
  if (normalizedManualAdjustment !== 0) {
    reasons.push({
      id: "manual_adjustment",
      label: "운영자 점수 보정",
      score: normalizedManualAdjustment,
      source: "manual",
      detail:
        normalizedManualAdjustment > 0
          ? "자동 산정에서 부족한 위험도를 가산"
          : "자동 산정의 과대 평가를 감산",
    });
  }

  const score = Math.max(
    0,
    Math.round(reasons.reduce((total, reason) => total + reason.score, 0) * 10) /
      10,
  );

  return {
    score,
    reasons,
    manualFlags: normalizedManualFlags,
    manualAdjustment: normalizedManualAdjustment,
    reviewedAt,
  };
}
