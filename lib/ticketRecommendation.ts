import { parseTicketRatingAnswer } from "@/features/onboarding/ticketRating";
import type { GatheringTicket } from "@/types/ticket";

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
  exactRatings: Map<string, number>;
  ratedSignals: Array<{ rating: number; signals: string[] }>;
  roles: string[];
  comfortablePeople: string[];
  avoidances: Set<string>;
  romancePreference: number | null;
};

type RankedTicket = {
  ticket: GatheringTicket;
  score: number;
  reasons: Array<{ text: string; weight: number }>;
  signals: Set<string>;
};

const MAX_RECOMMENDATIONS_PER_DATE = 5;

const preferenceScoreByRating: Record<number, number> = {
  1: -48,
  2: -22,
  3: 0,
  4: 24,
  5: 48,
};

const comfortSignalKeywords: Record<string, string[]> = {
  opens_conversation: ["대화", "아이스", "가벼운", "친해"],
  warm_reactor: ["따뜻", "공감", "편안"],
  good_questioner: ["대화", "이야기", "질문"],
  calm_listener: ["차분", "조용", "편안"],
  humor: ["유머", "웃음", "즐거"],
  not_pushy: ["부담", "편안", "차분"],
  deep_talker: ["깊", "생각", "가치관"],
  casual_talker: ["가벼", "일상", "편안"],
};

const roleSignalKeywords: Record<string, string[]> = {
  listener: ["차분", "편안", "소규모"],
  reactor: ["대화", "공감", "편안"],
  questioner: ["대화", "이야기", "질문"],
  starter: ["아이스", "가벼", "친해"],
  mood_maker: ["유머", "웃음", "활기"],
  organizer: ["차분", "정리", "편안"],
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

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function signalOverlap(left: Set<string>, right: string[]) {
  return right.some((signal) => left.has(signal));
}

function buildPreferences(
  rows: TicketRecommendationAnswer[],
): UserPreferences {
  const answers = new Map(rows.map((row) => [row.question_order, row]));
  const exactRatings = new Map<string, number>();
  const ratedSignals: Array<{ rating: number; signals: string[] }> = [];

  for (const row of rows) {
    const rating = parseTicketRatingAnswer(row.answer_text);
    const value = ratingValue(rating?.rating);
    if (!rating || value == null) continue;

    exactRatings.set(rating.ticket_id, value);
    ratedSignals.push({
      rating: value,
      signals: Array.from(signalSet(rating.signal_tags)),
    });
  }

  return {
    answers,
    exactRatings,
    ratedSignals,
    roles: answerValues(answers, 5),
    comfortablePeople: answerValues(answers, 6),
    avoidances: new Set(answerValues(answers, 8)),
    romancePreference: ratingValue(answerValues(answers, 7)[0]),
  };
}

function isExcluded(ticket: GatheringTicket, preferences: UserPreferences) {
  const exactRating = preferences.exactRatings.get(ticket.templateId);
  if (exactRating === 1) return true;

  const alcohol = ticket.vibeScores?.alcohol ?? null;
  if (preferences.avoidances.has("heavy_drinking") && alcohol != null && alcohol >= 4) {
    return true;
  }

  return false;
}

function vibeScore(
  ticket: GatheringTicket,
  profile: TicketRecommendationProfile,
) {
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

function directPreferenceScore(
  ticket: GatheringTicket,
  preferences: UserPreferences,
  signals: Set<string>,
) {
  const exactRating = preferences.exactRatings.get(ticket.templateId);
  if (exactRating != null) {
    return {
      score: preferenceScoreByRating[exactRating],
      reason:
        exactRating >= 4
          ? "높게 평가한 티켓 취향과 직접 맞아요."
          : null,
    };
  }

  const relatedRatings = preferences.ratedSignals.filter((rating) =>
    signalOverlap(signals, rating.signals),
  );
  if (relatedRatings.length === 0) return { score: 0, reason: null };

  const averageRating =
    relatedRatings.reduce((sum, rating) => sum + rating.rating, 0) /
    relatedRatings.length;
  const score = Math.max(-16, Math.min(16, (averageRating - 3) * 8));

  return {
    score,
    reason:
      score >= 8 ? "좋게 평가한 티켓과 활동이나 분위기가 닮아 있어요." : null,
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

  const preferenceSignals = [
    ...preferences.roles.flatMap((role) => roleSignalKeywords[role] ?? []),
    ...preferences.comfortablePeople.flatMap(
      (person) => comfortSignalKeywords[person] ?? [],
    ),
  ];
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

  const temperature = ticket.vibeScores?.temperature ?? null;
  const texture = ticket.vibeScores?.texture ?? null;
  const penalties: Array<[string, boolean, number]> = [
    ["too_loud", temperature != null && temperature >= 4, 16],
    ["too_quiet", temperature != null && temperature <= 2, 16],
    ["forced_deep_talk", texture != null && texture >= 4, 12],
    [
      "too_active",
      includesAny(text, ["운동", "러닝", "볼링", "등산", "액티브"]),
      12,
    ],
    [
      "business_networking",
      includesAny(text, ["네트워킹", "비즈니스", "커리어"]),
      18,
    ],
    [
      "long_self_intro",
      includesAny(text, ["자기소개", "소개 시간"]),
      8,
    ],
  ];

  for (const [avoidance, applies, penalty] of penalties) {
    if (preferences.avoidances.has(avoidance) && applies) score -= penalty;
  }

  return { score, reasons };
}

function rankTicket(
  ticket: GatheringTicket,
  profile: TicketRecommendationProfile,
  preferences: UserPreferences,
): RankedTicket {
  const text = normalize(ticketText(ticket));
  const signals = signalSet([
    ticket.activityType,
    ticket.title,
    ticket.subtitle,
    ...ticket.moodTags,
  ]);
  const direct = directPreferenceScore(ticket, preferences, signals);
  const vibe = vibeScore(ticket, profile);
  const conditions = conditionScore(ticket, preferences, text);
  const reasons = [
    direct.reason ? { text: direct.reason, weight: Math.max(direct.score, 0) } : null,
    vibe.reason ? { text: vibe.reason, weight: vibe.score } : null,
    ...conditions.reasons,
  ].filter((reason): reason is { text: string; weight: number } => Boolean(reason));

  return {
    ticket,
    score: direct.score + vibe.score + conditions.score,
    reasons,
    signals,
  };
}

function diversityPenalty(candidate: RankedTicket, selected: RankedTicket[]) {
  return selected.reduce((penalty, current) => {
    const sameActivity =
      candidate.ticket.activityType &&
      candidate.ticket.activityType === current.ticket.activityType;
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
  if (!profile) return tickets.slice(0, MAX_RECOMMENDATIONS_PER_DATE);

  const preferences = buildPreferences(rows);
  const ranked = tickets
    .filter((ticket) => !isExcluded(ticket, preferences))
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
