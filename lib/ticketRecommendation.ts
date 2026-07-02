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
  roles: string[];
  ticketCategories: TicketCategory[];
  romancePreference: number | null;
};

type RankedTicket = {
  ticket: GatheringTicket;
  score: number;
  reasons: Array<{ text: string; weight: number }>;
  signals: Set<string>;
};

const MAX_RECOMMENDATIONS_PER_DATE = 5;
const TICKET_CATEGORY_QUESTION_ORDER = 10;
const ticketCategoryPreferenceScores = [42, 30, 20] as const;

const roleSignalKeywords: Record<string, string[]> = {
  opener: ["대화", "아이스", "가벼", "친해", "활기"],
  connector: ["대화", "공감", "편안", "질문"],
  listener: ["차분", "편안", "소규모"],
};

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

function ratingValue(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function ticketScoreToInternal(value: number | null | undefined) {
  return value == null ? null : (value - 3) * 50;
}

function ticketText(ticket: GatheringTicket) {
  return [
    ticket.title,
    ticket.subtitle,
    ticket.activityType,
    ...ticket.moodTags,
    ...(ticket.detailActivities ?? []),
    ...(ticket.detailGoodFor ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function buildPreferences(
  rows: TicketRecommendationAnswer[],
): UserPreferences {
  const answers = new Map(rows.map((row) => [row.question_order, row]));
  const roles = [5, 6, 7]
    .flatMap((order) => answerValues(answers, order))
    .filter((role, index, values) => values.indexOf(role) === index);
  const ticketCategories = answerValues(answers, TICKET_CATEGORY_QUESTION_ORDER)
    .map(normalizeTicketCategory)
    .filter((category): category is TicketCategory => Boolean(category))
    .filter((category, index, values) => values.indexOf(category) === index)
    .slice(0, 3);

  return {
    answers,
    roles,
    ticketCategories,
    romancePreference: ratingValue(answerValues(answers, 8)[0]),
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
  text: string,
) {
  let score = 0;
  const reasons: Array<{ text: string; weight: number }> = [];

  const romance = ticket.vibeScores?.romance ?? null;
  if (preferences.romancePreference != null && romance != null) {
    const fit = 1 - Math.abs(preferences.romancePreference - romance) / 4;
    score += fit * 11;
    if (fit >= 0.75) {
      reasons.push({
        text: "기대하는 만남의 분위기와 잘 맞아요.",
        weight: fit * 11,
      });
    }
  }

  const preferenceSignals = preferences.roles.flatMap(
    (role) => roleSignalKeywords[role] ?? [],
  );
  const matchedSignals = preferenceSignals.filter((keyword) =>
    text.includes(normalize(keyword)),
  );
  if (matchedSignals.length > 0) {
    const matchScore = Math.min(12, matchedSignals.length * 3);
    score += matchScore;
    reasons.push({
      text: "편하게 느끼는 대화 분위기를 반영했어요.",
      weight: matchScore,
    });
  }

  return { score, reasons };
}

function categoryPreferenceScore(
  ticket: GatheringTicket,
  preferences: UserPreferences,
) {
  const category = inferTicketCategory({
    activityType: ticket.activityType,
    title: ticket.title,
    moodTags: ticket.moodTags,
    shortDescription: ticket.subtitle,
  });
  if (!category) return { score: 0, reason: null };

  const priorityIndex = preferences.ticketCategories.indexOf(category);
  if (priorityIndex === -1) return { score: 0, reason: null };

  const score = ticketCategoryPreferenceScores[priorityIndex] ?? 0;
  return {
    score,
    reason:
      priorityIndex === 0
        ? "1순위로 고른 관심 분야와 맞아요."
        : "관심 분야 우선순위를 반영했어요.",
  };
}

function rankTicket(
  ticket: GatheringTicket,
  profile: TicketRecommendationProfile | null,
  preferences: UserPreferences,
): RankedTicket {
  const text = normalize(ticketText(ticket));
  const signals = signalSet([
    ticket.activityType,
    ticket.title,
    ticket.subtitle,
    ...ticket.moodTags,
  ]);
  const category = categoryPreferenceScore(ticket, preferences);
  const vibe = vibeScore(ticket, profile);
  const conditions = conditionScore(ticket, preferences, text);
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
      activityType: candidate.ticket.activityType,
      title: candidate.ticket.title,
      moodTags: candidate.ticket.moodTags,
      shortDescription: candidate.ticket.subtitle,
    });
    const currentCategory = inferTicketCategory({
      activityType: current.ticket.activityType,
      title: current.ticket.title,
      moodTags: current.ticket.moodTags,
      shortDescription: current.ticket.subtitle,
    });
    const sameActivity =
      (candidateCategory && candidateCategory === currentCategory) ||
      (candidate.ticket.activityType &&
        candidate.ticket.activityType === current.ticket.activityType);
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
