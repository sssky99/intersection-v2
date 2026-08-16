"use client";

import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FiftyQLandingClient } from "@/app/FiftyQLandingClient";
import { onboardingGuides } from "@/data/onboardingGuides";
import { PreferenceQuestionFlow } from "@/features/onboarding/TableCardSurveyPreview";
import {
  loadGuestOnboardingDraft,
  saveGuestOnboardingDraft,
  type GuestOnboardingDraft,
} from "@/lib/guestOnboarding";
import { trackEvent } from "@/lib/analytics";
import type { StoredAnswerRow } from "@/types/question";
import type { Gender } from "@/types/user";

function GuestOnboardingGuide({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const text = onboardingGuides[page];
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    setTypedText("");
    let length = 0;
    const timer = window.setInterval(() => {
      length += 1;
      setTypedText(text.slice(0, length));
      if (length >= text.length) window.clearInterval(timer);
    }, 32);
    return () => window.clearInterval(timer);
  }, [text]);

  const typingComplete = typedText.length === text.length;
  return (
    <main className="flex h-dvh min-h-[640px] justify-center overflow-hidden bg-[#e9e9e5] text-[#121212] md:px-4">
      <section className="relative flex h-full w-full max-w-[430px] items-center overflow-hidden bg-[#F5F1E8] px-8 md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame">
        <div key={page} className="mx-auto flex w-full max-w-[340px] flex-col">
          <div className={page === 0 ? "min-h-[190px]" : "min-h-[390px]"}>
            <p className="whitespace-pre-line break-keep text-[16px] font-medium leading-[1.9] tracking-[-0.035em] text-[#171714]">
              {typedText}
              {!typingComplete && (
                <span className="ml-1 inline-block h-[0.9em] w-px animate-pulse bg-black/55 align-[-0.05em]" />
              )}
            </p>
          </div>
          <div className="mt-10 flex items-center justify-between border-t border-black/15 pt-5">
            <span className="text-[12px] font-semibold tracking-[0.16em] text-black/35">
              0{page + 1} / 02
            </span>
            <button
              type="button"
              disabled={!typingComplete}
              aria-label={page === 0 ? "다음 안내 보기" : "질문 시작하기"}
              onClick={() => {
                if (page === 0) setPage(1);
                else onComplete();
              }}
              className={`flex h-12 w-12 items-center justify-center transition-all duration-300 ${
                typingComplete
                  ? "text-black active:translate-x-0.5"
                  : "cursor-not-allowed text-black/20"
              }`}
            >
              <ArrowRight size={28} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export function GuestOnboardingFlow() {
  const [draft, setDraft] = useState<GuestOnboardingDraft | null>(null);

  useEffect(() => {
    const storedDraft = loadGuestOnboardingDraft();
    setDraft(storedDraft);
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
      const birthDate = answers.find((answer) => answer.question_order === 17)?.answer_text?.trim() ?? "";
      const mbti = answers.find((answer) => answer.question_order === 31)?.answer_value?.trim().toUpperCase() ?? "";
      updateDraft((current) => ({
        ...current,
        answers,
        phase: "auth",
        profile: {
          ...current.profile,
          birthDate,
          birthYear: birthDate.slice(0, 4),
          mbti,
        },
      }));
      trackEvent("guest_profile_ready_for_auth", { source: "guest_onboarding" });
      trackEvent("questions_complete", {
        question_count: answers.length,
        mode: "guest",
      });
    },
    [updateDraft],
  );

  const handleIdentityChange = useCallback(
    (identity: { name?: string; gender?: Gender }) => {
      updateDraft((current) => ({
        ...current,
        profile: {
          ...current.profile,
          ...(identity.name ? { name: identity.name } : {}),
          ...(identity.gender === "여성" || identity.gender === "남성"
            ? { gender: identity.gender }
            : {}),
        },
      }));
    },
    [updateDraft],
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

  if (draft.phase === "guide") {
    return (
      <GuestOnboardingGuide
        onComplete={() => {
          trackEvent("onboarding_guide_complete", { mode: "guest" });
          updateDraft((current) => ({ ...current, phase: "questions" }));
        }}
      />
    );
  }

  if (draft.phase === "questions") {
    return (
      <PreferenceQuestionFlow
        initialName={draft.profile.name}
        initialGender={draft.profile.gender}
        initialRows={draft.answers}
        mode="guest"
        onGuestDraftChange={handleAnswerDraftChange}
        onGuestComplete={handleQuestionsComplete}
        onGuestIdentityChange={handleIdentityChange}
      />
    );
  }

  if (draft.phase === "auth") {
    return (
      <FiftyQLandingClient
        initialHasSeenIntro
        trackLandingView={false}
        completionPath="/onboarding/import"
        authSource="guest_onboarding_complete"
      />
    );
  }

  return null;
}
