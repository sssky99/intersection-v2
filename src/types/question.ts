export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "text";

export type QuestionCategory =
  | "낯선 자리 적응"
  | "대화를 여는 방식"
  | "차이를 다루는 방식"
  | "만남의 분위기"
  | "하고 싶은 활동"
  | "피하고 싶은 활동"
  | "온도"
  | "결"
  | "톤"
  | "리듬"
  | "모임 역할"
  | "관심 분야"
  | "관계 기대"
  | "나이 조건"
  | "자기소개"
  | "나의 일"
  | "관심 주제";

export type QuestionOption = {
  value: string;
  label: string;
  exclusive?: boolean;
  hasTextInput?: boolean;
};

export type TicketRatingAnswer = {
  ticket_id: string;
  rating: string;
  title: string;
  signal_tags: string[];
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
  prompt?: string;
  allowPrivate?: boolean;
  allowOther?: boolean;
};

export type QuestionAnswer = {
  questionId: number;
  value: ProfileAnswerValue;
  otherText?: string;
};

export type ProfileAnswerValue = string | string[] | number;

export type ProfileAnswers = Record<number, QuestionAnswer>;

export type StoredAnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};
