import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { BrowseClient, type BrowseProfile } from "./BrowseClient";
import {
  getAuthenticatedProfile,
  nextOnboardingPath,
} from "@/lib/onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasUsablePublicIntro } from "@/lib/textQuality";

type BrowseProfileRow = {
  user_id: string;
  name: string | null;
  public_intro: string | null;
};

function displayName(row: BrowseProfileRow) {
  return row.name?.trim() || "교집합 멤버";
}

export default async function BrowsePage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) {
    redirect("/");
  }

  const nextPath = nextOnboardingPath(profile);

  if (!nextPath.startsWith("/meetings")) {
    redirect(nextPath);
  }

  if (profile.browse_seen_at) {
    redirect(nextPath);
  }

  const { data } = await createAdminClient()
    .from("profiles")
    .select("user_id,name,public_intro")
    .neq("user_id", user.id)
    .eq("profile_completed", true)
    .eq("questions_completed", true)
    .not("public_intro", "is", null)
    .limit(8);

  const profiles: BrowseProfile[] = ((data ?? []) as BrowseProfileRow[])
    .filter((row) => hasUsablePublicIntro(row.public_intro))
    .map((row) => ({
      id: row.user_id,
      displayName: displayName(row),
      intro: row.public_intro ?? "",
    }));

  return (
    <MobileFrame>
      <BrowseClient userId={user.id} profiles={profiles} />
    </MobileFrame>
  );
}
