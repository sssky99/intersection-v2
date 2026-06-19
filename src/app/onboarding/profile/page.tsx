import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { BasicInfoForm } from "@/features/onboarding/BasicInfoForm";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { Gender } from "@/types/user";

type OnboardingProfilePageProps = {
  searchParams?: Promise<{
    from?: string | string[];
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
  if (!profile.questions_completed) redirect("/onboarding/questions");
  const isTestProfileReview =
    Boolean(profile.profile_completed) &&
    profile.is_test_participant === true &&
    searchValue(params?.from) === "profile";

  if (profile.profile_completed && !isTestProfileReview) redirect("/profile/result");

  return (
    <MobileFrame>
      <BasicInfoForm
        userId={user.id}
        returnPath={isTestProfileReview ? "/meetings?tab=profile" : undefined}
        initialValues={{
          name: profile.name ?? "",
          phone: profile.phone ?? profile.phone_normalized ?? "",
          gender: (profile.gender ?? "") as Gender,
          birthYear:
            profile.birth_year == null ? "" : String(profile.birth_year),
          mbti: profile.mbti?.toUpperCase() ?? "",
          photoUrl: profile.photo_url ?? "",
        }}
      />
    </MobileFrame>
  );
}
