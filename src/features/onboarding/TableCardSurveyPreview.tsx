"use client";

import { preferenceQuestions } from "@/data/preferenceQuestions";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import type { StoredAnswerRow } from "@/types/question";

type PreferenceQuestionFlowMode =
  | "preview"
  | "onboarding"
  | "regeneration"
  | "upgrade"
  | "guest";

export function PreferenceQuestionFlow({
  userId,
  initialRows = [],
  mode = "preview",
  onGuestDraftChange,
  onGuestComplete,
}: {
  userId?: string;
  initialRows?: StoredAnswerRow[];
  mode?: PreferenceQuestionFlowMode;
  onGuestDraftChange?: (rows: StoredAnswerRow[]) => void;
  onGuestComplete?: (rows: StoredAnswerRow[]) => void;
}) {
  const questionFlowMode =
    mode === "preview" || mode === "guest" || mode === "onboarding"
      ? mode
      : "regeneration";
  const completionRequestMode =
    mode === "regeneration"
      ? "preferences-v2-regeneration"
      : mode === "upgrade"
        ? "preferences-v2-upgrade"
        : "preferences-v2";

  return (
    <QuestionFlow
      userId={userId}
      initialRows={initialRows}
      mode={questionFlowMode}
      questionSet={preferenceQuestions}
      completionRequestMode={completionRequestMode}
      skipConversationResult
      showProfileArchetypeResult
      conversationQuestionCount={0}
      onGuestDraftChange={onGuestDraftChange}
      onGuestComplete={onGuestComplete}
    />
  );
}

export function TableCardSurveyPreview() {
  return <PreferenceQuestionFlow mode="preview" />;
}
