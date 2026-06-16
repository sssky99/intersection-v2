import type { AvailableDate } from "@/types/ticket";

export const availableDates: AvailableDate[] = [
  {
    id: "date-2026-06-20",
    date: "2026-06-20",
    label: "6월 20일 토요일",
    tickets: [
      {
        id: "ticket-calm-table",
        title: "조용히 오래 앉는 자리",
        subtitle: "처음에도 대화가 급하지 않은 네 사람",
        date: "2026-06-20",
        time: "15:00",
        area: "성수",
        moodTags: ["차분한", "작은 테이블", "긴 대화"],
        remainingSeatCount: 2,
        peopleHint: "천천히 말해도 흐름이 끊기지 않는 사람들과 가까운 자리",
        reason:
          "대화 속도와 휴식 취향이 비슷해서 첫 만남의 부담이 낮을 가능성이 높아요.",
      },
      {
        id: "ticket-light-walk",
        title: "가볍게 걷고 마시는 자리",
        subtitle: "산책과 카페를 함께 좋아하는 사람들",
        date: "2026-06-20",
        time: "16:30",
        area: "망원",
        moodTags: ["산책", "가벼운", "햇빛"],
        remainingSeatCount: 1,
        peopleHint: "주말을 느슨하게 쓰는 감각이 닮은 사람들과 가까운 자리",
        reason:
          "주말 리듬과 장소 취향이 맞아 어색한 침묵도 자연스럽게 흘러갈 수 있어요.",
      },
    ],
  },
  {
    id: "date-2026-06-21",
    date: "2026-06-21",
    label: "6월 21일 일요일",
    tickets: [
      {
        id: "ticket-riverside-tea",
        title: "강변에서 차를 나누는 자리",
        subtitle: "산책 뒤 작은 찻집에서 이어지는 느린 오후",
        date: "2026-06-21",
        time: "16:00",
        area: "잠원",
        moodTags: ["차", "산책", "느린 오후"],
        remainingSeatCount: 0,
        peopleHint: "말 사이의 여백을 편안하게 느끼는 세 사람이 모여요.",
        reason:
          "조용한 장소 선호와 대화 속도가 닮아 부담 없이 머물기 좋은 자리예요.",
      },
    ],
  },
  {
    id: "date-2026-06-27",
    date: "2026-06-27",
    label: "6월 27일 토요일",
    tickets: [
      {
        id: "ticket-book-film",
        title: "책과 영화 사이의 자리",
        subtitle: "최근 본 것들로 대화가 시작되는 저녁",
        date: "2026-06-27",
        time: "18:00",
        area: "연남",
        moodTags: ["취향", "저녁", "대화"],
        remainingSeatCount: 3,
        peopleHint: "좋았던 문장이나 장면을 편하게 꺼낼 수 있는 사람들",
        reason:
          "취향을 말하는 방식과 대화 깊이가 비슷해 서로를 빠르게 파악할 수 있어요.",
      },
      {
        id: "ticket-soft-dinner",
        title: "편안한 저녁 식탁",
        subtitle: "음식 취향이 무난하게 겹치는 작은 모임",
        date: "2026-06-27",
        time: "19:00",
        area: "합정",
        moodTags: ["식사", "배려", "논알콜 가능"],
        remainingSeatCount: 2,
        peopleHint: "선택을 강요하지 않고 서로의 속도를 존중하는 사람들",
        reason:
          "음식 선호와 관계 태도에서 공통점이 많아 첫 식사 자리로 잘 맞아요.",
      },
    ],
  },
  {
    id: "date-2026-06-28",
    date: "2026-06-28",
    label: "6월 28일 일요일",
    tickets: [],
  },
  {
    id: "date-2026-07-04",
    date: "2026-07-04",
    label: "7월 4일 토요일",
    tickets: [
      {
        id: "ticket-gallery",
        title: "전시를 보고 나누는 자리",
        subtitle: "말보다 감상을 먼저 두는 오후",
        date: "2026-07-04",
        time: "14:00",
        area: "북촌",
        moodTags: ["전시", "감상", "낮"],
        remainingSeatCount: 1,
        peopleHint: "각자의 느낌을 천천히 말하는 방식이 어울리는 사람들",
        reason:
          "새로운 취향을 시도하는 정도와 조용한 장소 선호가 잘 맞는 조합이에요.",
      },
      {
        id: "ticket-weekend-ease",
        title: "주말을 느슨하게 여는 자리",
        subtitle: "계획은 단순하게, 대화는 자연스럽게",
        date: "2026-07-04",
        time: "13:30",
        area: "서촌",
        moodTags: ["브런치", "느슨한", "처음 만남"],
        remainingSeatCount: 0,
        peopleHint: "너무 빠르게 친해지려 하지 않아도 괜찮은 사람들",
        reason:
          "관계 속도와 주말 사용법이 비슷해 편안한 시작점이 될 수 있어요.",
      },
    ],
  },
];
