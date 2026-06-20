import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/onboarding";

export default async function ProfileResultPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");

  redirect("/meetings?tab=recommend&profileComplete=1");
}
