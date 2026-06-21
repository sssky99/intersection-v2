import type { ProfileQuestion } from "@/types/question";

export const questionCategories = [
  { key: "온도", label: "온도", icon: "Coffee" },
  { key: "결", label: "결", icon: "MessageCircle" },
  { key: "톤", label: "톤", icon: "Heart" },
  { key: "리듬", label: "리듬", icon: "Sparkles" },
  { key: "모임 역할", label: "모임 역할", icon: "Users" },
  { key: "모임 역할 - 상대", label: "편한 상대", icon: "Users" },
  { key: "관계 기대", label: "관계 기대", icon: "Heart" },
  { key: "나이 조건", label: "나이 조건", icon: "Users" },
  { key: "모임 취향", label: "모임 취향", icon: "Ticket" },
  { key: "나의 일", label: "나의 일", icon: "PenLine" },
  { key: "관심 주제", label: "관심 주제", icon: "Sparkles" },
] as const;

const baseQuestions: ProfileQuestion[] = [
  {
    id: 1,
    order: 1,
    category: "온도",
    type: "single_choice",
    question:
      "새로운 사람들과 함께 있을 때,\n나는 어떤 분위기에서 더 편해지나요?",
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
    question:
      "처음 만난 사람과 대화할 때,\n어떤 이야기가 더 잘 이어지나요?",
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
    question:
      "누군가 고민을 말했을 때,\n나는 어떤 방식으로 반응하는 편인가요?",
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
    question: "처음 만난 자리에서\n나에게 가까운 모습을 골라주세요.",
    description: "최대 2개까지 선택할 수 있어요.",
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
      "처음 만나는 자리에서\n내가 편하게 느끼는 사람은 어떤 사람인가요?",
    description: "최대 2개까지 선택할 수 있어요.",
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
        label:
          "연애로 이어질 가능성은 없었으면 좋겠어요. 편한 사람들과 좋은 대화를 나누는 정도를 기대해요.",
      },
      {
        value: "2",
        label:
          "기본적으로는 친구나 지인처럼 편한 만남을 원해요. 연애로 이어지는 흐름은 크게 기대하지 않아요.",
      },
      {
        value: "3",
        label:
          "좋은 사람이 있다면 자연스럽게 열어둘 수 있어요. 다만 처음부터 연애를 목표로 오진 않아요.",
      },
      {
        value: "4",
        label:
          "편하게 시작하되, 잘 맞는 사람이 있다면 연애로 이어질 가능성도 긍정적으로 보고 있어요.",
      },
      {
        value: "5",
        label:
          "연애로 이어질 가능성도 생각하고 있어요. 좋은 사람을 만나는 기대가 분명히 있어요.",
      },
    ],
  },
  {
    id: 9,
    order: 9,
    category: "나이 조건",
    type: "single_choice",
    question:
      "분위기가 잘 맞는다면\n어느 정도 나이 차이까지 괜찮으신가요?",
    options: [
      { value: "older_ok", label: "3살 이상 연상도 괜찮아요." },
      { value: "younger_ok", label: "3살 이상 연하도 괜찮아요." },
      { value: "age_flexible", label: "분위기가 맞으면 나이는 거의 상관 없어요." },
    ],
  },
  {
    id: 15,
    order: 15,
    category: "나의 일",
    type: "text",
    question: "내가 하는 일에 대해 간단하게 소개해주세요.",
    description:
      "회사명이나 정확한 직함보다, 요즘 어떤 일을 하며 지내는지 편하게 적어주세요.",
    examples: [
      "예: 브랜드 마케팅 일을 하고 있고, 요즘은 콘텐츠 기획을 많이 하고 있어요.",
      "예: 개발자로 일하고 있고, 사람들이 쓰기 편한 서비스를 만드는 데 관심이 많아요.",
      "예: 교육 쪽 일을 하고 있고, 사람들과 이야기하며 배우는 걸 좋아해요.",
      "예: 자영업을 하고 있고, 요즘은 가게 운영과 새로운 메뉴를 고민하고 있어요.",
      "예: 아직 진로를 찾아가는 중이고, 요즘은 여러 일을 경험해보는 중이에요.",
    ],
  },
  {
    id: 16,
    order: 16,
    category: "관심 주제",
    type: "text",
    question: "요즘 관심을 가지는 주제에 대해 이야기해주세요.",
    description:
      "꼭 거창한 관심사가 아니어도 괜찮아요. 요즘 자주 이야기하게 되는 것을 적어주세요.",
    examples: [
      "예: 요즘은 전시랑 산책에 관심이 많고, 쉬는 날엔 새로운 카페를 찾아다니는 편이에요.",
      "예: 요즘은 일과 삶의 균형에 대해 자주 생각하고, 비슷한 고민을 나누는 대화를 좋아해요.",
      "예: 음악, 영화, 맛집 이야기를 좋아하고, 취향이 드러나는 대화를 하면 금방 편해지는 편이에요.",
      "예: 운동을 다시 시작해서 건강한 루틴에 관심이 많고, 같이 가볍게 이야기 나누는 걸 좋아해요.",
      "예: 요즘은 사람들이 어떻게 가까워지는지, 좋은 관계가 어떻게 만들어지는지에 관심이 있어요.",
    ],
  },
];

export const profileQuestions: ProfileQuestion[] = baseQuestions;
