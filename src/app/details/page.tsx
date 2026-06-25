import { redirect } from "next/navigation";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";
import { ImprovedDetailsClient } from "./improved/ImprovedDetailsClient";

type DetailsPageProps = {
  searchParams?: Promise<{
    from?: string | string[];
  }>;
};

export default async function DetailsPage({ searchParams }: DetailsPageProps) {
  const params = await searchParams;
  const from = Array.isArray(params?.from) ? params?.from[0] : params?.from;
  const replayRequested = from === "profile";
  const { supabase, user, profile } = await getAuthenticatedProfile();
  const replayMode = replayRequested && Boolean(user && profile);

  if (user && profile) {
    if (!profile.details_seen_at) {
      const { error } = await supabase
        .from("profiles")
        .update({ details_seen_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (error) {
        console.error("Details seen update error:", error.message);
      }
    }

    if (!replayMode) {
      redirect(nextOnboardingPath(profile));
    }
  }

  const ticketQuestionTemplates = await loadTicketQuestionTemplates();

  return (
    <ImprovedDetailsClient
      ticketQuestionTemplates={ticketQuestionTemplates}
      nextPath={
        replayMode ? "/meetings?tab=recommend" : "/onboarding/questions?start=1"
      }
      replayMode={replayMode}
    />
  );
}
