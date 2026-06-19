import { redirect } from "next/navigation";
import { DetailsClient } from "./DetailsClient";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
  nextOnboardingPathAfterDetails,
} from "@/lib/onboarding";

type DetailsSearchParams = Record<string, string | string[] | undefined>;

function hasReplayParam(searchParams: DetailsSearchParams) {
  const value = searchParams.from ?? searchParams.view;
  return Array.isArray(value) ? Boolean(value[0]) : Boolean(value);
}

export default async function DetailsPage({
  searchParams,
}: {
  searchParams?: Promise<DetailsSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) {
    redirect("/");
  }

  const replay = hasReplayParam(resolvedSearchParams);
  const alreadySeen = Boolean(profile.details_seen_at);
  const ticketQuestionTemplates = await loadTicketQuestionTemplates();

  if (alreadySeen && !replay) {
    redirect(nextOnboardingPath(profile));
  }

  return (
    <DetailsClient
      userId={user.id}
      alreadySeen={alreadySeen}
      ticketQuestionTemplates={ticketQuestionTemplates}
      nextPath={
        alreadySeen
          ? nextOnboardingPath(profile)
          : nextOnboardingPathAfterDetails(profile)
      }
    />
  );
}
