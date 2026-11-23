"use client";

import { preferenceProfileVersion, preferenceQuestionsForVersion } from "@/data/preferenceQuestions";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import { localSignupQuestions } from "@/data/localSignupQuestions";
import { LocalSignupQuestions } from "./LocalSignupQuestions";
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
  questionnaireVersion = preferenceProfileVersion,
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
  questionnaireVersion?: string;
  onGuestDraftChange?: (rows: StoredAnswerRow[]) => void;
  onGuestComplete?: (rows: StoredAnswerRow[]) => void;
  onGuestIdentityChange?: (identity: { name?: string; gender?: Gender }) => void;
  onGuestPhotoChange?: (file: File) => Promise<void>;
}) {
  if (mode === "guest") {
    return <QuestionFlow mode="guest" initialRows={initialRows} questionSet={localSignupQuestions}
      skipConversationResult conversationQuestionCount={0}
      onGuestDraftChange={onGuestDraftChange} onGuestComplete={onGuestComplete} />;
  }
  if (process.env.NODE_ENV === "development" && mode === "preview") {
    return <LocalSignupQuestions />;
  }
  const questionFlowMode =
    mode === "preview" || mode === "onboarding"
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
      questionSet={preferenceQuestionsForVersion(questionnaireVersion)}
      completionRequestMode={completionRequestMode}
      skipConversationResult
      showProfileArchetypeResult
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
