import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { ProfileResult } from "@/features/onboarding/ProfileResult";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import { publicDisplayName } from "@/lib/profilePrompt";
import { hasUsablePublicIntro } from "@/lib/textQuality";

export default async function ProfileResultPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.details_seen_at) redirect("/details");
  if (!profile.browse_seen_at) redirect("/browse");
  if (!profile.questions_completed) redirect("/onboarding/questions");
  if (!profile.profile_completed) redirect("/onboarding/profile");
  const storedIntroIsUsable = hasUsablePublicIntro(profile.public_intro);

  return (
    <MobileFrame>
      <ProfileResult
        displayName={publicDisplayName(profile.name)}
        initialIntro={storedIntroIsUsable ? profile.public_intro : null}
        generateOnLoad={
          !storedIntroIsUsable || profile.public_intro_model === "fallback"
        }
        isDevelopment={process.env.NODE_ENV === "development"}
      />
    </MobileFrame>
  );
}
