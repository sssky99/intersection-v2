import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  QuestionFlow,
  type StoredAnswerRow,
} from "@/features/onboarding/QuestionFlow";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import { getAuthenticatedProfile } from "@/lib/onboarding";

export default async function QuestionsPage() {
  const { supabase, user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  if (profile.questions_completed) redirect("/onboarding/profile");

  const { data } = await supabase
    .from("user_answers")
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
      />
    </MobileFrame>
  );
}
