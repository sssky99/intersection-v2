import type { GatheringTicket } from "@/types/ticket";
import {
  inferTicketCategory,
  normalizeTicketCategory,
  type TicketCategory,
} from "@/types/ticketCategory";

export type TicketRecommendationAnswer = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
};

export type TicketRecommendationProfile = {
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
};

type UserPreferences = {
  answers: Map<number, TicketRecommendationAnswer>;
  ticketCategories: TicketCategory[];
  avoidedTicketCategories: TicketCategory[];
};

type RankedTicket = {
  ticket: GatheringTicket;
  score: number;
  reasons: Array<{ text: string; weight: number }>;
  signals: Set<string>;
};

const MAX_RECOMMENDATIONS_PER_DATE = 5;
const TICKET_CATEGORY_QUESTION_ORDER = 17;
const AVOIDED_TICKET_CATEGORY_QUESTION_ORDER = 18;
const ticketCategoryPreferenceScores = [42, 30, 20] as const;

function normalize(value: string) {
  return value
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .trim();
}

function signalSet(values: Array<string | null | undefined>) {
  const signals = new Set<string>();

  for (const value of values) {
    const normalized = normalize(value ?? "");
    if (!normalized) continue;
    signals.add(normalized);
    for (const word of normalized.split(/\s+/)) {
      if (word.length >= 2) signals.add(word);
    }
  }

  return signals;
}

function answerValues(
  answers: Map<number, TicketRecommendationAnswer>,
  order: number,
) {
  const answer = answers.get(order);
  if (!answer) return [];
  if (answer.answer_values?.length) return answer.answer_values;
  return answer.answer_value ? [answer.answer_value] : [];
}

function ticketScoreToInternal(value: number | null | undefined) {
  return value == null ? null : (value - 3) * 50;
}

function ticketText(ticket: GatheringTicket) {
  const courseSteps = ticket.courseSteps ?? [];

  return [
    ticket.title,
    ticket.subtitle,
    ticket.activityType,
    ...courseSteps.flatMap((step) => [
      step.title,
      step.activityType,
      step.placeName,
    ]),
    ...ticket.moodTags,
    ...(ticket.detailActivities ?? []),
    ...(ticket.detailGoodFor ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function mainActivityType(ticket: GatheringTicket) {
  return (
    ticket.courseSteps?.find((step) => step.isMainActivity)?.activityType ??
    ticket.courseSteps?.[0]?.activityType ??
    ticket.activityType
  );
}

function auxiliaryActivityTypes(ticket: GatheringTicket) {
  return (ticket.courseSteps ?? [])
    .filter((step) => !step.isMainActivity)
    .map((step) => step.activityType)
    .filter((value): value is string => Boolean(value?.trim()));
}

function buildPreferences(
  rows: TicketRecommendationAnswer[],
): UserPreferences {
  const answers = new Map(rows.map((row) => [row.question_order, row]));
  const ticketCategories = answerValues(answers, TICKET_CATEGORY_QUESTION_ORDER)
    .map(normalizeTicketCategory)
    .filter((category): category is TicketCategory => Boolean(category))
    .filter((category, index, values) => values.indexOf(category) === index)
    .slice(0, 3);
  const avoidedTicketCategories = answerValues(
    answers,
    AVOIDED_TICKET_CATEGORY_QUESTION_ORDER,
  )
    .map(normalizeTicketCategory)
    .filter((category): category is TicketCategory => Boolean(category))
    .filter((category, index, values) => values.indexOf(category) === index)
    .slice(0, 3);

  return {
    answers,
    ticketCategories,
    avoidedTicketCategories,
  };
}

function vibeScore(
  ticket: GatheringTicket,
  profile: TicketRecommendationProfile | null,
) {
  if (!profile) return { score: 0, reason: null };

  const axes: Array<{
    profile: number | null;
    ticket: number | null | undefined;
    reason: string;
  }> = [
    {
      profile: profile.score_temperature,
      ticket: ticketScoreToInternal(ticket.vibeScores?.temperature),
      reason: "선호하는 모임의 활기와 잘 맞아요.",
    },
    {
      profile: profile.score_texture,
      ticket: ticketScoreToInternal(ticket.vibeScores?.texture),
      reason: "편하게 이어지는 대화 결이 잘 맞아요.",
    },
    {
      profile: profile.score_tone,
      ticket: ticketScoreToInternal(ticket.vibeScores?.tone),
      reason: "대화할 때 편한 반응 방식과 잘 맞아요.",
    },
    {
      profile: profile.score_rhythm,
      ticket: ticketScoreToInternal(ticket.vibeScores?.rhythm),
      reason: "선호하는 모임의 흐름과 잘 맞아요.",
    },
  ];

  const matches = axes
    .filter((axis) => axis.profile != null && axis.ticket != null)
    .map((axis) => ({
      fit: 1 - Math.abs(axis.profile! - axis.ticket!) / 200,
      reason: axis.reason,
    }));

  if (matches.length === 0) return { score: 0, reason: null };

  const total = matches.reduce((sum, match) => sum + match.fit, 0);
  const strongest = [...matches].sort((left, right) => right.fit - left.fit)[0];
  return {
    score: (total / matches.length) * 34,
    reason: strongest?.fit >= 0.72 ? strongest.reason : null,
  };
}

function conditionScore(
  ticket: GatheringTicket,
  preferences: UserPreferences,
) {
  const mainCategory = inferTicketCategory({
    activityType: mainActivityType(ticket),
    title: ticket.title,
    moodTags: ticket.moodTags,
    shortDescription: ticket.subtitle,
  });
  if (
    mainCategory &&
    preferences.avoidedTicketCategories.includes(mainCategory)
  ) {
    return { score: -120, reasons: [] };
  }

  const hasAvoidedAuxiliaryActivity = auxiliaryActivityTypes(ticket).some(
    (activityType) => {
      const category = inferTicketCategory({
        activityType,
        title: ticket.title,
        moodTags: ticket.moodTags,
        shortDescription: ticket.subtitle,
      });
      return Boolean(
        category && preferences.avoidedTicketCategories.includes(category),
      );
    },
  );

  return { score: hasAvoidedAuxiliaryActivity ? -24 : 0, reasons: [] };
}

function categoryPreferenceScore(
  ticket: GatheringTicket,
  preferences: UserPreferences,
) {
  const category = inferTicketCategory({
    activityType: mainActivityType(ticket),
    title: ticket.title,
    moodTags: ticket.moodTags,
    shortDescription: ticket.subtitle,
  });
  const priorityIndex = category
    ? preferences.ticketCategories.indexOf(category)
    : -1;

  if (priorityIndex !== -1) {
    const score = ticketCategoryPreferenceScores[priorityIndex] ?? 0;
    return {
      score,
      reason:
        priorityIndex === 0
          ? "1순위로 고른 관심 분야와 맞아요."
          : "관심 분야 우선순위를 반영했어요.",
    };
  }

  const auxiliaryPriorityIndex = auxiliaryActivityTypes(ticket)
    .map((activityType) =>
      inferTicketCategory({
        activityType,
        title: ticket.title,
        moodTags: ticket.moodTags,
        shortDescription: ticket.subtitle,
      }),
    )
    .filter((item): item is TicketCategory => Boolean(item))
    .map((item) => preferences.ticketCategories.indexOf(item))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (auxiliaryPriorityIndex == null) return { score: 0, reason: null };

  return {
    score: (ticketCategoryPreferenceScores[auxiliaryPriorityIndex] ?? 0) * 0.35,
    reason: "보조 코스의 관심 분야도 함께 반영했어요.",
  };
}

function rankTicket(
  ticket: GatheringTicket,
  profile: TicketRecommendationProfile | null,
  preferences: UserPreferences,
): RankedTicket {
  const signals = signalSet([
    mainActivityType(ticket),
    ticket.title,
    ticket.subtitle,
    ...(ticket.courseSteps ?? []).flatMap((step) => [
      step.title,
      step.activityType,
    ]),
    ...ticket.moodTags,
  ]);
  const category = categoryPreferenceScore(ticket, preferences);
  const vibe = vibeScore(ticket, profile);
  const conditions = conditionScore(ticket, preferences);
  const reasons = [
    category.reason ? { text: category.reason, weight: category.score } : null,
    vibe.reason ? { text: vibe.reason, weight: vibe.score } : null,
    ...conditions.reasons,
  ].filter((reason): reason is { text: string; weight: number } => Boolean(reason));

  return {
    ticket,
    score: category.score + vibe.score + conditions.score,
    reasons,
    signals,
  };
}

function diversityPenalty(candidate: RankedTicket, selected: RankedTicket[]) {
  return selected.reduce((penalty, current) => {
    const candidateCategory = inferTicketCategory({
      activityType: mainActivityType(candidate.ticket),
      title: candidate.ticket.title,
      moodTags: candidate.ticket.moodTags,
      shortDescription: candidate.ticket.subtitle,
    });
    const currentCategory = inferTicketCategory({
      activityType: mainActivityType(current.ticket),
      title: current.ticket.title,
      moodTags: current.ticket.moodTags,
      shortDescription: current.ticket.subtitle,
    });
    const sameActivity =
      (candidateCategory && candidateCategory === currentCategory) ||
      (mainActivityType(candidate.ticket) &&
        mainActivityType(candidate.ticket) === mainActivityType(current.ticket));
    const sharedSignals = Array.from(candidate.signals).filter((signal) =>
      current.signals.has(signal),
    ).length;
    return penalty + (sameActivity ? 10 : 0) + Math.min(sharedSignals, 2) * 3;
  }, 0);
}

function uniqueReasons(reasons: Array<{ text: string; weight: number }>) {
  return Array.from(
    new Map(
      [...reasons]
        .sort((left, right) => right.weight - left.weight)
        .map((reason) => [reason.text, reason.text]),
    ).values(),
  ).slice(0, 2);
}

export function recommendTickets(
  tickets: GatheringTicket[],
  profile: TicketRecommendationProfile | null,
  rows: TicketRecommendationAnswer[],
) {
  const preferences = buildPreferences(rows);
  if (!profile && preferences.ticketCategories.length === 0) {
    return tickets.slice(0, MAX_RECOMMENDATIONS_PER_DATE);
  }

  const ranked = tickets
    .map((ticket) => rankTicket(ticket, profile, preferences))
    .sort(
      (left, right) =>
        right.score - left.score ||
        `${left.ticket.time}${left.ticket.title}`.localeCompare(
          `${right.ticket.time}${right.ticket.title}`,
          "ko",
        ),
    );

  const selected: RankedTicket[] = [];
  const remaining = [...ranked];

  while (remaining.length > 0 && selected.length < MAX_RECOMMENDATIONS_PER_DATE) {
    remaining.sort(
      (left, right) =>
        right.score - diversityPenalty(right, selected) -
          (left.score - diversityPenalty(left, selected)) ||
        left.ticket.title.localeCompare(right.ticket.title, "ko"),
    );
    const next = remaining.shift();
    if (next) selected.push(next);
  }

  return selected.map((candidate, index) => ({
    ...candidate.ticket,
    recommendationRank: index + 1,
    recommendationReasons: uniqueReasons(candidate.reasons),
  }));
}
