import type {
  TicketRatingAnswer,
  TicketRatingQuestionTicket,
} from "@/types/question";

export const ticketRatingOptions = [
  { value: "1", label: "별로 끌리지 않아요" },
  { value: "2", label: "조금 애매해요" },
  { value: "3", label: "괜찮을 것 같아요" },
  { value: "4", label: "꽤 좋아요" },
  { value: "5", label: "너무 좋아요" },
] as const;

export type SampleMeetingTicketQuestion = {
  order: number;
  category: "샘플 모임";
  type: "ticket_rating";
  question: string;
  ticket: TicketRatingQuestionTicket;
  intent: string;
  signalTags: string[];
};

export const sampleMeetingTicketQuestions: SampleMeetingTicketQuestion[] = [
  {
    order: 10,
    category: "샘플 모임",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: "pizza_easy_dinner",
      title: "화덕피자,\n편한 대화,\n가벼운 저녁",
      imageUrl: "/images/onboarding-tickets/pizza.jpg",
      fallbackImageUrl: "/images/details/ticket-pizza.jpg",
      dateLabel: "06.13 (토)",
      timeLabel: "18:00",
      locationLabel: "서울\n강남",
      tags: ["화덕피자", "맛집", "편한대화"],
    },
    intent: "맛집·편한 대화형 선호 파악",
    signalTags: ["맛집 선호", "낮은 부담", "가벼운 대화", "낮은 활동 강도"],
  },
  {
    order: 11,
    category: "샘플 모임",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: "career_deep_talk",
      title: "일 얘기,\n솔직하게,\n나눠보는 밤",
      imageUrl: "/images/onboarding-tickets/career.jpg",
      fallbackImageUrl: "/images/details/ticket-lpbar.jpg",
      dateLabel: "06.20 (토)",
      timeLabel: "19:00",
      locationLabel: "서울\n성수",
      tags: ["커리어", "깊은대화", "솔직한밤"],
    },
    intent: "커리어·깊은 대화 선호 파악",
    signalTags: ["커리어 대화 선호", "대화 깊이", "자기개방도"],
  },
  {
    order: 12,
    category: "샘플 모임",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: "exhibition_cafe_talk",
      title: "전시 보고,\n카페에서,\n감상 나누기",
      imageUrl: "/images/onboarding-tickets/exhibition.jpg",
      fallbackImageUrl: "/images/details/ticket-exhibition.jpg",
      dateLabel: "06.21 (일)",
      timeLabel: "15:00",
      locationLabel: "서울\n한남",
      tags: ["전시", "카페", "감상대화"],
    },
    intent: "문화생활·차분한 대화 선호 파악",
    signalTags: ["문화생활 선호", "조용한 자리", "감상형 대화", "카페 선호"],
  },
  {
    order: 13,
    category: "샘플 모임",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: "bowling_fun_group",
      title: "다 같이,\n볼링 치고,\n웃으며 친해지기",
      imageUrl: "/images/onboarding-tickets/bowling.jpg",
      fallbackImageUrl: "/images/landing-people.jpg",
      dateLabel: "06.27 (토)",
      timeLabel: "17:00",
      locationLabel: "서울\n잠실",
      tags: ["볼링", "활동형", "유쾌한자리"],
    },
    intent: "활동형·유쾌한 자리 선호 파악",
    signalTags: ["활동형 선호", "사회적 에너지", "빠른 친밀감"],
  },
  {
    order: 14,
    category: "샘플 모임",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: "failed_love_story",
      title: "망한 연애,\n썰 풀기,\n대회",
      imageUrl: "/images/onboarding-tickets/love-story.jpg",
      fallbackImageUrl: "/images/landing-cinematic.png",
      dateLabel: "07.04 (토)",
      timeLabel: "19:00",
      locationLabel: "서울\n연남",
      tags: ["연애토크", "유머", "솔직한대화"],
    },
    intent: "관계·연애 대화 및 자기개방 선호 파악",
    signalTags: ["관계 대화 선호", "자기개방도", "유머", "설렘 개방도"],
  },
  {
    order: 15,
    category: "샘플 모임",
    type: "ticket_rating",
    question: "이런 자리는 어떠세요?",
    ticket: {
      id: "gwanaksan_trail_running",
      title: "관악산,\n가벼운,\n트레일러닝",
      imageUrl: "/images/onboarding-tickets/trail-running.jpg",
      fallbackImageUrl: "/images/details/lasting-meeting.png",
      dateLabel: "07.05 (일)",
      timeLabel: "09:00",
      locationLabel: "서울\n관악산",
      tags: ["트레일러닝", "야외활동", "운동"],
    },
    intent: "야외·운동·높은 활동 강도 선호 파악",
    signalTags: ["야외활동 선호", "활동 강도", "운동 선호"],
  },
];

export function parseTicketRatingAnswer(
  value: string | null | undefined,
): TicketRatingAnswer | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as TicketRatingAnswer).ticket_id === "string" &&
      typeof (parsed as TicketRatingAnswer).rating === "string" &&
      typeof (parsed as TicketRatingAnswer).title === "string" &&
      Array.isArray((parsed as TicketRatingAnswer).signal_tags)
    ) {
      return parsed as TicketRatingAnswer;
    }
  } catch {
    return null;
  }

  return null;
}
