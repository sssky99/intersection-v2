export type TicketPreferenceAnswer = "yes" | "no";

export type OnboardingTicketSample = {
  id: string;
  title: string;
  subtitle: string;
  region: string;
  activityType: string;
  tags: string[];
  imageUrl: string;
};

export type TicketPreferenceResult = {
  ticket_id: string;
  title: string;
  activity_type: string;
  answer: TicketPreferenceAnswer;
  tags: string[];
};

export const onboardingTicketSamples: OnboardingTicketSample[] = [
  {
    id: "cafe_light_talk",
    title: "조용한 카페에서 가볍게 대화하는 저녁",
    subtitle: "부담 없는 분위기에서 천천히 가까워지는 자리",
    region: "성수",
    activityType: "cafe",
    tags: ["카페", "가벼운 대화", "차분한 분위기"],
    imageUrl: "/images/landing-gathering.png",
  },
  {
    id: "lp_bar_slow_talk",
    title: "LP바에서 음악 들으며 천천히 대화하는 밤",
    subtitle: "좋은 음악과 함께 자연스럽게 이야기가 이어지는 자리",
    region: "을지로",
    activityType: "lp_bar",
    tags: ["LP바", "음악", "무드 있는 대화"],
    imageUrl: "/images/landing-cinematic.png",
  },
  {
    id: "exhibition_cafe_talk",
    title: "전시를 보고 카페에서 생각을 나누는 오후",
    subtitle: "감상과 취향이 자연스럽게 대화가 되는 자리",
    region: "한남",
    activityType: "exhibition",
    tags: ["전시", "문화생활", "생각 나누기"],
    imageUrl: "/images/landing-cinematic.png",
  },
  {
    id: "pizza_easy_dinner",
    title: "화덕피자 먹으며 편하게 친해지는 저녁",
    subtitle: "맛있는 음식을 사이에 두고 가볍게 가까워지는 자리",
    region: "강남",
    activityType: "dinner",
    tags: ["저녁식사", "맛집", "편한 분위기"],
    imageUrl: "/images/landing-gathering.png",
  },
  {
    id: "wine_deep_talk",
    title: "와인바에서 깊은 이야기를 나누는 자리",
    subtitle: "조금 더 차분하게 서로의 생각을 듣는 밤",
    region: "연남",
    activityType: "wine_bar",
    tags: ["와인바", "깊은 대화", "차분한 밤"],
    imageUrl: "/images/landing-people.jpg",
  },
];

export function parseTicketPreferenceResults(
  value: string | null | undefined,
): TicketPreferenceResult[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is TicketPreferenceResult =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as TicketPreferenceResult).ticket_id === "string" &&
        typeof (item as TicketPreferenceResult).title === "string" &&
        typeof (item as TicketPreferenceResult).activity_type === "string" &&
        ((item as TicketPreferenceResult).answer === "yes" ||
          (item as TicketPreferenceResult).answer === "no") &&
        Array.isArray((item as TicketPreferenceResult).tags),
    );
  } catch {
    return [];
  }
}
