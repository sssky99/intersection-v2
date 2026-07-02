export const ticketCategories = [
  "쇼핑 / 취향탐색",
  "활동 / 체험",
  "문화콘텐츠",
  "오락",
  "독서",
  "식사 / 카페",
] as const;

export type TicketCategory = (typeof ticketCategories)[number];

export const ticketCategoryOptions = ticketCategories.map((category) => ({
  value: category,
  label: category,
}));

function compact(value: string) {
  return value
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

const ticketCategoryAliases = new Map<string, TicketCategory>(
  [
    ["쇼핑 / 취향탐색", "쇼핑 / 취향탐색"],
    ["쇼핑/취향탐색", "쇼핑 / 취향탐색"],
    ["쇼핑", "쇼핑 / 취향탐색"],
    ["취향탐색", "쇼핑 / 취향탐색"],
    ["shop", "쇼핑 / 취향탐색"],
    ["shopping", "쇼핑 / 취향탐색"],

    ["활동 / 체험", "활동 / 체험"],
    ["활동/체험", "활동 / 체험"],
    ["활동", "활동 / 체험"],
    ["체험", "활동 / 체험"],
    ["activity", "활동 / 체험"],
    ["picture", "활동 / 체험"],

    ["문화콘텐츠", "문화콘텐츠"],
    ["문화 콘텐츠", "문화콘텐츠"],
    ["문화", "문화콘텐츠"],
    ["콘텐츠", "문화콘텐츠"],
    ["movie", "문화콘텐츠"],
    ["display", "문화콘텐츠"],
    ["exhibition", "문화콘텐츠"],
    ["culture", "문화콘텐츠"],

    ["오락", "오락"],
    ["게임", "오락"],
    ["보드게임", "오락"],
    ["boardgame", "오락"],
    ["game", "오락"],
    ["entertainment", "오락"],

    ["독서", "독서"],
    ["책", "독서"],
    ["book", "독서"],
    ["books", "독서"],
    ["reading", "독서"],

    ["식사 / 카페", "식사 / 카페"],
    ["식사/카페", "식사 / 카페"],
    ["식사", "식사 / 카페"],
    ["카페", "식사 / 카페"],
    ["dinner", "식사 / 카페"],
    ["food", "식사 / 카페"],
    ["cafe", "식사 / 카페"],
    ["pizza", "식사 / 카페"],
    ["talk", "식사 / 카페"],
  ].map(([alias, category]) => [compact(alias), category as TicketCategory]),
);

const ticketCategoryKeywordRules: Array<{
  category: TicketCategory;
  keywords: string[];
}> = [
  {
    category: "쇼핑 / 취향탐색",
    keywords: ["쇼핑", "취향", "동묘", "빈티지", "구제", "플리마켓", "물건"],
  },
  {
    category: "문화콘텐츠",
    keywords: [
      "영화",
      "토이스토리",
      "전시",
      "공연",
      "뮤지컬",
      "미술",
      "감상",
      "콘텐츠",
      "문화",
    ],
  },
  {
    category: "오락",
    keywords: ["보드게임", "게임", "오락", "웃음", "놀이"],
  },
  {
    category: "독서",
    keywords: ["책", "독서", "소설", "북", "서점"],
  },
  {
    category: "활동 / 체험",
    keywords: [
      "활동",
      "체험",
      "클래스",
      "워크숍",
      "산책",
      "러닝",
      "운동",
      "볼링",
      "사진",
      "컬러헌팅",
      "한강",
    ],
  },
  {
    category: "식사 / 카페",
    keywords: [
      "식사",
      "카페",
      "커피",
      "디저트",
      "맛집",
      "피자",
      "저녁",
      "브런치",
      "음식",
      "대화",
    ],
  },
];

export function normalizeTicketCategory(
  value: unknown,
): TicketCategory | null {
  if (typeof value !== "string") return null;

  const normalized = compact(value);
  if (!normalized) return null;

  const exact = ticketCategoryAliases.get(normalized);
  if (exact) return exact;

  return (
    ticketCategoryKeywordRules.find((rule) =>
      rule.keywords.some((keyword) => normalized.includes(compact(keyword))),
    )?.category ?? null
  );
}

export function inferTicketCategory({
  activityType,
  title,
  moodTags,
  shortDescription,
}: {
  activityType?: string | null;
  title?: string | null;
  moodTags?: string[] | null;
  shortDescription?: string | null;
}) {
  return (
    normalizeTicketCategory(activityType) ??
    normalizeTicketCategory(
      [title, ...(moodTags ?? []), shortDescription].filter(Boolean).join(" "),
    )
  );
}
