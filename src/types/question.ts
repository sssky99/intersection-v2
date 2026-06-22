export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "text"
  | "ticket_rating";

export type QuestionCategory =
  | "온도"
  | "결"
  | "톤"
  | "리듬"
  | "모임 역할"
  | "모임 역할 - 상대"
  | "관계 기대"
  | "나이 조건"
  | "모임 취향"
  | "자기소개"
  | "나의 일"
  | "관심 주제";

export type QuestionOption = {
  value: string;
  label: string;
  exclusive?: boolean;
  hasTextInput?: boolean;
};

export type TicketRatingQuestionTicket = {
  id: string;
  title: string;
  imageUrl: string;
  fallbackImageUrl?: string;
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
  proposerLabel?: string;
  tags: string[];
};

export type TicketRatingAnswer = {
  ticket_id: string;
  rating: string;
  title: string;
  signal_tags: string[];
};

export type TicketQuestionTemplate = {
  id: string;
  title: string;
  shortDescription: string | null;
  imageUrl: string | null;
  moodTags: string[];
  activityType: string | null;
  recommendationCopy: string | null;
  defaultRegion: string | null;
  defaultTime: string | null;
  proposerLabel: string;
  questionOrder: number;
};

export type ProfileQuestion = {
  id: number;
  order?: number;
  category: QuestionCategory;
  question: string;
  description?: string;
  placeholder?: string;
  examples?: string[];
  type: QuestionType;
  options?: Array<string | QuestionOption>;
  maxSelections?: number;
  scaleLabel?: string;
  ticket?: TicketRatingQuestionTicket;
  intent?: string;
  signalTags?: string[];
  allowPrivate?: boolean;
  allowOther?: boolean;
};

export type QuestionAnswer = {
  questionId: number;
  value: ProfileAnswerValue;
  otherText?: string;
};

export type ProfileAnswerValue = string | string[] | number | TicketRatingAnswer;

export type ProfileAnswers = Record<number, QuestionAnswer>;
