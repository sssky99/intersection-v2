import type { ProfileQuestion, QuestionAnswer } from "@/types/question";

export const preferenceProfileVersion = "preferences-v13";

export const preferenceQuestions: ProfileQuestion[] = [
  {
    id: 1,
    order: 1,
    category: "흥미",
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
    category: "흥미",
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
    category: "가치",
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
    category: "관계 기대",
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
    category: "관계 기대",
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
  {
    "id": 6,
    "order": 6,
    "category": "활동성",
    "type": "single_choice",
    "question": "시끌시끌하고 활기찬 자리에서 에너지를 얻는 편인가요?",
    "scaleMinLabel": "전혀 그렇지 않다",
    "scaleMaxLabel": "매우 그렇다",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      }
    ]
  },
  {
    "id": 7,
    "order": 7,
    "category": "활동성",
    "type": "single_choice",
    "question": "새로운 사람과도\n쉽게 가까워지는 편인가요?",
    "scaleMinLabel": "매우 어렵다",
    "scaleMaxLabel": "매우 쉽다",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      }
    ]
  },
  {
    "id": 8,
    "order": 8,
    "category": "활동성",
    "type": "single_choice",
    "question": "조언할 때 논리적인 편인가요,\n감정적인 편인가요?",
    "scaleMinLabel": "논리적인 문제 해결 우선",
    "scaleMaxLabel": "감정적인 공감과 위로 우선",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      }
    ]
  },
  {
    "id": 9,
    "order": 9,
    "category": "활동성",
    "type": "single_choice",
    "question": "처음 만난 사람과\n일 이야기를 나누는 게 편한 편인가요?",
    "prompt": "일 대화 조심에서 일 대화 편함 사이, 가장 가까운 답을 골라주세요.",
    "options": [
      {
        "value": "talking_about_work_comfort_scale_1",
        "label": "처음부터 일 이야기를 하는 건 조금 부담스러워요."
      },
      {
        "value": "talking_about_work_comfort_scale_2",
        "label": "가볍게 묻는 정도는 괜찮지만 깊게는 잘 안 해요."
      },
      {
        "value": "talking_about_work_comfort_scale_3",
        "label": "자연스럽게 나오면 편하게 이야기할 수 있어요."
      },
      {
        "value": "talking_about_work_comfort_scale_4",
        "label": "일 이야기도 좋은 대화 주제가 될 수 있다고 생각해요."
      },
      {
        "value": "talking_about_work_comfort_scale_5",
        "label": "저는 처음 만난 사람과도 일 이야기를 꽤 편하게 나눠요."
      }
    ]
  },
  {
    "id": 10,
    "order": 10,
    "category": "성향",
    "type": "single_choice",
    "question": "올빼미형인가요, 아침형인가요?",
    "scaleMinLabel": "새벽 5시 취침형",
    "scaleMaxLabel": "새벽 5시 기상형",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      }
    ]
  },
  {
    "id": 11,
    "order": 11,
    "category": "성향",
    "type": "single_choice",
    "question": "술이 있는 자리는\n나에게 어느 정도 편한가요?",
    "scaleMinLabel": "술 없는 자리가 더 편하다",
    "scaleMaxLabel": "술 있는 자리가 더 편하다",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      }
    ]
  },
  {
    "id": 12,
    "order": 12,
    "category": "성향",
    "type": "single_choice",
    "question": "흡연에 대해\n나는 어느 정도 편하게 느끼나요?",
    "scaleMinLabel": "흡연이 없는 자리가 더 편하다",
    "scaleMaxLabel": "흡연이 있는 자리도 편하다",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      }
    ]
  },
  {
    "id": 13,
    "order": 13,
    "category": "흥미",
    "type": "multi_choice",
    "question": "요즘 즐기고 있는\n취미는 무엇인가요?",
    "prompt": "나를 가장 잘 보여주는 취미를 최대 3개 골라주세요.",
    "options": [
      {
        "value": "exercise",
        "label": "운동"
      },
      {
        "value": "reading",
        "label": "독서"
      },
      {
        "value": "music",
        "label": "음악"
      },
      {
        "value": "movie",
        "label": "영화·드라마"
      },
      {
        "value": "game",
        "label": "게임·보드게임"
      },
      {
        "value": "cooking",
        "label": "요리·베이킹"
      },
      {
        "value": "photo",
        "label": "사진"
      },
      {
        "value": "travel",
        "label": "여행"
      },
      {
        "value": "culture",
        "label": "전시·공연"
      },
      {
        "value": "craft",
        "label": "공예·만들기"
      },
      {
        "value": "pet",
        "label": "반려동물"
      },
      {
        "value": "other",
        "label": "직접 입력",
        "hasTextInput": true
      }
    ],
    "maxSelections": 3
  },
  {
    "id": 14,
    "order": 14,
    "category": "흥미",
    "type": "multi_choice",
    "question": "평소 좋아하거나\n자주 찾아보는 관심사는 무엇인가요?",
    "prompt": "최대 5개까지 골라주세요.",
    "options": [
      {
        "value": "interests_choice_1",
        "label": "연애 / 관계"
      },
      {
        "value": "interests_choice_2",
        "label": "심리 / 성격"
      },
      {
        "value": "interests_choice_3",
        "label": "자기계발"
      },
      {
        "value": "interests_choice_4",
        "label": "책 / 인문학"
      },
      {
        "value": "interests_choice_5",
        "label": "영화 / 드라마"
      },
      {
        "value": "interests_choice_6",
        "label": "음악"
      },
      {
        "value": "interests_choice_7",
        "label": "패션 / 뷰티"
      },
      {
        "value": "interests_choice_8",
        "label": "맛집 / 카페"
      },
      {
        "value": "interests_choice_9",
        "label": "여행"
      },
      {
        "value": "interests_choice_10",
        "label": "운동 / 건강"
      },
      {
        "value": "interests_choice_11",
        "label": "경제 / 투자"
      },
      {
        "value": "interests_choice_12",
        "label": "커리어 / 일"
      },
      {
        "value": "interests_choice_13",
        "label": "창업 / 사이드프로젝트"
      },
      {
        "value": "interests_choice_14",
        "label": "예술 / 디자인"
      },
      {
        "value": "interests_choice_15",
        "label": "사진 / 영상"
      },
      {
        "value": "interests_choice_16",
        "label": "IT / 기술"
      },
      {
        "value": "interests_choice_17",
        "label": "사회 이슈 / 뉴스"
      },
      {
        "value": "interests_choice_18",
        "label": "반려동물"
      },
      {
        "value": "interests_choice_19",
        "label": "라이프스타일"
      },
      {
        "value": "interests_choice_20",
        "label": "잘 모르겠어요",
        "exclusive": true
      },
      {
        "value": "interests_other",
        "label": "직접 입력",
        "hasTextInput": true
      }
    ],
    "maxSelections": 5
  },
  {
    "id": 15,
    "order": 15,
    "category": "흥미",
    "type": "multi_choice",
    "question": "어떤 스포츠를\n즐겨 보시나요?",
    "prompt": "관심 있게 보는 종목을 골라주세요.",
    "options": [
      {
        "value": "football",
        "label": "축구"
      },
      {
        "value": "baseball",
        "label": "야구"
      },
      {
        "value": "basketball",
        "label": "농구"
      },
      {
        "value": "volleyball",
        "label": "배구"
      },
      {
        "value": "tennis",
        "label": "테니스"
      },
      {
        "value": "golf",
        "label": "골프"
      },
      {
        "value": "motorsport",
        "label": "모터스포츠"
      },
      {
        "value": "esports",
        "label": "e스포츠"
      },
      {
        "value": "combat",
        "label": "격투기"
      },
      {
        "value": "other",
        "label": "직접 입력",
        "hasTextInput": true
      },
      {
        "value": "none",
        "label": "딱히 보지 않아요",
        "exclusive": true
      }
    ],
    "maxSelections": 4
  },
  {
    "id": 16,
    "order": 16,
    "category": "흥미",
    "type": "text",
    "question": "서울에서 해보고 싶은 활동이나\n가보고 싶은 장소가 있나요?",
    "prompt": "구체적인 장소나 막연한 아이디어 모두 좋아요.",
    "placeholder": "예: 한강에서 야간 러닝을 해보고 싶어요."
  },
  {
    "id": 17,
    "order": 17,
    "category": "관계 기대",
    "type": "single_choice",
    "question": "기본 나이 범위를 벗어나더라도,\n같은 자리에 함께해도 괜찮은 쪽을 알려주세요.",
    "prompt": "(교집합은 기본적으로\n나와 3~4살 차이 안쪽의 사람들과 만날 수 있도록 준비합니다.)",
    "options": [
      {
        "value": "age_range_choice_1",
        "label": "나보다 3살 이상 연상도 괜찮아요"
      },
      {
        "value": "age_range_choice_2",
        "label": "나보다 3살 이상 연하도 괜찮아요"
      },
      {
        "value": "age_range_prefer_not_to_say",
        "label": "밝히고 싶지 않아요",
        "exclusive": true
      }
    ]
  },
  {
    "id": 18,
    "order": 18,
    "category": "관계 기대",
    "type": "text",
    "question": "당신이 만나고 싶은 사람은\n어떤 느낌의 사람인가요?",
    "placeholder": "예: 말이 잘 통하는 사람, 편안한 사람, 유머 코드가 맞는 사람, 배려가 느껴지는 사람"
  },
  {
    "id": 19,
    "order": 19,
    "category": "가치",
    "type": "single_choice",
    "question": "나는 예술적인 사람이라고 생각한다",
    "scaleMinLabel": "전혀 동의하지 않음",
    "scaleMaxLabel": "매우 동의함",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      }
    ]
  },
  {
    "id": 20,
    "order": 20,
    "category": "가치",
    "type": "single_choice",
    "question": "새로운 것을 배우고\n알아가는 일에 끌리는 편인가요?",
    "scaleMinLabel": "전혀 동의하지 않음",
    "scaleMaxLabel": "매우 동의함",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      }
    ]
  },
  {
    "id": 21,
    "order": 21,
    "category": "가치",
    "type": "single_choice",
    "question": "자신이 얼마나 매력적이라고 생각하나요?",
    "scaleMinLabel": "전혀 매력적이지 않음",
    "scaleMaxLabel": "매우 매력적",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      },
      {
        "value": "8",
        "label": "8"
      },
      {
        "value": "9",
        "label": "9"
      },
      {
        "value": "10",
        "label": "10"
      }
    ]
  },
  {
    "id": 22,
    "order": 22,
    "category": "가치",
    "type": "single_choice",
    "question": "자신이 얼마나 지적이라고 생각하나요?",
    "scaleMinLabel": "그다지 영리하지 않음",
    "scaleMaxLabel": "아인슈타인",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      },
      {
        "value": "8",
        "label": "8"
      },
      {
        "value": "9",
        "label": "9"
      },
      {
        "value": "10",
        "label": "10"
      }
    ]
  },
  {
    "id": 23,
    "order": 23,
    "category": "가치",
    "type": "single_choice",
    "question": "사람을 만날 때,\n외적인 끌림은 얼마나 중요한가요?",
    "prompt": "내면 우선에서 외모 우선 사이, 가장 가까운 답을 골라주세요.",
    "options": [
      {
        "value": "physical_attraction_importance_scale_1",
        "label": "저는 외적인 끌림을 크게 보지 않는 편이에요."
      },
      {
        "value": "physical_attraction_importance_scale_2",
        "label": "첫인상 정도로만 보는 편이에요."
      },
      {
        "value": "physical_attraction_importance_scale_3",
        "label": "어느 정도의 끌림은 필요하다고 생각해요."
      },
      {
        "value": "physical_attraction_importance_scale_4",
        "label": "외적인 끌림은 저에게 꽤 중요한 편이에요."
      },
      {
        "value": "physical_attraction_importance_scale_5",
        "label": "저는 처음 느껴지는 끌림이 정말 중요해요."
      },
      {
        "value": "physical_attraction_importance_prefer_not_to_say",
        "label": "밝히고 싶지 않아요",
        "exclusive": true
      }
    ]
  },
  {
    "id": 24,
    "order": 24,
    "category": "관점",
    "type": "single_choice",
    "question": "나는 정치 토론과 뉴스를 즐긴다",
    "scaleMinLabel": "전혀 동의하지 않는다",
    "scaleMaxLabel": "매우 동의한다",
    "options": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      }
    ]
  },
  {
    "id": 25,
    "order": 25,
    "category": "관점",
    "type": "single_choice",
    "question": "나와 다른 정치적 성향의\n사람을 만나는 걸 즐기시나요?",
    "prompt": "차이 불편함에서 차이 존중함 사이, 가장 가까운 답을 골라주세요.",
    "options": [
      {
        "value": "openness_to_different_opinions_scale_1",
        "label": "생각이 너무 다르면 대화가 조금 어렵게 느껴져요."
      },
      {
        "value": "openness_to_different_opinions_scale_2",
        "label": "차이가 크면 조심스러워지는 편이에요."
      },
      {
        "value": "openness_to_different_opinions_scale_3",
        "label": "서로 예의를 지킨다면 어느 정도 괜찮아요."
      },
      {
        "value": "openness_to_different_opinions_scale_4",
        "label": "다른 생각을 가진 사람과도 편하게 이야기할 수 있어요."
      },
      {
        "value": "openness_to_different_opinions_scale_5",
        "label": "저는 생각의 차이도 흥미로운 대화가 될 수 있다고 느껴요."
      }
    ]
  },
  {
    "id": 26,
    "order": 26,
    "category": "관점",
    "type": "single_choice",
    "question": "나는 정치적으로\n어떠한 성향의 사람인가요?",
    "prompt": "가장 가깝다고 느끼는 답을 골라주세요.",
    "options": [
      {
        "value": "progressive",
        "label": "진보"
      },
      {
        "value": "center_progressive",
        "label": "중도 진보"
      },
      {
        "value": "center",
        "label": "중도"
      },
      {
        "value": "center_conservative",
        "label": "중도 보수"
      },
      {
        "value": "conservative",
        "label": "보수"
      },
      {
        "value": "not_interested",
        "label": "정치에 관심이 적어요"
      },
      {
        "value": "prefer_not_to_say",
        "label": "답하고 싶지 않아요"
      }
    ]
  },
  {
    "id": 27,
    "order": 27,
    "category": "배경",
    "type": "single_choice",
    "question": "내 일이 내 삶에서 차지하는 비중은\n어느 정도인가요?",
    "prompt": "일상 우선에서 일 우선 사이, 가장 가까운 답을 골라주세요.",
    "options": [
      {
        "value": "work_life_importance_scale_1",
        "label": "제 삶에서 일이 큰 비중을 차지하지는 않아요.",
        "exclusive": true
      },
      {
        "value": "work_life_importance_scale_2",
        "label": "일도 중요하지만, 삶의 다른 부분이 더 중요해요."
      },
      {
        "value": "work_life_importance_scale_3",
        "label": "일과 삶의 균형을 맞추고 싶은 편이에요."
      },
      {
        "value": "work_life_importance_scale_4",
        "label": "제 일은 제 삶에서 꽤 중요한 부분이에요."
      },
      {
        "value": "work_life_importance_scale_5",
        "label": "일은 지금의 저를 설명하는 큰 축에 가까워요."
      }
    ]
  },
  {
    "id": 28,
    "order": 28,
    "category": "배경",
    "type": "single_choice",
    "optionColumns": 2,
    "question": "현재 일하고 있는 분야는\n어느 쪽에 가까운가요?",
    "options": [
      {
        "value": "work_field_choice_1",
        "label": "학생"
      },
      {
        "value": "work_field_choice_2",
        "label": "취업 준비 / 이직 준비 중"
      },
      {
        "value": "work_field_choice_3",
        "label": "IT / 개발 / 데이터"
      },
      {
        "value": "work_field_choice_4",
        "label": "디자인 / 콘텐츠 / 크리에이티브"
      },
      {
        "value": "work_field_choice_5",
        "label": "마케팅 / 광고 / PR"
      },
      {
        "value": "work_field_choice_6",
        "label": "미디어 / 영상 / 엔터테인먼트"
      },
      {
        "value": "work_field_choice_7",
        "label": "교육 / 연구"
      },
      {
        "value": "work_field_choice_8",
        "label": "의료 / 보건"
      },
      {
        "value": "work_field_choice_9",
        "label": "금융 / 회계 / 컨설팅"
      },
      {
        "value": "work_field_choice_10",
        "label": "법률 / 공공 / 행정"
      },
      {
        "value": "work_field_choice_11",
        "label": "제조 / 엔지니어링"
      },
      {
        "value": "work_field_choice_12",
        "label": "건축 / 인테리어 / 공간"
      },
      {
        "value": "work_field_choice_13",
        "label": "유통 / MD / 이커머스"
      },
      {
        "value": "work_field_choice_14",
        "label": "영업 / 서비스"
      },
      {
        "value": "work_field_choice_15",
        "label": "자영업 / 프리랜서"
      },
      {
        "value": "work_field_choice_16",
        "label": "스타트업 / 창업"
      },
      {
        "value": "work_field_choice_17",
        "label": "문화예술"
      },
      {
        "value": "work_field_choice_18",
        "label": "아직 정해진 분야는 없어요",
        "exclusive": true
      },
      {
        "value": "work_field_other",
        "label": "직접 입력",
        "hasTextInput": true
      },
      {
        "value": "work_field_prefer_not_to_say",
        "label": "밝히고 싶지 않아요",
        "exclusive": true
      }
    ]
  },
  {
    "id": 29,
    "order": 29,
    "category": "배경",
    "type": "text",
    "question": "당신의 고향은 어디인가요?",
    "prompt": "어릴 적 추억이 가장 많이 담긴 곳을 알려주세요.",
    "placeholder": "예: 부산에서 자랐고, 지금은 서울에 살고 있어요.",
    "allowPrivate": true
  },
  {
    "id": 30,
    "order": 30,
    "category": "배경",
    "type": "text",
    "question": "살아봤거나 여행해본 나라가 있다면\n알려주세요.",
    "placeholder": "예: 일본, 프랑스, 태국 / 아직 해외여행 경험은 없어요"
  }
];

function selectedLabels(answer: QuestionAnswer | undefined, questionId: number) {
  if (!answer || !Array.isArray(answer.value)) return [];
  const question = preferenceQuestions.find((item) => item.id === questionId);
  const options = (question?.options ?? []).map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return answer.value.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  );
}

function selectedValues(answer: QuestionAnswer | undefined) {
  return Array.isArray(answer?.value) ? answer.value : [];
}

export function preferenceRecentInterests(
  answers: Record<number, QuestionAnswer>,
) {
  const directValues = selectedValues(answers[2]);
  if (directValues.length > 0) return directValues.slice(0, 3);

  const labels = selectedLabels(answers[14], 14).join(" ");
  const matches: Array<[string, RegExp]> = [
    ["travel", /여행/],
    ["food", /맛집|카페|요리/],
    ["movie", /영화|드라마/],
    ["music", /음악/],
    ["book", /책|인문학/],
    ["exhibition", /예술|디자인/],
    ["fitness", /운동|건강/],
    ["photo", /사진|영상/],
    ["growth", /심리|성격|자기계발/],
  ];
  return matches.filter(([, pattern]) => pattern.test(labels)).map(([value]) => value).slice(0, 3);
}

export function preferencePreferredActivities(
  answers: Record<number, QuestionAnswer>,
) {
  const directValues = selectedValues(answers[4]);
  if (directValues.length > 0) return directValues.slice(0, 3);

  const labels = selectedLabels(answers[13], 13).join(" ");
  const matches: Array<[string, RegExp]> = [
    ["meal", /카페|맛집|요리|베이킹/],
    ["culture", /영화|드라마|음악|공연|독서|전시|미술관|사진|영상|글쓰기/],
    ["outdoor", /산책|러닝|운동|헬스|요가|필라테스|등산|캠핑|여행/],
    ["play", /게임/],
    ["reading", /독서|자기계발|공부/],
    ["taste", /사진|영상|쇼핑|패션|요리|베이킹/],
  ];
  return matches.filter(([, pattern]) => pattern.test(labels)).map(([value]) => value).slice(0, 3);
}

export function usesPreferenceProfile(
  profile: { profile_experience_version?: string | null },
) {
  return profile.profile_experience_version === preferenceProfileVersion;
}
