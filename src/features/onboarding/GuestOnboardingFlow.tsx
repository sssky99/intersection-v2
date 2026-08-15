"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppHome } from "@/features/app/AppHome";
import {
  BasicInfoForm,
  type BasicInfoValues,
} from "@/features/onboarding/BasicInfoForm";
import { PreferenceQuestionFlow } from "@/features/onboarding/TableCardSurveyPreview";
import { preferenceProfileVersion } from "@/data/preferenceQuestions";
import {
  loadGuestOnboardingDraft,
  loadGuestProfilePhoto,
  saveGuestOnboardingDraft,
  saveGuestProfilePhoto,
  type GuestOnboardingDraft,
} from "@/lib/guestOnboarding";
import { trackEvent } from "@/lib/analytics";
import { createOAuthRedirectUrl } from "@/lib/authRedirect";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/profile";
import type { StoredAnswerRow } from "@/types/question";

type GuestScreen = "app" | "basic-info";

function guestProfile(): ProfileRow {
  return {
    user_id: "guest-preview",
    provider: null,
    kakao_id: null,
    name: null,
    nickname: null,
    phone: null,
    phone_normalized: null,
    gender: null,
    birth_year: null,
    mbti: null,
    photo_url: null,
    details_seen_at: null,
    browse_seen_at: null,
    profile_completed: false,
    questions_completed: true,
    profile_experience_version: preferenceProfileVersion,
    is_test_participant: false,
    public_intro: null,
    public_emoji: null,
    public_intro_generated_at: null,
    public_intro_revealed_generated_at: null,
    public_intro_model: null,
    last_profile_regenerated_at: null,
    profile_regeneration_started_at: null,
    profile_regeneration_questions_completed_at: null,
    meeting_guidelines_agreed: false,
    meeting_guidelines_agreed_at: null,
    membership_status: null,
    membership_plan: null,
    membership_start_date: null,
    membership_end_date: null,
    membership_purchase_clicked_at: null,
    membership_updated_at: null,
    matching_precision_bonus: 0,
    community_guidelines_agreed: false,
    community_guidelines_agreed_at: null,
  };
}

export function GuestOnboardingFlow() {
  const [draft, setDraft] = useState<GuestOnboardingDraft | null>(null);
  const [screen, setScreen] = useState<GuestScreen>("app");
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    let objectUrl = "";
    const storedDraft = loadGuestOnboardingDraft();

    void loadGuestProfilePhoto(storedDraft.id).then((file) => {
      if (!mounted) return;
      if (file) {
        objectUrl = URL.createObjectURL(file);
        setPhotoUrl(objectUrl);
      }
      setDraft(storedDraft);
    });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const updateDraft = useCallback(
    (update: (current: GuestOnboardingDraft) => GuestOnboardingDraft) => {
      setDraft((current) => {
        if (!current) return current;
        const nextDraft = update(current);
        saveGuestOnboardingDraft(nextDraft);
        return nextDraft;
      });
    },
    [],
  );

  const handleAnswerDraftChange = useCallback(
    (answers: StoredAnswerRow[]) => {
      updateDraft((current) => ({ ...current, answers }));
    },
    [updateDraft],
  );

  const handleQuestionsComplete = useCallback(
    (answers: StoredAnswerRow[]) => {
      updateDraft((current) => ({ ...current, answers, phase: "profile" }));
      setScreen("app");
      trackEvent("questions_complete", {
        question_count: answers.length,
        mode: "guest",
      });
    },
    [updateDraft],
  );

  const requestBasicInfo = useCallback(
    (meetingDate?: string) => {
      updateDraft((current) => ({ ...current, returnMeetingDate: meetingDate }));
      setScreen("basic-info");
    },
    [updateDraft],
  );

  const handleProfileDraftChange = useCallback(
    (values: BasicInfoValues) => {
      updateDraft((current) => ({
        ...current,
        profile: {
          name: values.name,
          phone: values.phone,
          gender: values.gender,
          birthYear: values.birthYear,
          mbti: values.mbti,
        },
      }));
    },
    [updateDraft],
  );

  const handlePhotoChange = useCallback(
    async (file: File) => {
      if (!draft) throw new Error("Guest onboarding draft is unavailable.");
      await saveGuestProfilePhoto(file, draft.id);
    },
    [draft],
  );

  const handleProfileComplete = useCallback(
    async (values: BasicInfoValues) => {
      if (!draft) throw new Error("Guest onboarding draft is unavailable.");

      const finalDraft: GuestOnboardingDraft = {
        ...draft,
        phase: "profile",
        profile: {
          name: values.name.trim(),
          phone: values.phone.trim(),
          gender: values.gender,
          birthYear: values.birthYear,
          mbti: values.mbti.toUpperCase(),
        },
        updatedAt: new Date().toISOString(),
      };
      saveGuestOnboardingDraft(finalDraft);

      const redirectTo = createOAuthRedirectUrl(
        window.location.origin,
        "/onboarding/import",
      );
      trackEvent("kakao_login_click", {
        next_path: "/onboarding/import",
        provider: "kakao",
        source: "guest_basic_info_complete",
      });

      const { error } = await createClient().auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo,
          queryParams: { scope: "" },
        },
      });

      if (error) throw error;
    },
    [draft],
  );

  const initialProfileValues = useMemo(
    () => (draft ? { ...draft.profile, photoUrl } : null),
    [draft, photoUrl],
  );

  if (!draft) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 md:min-h-[calc(100dvh-32px)]">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-black/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-black/45" />
        </div>
      </div>
    );
  }

  if (draft.phase === "questions") {
    return (
      <PreferenceQuestionFlow
        initialRows={draft.answers}
        mode="guest"
        onGuestDraftChange={handleAnswerDraftChange}
        onGuestComplete={handleQuestionsComplete}
      />
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden md:h-[calc(100dvh-32px)]">
      <AppHome
        userId="guest-preview"
        profile={guestProfile()}
        initialTab="recommend"
        guestMode
        initialAnswerRows={draft.answers}
        onRequestBasicInfo={requestBasicInfo}
      />

      <AnimatePresence>
        {screen === "basic-info" && initialProfileValues && (
          <motion.div
            key="guest-basic-info-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-label="기본정보 입력"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="h-[min(760px,calc(100dvh-32px))] w-full max-w-[390px] overflow-hidden rounded-[30px] border border-white/45 bg-[#F7F5EF] shadow-[0_28px_90px_rgba(0,0,0,0.28)]"
            >
              <BasicInfoForm
                mode="guest"
                presentation="modal"
                initialValues={initialProfileValues}
                onClose={() => setScreen("app")}
                onGuestDraftChange={handleProfileDraftChange}
                onGuestPhotoChange={handlePhotoChange}
                onGuestComplete={handleProfileComplete}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
