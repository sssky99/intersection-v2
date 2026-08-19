import { redirect } from "next/navigation";
import { LandingVariantB } from "@/features/landing/LandingVariantBPreview";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function InstagramLandingPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (user && profile) {
    redirect(nextOnboardingPath(profile));
  }

  return <LandingVariantB instagramAd />;
}
