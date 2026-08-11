import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";
import { FiftyQLandingClient } from "./FiftyQLandingClient";

export const dynamic = "force-dynamic";

const INTRO_VIDEO_COOKIE = "intro_video_seen_v1";

export default async function Home() {
  const [{ user, profile }, cookieStore] = await Promise.all([
    getAuthenticatedProfile(),
    cookies(),
  ]);

  if (user && profile) {
    redirect(nextOnboardingPath(profile));
  }

  return (
    <FiftyQLandingClient
      initialHasSeenIntro={cookieStore.get(INTRO_VIDEO_COOKIE)?.value === "1"}
    />
  );
}
