export const activityLabels: Record<string, string> = {
  meal: "식사·카페",
  culture: "문화 콘텐츠",
  outdoor: "활동·체험",
  play: "오락",
  reading: "독서",
  taste: "취향 탐색",
};

export const interestLabels: Record<string, string> = {
  travel: "여행",
  food: "맛집·요리",
  coffee: "카페·커피",
  movie: "영화·드라마",
  music: "음악",
  book: "독서",
  exhibition: "전시·디자인",
  fitness: "운동",
  nature: "자연·등산",
  game: "게임·보드게임",
  photo: "사진",
  growth: "심리·성장",
};

export const activityValues = Object.keys(activityLabels);
export const interestValues = Object.keys(interestLabels);

export function normalizeRecommendationAudienceValues(
  value: unknown,
  allowedValues: string[],
) {
  if (!Array.isArray(value)) return [];

  const allowed = new Set(allowedValues);
  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && allowed.has(item),
      ),
    ),
  ).slice(0, 3);
}
