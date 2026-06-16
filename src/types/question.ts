export type QuestionType =
  | "scale"
  | "single"
  | "multiple"
  | "singleWithOther"
  | "multipleWithOther"
  | "single_choice"
  | "multi_choice"
  | "ticket_preference"
  | "text"
  | "photo_upload";

export type QuestionCategory =
  | "Communication"
  | "Lifestyle"
  | "Relationship"
  | "Values"
  | "Background"
  | "Interests"
  | "Preference"
  | "TicketPreference"
  | "Story"
  | "Picture";

export type QuestionOption = {
  value: string;
  label: string;
  exclusive?: boolean;
  hasTextInput?: boolean;
};

export type ProfileQuestion = {
  id: number;
  order?: number;
  category: QuestionCategory;
  question: string;
  description?: string;
  placeholder?: string;
  type: QuestionType;
  options?: Array<string | QuestionOption>;
  allowPrivate?: boolean;
  allowOther?: boolean;
};

export type QuestionAnswer = {
  questionId: number;
  value: string | string[] | number;
  otherText?: string;
};

export type ProfileAnswerValue = string | string[] | number;

export type ProfileAnswers = Record<number, QuestionAnswer>;
