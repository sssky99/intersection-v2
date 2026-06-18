export const vibeAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
  "alcohol",
  "romance",
] as const;

export type VibeAxis = (typeof vibeAxes)[number];

export type VibeScores = Partial<Record<VibeAxis, number | null | undefined>>;

export const vibeAxisConfig: Record<
  VibeAxis,
  {
    label: string;
    leftLabel: string;
    rightLabel: string;
  }
> = {
  temperature: {
    label: "온도",
    leftLabel: "차분한",
    rightLabel: "활기찬",
  },
  texture: {
    label: "결",
    leftLabel: "일상적인",
    rightLabel: "깊이 있는",
  },
  tone: {
    label: "톤",
    leftLabel: "공감 중심",
    rightLabel: "분석 중심",
  },
  rhythm: {
    label: "리듬",
    leftLabel: "계획적인",
    rightLabel: "즉흥적인",
  },
  alcohol: {
    label: "술",
    leftLabel: "술이 없는",
    rightLabel: "술이 있는",
  },
  romance: {
    label: "설렘",
    leftLabel: "편한 관계",
    rightLabel: "설렘 가능성",
  },
};
