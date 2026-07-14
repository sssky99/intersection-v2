"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BasicInfoForm, type BasicInfoValues } from "@/features/onboarding/BasicInfoForm";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
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
import type { StoredAnswerRow } from "@/types/question";

export function GuestOnboardingFlow() {
  const [draft, setDraft] = useState<GuestOnboardingDraft | null>(null);
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
      updateDraft((current) => ({
        ...current,
        answers,
        phase: "profile",
      }));
      trackEvent("questions_complete", {
        question_count: answers.length,
        mode: "guest",
      });
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
        source: "guest_onboarding_complete",
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
    () =>
      draft
        ? {
            ...draft.profile,
            photoUrl,
          }
        : null,
    [
      draft?.profile.birthYear,
      draft?.profile.gender,
      draft?.profile.mbti,
      draft?.profile.name,
      draft?.profile.phone,
      photoUrl,
    ],
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
      <QuestionFlow
        initialRows={draft.answers}
        mode="guest"
        onGuestDraftChange={handleAnswerDraftChange}
        onGuestComplete={handleQuestionsComplete}
      />
    );
  }

  return initialProfileValues ? (
    <BasicInfoForm
      mode="guest"
      initialValues={initialProfileValues}
      onGuestDraftChange={handleProfileDraftChange}
      onGuestPhotoChange={handlePhotoChange}
      onGuestComplete={handleProfileComplete}
    />
  ) : null;
}
