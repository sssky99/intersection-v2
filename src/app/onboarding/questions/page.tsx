import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  QuestionFlow,
  type StoredAnswerRow,
} from "@/features/onboarding/QuestionFlow";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import { getAuthenticatedProfile } from "@/lib/onboarding";

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
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
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
  const ticketQuestionTemplates = await loadTicketQuestionTemplates();

  return (
    <MobileFrame>
      <QuestionFlow
        userId={user.id}
        initialRows={(data ?? []) as StoredAnswerRow[]}
        ticketQuestionTemplates={ticketQuestionTemplates}
        mode={isRegeneration ? "regeneration" : "onboarding"}
      />
    </MobileFrame>
  );
}
