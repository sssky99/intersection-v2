import { MobileFrame } from "@/components/MobileFrame";
import { GuestOnboardingFlow } from "@/features/onboarding/GuestOnboardingFlow";

export const dynamic = "force-static";

export default function GuestOnboardingPage() {
  return (
    <MobileFrame>
      <GuestOnboardingFlow />
    </MobileFrame>
  );
}
