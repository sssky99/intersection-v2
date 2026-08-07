import { createClient } from "@/lib/supabase/server";
import {
  preferenceProfileVersion,
  usesPreferenceProfile,
} from "@/data/preferenceQuestions";
import {
  classifyLegacyProfileArchetype,
  classifyProfileArchetype,
  isProfileArchetypeId,
  profileArchetypeVersion,
} from "@/data/profileArchetypes";
import type { ProfileRow } from "@/types/profile";
import type { StoredAnswerRow } from "@/types/question";

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
    if (
      existingProfile.questions_completed === true &&
      !isProfileArchetypeId(existingProfile.profile_archetype_id)
    ) {
      const { data: storedAnswers } = await supabase
        .from("user_answers")
        .select(
          "question_order,answer_value,answer_values,answer_text,other_text",
        )
        .eq("user_id", user.id)
        .order("question_order")
        .returns<StoredAnswerRow[]>();
      const rows = storedAnswers ?? [];
      const profileArchetypeId = usesPreferenceProfile(existingProfile)
        ? classifyProfileArchetype(rows, user.id)
        : classifyLegacyProfileArchetype(rows, user.id);
      const assignedAt = new Date().toISOString();
      const assignment = {
        profile_archetype_id: profileArchetypeId,
        profile_archetype_version: profileArchetypeVersion,
        profile_archetype_assigned_at: assignedAt,
      };

      const { error: assignmentError } = await supabase
        .from("profiles")
        .update(assignment)
        .eq("user_id", user.id);
      if (assignmentError) {
        console.error("Profile archetype assignment failed:", assignmentError.message);
      }

      return {
        supabase,
        user,
        profile: { ...existingProfile, ...assignment },
      };
    }

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
      profile_experience_version: preferenceProfileVersion,
    })
    .select("*")
    .single<ProfileRow>();

  if (error) {
    console.error("Profile bootstrap error:", error.message);
  }

  return { supabase, user, profile: createdProfile ?? null };
}
