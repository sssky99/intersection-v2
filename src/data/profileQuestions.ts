import type { ProfileQuestion, QuestionOption } from "@/types/question";
import { ticketCategories } from "@/types/ticketCategory";

export const questionCategories = [
  { key: "낯선 자리 적응", label: "낯선 자리 적응", icon: "Coffee" },
  { key: "대화를 여는 방식", label: "대화를 여는 방식", icon: "MessageCircle" },
  { key: "차이를 다루는 방식", label: "차이를 다루는 방식", icon: "Heart" },
  { key: "만남의 분위기", label: "만남의 분위기", icon: "Sparkles" },
  { key: "하고 싶은 활동", label: "활동 취향", icon: "Ticket" },
  { key: "피하고 싶은 활동", label: "활동 취향", icon: "Ticket" },
  { key: "나의 일", label: "나의 이야기", icon: "PenLine" },
  { key: "관심 주제", label: "나의 이야기", icon: "Sparkles" },
] as const;

const binaryQuestion = ({
  id,
  category,
  scene,
  leftValue,
  leftLabel,
  rightValue,
  rightLabel,
}: {
  id: number;
  category: ProfileQuestion["category"];
  scene: string;
  leftValue: string;
  leftLabel: string;
  rightValue: string;
  rightLabel: string;
}): ProfileQuestion => ({
  id,
  order: id,
  category,
  type: "single_choice",
  question: scene,
  prompt: "나는 어느 쪽에 더 가까울까?",
  options: [
    { value: leftValue, label: leftLabel },
    { value: rightValue, label: rightLabel },
  ],
});

const activityOptions: QuestionOption[] = ticketCategories.map((category) => ({
  value: category,
  label: category,
}));

export const profileQuestions: ProfileQuestion[] = [
  binaryQuestion({
    id: 1,
    category: "낯선 자리 적응",
    scene: "처음 보는 사람들과\n한 테이블에 앉았다.",
    leftValue: "O",
    leftLabel: "조용히 분위기와 사람들의 결을 먼저 살펴볼래요.",
    rightValue: "I",
    rightLabel: "먼저 가벼운 말로 자리를 풀어볼래요.",
  }),
  binaryQuestion({
    id: 2,
    category: "낯선 자리 적응",
    scene: "식사가 시작되고,\n잠깐 어색한 침묵이 생겼다.",
    leftValue: "O",
    leftLabel: "다른 사람이 말을 건넬 때까지 기다려볼래요.",
    rightValue: "I",
    rightLabel: "짧은 질문이나 농담으로 분위기를 열어볼래요.",
  }),
  binaryQuestion({
    id: 3,
    category: "낯선 자리 적응",
    scene: "처음 만난 사람들과\n대화가 막 시작되려는 순간.",
    leftValue: "O",
    leftLabel: "상대가 편해질 때까지 천천히 반응해볼래요.",
    rightValue: "I",
    rightLabel: "먼저 리액션을 보내며 대화에 들어가볼래요.",
  }),
  binaryQuestion({
    id: 4,
    category: "낯선 자리 적응",
    scene: "저녁 자리가 조금씩\n편해지고 있다.",
    leftValue: "O",
    leftLabel: "시간이 지날수록 천천히 내 이야기를 꺼내볼래요.",
    rightValue: "I",
    rightLabel: "초반부터 내 이야기를 조금씩 나눠볼래요.",
  }),
  binaryQuestion({
    id: 5,
    category: "대화를 여는 방식",
    scene: "누군가 자신의 이야기를\n조심스럽게 꺼냈다.",
    leftValue: "L",
    leftLabel: "말을 끊지 않고 천천히 들어볼래요.",
    rightValue: "Q",
    rightLabel: "더 궁금한 점을 자연스럽게 물어볼래요.",
  }),
  binaryQuestion({
    id: 6,
    category: "대화를 여는 방식",
    scene: "대화가 한 사람의\n취향 이야기로 이어지고 있다.",
    leftValue: "L",
    leftLabel: "상대가 편하게 말할 수 있게 반응해볼래요.",
    rightValue: "Q",
    rightLabel: "그 취향이 왜 좋은지 더 물어볼래요.",
  }),
  binaryQuestion({
    id: 7,
    category: "대화를 여는 방식",
    scene: "테이블에 아직 서로\n잘 모르는 사람들이 앉아 있다.",
    leftValue: "L",
    leftLabel: "사람들의 이야기가 자연스럽게 나오길 기다려볼래요.",
    rightValue: "Q",
    rightLabel: "가벼운 질문으로 서로를 알아가게 해볼래요.",
  }),
  binaryQuestion({
    id: 8,
    category: "대화를 여는 방식",
    scene: "누군가 조금 깊은\n이야기를 꺼냈다.",
    leftValue: "L",
    leftLabel: "그 마음을 충분히 들어주는 쪽을 택할래요.",
    rightValue: "Q",
    rightLabel: "그 이야기를 더 잘 이해하기 위해 물어볼래요.",
  }),
  binaryQuestion({
    id: 9,
    category: "차이를 다루는 방식",
    scene: "나와 전혀 다른 생각을 가진\n사람이 이야기를 꺼냈다.",
    leftValue: "H",
    leftLabel: "먼저 공감할 수 있는 부분을 찾아볼래요.",
    rightValue: "W",
    rightLabel: "왜 그렇게 생각하는지 더 들어보고 싶어요.",
  }),
  binaryQuestion({
    id: 10,
    category: "차이를 다루는 방식",
    scene: "테이블 안에서 취향이\n서로 다르다는 걸 알게 됐다.",
    leftValue: "H",
    leftLabel: "서로 편하게 느낄 수 있는 공통점을 찾아볼래요.",
    rightValue: "W",
    rightLabel: "다른 취향에서 예상 밖의 재미를 찾아볼래요.",
  }),
  binaryQuestion({
    id: 11,
    category: "차이를 다루는 방식",
    scene: "대화 중 누군가\n조금 낯선 관점을 말했다.",
    leftValue: "H",
    leftLabel: "분위기가 불편해지지 않게 부드럽게 받아볼래요.",
    rightValue: "W",
    rightLabel: "그 낯선 관점이 어디서 왔는지 궁금해져요.",
  }),
  binaryQuestion({
    id: 12,
    category: "차이를 다루는 방식",
    scene: "서로의 생각이 조금 다르게\n흘러가는 순간이 생겼다.",
    leftValue: "H",
    leftLabel: "대화가 편안하게 이어지도록 균형을 잡아볼래요.",
    rightValue: "W",
    rightLabel: "차이가 드러나는 지점을 조금 더 이야기해보고 싶어요.",
  }),
  binaryQuestion({
    id: 13,
    category: "만남의 분위기",
    scene: "오늘의 식사 모임이 끝났을 때,\n더 좋은 기억으로 남을 장면은?",
    leftValue: "C",
    leftLabel: "부담 없이 편안하게 머물렀던 시간",
    rightValue: "E",
    rightLabel: "예상 밖의 이야기를 발견했던 시간",
  }),
  binaryQuestion({
    id: 14,
    category: "만남의 분위기",
    scene: "처음 보는 사람들과 저녁을 함께한다면,\n더 끌리는 분위기는?",
    leftValue: "C",
    leftLabel: "말이 많지 않아도 편안한 분위기",
    rightValue: "E",
    rightLabel: "새로운 이야기가 계속 열리는 분위기",
  }),
  binaryQuestion({
    id: 15,
    category: "만남의 분위기",
    scene: "나와 잘 맞는 사람들을\n떠올려본다.",
    leftValue: "C",
    leftLabel: "함께 있으면 긴장이 풀리는 사람들",
    rightValue: "E",
    rightLabel: "함께 있으면 새로운 내가 나오는 사람들",
  }),
  binaryQuestion({
    id: 16,
    category: "만남의 분위기",
    scene: "교집합에서\n기대하는 만남은?",
    leftValue: "C",
    leftLabel: "천천히 편해지는 안정적인 만남",
    rightValue: "E",
    rightLabel: "생각보다 즐거운 발견이 있는 만남",
  }),
  {
    id: 17,
    order: 17,
    category: "하고 싶은 활동",
    type: "multi_choice",
    maxSelections: 3,
    question: "교집합에서 어떤 활동을\n해보고 싶나요?",
    prompt: "마음이 가는 순서대로 최대 3개를 골라주세요.",
    options: [
      ...activityOptions,
      { value: "any_activity", label: "뭐든 다 괜찮아요", exclusive: true },
    ],
  },
  {
    id: 18,
    order: 18,
    category: "피하고 싶은 활동",
    type: "multi_choice",
    maxSelections: 3,
    question: "가능하면 피하고 싶은\n활동이 있나요?",
    prompt: "부담스럽게 느껴지는 활동을 최대 3개까지 골라주세요.",
    options: [
      ...activityOptions,
      { value: "no_avoidance", label: "딱히 없어요", exclusive: true },
    ],
  },
  {
    id: 19,
    order: 19,
    category: "나의 일",
    type: "text",
    question: "요즘 어떤 일을 하며 지내는지\n간단하게 소개해주세요.",
    description:
      "회사명이나 정확한 직함보다, 요즘 어떤 일을 하거나 무엇을 준비하며 지내는지 편하게 적어주세요.",
    placeholder: "예: 브랜드 마케팅 일을 하며 콘텐츠를 기획하고 있어요.",
  },
  {
    id: 20,
    order: 20,
    category: "관심 주제",
    type: "text",
    question: "요즘 자주 생각하거나\n관심을 가지는 것은 무엇인가요?",
    description:
      "취미, 콘텐츠, 일상의 고민처럼 가벼운 내용도 괜찮아요. 최근 마음이 가는 것을 편하게 적어주세요.",
    placeholder: "예: 요즘은 전시와 산책, 일과 삶의 균형에 관심이 있어요.",
  },
];
