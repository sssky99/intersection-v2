import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { localSignupQuestions } from "@/data/localSignupQuestions";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";

export default async function ChoiceReview({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  if (process.env.CONTEXT === "production") notFound();
  const musicians = (await searchParams).kind === "musicians";
  const id = musicians ? 2020 : 2019;
  const values = musicians ? ["한로로", "우즈(WOODZ)", "최유리", "백예린"] : ["라라랜드", "리틀 포레스트", "인터스텔라"];
  return (
    <MobileFrame>
      <Suspense>
        <QuestionFlow mode="preview" questionSet={localSignupQuestions} conversationQuestionCount={0}
          initialRows={[{question_order: id, answer_values: values, answer_value: null, answer_text: null, other_text: null}]}
          initialQuestionIndex={localSignupQuestions.findIndex(q => q.id === id)} skipConversationResult />
      </Suspense>
    </MobileFrame>
  );
}
