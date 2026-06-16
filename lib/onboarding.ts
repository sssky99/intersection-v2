import { createClient } from "@/lib/supabase/server";
import { hasUsablePublicIntro } from "@/lib/textQuality";
import type { ProfileRow } from "@/types/profile";

export function nextOnboardingPath(profile: ProfileRow) {
  if (!profile.details_seen_at) return "/details";
  return nextOnboardingPathAfterDetails(profile);
}

export function nextOnboardingPathAfterDetails(profile: ProfileRow) {
  if (!profile.browse_seen_at) return "/browse";
  if (!profile.questions_completed) return "/onboarding/questions";
  if (!profile.profile_completed) return "/onboarding/profile";
  if (!hasUsablePublicIntro(profile.public_intro)) return "/profile/result";
  return "/meetings";
}

export async function getAuthenticatedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (existingProfile) {
    return { supabase, user, profile: existingProfile };
  }

  const kakaoIdentity = user.identities?.find(
    (identity) => identity.provider === "kakao",
  );
  const { data: createdProfile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      provider: "kakao",
      kakao_id: kakaoIdentity?.id ?? null,
      questions_completed: false,
      profile_completed: false,
      meeting_guidelines_agreed: false,
    })
    .select("*")
    .single<ProfileRow>();

  if (error) {
    console.error("Profile bootstrap error:", error.message);
  }

  return { supabase, user, profile: createdProfile ?? null };
}
