import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { BasicInfoForm } from "@/features/onboarding/BasicInfoForm";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { Gender } from "@/types/user";

type OnboardingProfilePageProps = {
  searchParams?: Promise<{
    from?: string | string[];
    regenerate?: string | string[];
  }>;
};

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingProfilePage({
  searchParams,
}: OnboardingProfilePageProps) {
  const params = await searchParams;
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  const isRegeneration = searchValue(params?.regenerate) === "1";
  if (isRegeneration && !profile.profile_regeneration_started_at) {
    redirect("/meetings?tab=profile");
  }
  if (
    isRegeneration &&
    !profile.profile_regeneration_questions_completed_at
  ) {
    redirect("/onboarding/questions?regenerate=1&start=1");
  }
  if (!profile.questions_completed && !isRegeneration) {
    redirect("/onboarding/questions");
  }
  const isTestProfileReview =
    Boolean(profile.profile_completed) &&
    profile.is_test_participant === true &&
    searchValue(params?.from) === "profile";

  if (profile.profile_completed && !isTestProfileReview && !isRegeneration) {
    redirect("/profile/result");
  }

  return (
    <MobileFrame>
      <BasicInfoForm
        userId={user.id}
        mode={isRegeneration ? "regeneration" : "onboarding"}
        returnPath={isTestProfileReview ? "/meetings?tab=profile" : undefined}
        initialValues={{
          name: isRegeneration ? "" : profile.name ?? "",
          phone: isRegeneration ? "" : profile.phone ?? profile.phone_normalized ?? "",
          gender: (isRegeneration ? "" : profile.gender ?? "") as Gender,
          birthYear:
            isRegeneration || profile.birth_year == null
              ? ""
              : String(profile.birth_year),
          mbti: isRegeneration ? "" : profile.mbti?.toUpperCase() ?? "",
          photoUrl: isRegeneration ? "" : profile.photo_url ?? "",
        }}
      />
    </MobileFrame>
  );
}
