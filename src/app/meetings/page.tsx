import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { AppHome, type AppTab } from "@/features/app/AppHome";
import { loadTicketQuestionTemplates } from "@/features/onboarding/loadTicketQuestionTemplates";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import { hasUsablePublicIntro } from "@/lib/textQuality";

type MeetingsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
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
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");
  if (!hasUsablePublicIntro(profile.public_intro)) redirect("/profile/result");

  const ticketQuestionTemplates = await loadTicketQuestionTemplates();

  return (
    <MobileFrame>
      <AppHome
        userId={user.id}
        profile={profile}
        initialTab={initialTabFromSearchParam(params?.tab)}
        ticketQuestionTemplates={ticketQuestionTemplates}
      />
    </MobileFrame>
  );
}
