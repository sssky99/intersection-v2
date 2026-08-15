import { redirect } from "next/navigation";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";
import { LandingVariantB } from "@/features/landing/LandingVariantBPreview";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user, profile } = await getAuthenticatedProfile();

  if (user && profile) {
    redirect(nextOnboardingPath(profile));
  }

  return <LandingVariantB />;
}
