import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import {
  PreferenceQuestionFlow,
} from "@/features/onboarding/TableCardSurveyPreview";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { StoredAnswerRow } from "@/types/question";

type QuestionsPageProps = {
  searchParams?: Promise<{
    regenerate?: string | string[];
    upgrade?: string | string[];
    namePreview?: string | string[];
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
  const isNamePreview =
    process.env.NODE_ENV === "development" &&
    searchValue(params?.namePreview) === "1";

  if (!user || !profile) redirect("/");
  if (
    (isRegeneration || isPreferenceUpgrade) &&
    !profile.profile_regeneration_started_at &&
    !isNamePreview
  ) {
    redirect("/meetings?tab=profile");
  }
  if (
    profile.questions_completed &&
    profile.profile_completed &&
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
      <PreferenceQuestionFlow
        userId={user.id}
        initialName={profile.name ?? ""}
        initialGender={profile.gender ?? ""}
        initialPhotoUrl={profile.photo_url ?? ""}
        namePreview={isNamePreview}
        initialRows={(data ?? []) as StoredAnswerRow[]}
        mode={
          isPreferenceUpgrade
            ? "upgrade"
            : isRegeneration
              ? "regeneration"
              : "onboarding"
        }
      />
    </MobileFrame>
  );
}
