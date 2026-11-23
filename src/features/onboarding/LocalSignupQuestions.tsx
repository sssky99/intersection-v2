"use client";

import { useState } from "react";
import { localSignupQuestions } from "@/data/localSignupQuestions";
import { classifyLocalSignup } from "@/data/localSignupArchetype";
import { QuestionFlow } from "./QuestionFlow";

export function LocalSignupQuestions() {
  const [run, setRun] = useState(0);
  return <QuestionFlow key={run} mode="preview" initialRows={[]} questionSet={localSignupQuestions}
    conversationQuestionCount={0} skipConversationResult showProfileArchetypeResult
    classifyPreviewAnswers={classifyLocalSignup} onPreviewComplete={() => setRun(previous => previous + 1)} />;
}
