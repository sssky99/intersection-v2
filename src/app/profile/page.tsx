import { redirect } from "next/navigation";
import { getAuthenticatedProfile, nextOnboardingPath } from "@/lib/onboarding";

export default async function ProfilePage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");

  const nextPath = nextOnboardingPath(profile);
  if (!nextPath.startsWith("/meetings")) redirect(nextPath);

  redirect("/profile/result?view=profile");
}
