export type QuestionFlowMode =
  | "guest"
  | "onboarding"
  | "preview"
  | "regeneration";

export function initialResumeQuestionIndex({
  explicitQuestionIndex,
  requestedStartIndex,
  firstIncompleteIndex,
  questionCount,
  storedAnswerCount,
}: {
  explicitQuestionIndex?: number;
  requestedStartIndex: number | null;
  firstIncompleteIndex: number;
  questionCount: number;
  storedAnswerCount: number;
}) {
  if (explicitQuestionIndex !== undefined) return explicitQuestionIndex;

  // `start` is only a first-entry hint. Once an answer has been saved, the
  // first incomplete question must win so an old URL cannot reset progress.
  if (storedAnswerCount === 0 && requestedStartIndex !== null) {
    return requestedStartIndex;
  }

  if (firstIncompleteIndex !== -1) return firstIncompleteIndex;
  return Math.max(0, questionCount - 1);
}

export function shouldResumeAtPhotoStep({
  mode,
  initialPhotoStep,
  explicitQuestionIndex,
  firstIncompleteIndex,
}: {
  mode: QuestionFlowMode;
  initialPhotoStep: boolean;
  explicitQuestionIndex?: number;
  firstIncompleteIndex: number;
}) {
  if (initialPhotoStep) return true;
  if (explicitQuestionIndex !== undefined) return false;
  if (mode === "preview" || mode === "guest") return false;
  return firstIncompleteIndex === -1;
}
