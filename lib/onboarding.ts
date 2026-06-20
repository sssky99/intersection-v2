import { createClient } from "@/lib/supabase/server";
import { hasUsablePublicIntro } from "@/lib/textQuality";
import type { ProfileRow } from "@/types/profile";

type OnboardingPathOptions = {
  startQuestions?: boolean;
};

export function nextOnboardingPath(
  profile: ProfileRow,
  options: OnboardingPathOptions = {},
) {
  return nextOnboardingPathAfterDetails(profile, options);
}

export function nextOnboardingPathAfterDetails(
  profile: ProfileRow,
  options: OnboardingPathOptions = {},
) {
  if (profile.profile_regeneration_started_at) {
    if (!profile.profile_regeneration_questions_completed_at) {
      return "/onboarding/questions?regenerate=1";
    }

    return "/onboarding/profile?regenerate=1";
  }

  if (!profile.questions_completed) {
    return options.startQuestions
      ? "/onboarding/questions?start=1"
      : "/onboarding/questions";
  }

  if (!profile.profile_completed) return "/onboarding/profile";
  if (!hasUsablePublicIntro(profile.public_intro)) {
    return "/meetings?tab=recommend&profileComplete=1";
  }
  return "/meetings?tab=recommend";
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
