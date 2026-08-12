import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";
import { FiftyQLandingClient } from "./FiftyQLandingClient";
import { LandingVariantB } from "@/features/landing/LandingVariantBPreview";

export const dynamic = "force-dynamic";

const INTRO_VIDEO_COOKIE = "intro_video_seen_v1";
const LANDING_EXPERIMENT_COOKIE = "landing_ab_v1";

export default async function Home() {
  const [{ user, profile }, cookieStore] = await Promise.all([
    getAuthenticatedProfile(),
    cookies(),
  ]);

  if (user && profile) {
    redirect(nextOnboardingPath(profile));
  }

  const landingVariant =
    cookieStore.get(LANDING_EXPERIMENT_COOKIE)?.value === "b" ? "b" : "a";

  if (landingVariant === "b") return <LandingVariantB />;

  return (
    <FiftyQLandingClient
      initialHasSeenIntro={cookieStore.get(INTRO_VIDEO_COOKIE)?.value === "1"}
    />
  );
}
