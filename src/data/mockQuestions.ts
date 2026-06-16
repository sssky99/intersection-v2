import type { ProfileQuestion } from "@/types/question";

export const questionCategories = [
  {
    "key": "Communication",
    "label": "대화",
    "icon": "MessageCircle"
  },
  {
    "key": "Lifestyle",
    "label": "생활",
    "icon": "Coffee"
  },
  {
    "key": "Preference",
    "label": "취향",
    "icon": "X"
  },
  {
    "key": "Relationship",
    "label": "관계",
    "icon": "Users"
  },
  {
    "key": "Values",
    "label": "가치관",
    "icon": "Sparkles"
  },
  {
    "key": "Background",
    "label": "배경",
    "icon": "Briefcase"
  },
  {
    "key": "Interests",
    "label": "관심사",
    "icon": "Heart"
  },
  {
    "key": "TicketPreference",
    "label": "티켓 취향",
    "icon": "Ticket"
  },
  {
    "key": "Story",
    "label": "이야기",
    "icon": "PenLine"
  },
  {
    "key": "Picture",
    "label": "사진",
    "icon": "Camera"
  }
] as const;

const legacyQuestions: ProfileQuestion[] = [
  {
    "id": 1,
    "order": 1,
    "category": "Communication",
    "type": "single_choice",
    "question": "시끌시끌하고 활기찬 자리에서 에너지를 얻는 편인가요?",
    "options": [
      {
        "value": "1",
        "label": "저는 조용하고 차분한 자리가 훨씬 편해요."
      },
      {
        "value": "2",
        "label": "너무 시끄러운 자리는 조금 빨리 지치는 편이에요."
      },
      {
        "value": "3",
        "label": "분위기에 따라 조용한 자리도, 활기찬 자리도 괜찮아요."
      },
      {
        "value": "4",
        "label": "적당히 활기찬 자리에 있으면 기분이 좋아져요."
      },
      {
        "value": "5",
        "label": "저는 사람이 많고 에너지 있는 자리에서 힘을 얻는 편이에요."
      }
    ]
  },
  {
    "id": 2,
    "order": 2,
    "category": "Communication",
    "type": "single_choice",
    "question": "새로운 사람과도 비교적 쉽게 가까워지는 편인가요?",
    "options": [
      {
        "value": "1",
        "label": "저는 천천히 가까워지는 편이에요."
      },
      {
        "value": "2",
        "label": "처음에는 조금 낯을 가리는 편이에요."
      },
      {
        "value": "3",
        "label": "상대와 분위기에 따라 달라져요."
      },
      {
        "value": "4",
        "label": "대체로 새로운 사람과도 금방 편해지는 편이에요."
      },
      {
        "value": "5",
        "label": "저는 처음 만난 사람과도 자연스럽게 가까워지는 편이에요."
      }
    ]
  },
  {
    "id": 3,
    "order": 3,
    "category": "Communication",
    "type": "single_choice",
    "question": "누군가 고민을 말했을 때, 나는 어떤 방식으로 반응하는 편인가요?",
    "options": [
      {
        "value": "1",
        "label": "저는 먼저 감정을 충분히 들어주는 편이에요."
      },
      {
        "value": "2",
        "label": "공감해주고, 천천히 이야기를 들어주려 해요."
      },
      {
        "value": "3",
        "label": "공감도 하고, 필요한 말도 함께 해주는 편이에요."
      },
      {
        "value": "4",
        "label": "상황을 정리해주고 현실적인 조언을 해주는 편이에요."
      },
      {
        "value": "5",
        "label": "저는 문제를 분석하고 해결책을 찾는 쪽에 가까워요."
      }
    ]
  },
  {
    "id": 4,
    "order": 4,
    "category": "Communication",
    "type": "single_choice",
    "question": "처음 만난 사람과 일 이야기를 나누는 게 편한 편인가요?",
    "options": [
      {
        "value": "1",
        "label": "처음부터 일 이야기를 하는 건 조금 부담스러워요."
      },
      {
        "value": "2",
        "label": "가볍게 묻는 정도는 괜찮지만 깊게는 잘 안 해요."
      },
      {
        "value": "3",
        "label": "자연스럽게 나오면 편하게 이야기할 수 있어요."
      },
      {
        "value": "4",
        "label": "일 이야기도 좋은 대화 주제가 될 수 있다고 생각해요."
      },
      {
        "value": "5",
        "label": "저는 처음 만난 사람과도 일 이야기를 꽤 편하게 나눠요."
      }
    ]
  },
  {
    "id": 5,
    "order": 5,
    "category": "Communication",
    "type": "single_choice",
    "question": "처음 만난 자리에서 나는 보통 어떤 역할인가요?",
    "options": [
      {
        "value": "listener",
        "label": "주로 듣는 편이에요."
      },
      {
        "value": "reactor",
        "label": "주로 리액션을 많이 하는 편이에요."
      },
      {
        "value": "questioner",
        "label": "주로 질문을 던지는 편이에요."
      },
      {
        "value": "leader",
        "label": "주로 이야기를 이끄는 편이에요."
      },
      {
        "value": "mood_maker",
        "label": "주로 분위기를 띄우는 편이에요."
      }
    ]
  },
  {
    "id": 6,
    "order": 6,
    "category": "Communication",
    "type": "single_choice",
    "question": "처음 만난 사람들과의 대화는 어느 정도 깊이가 편한가요?",
    "options": [
      {
        "value": "1",
        "label": "가볍고 편한 수다가 좋아요."
      },
      {
        "value": "2",
        "label": "처음에는 부담 없는 이야기가 편해요."
      },
      {
        "value": "3",
        "label": "분위기에 따라 가벼운 이야기와 깊은 이야기 모두 괜찮아요."
      },
      {
        "value": "4",
        "label": "가치관이나 생각을 나누는 대화가 좋아요."
      },
      {
        "value": "5",
        "label": "저는 처음 만난 사람과도 깊은 이야기를 나누는 게 좋아요."
      }
    ]
  },
  {
    "id": 7,
    "order": 7,
    "category": "Lifestyle",
    "type": "single_choice",
    "question": "술이 있는 자리는 나에게 어느 정도 편한가요?",
    "options": [
      {
        "value": "1",
        "label": "저는 술이 없는 자리가 더 편해요."
      },
      {
        "value": "2",
        "label": "술이 있어도 괜찮지만, 마시고 싶지는 않아요."
      },
      {
        "value": "3",
        "label": "분위기에 따라 가볍게 마시는 정도는 괜찮아요."
      },
      {
        "value": "4",
        "label": "좋은 사람들과 마시는 술자리는 꽤 좋아해요."
      },
      {
        "value": "5",
        "label": "저는 술이 있는 자리에서 더 편하게 풀리는 편이에요."
      },
      {
        "value": "prefer_not_to_say",
        "label": "밝히고 싶지 않아요."
      }
    ]
  },
  {
    "id": 8,
    "order": 8,
    "category": "Lifestyle",
    "type": "single_choice",
    "question": "흡연에 대해 나는 어느 정도 편하게 느끼나요?",
    "options": [
      {
        "value": "1",
        "label": "저는 흡연이 없는 자리가 가장 편해요."
      },
      {
        "value": "2",
        "label": "흡연하는 사람이 있어도, 가까운 자리는 조금 불편해요."
      },
      {
        "value": "3",
        "label": "서로 배려가 있다면 크게 신경 쓰지 않아요."
      },
      {
        "value": "4",
        "label": "흡연하는 사람과도 편하게 지낼 수 있어요."
      },
      {
        "value": "5",
        "label": "저는 흡연이 있는 자리도 익숙하고 편한 편이에요."
      },
      {
        "value": "prefer_not_to_say",
        "label": "밝히고 싶지 않아요."
      }
    ]
  },
  {
    "id": 9,
    "order": 9,
    "category": "Preference",
    "type": "multi_choice",
    "question": "아래 중 피하고 싶은 자리가 있다면 골라주세요.",
    "options": [
      {
        "value": "heavy_drinking",
        "label": "과한 술자리"
      },
      {
        "value": "too_loud",
        "label": "너무 시끄러운 자리"
      },
      {
        "value": "too_quiet",
        "label": "너무 조용해서 어색한 자리"
      },
      {
        "value": "too_romantic",
        "label": "노골적인 이성 목적의 자리"
      },
      {
        "value": "business_networking",
        "label": "비즈니스 네트워킹 같은 자리"
      },
      {
        "value": "forced_deep_talk",
        "label": "깊은 이야기를 강요하는 자리"
      },
      {
        "value": "long_self_intro",
        "label": "자기소개를 길게 해야 하는 자리"
      },
      {
        "value": "too_active",
        "label": "활동량이 너무 많은 자리"
      },
      {
        "value": "expensive",
        "label": "비용이 높은 자리"
      },
      {
        "value": "photo_heavy",
        "label": "사진을 많이 찍는 분위기"
      },
      {
        "value": "none",
        "label": "딱히 없어요",
        "exclusive": true
      },
      {
        "value": "other",
        "label": "직접 입력",
        "hasTextInput": true
      }
    ]
  },
  {
    "id": 10,
    "order": 10,
    "category": "Relationship",
    "type": "single_choice",
    "question": "교집합은 기본적으로 비슷한 나이대의 사람들과 자리를 구성해요.\n\n보통 3~4살 안쪽의 분들과 함께할 수 있도록 조합합니다.\n\n만약 자리의 분위기가 잘 맞는다면, 아래 중 어느 쪽까지는 괜찮으신가요?",
    "options": [
      {
        "value": "older_ok",
        "label": "나보다 3살 이상 연상도 괜찮아요."
      },
      {
        "value": "younger_ok",
        "label": "나보다 3살 이상 연하도 괜찮아요."
      },
      {
        "value": "age_flexible",
        "label": "나이는 크게 신경 쓰지 않아요."
      }
    ]
  },
  {
    "id": 11,
    "order": 11,
    "category": "Values",
    "type": "single_choice",
    "question": "새로운 사람과의 만남에서 ‘설렘 가능성’은 어느 정도 열려 있나요?",
    "options": [
      {
        "value": "1",
        "label": "저는 편한 친구 같은 만남이 더 좋아요."
      },
      {
        "value": "2",
        "label": "설렘보다는 자연스러운 대화가 더 중요해요."
      },
      {
        "value": "3",
        "label": "좋은 사람이면 설렘이 생길 수도 있다고 생각해요."
      },
      {
        "value": "4",
        "label": "어느 정도 설렘이 있는 자리가 좋아요."
      },
      {
        "value": "5",
        "label": "저는 첫인상에서 오는 끌림도 꽤 중요해요."
      },
      {
        "value": "prefer_not_to_say",
        "label": "밝히고 싶지 않아요."
      }
    ]
  },
  {
    "id": 12,
    "order": 12,
    "category": "Background",
    "type": "text",
    "question": "지금 하는 일이나 공부는 얼마나 됐는지,\n이 일에 흥미롭게 느끼는 점이 있다면 알려주세요.",
    "placeholder": "예: 5년 동안 경찰로 일하고 있어요. 나라를 위해서 기여하고 있다는 느낌이 좋아요. 내가 하는 일로 세상을 이롭게 만드는 느낌..?"
  },
  {
    "id": 13,
    "order": 13,
    "category": "Interests",
    "type": "text",
    "question": "요즘 자주 생각하거나, 새롭게 관심이 생긴 것이 있나요?",
    "placeholder": "예: 요즘은 음악과 커리어 고민에 관심이 많아요."
  },
  {
    "id": 14,
    "order": 14,
    "category": "Story",
    "type": "text",
    "question": "다른 사람들이 알면 재밌을 만한 나에 대한 이야기를 한 가지만 소개해주세요!\n\n이 답변은 교집합이 당신의 분위기를 더 잘 이해하고, 모임에서 자연스러운 대화 시작점을 만들기 위한 참고로 사용돼요.\n일부 내용은 모임 전 다른 분들에게 익명으로 소개될 수 있어요.",
    "placeholder": "예:\n1. 제 MBTI를 처음에 맞춘 사람은 아무도 없어요.\n2. 저는 한식 조리사 자격증이 있어요.\n3. 저는 프랑스에서 포르투갈까지 걸어서 이동해봤어요."
  },
  {
    "id": 15,
    "order": 15,
    "category": "Interests",
    "type": "multi_choice",
    "question": "요즘 관심이 가는 취미가 있다면 골라주세요.",
    "options": [
      {
        "value": "movie_drama",
        "label": "영화·드라마 보기"
      },
      {
        "value": "music_concert",
        "label": "음악 듣기·공연 가기"
      },
      {
        "value": "reading",
        "label": "독서"
      },
      {
        "value": "exhibition_museum",
        "label": "전시·미술관"
      },
      {
        "value": "cafe",
        "label": "카페 가기"
      },
      {
        "value": "food_tour",
        "label": "맛집 탐방"
      },
      {
        "value": "walking_running",
        "label": "산책·러닝"
      },
      {
        "value": "fitness",
        "label": "운동·헬스"
      },
      {
        "value": "yoga_pilates",
        "label": "요가·필라테스"
      },
      {
        "value": "hiking_camping",
        "label": "등산·캠핑"
      },
      {
        "value": "travel",
        "label": "여행"
      },
      {
        "value": "photo_video",
        "label": "사진·영상"
      },
      {
        "value": "writing",
        "label": "글쓰기"
      },
      {
        "value": "cooking_baking",
        "label": "요리·베이킹"
      },
      {
        "value": "game",
        "label": "게임"
      },
      {
        "value": "board_game",
        "label": "보드게임"
      },
      {
        "value": "pet",
        "label": "반려동물"
      },
      {
        "value": "study_self_dev",
        "label": "자기계발·공부"
      },
      {
        "value": "shopping_fashion",
        "label": "쇼핑·패션"
      },
      {
        "value": "none_fixed",
        "label": "딱히 정해진 취미는 없어요",
        "exclusive": true
      },
      {
        "value": "other",
        "label": "직접 입력",
        "hasTextInput": true
      }
    ]
  },
  {
    "id": 16,
    "order": 16,
    "category": "Interests",
    "type": "multi_choice",
    "question": "평소 좋아하거나 자주 찾아보는 관심사는 무엇인가요?",
    "options": [
      {
        "value": "love_relationship",
        "label": "연애·관계"
      },
      {
        "value": "psychology_personality",
        "label": "심리·성격"
      },
      {
        "value": "self_development",
        "label": "자기계발"
      },
      {
        "value": "books_humanities",
        "label": "책·인문학"
      },
      {
        "value": "movie_drama",
        "label": "영화·드라마"
      },
      {
        "value": "music",
        "label": "음악"
      },
      {
        "value": "fashion_beauty",
        "label": "패션·뷰티"
      },
      {
        "value": "food_cafe",
        "label": "맛집·카페"
      },
      {
        "value": "travel",
        "label": "여행"
      },
      {
        "value": "exercise_health",
        "label": "운동·건강"
      },
      {
        "value": "economy_investment",
        "label": "경제·투자"
      },
      {
        "value": "career_work",
        "label": "커리어·일"
      },
      {
        "value": "startup_side_project",
        "label": "창업·사이드프로젝트"
      },
      {
        "value": "art_design",
        "label": "예술·디자인"
      },
      {
        "value": "photo_video",
        "label": "사진·영상"
      },
      {
        "value": "it_tech",
        "label": "IT·기술"
      },
      {
        "value": "social_news",
        "label": "사회 이슈·뉴스"
      },
      {
        "value": "pet",
        "label": "반려동물"
      },
      {
        "value": "lifestyle",
        "label": "라이프스타일"
      },
      {
        "value": "not_sure",
        "label": "잘 모르겠어요",
        "exclusive": true
      },
      {
        "value": "other",
        "label": "직접 입력",
        "hasTextInput": true
      }
    ]
  },
  {
    "id": 17,
    "order": 17,
    "category": "Interests",
    "type": "multi_choice",
    "question": "즐겨 보거나 관심 있는 스포츠가 있나요?",
    "options": [
      {
        "value": "soccer",
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
        "value": "running_marathon",
        "label": "러닝·마라톤"
      },
      {
        "value": "fitness",
        "label": "헬스·피트니스"
      },
      {
        "value": "yoga_pilates",
        "label": "요가·필라테스"
      },
      {
        "value": "hiking",
        "label": "등산"
      },
      {
        "value": "boxing_mma",
        "label": "격투기·복싱"
      },
      {
        "value": "esports",
        "label": "e스포츠"
      },
      {
        "value": "winter_sports",
        "label": "겨울 스포츠"
      },
      {
        "value": "not_interested",
        "label": "스포츠를 즐겨 보지는 않아요",
        "exclusive": true
      },
      {
        "value": "other",
        "label": "직접 입력",
        "hasTextInput": true
      }
    ]
  },
  {
    "id": 18,
    "order": 18,
    "category": "Picture",
    "type": "photo_upload",
    "question": "나중에 함께 자리한 분들이 얼굴과 이름을 헷갈리지 않도록 사진을 올려주세요.",
    "description": "정면 사진이 아니어도 괜찮아요. 나를 알아보기 쉬운 사진이면 충분해요."
  }
];

export const mockQuestions: ProfileQuestion[] = [
  ...legacyQuestions.slice(0, 14),
  {
    id: 15,
    order: 15,
    category: "TicketPreference",
    type: "ticket_preference",
    question: "아래 활동을 보고, 끌리면 YES를 눌러주세요.",
  },
  {
    id: 16,
    order: 16,
    category: "Picture",
    type: "photo_upload",
    question:
      "나중에 함께 자리한 분들이 얼굴과 이름을 헷갈리지 않도록 사진을 올려주세요.",
    description:
      "정면 사진이 아니어도 괜찮아요. 나를 알아보기 쉬운 사진이면 충분해요.",
  },
];
