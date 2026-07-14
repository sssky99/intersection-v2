import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { GuestOnboardingFlow } from "@/features/onboarding/GuestOnboardingFlow";
import { getAuthenticatedProfile, nextOnboardingPath } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function GuestOnboardingPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (user && profile) redirect(nextOnboardingPath(profile, { startQuestions: true }));

  return (
    <MobileFrame>
      <GuestOnboardingFlow />
    </MobileFrame>
  );
}
