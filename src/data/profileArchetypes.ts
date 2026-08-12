import type { StoredAnswerRow } from "@/types/question";
import { ticketCategories } from "@/types/ticketCategory";

export const profileArchetypeIds = [
  "romantic",
  "sentimental",
  "bohemian",
  "adventurer",
  "experientialist",
  "stoic",
  "searcher",
  "idealist",
  "artisan",
  "visionary",
] as const;

export type ProfileArchetypeId = (typeof profileArchetypeIds)[number];

export const profileArchetypeVersion = "profile-archetypes-v1";

export const profileArchetypeBackgrounds: Record<ProfileArchetypeId, string> = {
  romantic: "/images/profile-archetypes/romantic.jpg",
  sentimental: "/images/profile-archetypes/sentimental.jpg",
  bohemian: "/images/profile-archetypes/bohemian.jpg",
  adventurer: "/images/profile-archetypes/adventurer.jpg",
  experientialist: "/images/profile-archetypes/experientialist.jpg",
  stoic: "/images/profile-archetypes/stoic.jpg",
  searcher: "/images/profile-archetypes/searcher.jpg",
  idealist: "/images/profile-archetypes/idealist.jpg",
  artisan: "/images/profile-archetypes/artisan.jpg",
  visionary: "/images/profile-archetypes/visionary.jpg",
};

export function isProfileArchetypeId(
  value: unknown,
): value is ProfileArchetypeId {
  return (
    typeof value === "string" &&
    profileArchetypeIds.includes(value as ProfileArchetypeId)
  );
}

export const profileArchetypes: Record<
  ProfileArchetypeId,
  { englishName: string; koreanName: string; description: string }
> = {
  romantic: {
    englishName: "Romantic",
    koreanName: "낭만주의자",
    description: "사람 사이의 끌림과 따뜻한 교감을 중요하게 여겨요.",
  },
  sentimental: {
    englishName: "Sentimental",
    koreanName: "감성주의자",
    description: "감정의 결을 섬세하게 느끼고 마음에 오래 담아두는 편이에요.",
  },
  bohemian: {
    englishName: "Bohemian",
    koreanName: "자유로운 영혼",
    description: "정해진 방식보다 자유로운 취향과 자기만의 리듬을 따라가요.",
  },
  adventurer: {
    englishName: "Adventurer",
    koreanName: "모험가",
    description: "낯선 장소와 새로운 도전을 직접 마주할 때 살아 있음을 느껴요.",
  },
  experientialist: {
    englishName: "Experientialist",
    koreanName: "경험주의자",
    description: "생각에 머무르기보다 다양한 경험을 직접 해보는 일을 좋아해요.",
  },
  stoic: {
    englishName: "Stoic",
    koreanName: "안정가",
    description: "차분한 기준과 현실적인 판단으로 자신만의 균형을 지켜요.",
  },
  searcher: {
    englishName: "Searcher",
    koreanName: "탐색가",
    description: "질문을 던지고 새로운 관점과 지식을 발견하는 과정에 끌려요.",
  },
  idealist: {
    englishName: "Idealist",
    koreanName: "이상주의자",
    description: "사람과 세상이 더 나아질 가능성을 믿고 가치 있는 관계를 바라요.",
  },
  artisan: {
    englishName: "Artisan",
    koreanName: "예술가",
    description: "감각과 취향을 구체적인 결과물로 표현하는 데 즐거움을 느껴요.",
  },
  visionary: {
    englishName: "Visionary",
    koreanName: "미래지향가",
    description: "지금보다 앞으로의 가능성을 보고 새로운 방향을 그리는 편이에요.",
  },
};

type ScoreMap = Record<ProfileArchetypeId, number>;

export const profileArchetypeAssignmentGuide: Record<
  ProfileArchetypeId,
  { summary: string; signals: string[] }
> = {
  romantic: {
    summary: "관계의 친밀감과 정서적 교감을 적극적으로 추구",
    signals: [
      "새로운 사람과 쉽게 가까워짐",
      "논리보다 공감과 위로를 우선",
      "반려동물·관계·친밀감 선호",
    ],
  },
  sentimental: {
    summary: "감정과 분위기를 섬세하게 느끼고 정서적으로 반응",
    signals: [
      "조심스럽게 관계를 시작함",
      "공감과 위로를 우선",
      "음악·영화·사진·반려동물 선호",
    ],
  },
  bohemian: {
    summary: "자유로운 취향과 즉흥성, 개성 있는 경험을 선호",
    signals: [
      "활기찬 자리와 즉흥적인 선택 선호",
      "문화·예술·취향 탐색 관심",
      "계획·규칙보다 자유로운 방식 선호",
    ],
  },
  adventurer: {
    summary: "새로운 장소와 도전을 몸으로 직접 경험",
    signals: [
      "운동·여행·아웃도어 관심",
      "새로운 활동에 대한 거부가 적음",
      "도전적인 업무·경험 선호",
    ],
  },
  experientialist: {
    summary: "생각보다 실행과 다양한 실제 경험을 중시",
    signals: [
      "활기찬 자리와 새로운 사람에 개방적",
      "운동·요리·여행 등 체험 선호",
      "분석보다 직접 해보는 선택 선호",
    ],
  },
  stoic: {
    summary: "차분한 환경, 현실적인 판단과 안정적인 계획을 중시",
    signals: [
      "조용한 자리와 논리적 해결 선호",
      "안정·계획·현실성을 중시",
      "독서와 차분한 활동 선호",
    ],
  },
  searcher: {
    summary: "질문과 탐구를 통해 새로운 관점과 지식을 발견",
    signals: [
      "조용한 환경에서 깊이 탐색",
      "독서·지식·심리·연구 관심",
      "경험의 의미와 새로운 관점을 중시",
    ],
  },
  idealist: {
    summary: "가치와 관계의 가능성, 더 나은 방향을 중요하게 생각",
    signals: [
      "공감과 관계의 의미를 중시",
      "사회·인문·성장 주제 관심",
      "새로운 관점과 가치 있는 선택 선호",
    ],
  },
  artisan: {
    summary: "감각과 취향을 창작이나 구체적인 결과물로 표현",
    signals: [
      "음악·사진·요리·공예·문화 관심",
      "미적 감각과 표현 활동 선호",
      "디자인·예술·콘텐츠 분야 관심",
    ],
  },
  visionary: {
    summary: "미래 가능성과 성장 방향을 보고 계획적으로 움직임",
    signals: [
      "목표·계획·성장 가능성을 중시",
      "기술·창업·미래·새로운 관점 관심",
      "장기적인 의미와 방향을 탐색",
    ],
  },
};

export const profileArchetypeScoreCalibration: Record<
  ProfileArchetypeId,
  number
> = {
  romantic: 1.2,
  sentimental: 1.1,
  bohemian: 0.9,
  adventurer: 1.65,
  experientialist: 0.82,
  stoic: 0.9,
  searcher: 0.85,
  idealist: 1.25,
  artisan: 1.55,
  visionary: 1.2,
};

function emptyScores(): ScoreMap {
  return Object.fromEntries(
    profileArchetypeIds.map((id) => [id, 0]),
  ) as ScoreMap;
}

function valuesByOrder(rows: StoredAnswerRow[]) {
  return new Map(
    rows.map((row) => [
      row.question_order,
      row.answer_values?.length
        ? row.answer_values
        : row.answer_value
          ? [row.answer_value]
          : [],
    ]),
  );
}

function add(
  scores: ScoreMap,
  ids: ProfileArchetypeId[],
  weight = 1,
) {
  ids.forEach((id) => {
    scores[id] += weight;
  });
}

function stableNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function answerSeed(rows: StoredAnswerRow[]) {
  return rows
    .map(
      (row) =>
        `${row.question_order}:${row.answer_value ?? ""}:${row.answer_values?.join(",") ?? ""}:${row.answer_text ?? ""}`,
    )
    .join("|");
}

function pickProfileArchetype(
  scores: ScoreMap,
  rows: StoredAnswerRow[],
  seed = "",
) {
  const ranked = [...profileArchetypeIds].sort(
    (left, right) =>
      scores[right] * profileArchetypeScoreCalibration[right] -
      scores[left] * profileArchetypeScoreCalibration[left],
  );
  const first = ranked[0];
  const second = ranked[1];
  const firstScore = scores[first] * profileArchetypeScoreCalibration[first];
  const secondScore = scores[second] * profileArchetypeScoreCalibration[second];
  const similar =
    firstScore - secondScore <= Math.max(0.75, Math.abs(firstScore) * 0.08);

  if (!similar) return first;
  return stableNumber(`${seed}|${answerSeed(rows)}`) % 2 === 0
    ? first
    : second;
}

export function classifyProfileArchetype(
  rows: StoredAnswerRow[],
  seed = "",
): ProfileArchetypeId {
  const scores = emptyScores();
  const answers = valuesByOrder(rows);
  const selected = (order: number, value: string) =>
    answers.get(order)?.includes(value) === true;
  const numeric = (order: number, fallback = 0) => {
    const raw = answers.get(order)?.[0] ?? "";
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const suffix = Number(raw.match(/(?:scale_)(\d+)$/)?.[1]);
    return Number.isFinite(suffix) ? suffix : fallback;
  };
  const scale = (
    order: number,
    min: number,
    max: number,
    low: ProfileArchetypeId[],
    high: ProfileArchetypeId[],
    weight = 2,
  ) => {
    const value = numeric(order, (min + max) / 2);
    const highShare = Math.max(0, Math.min(1, (value - min) / (max - min)));
    add(scores, low, weight * (1 - highShare));
    add(scores, high, weight * highShare);
  };
  const choice = (
    order: number,
    value: string,
    ids: ProfileArchetypeId[],
    weight = 1,
  ) => {
    if (selected(order, value)) add(scores, ids, weight);
  };

  scale(6, 1, 7, ["stoic", "searcher"], ["bohemian", "experientialist"], 2.5);
  scale(7, 1, 7, ["sentimental", "searcher"], ["romantic", "experientialist"], 2.5);
  scale(8, 1, 7, ["stoic", "searcher"], ["sentimental", "romantic", "idealist"], 2.5);
  scale(9, 1, 5, ["bohemian", "sentimental"], ["visionary", "searcher"], 1.5);
  scale(10, 1, 7, ["bohemian", "sentimental"], ["stoic", "visionary"], 1.2);
  scale(11, 1, 5, ["stoic"], ["bohemian", "experientialist"], 1);
  scale(12, 1, 5, ["stoic"], ["bohemian"], 0.8);

  const hobbySignals: Array<[string, ProfileArchetypeId[]]> = [
    ["exercise", ["adventurer", "experientialist"]],
    ["reading", ["searcher", "stoic"]],
    ["music", ["sentimental", "artisan"]],
    ["movie", ["sentimental", "romantic"]],
    ["cooking", ["artisan", "experientialist"]],
    ["photo", ["artisan", "sentimental"]],
    ["travel", ["adventurer", "experientialist"]],
    ["culture", ["artisan", "bohemian"]],
    ["craft", ["artisan"]],
    ["pet", ["romantic", "sentimental"]],
  ];
  hobbySignals.forEach(([value, ids]) => choice(13, value, ids, 1.4));

  choice(14, "interests_choice_1", ["romantic"], 1.4);
  choice(14, "interests_choice_2", ["searcher", "idealist"], 1.3);
  choice(14, "interests_choice_3", ["visionary", "searcher"], 1.3);
  choice(14, "interests_choice_4", ["searcher", "idealist"], 1.3);
  choice(14, "interests_choice_6", ["sentimental", "artisan"], 1.2);
  choice(14, "interests_choice_9", ["adventurer", "experientialist"], 1.3);
  choice(14, "interests_choice_13", ["visionary"], 1.6);
  choice(14, "interests_choice_14", ["artisan", "bohemian"], 1.5);
  choice(14, "interests_choice_15", ["artisan", "sentimental"], 1.3);
  choice(14, "interests_choice_16", ["visionary", "searcher"], 1.4);
  choice(14, "interests_choice_17", ["idealist", "searcher"], 1.4);

  if (!selected(15, "none")) add(scores, ["experientialist", "adventurer"], 0.8);
  scale(19, 1, 5, ["stoic"], ["artisan", "bohemian"], 3);
  scale(20, 1, 7, ["stoic"], ["searcher", "visionary", "idealist"], 3);
  scale(21, 1, 10, ["sentimental"], ["romantic", "bohemian"], 1.2);
  scale(22, 1, 10, ["experientialist"], ["searcher", "visionary"], 2);
  scale(23, 1, 5, ["idealist", "sentimental"], ["romantic", "bohemian"], 1.2);
  scale(24, 1, 7, ["experientialist"], ["searcher", "idealist", "visionary"], 1.6);
  scale(25, 1, 5, ["stoic"], ["idealist", "searcher", "bohemian"], 1.8);
  scale(27, 1, 5, ["bohemian", "experientialist"], ["visionary", "stoic"], 1.8);

  choice(28, "work_field_choice_3", ["visionary", "searcher"], 1.2);
  choice(28, "work_field_choice_4", ["artisan", "bohemian"], 1.5);
  choice(28, "work_field_choice_6", ["artisan", "sentimental"], 1.2);
  choice(28, "work_field_choice_7", ["searcher", "idealist"], 1.3);
  choice(28, "work_field_choice_16", ["visionary", "adventurer"], 1.5);
  choice(28, "work_field_choice_17", ["artisan", "bohemian"], 1.6);

  return pickProfileArchetype(scores, rows, seed);
}

export function classifyLegacyProfileArchetype(
  rows: StoredAnswerRow[],
  seed = "",
): ProfileArchetypeId {
  const scores = emptyScores();
  const answers = valuesByOrder(rows);
  const values = (order: number) => answers.get(order) ?? [];
  const has = (order: number, value: string) => values(order).includes(value);

  for (let order = 1; order <= 4; order += 1) {
    if (has(order, "O")) add(scores, ["stoic", "searcher", "sentimental"], 1.4);
    if (has(order, "I")) add(scores, ["adventurer", "experientialist", "bohemian"], 1.4);
  }
  for (let order = 5; order <= 8; order += 1) {
    if (has(order, "L")) add(scores, ["sentimental", "romantic", "stoic"], 1.5);
    if (has(order, "Q")) add(scores, ["searcher", "visionary", "experientialist"], 1.5);
  }
  for (let order = 9; order <= 12; order += 1) {
    if (has(order, "H")) add(scores, ["idealist", "romantic", "stoic"], 1.5);
    if (has(order, "W")) add(scores, ["searcher", "bohemian", "visionary"], 1.5);
  }
  for (let order = 13; order <= 16; order += 1) {
    if (has(order, "C")) add(scores, ["stoic", "sentimental", "romantic"], 1.5);
    if (has(order, "E")) add(scores, ["adventurer", "experientialist", "bohemian"], 1.5);
  }

  const activityTypes: ProfileArchetypeId[][] = [
    ["artisan", "bohemian"],
    ["adventurer", "experientialist"],
    ["artisan", "sentimental"],
    ["bohemian", "experientialist"],
    ["searcher", "stoic"],
    ["romantic", "experientialist"],
  ];
  [17, 18].forEach((order) => {
    values(order).forEach((value) => {
      const index = ticketCategories.indexOf(
        value as (typeof ticketCategories)[number],
      );
      if (index >= 0) add(scores, activityTypes[index], 1.8);
    });
  });

  const freeText = rows
    .map((row) => `${row.answer_text ?? ""} ${row.other_text ?? ""}`)
    .join(" ")
    .toLocaleLowerCase("ko-KR");
  const textSignals: Array<[RegExp, ProfileArchetypeId[]]> = [
    [/여행|운동|아웃도어|도전|travel|fitness|outdoor/, ["adventurer", "experientialist"]],
    [/전시|미술|디자인|사진|음악|창작|art|design|photo|music/, ["artisan", "sentimental"]],
    [/책|독서|공부|연구|배우|book|read|study|research/, ["searcher", "idealist"]],
    [/기술|개발|미래|창업|성장|tech|develop|future|startup|growth/, ["visionary", "searcher"]],
    [/사람|관계|친구|사랑|people|relationship|friend|love/, ["romantic", "idealist"]],
    [/자유|개성|취향|패션|free|unique|fashion/, ["bohemian", "artisan"]],
    [/안정|차분|휴식|일상|stable|calm|rest/, ["stoic", "sentimental"]],
  ];
  textSignals.forEach(([pattern, ids]) => {
    if (pattern.test(freeText)) add(scores, ids, 1.6);
  });

  return pickProfileArchetype(scores, rows, seed);
}
