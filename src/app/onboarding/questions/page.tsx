import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  QuestionFlow,
} from "@/features/onboarding/QuestionFlow";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { StoredAnswerRow } from "@/types/question";

type QuestionsPageProps = {
  searchParams?: Promise<{
    regenerate?: string | string[];
  }>;
};

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAuthenticatedProfile();
  const isRegeneration = searchValue(params?.regenerate) === "1";

  if (!user || !profile) redirect("/");
  if (isRegeneration && !profile.profile_regeneration_started_at) {
    redirect("/meetings?tab=profile");
  }
  if (profile.questions_completed && !isRegeneration) redirect("/onboarding/profile");

  const { data } = await supabase
    .from(isRegeneration ? "profile_regeneration_answers" : "user_answers")
    .select(
      "question_order,answer_value,answer_values,answer_text,other_text",
    )
    .eq("user_id", user.id)
    .order("question_order");
  return (
    <MobileFrame>
      <QuestionFlow
        userId={user.id}
        initialRows={(data ?? []) as StoredAnswerRow[]}
        mode={isRegeneration ? "regeneration" : "onboarding"}
      />
    </MobileFrame>
  );
}
