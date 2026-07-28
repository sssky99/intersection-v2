import type { ProfileQuestion } from "@/types/question";

export const preferenceProfileVersion = "preferences-v2";

export const preferenceQuestions: ProfileQuestion[] = [
  {
    id: 1,
    order: 1,
    category: "일상 취향",
    type: "single_choice",
    question: "내 삶을 영화로 만든다면\n어떤 장르에 가까울까요?",
    prompt: "가장 마음이 가는 장면을 골라주세요.",
    options: [
      { value: "comedy", label: "코미디" },
      { value: "drama", label: "드라마" },
      { value: "adventure", label: "모험" },
      { value: "romance", label: "로맨스" },
    ],
  },
  {
    id: 2,
    order: 2,
    category: "최근 관심사",
    type: "multi_choice",
    maxSelections: 3,
    question: "쉬는 시간에는\n무엇을 하며 보내나요?",
    prompt: "최대 3개까지 골라주세요.",
    options: [
      { value: "travel", label: "여행" },
      { value: "food", label: "맛집·요리" },
      { value: "coffee", label: "카페·커피" },
      { value: "movie", label: "영화·드라마" },
      { value: "music", label: "음악" },
      { value: "book", label: "독서" },
      { value: "exhibition", label: "전시·디자인" },
      { value: "fitness", label: "운동" },
      { value: "nature", label: "자연·등산" },
      { value: "game", label: "게임·보드게임" },
      { value: "photo", label: "사진" },
      { value: "growth", label: "심리·성장" },
    ],
  },
  {
    id: 3,
    order: 3,
    category: "관계 가치",
    type: "multi_choice",
    minSelections: 3,
    maxSelections: 3,
    question: "친구 관계에서\n무엇이 가장 중요한가요?",
    prompt: "함께 중요하게 여겼으면 하는 모습을 3개 골라주세요.",
    options: [
      { value: "authentic", label: "진솔함" },
      { value: "attentive", label: "세심한 배려" },
      { value: "funny", label: "유머" },
      { value: "warm", label: "따뜻함" },
      { value: "intelligent", label: "지적인 자극" },
      { value: "grounded", label: "차분한 안정감" },
      { value: "curious", label: "새로운 관점" },
      { value: "positive", label: "긍정적인 태도" },
    ],
  },
  {
    id: 4,
    order: 4,
    category: "선호 활동",
    type: "multi_choice",
    maxSelections: 3,
    question: "교집합에서 어떤 시간을\n보내보고 싶나요?",
    prompt: "마음이 가는 활동을 최대 3개 골라주세요.",
    options: [
      { value: "meal", label: "식사·카페" },
      { value: "culture", label: "문화 콘텐츠" },
      { value: "outdoor", label: "활동·체험" },
      { value: "play", label: "오락" },
      { value: "reading", label: "독서" },
      { value: "taste", label: "취향 탐색" },
    ],
  },
  {
    id: 5,
    order: 5,
    category: "비선호 활동",
    type: "multi_choice",
    maxSelections: 3,
    question: "가능하면 피하고 싶은\n활동이 있나요?",
    prompt: "부담스러운 활동을 골라주세요. 없어도 괜찮아요.",
    options: [
      { value: "meal", label: "식사·카페" },
      { value: "culture", label: "문화 콘텐츠" },
      { value: "outdoor", label: "활동·체험" },
      { value: "play", label: "오락" },
      { value: "reading", label: "독서" },
      { value: "taste", label: "취향 탐색" },
      { value: "no_avoidance", label: "딱히 없어요", exclusive: true },
    ],
  },
];

export function usesPreferenceProfile(
  profile: { profile_experience_version?: string | null },
) {
  return profile.profile_experience_version === preferenceProfileVersion;
}
