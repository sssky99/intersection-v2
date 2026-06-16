import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { BrowseClient } from "./BrowseClient";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";

export default async function BrowsePage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) {
    redirect("/");
  }

  if (!profile.details_seen_at) {
    redirect("/details");
  }

  if (profile.browse_seen_at) {
    redirect(nextOnboardingPath(profile));
  }

  return (
    <MobileFrame>
      <BrowseClient userId={user.id} />
    </MobileFrame>
  );
}
