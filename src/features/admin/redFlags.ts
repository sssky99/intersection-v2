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
  reviewedAt = null,
}: {
  answers: AdminProfileAnswer[];
  participations: RedFlagParticipation[];
  manualFlags?: RedFlagManualFlags | null;
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

  const score = Math.round(
    reasons.reduce((total, reason) => total + reason.score, 0) * 10,
  ) / 10;

  return {
    score,
    reasons,
    manualFlags: normalizedManualFlags,
    reviewedAt,
  };
}
