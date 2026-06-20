import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { ProfileEditor } from "@/features/profile/ProfileEditor";
import { getAuthenticatedProfile } from "@/lib/onboarding";
import type { Gender } from "@/types/user";

export default async function ProfileEditPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) redirect("/");
  if (!profile.profile_completed) redirect("/onboarding/profile");

  return (
    <MobileFrame>
      <ProfileEditor
        userId={user.id}
        initialValues={{
          name: profile.name ?? "",
          phone: profile.phone ?? profile.phone_normalized ?? "",
          gender: (profile.gender ?? "") as Gender,
          birthYear:
            profile.birth_year == null ? "" : String(profile.birth_year),
          mbti: profile.mbti?.toUpperCase() ?? "",
        }}
      />
    </MobileFrame>
  );
}
