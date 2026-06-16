import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { AppHome } from "@/features/app/AppHome";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import { hasUsablePublicIntro } from "@/lib/textQuality";

export default async function MeetingsPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");
  if (!hasUsablePublicIntro(profile.public_intro)) redirect("/profile/result");

  return (
    <MobileFrame>
      <AppHome userId={user.id} profile={profile} initialTab="recommend" />
    </MobileFrame>
  );
}
