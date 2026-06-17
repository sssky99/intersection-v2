import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { BasicInfoForm } from "@/features/onboarding/BasicInfoForm";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { Gender } from "@/types/user";

export default async function OnboardingProfilePage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (profile.profile_completed) redirect("/profile/result");

  return (
    <MobileFrame>
      <BasicInfoForm
        userId={user.id}
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
