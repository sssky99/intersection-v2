import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  QuestionFlow,
} from "@/features/onboarding/QuestionFlow";
import { PreferenceQuestionFlow } from "@/features/onboarding/TableCardSurveyPreview";
import { usesPreferenceProfile } from "@/data/preferenceQuestions";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { StoredAnswerRow } from "@/types/question";

type QuestionsPageProps = {
  searchParams?: Promise<{
    regenerate?: string | string[];
    upgrade?: string | string[];
  }>;
};

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAuthenticatedProfile();
  const isRegeneration = searchValue(params?.regenerate) === "1";
  const isPreferenceUpgrade =
    searchValue(params?.upgrade) === "preferences-v2";

  if (!user || !profile) redirect("/");
  if (
    (isRegeneration || isPreferenceUpgrade) &&
    !profile.profile_regeneration_started_at
  ) {
    redirect("/meetings?tab=profile");
  }
  if (
    profile.questions_completed &&
    !isRegeneration &&
    !isPreferenceUpgrade
  ) {
    redirect("/onboarding/profile");
  }

  const { data } = await supabase
    .from(
      isRegeneration || isPreferenceUpgrade
        ? "profile_regeneration_answers"
        : "user_answers",
    )
    .select(
      "question_order,answer_value,answer_values,answer_text,other_text",
    )
    .eq("user_id", user.id)
    .order("question_order");
  return (
    <MobileFrame>
      {usesPreferenceProfile(profile) || isPreferenceUpgrade ? (
        <PreferenceQuestionFlow
          userId={user.id}
          initialRows={(data ?? []) as StoredAnswerRow[]}
          mode={
            isPreferenceUpgrade
              ? "upgrade"
              : isRegeneration
                ? "regeneration"
                : "onboarding"
          }
        />
      ) : (
        <QuestionFlow
          userId={user.id}
          initialRows={(data ?? []) as StoredAnswerRow[]}
          mode={isRegeneration ? "regeneration" : "onboarding"}
        />
      )}
    </MobileFrame>
  );
}
