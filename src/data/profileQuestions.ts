import type { ProfileQuestion } from "@/types/question";

export const questionCategories = [
  { key: "온도", label: "온도", icon: "Coffee" },
  { key: "결", label: "결", icon: "MessageCircle" },
  { key: "톤", label: "톤", icon: "Heart" },
  { key: "리듬", label: "리듬", icon: "Sparkles" },
  { key: "모임 역할", label: "모임 역할", icon: "Users" },
  { key: "모임 역할 - 상대", label: "편한 상대", icon: "Users" },
  { key: "관계 기대", label: "관계 기대", icon: "Heart" },
  { key: "회피 조건", label: "회피 조건", icon: "X" },
  { key: "나이 조건", label: "나이 조건", icon: "Users" },
  { key: "모임 취향", label: "모임 취향", icon: "Ticket" },
  { key: "자기소개", label: "자기소개", icon: "PenLine" },
] as const;

const baseQuestions: ProfileQuestion[] = [
  {
    id: 1,
    order: 1,
    category: "온도",
    type: "single_choice",
    question: "새로운 사람들과 함께 있을 때, 나는 어떤 분위기에서 더 편해지나요?",
    scaleLabel: "차분형 ↔ 활기형",
    options: [
      { value: "1", label: "조용하고 차분한 자리가 훨씬 편해요." },
      { value: "2", label: "너무 시끄럽지 않은 소규모 자리가 좋아요." },
      {
        value: "3",
        label: "분위기에 따라 조용한 자리도, 활기찬 자리도 괜찮아요.",
      },
      { value: "4", label: "적당히 활기 있는 자리에서 에너지가 나요." },
      {
        value: "5",
        label: "사람이 많고 활기찬 자리에서 더 잘 풀리는 편이에요.",
      },
    ],
  },
  {
    id: 2,
    order: 2,
    category: "결",
    type: "single_choice",
    question: "처음 만난 사람과 대화할 때, 어떤 이야기가 더 잘 이어지나요?",
    scaleLabel: "현실·경험 중심 ↔ 의미·아이디어 중심",
    options: [
      {
        value: "1",
        label: "오늘 있었던 일, 맛집, 취미처럼 구체적인 이야기가 편해요.",
      },
      {
        value: "2",
        label: "서로의 경험이나 일상 이야기를 나누는 게 좋아요.",
      },
      {
        value: "3",
        label: "현실적인 이야기도, 생각을 나누는 이야기도 둘 다 괜찮아요.",
      },
      {
        value: "4",
        label: "왜 그런지, 어떤 의미인지처럼 생각을 나누는 대화가 좋아요.",
      },
      {
        value: "5",
        label: "가치관, 아이디어, 사회, 미래 같은 넓은 주제로 이어질 때 재미있어요.",
      },
    ],
  },
  {
    id: 3,
    order: 3,
    category: "톤",
    type: "single_choice",
    question: "누군가 고민을 말했을 때, 나는 어떤 방식으로 반응하는 편인가요?",
    scaleLabel: "공감 중심 ↔ 분석·해결 중심",
    options: [
      { value: "1", label: "먼저 감정을 충분히 들어주는 편이에요." },
      { value: "2", label: "공감해주고, 천천히 이야기를 들어주려 해요." },
      { value: "3", label: "공감도 하고, 필요한 말도 함께 해주는 편이에요." },
      {
        value: "4",
        label: "상황을 정리해주고 현실적인 조언을 해주는 편이에요.",
      },
      { value: "5", label: "문제를 분석하고 해결책을 찾는 쪽에 가까워요." },
    ],
  },
  {
    id: 4,
    order: 4,
    category: "리듬",
    type: "single_choice",
    question: "모임의 흐름은 어느 쪽이 더 편한가요?",
    scaleLabel: "계획·구조 선호 ↔ 자유·즉흥 선호",
    options: [
      {
        value: "1",
        label: "시간, 장소, 순서가 어느 정도 정해져 있어야 편해요.",
      },
      { value: "2", label: "큰 흐름은 미리 정해져 있는 게 좋아요." },
      {
        value: "3",
        label: "정해진 흐름도 괜찮고, 자연스럽게 흘러가도 괜찮아요.",
      },
      { value: "4", label: "분위기에 따라 유연하게 바뀌는 게 좋아요." },
      {
        value: "5",
        label: "즉흥적으로 다음 이야기나 장소가 정해지는 자유로운 흐름이 좋아요.",
      },
    ],
  },
  {
    id: 5,
    order: 5,
    category: "모임 역할",
    type: "multi_choice",
    maxSelections: 2,
    question:
      "처음 만난 자리에서 나에게 가까운 모습을 골라주세요.\n최대 2개까지 선택할 수 있어요.",
    options: [
      { value: "listener", label: "주로 편하게 듣는 편이에요." },
      { value: "reactor", label: "주로 리액션으로 대화를 받아주는 편이에요." },
      {
        value: "questioner",
        label: "주로 질문을 던져 대화를 이어가는 편이에요.",
      },
      { value: "starter", label: "주로 어색하면 먼저 말을 꺼내는 편이에요." },
      { value: "mood_maker", label: "주로 분위기를 밝게 만드는 편이에요." },
      {
        value: "organizer",
        label: "주로 대화가 산만하면 자연스럽게 정리하는 편이에요.",
      },
    ],
  },
  {
    id: 6,
    order: 6,
    category: "모임 역할 - 상대",
    type: "multi_choice",
    maxSelections: 2,
    question:
      "처음 만나는 자리에서 내가 편하게 느끼는 사람은 어떤 사람인가요?\n최대 2개까지 골라주세요.",
    options: [
      { value: "opens_conversation", label: "먼저 말문을 열어주는 사람" },
      { value: "warm_reactor", label: "리액션이 따뜻한 사람" },
      { value: "good_questioner", label: "질문을 잘 던져주는 사람" },
      { value: "calm_listener", label: "차분히 들어주는 사람" },
      { value: "humor", label: "유머로 분위기를 풀어주는 사람" },
      { value: "not_pushy", label: "과하게 다가오지 않는 사람" },
      { value: "deep_talker", label: "생각이나 가치관을 깊게 나누는 사람" },
      { value: "casual_talker", label: "가볍고 편한 이야기를 잘하는 사람" },
    ],
  },
  {
    id: 7,
    order: 7,
    category: "관계 기대",
    type: "single_choice",
    question: "교집합에서 어떤 만남을 기대하나요?",
    scaleLabel: "친구 같은 만남 ↔ 연애 가능성",
    options: [
      {
        value: "1",
        label: "우선은 편한 대화와 좋은 사람들을 만나는 정도면 좋아요.",
      },
      {
        value: "2",
        label: "친구처럼 편하게 시작하되, 잘 맞으면 설렘도 열려 있어요.",
      },
      {
        value: "3",
        label: "좋은 사람이 있다면 연애 가능성도 자연스럽게 보고 싶어요.",
      },
      { value: "4", label: "연애로 이어질 수 있는 만남이면 더 좋아요." },
      { value: "5", label: "잘 맞는 이성을 만나는 기대가 꽤 커요." },
    ],
  },
  {
    id: 8,
    order: 8,
    category: "회피 조건",
    type: "multi_choice",
    question: "아래 중 피하고 싶은 자리가 있다면 골라주세요.",
    options: [
      { value: "heavy_drinking", label: "과한 술자리" },
      { value: "too_loud", label: "너무 시끄러운 자리" },
      { value: "too_quiet", label: "너무 조용해서 어색한 자리" },
      { value: "too_romantic", label: "노골적인 이성 목적의 자리" },
      { value: "business_networking", label: "비즈니스 네트워킹 같은 자리" },
      { value: "forced_deep_talk", label: "깊은 이야기를 강요하는 자리" },
      { value: "long_self_intro", label: "자기소개를 길게 해야 하는 자리" },
      { value: "too_active", label: "활동량이 너무 많은 자리" },
      { value: "expensive", label: "비용이 높은 자리" },
      { value: "photo_heavy", label: "사진을 많이 찍는 분위기" },
      { value: "none", label: "딱히 없어요", exclusive: true },
      { value: "other", label: "직접 입력", hasTextInput: true },
    ],
  },
  {
    id: 9,
    order: 9,
    category: "나이 조건",
    type: "single_choice",
    question: "분위기가 잘 맞는다면 어느 정도 나이 차이까지 괜찮으신가요?",
    options: [
      { value: "older_ok", label: "3살 이상 연상도 괜찮아요." },
      { value: "younger_ok", label: "3살 이상 연하도 괜찮아요." },
      { value: "age_flexible", label: "분위기가 맞으면 나이는 거의 상관 없어요." },
    ],
  },
  {
    id: 10,
    order: 10,
    category: "자기소개",
    type: "text",
    question:
      "마지막으로, 함께 만날 분들이 당신을 조금 더 편하게 알아볼 수 있도록 짧게 소개해주세요.",
    description:
      "성격, 대화 스타일, 요즘 관심사, 좋아하는 분위기 뭐든 좋아요.\n편한 내용을 2~3문장으로 적어주시면 돼요.",
    placeholder:
      "예: 처음엔 조용한 편이지만 편해지면 장난도 잘 치는 편이에요. 요즘은 전시랑 맛집 찾는 것에 관심이 많고, 너무 시끄러운 자리보다는 편하게 대화가 이어지는 분위기를 좋아해요.",
  },
];

export const profileQuestions: ProfileQuestion[] = baseQuestions;
