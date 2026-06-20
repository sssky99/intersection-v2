import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { AppHome, type AppTab } from "@/features/app/AppHome";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import { hasUsablePublicIntro } from "@/lib/textQuality";

type MeetingsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    profileComplete?: string | string[];
  }>;
};

function initialTabFromSearchParam(value: string | string[] | undefined): AppTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "browse" || tab === "profile" ? tab : "recommend";
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const params = await searchParams;
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");
  const introUsable = hasUsablePublicIntro(profile.public_intro);
  const profileCompleteParam = Array.isArray(params?.profileComplete)
    ? params?.profileComplete[0]
    : params?.profileComplete;
  const hasUnrevealedGeneratedIntro = Boolean(
    profile.public_intro_generated_at &&
      profile.public_intro_revealed_generated_at !==
        profile.public_intro_generated_at,
  );
  const shouldOpenCompletionModal =
    hasUnrevealedGeneratedIntro ||
    (profileCompleteParam === "1" && !introUsable);
  if (!introUsable && !shouldOpenCompletionModal) redirect("/profile/result");

  const ticketQuestionTemplates = await loadTicketQuestionTemplates();

  return (
    <MobileFrame>
      <AppHome
        userId={user.id}
        profile={profile}
        initialTab={initialTabFromSearchParam(params?.tab)}
        initialProfileCompletionOpen={shouldOpenCompletionModal}
        ticketQuestionTemplates={ticketQuestionTemplates}
      />
    </MobileFrame>
  );
}
