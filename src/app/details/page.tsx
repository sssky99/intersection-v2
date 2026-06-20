import { DetailsClient } from "./DetailsClient";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";

export default async function DetailsPage() {
  const { user, profile } = await getAuthenticatedProfile();
  const ticketQuestionTemplates = await loadTicketQuestionTemplates();
  const alreadySeen = Boolean(profile?.details_seen_at);
  const profileComplete = Boolean(profile?.profile_completed);

  return (
    <DetailsClient
      userId={user?.id ?? null}
      alreadySeen={alreadySeen}
      ctaState={!user || !profile ? "guest" : profileComplete ? "complete" : "onboarding"}
      ticketQuestionTemplates={ticketQuestionTemplates}
      nextPath={
        profile
          ? nextOnboardingPath(profile)
          : "/onboarding/questions?start=1"
      }
    />
  );
}
