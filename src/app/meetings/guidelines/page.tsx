import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import { hasUsablePublicIntro } from "@/lib/textQuality";

export default async function MeetingGuidelinesPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");
  if (!hasUsablePublicIntro(profile.public_intro)) redirect("/profile/result");
  redirect("/meetings");
}
