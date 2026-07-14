import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { GuestOnboardingImport } from "@/features/onboarding/GuestOnboardingImport";
import { getAuthenticatedProfile, nextOnboardingPath } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function GuestOnboardingImportPage() {
  const { user, profile } = await getAuthenticatedProfile();
  if (!user || !profile) redirect("/");
  if (profile.questions_completed || profile.profile_completed) {
    redirect(nextOnboardingPath(profile));
  }

  return (
    <MobileFrame>
      <GuestOnboardingImport userId={user.id} />
    </MobileFrame>
  );
}
