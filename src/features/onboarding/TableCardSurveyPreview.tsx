"use client";

import { preferenceQuestions } from "@/data/preferenceQuestions";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import type { StoredAnswerRow } from "@/types/question";
import type { Gender } from "@/types/user";

type PreferenceQuestionFlowMode =
  | "preview"
  | "onboarding"
  | "regeneration"
  | "upgrade"
  | "guest";

export function PreferenceQuestionFlow({
  userId,
  initialName = "",
  initialGender = "",
  initialPhotoUrl = "",
  namePreview = false,
  initialRows = [],
  mode = "preview",
  onGuestDraftChange,
  onGuestComplete,
  onGuestIdentityChange,
  onGuestPhotoChange,
}: {
  userId?: string;
  initialName?: string;
  initialGender?: Gender;
  initialPhotoUrl?: string;
  namePreview?: boolean;
  initialRows?: StoredAnswerRow[];
  mode?: PreferenceQuestionFlowMode;
  onGuestDraftChange?: (rows: StoredAnswerRow[]) => void;
  onGuestComplete?: (rows: StoredAnswerRow[]) => void;
  onGuestIdentityChange?: (identity: { name?: string; gender?: Gender }) => void;
  onGuestPhotoChange?: (file: File) => Promise<void>;
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
      initialName={initialName}
      initialGender={initialGender}
      initialPhotoUrl={initialPhotoUrl}
      namePreview={namePreview}
      initialRows={initialRows}
      mode={questionFlowMode}
      questionSet={preferenceQuestions}
      completionRequestMode={completionRequestMode}
      skipConversationResult
      showProfileArchetypeResult={mode !== "guest"}
      conversationQuestionCount={0}
      onGuestDraftChange={onGuestDraftChange}
      onGuestComplete={onGuestComplete}
      onGuestIdentityChange={onGuestIdentityChange}
      onGuestPhotoChange={onGuestPhotoChange}
    />
  );
}

export function TableCardSurveyPreview() {
  return <PreferenceQuestionFlow mode="preview" />;
}
