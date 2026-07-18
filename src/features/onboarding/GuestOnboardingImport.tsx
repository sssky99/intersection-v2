"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearGuestOnboardingDraft,
  loadGuestOnboardingDraft,
  loadGuestProfilePhoto,
} from "@/lib/guestOnboarding";
import { trackEvent, trackLoginSuccessFromUrl } from "@/lib/analytics";
import { uploadProfilePhoto } from "@/lib/profilePhoto";

export function GuestOnboardingImport({ userId }: { userId: string }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackLoginSuccessFromUrl("new");

    void (async () => {
      const draft = loadGuestOnboardingDraft();
      const photo = await loadGuestProfilePhoto(draft.id);
      if (!draft.answers.length || !photo) {
        setError("임시 저장된 답변을 찾지 못했어요.");
        return;
      }

      try {
        const photoUrl = await uploadProfilePhoto(userId, photo);
        const response = await fetch("/api/profile/onboarding/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: draft.answers,
            profile: draft.profile,
            photoUrl,
          }),
        });
        const body = (await response.json().catch(() => null)) as
          | { error?: string; existing?: boolean }
          | null;

        if (response.status === 409 && body?.existing) {
          await clearGuestOnboardingDraft();
          router.replace("/meetings?tab=recommend");
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error(body?.error ?? "온보딩 저장 실패");

        await clearGuestOnboardingDraft();
        trackEvent("guest_onboarding_import_complete");
        router.replace("/meetings?tab=profile");
        router.refresh();
      } catch (importError) {
        console.error("Guest onboarding import failed:", importError);
        setError("답변을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    })();
  }, [router, userId]);

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-6 text-center md:min-h-[calc(100dvh-32px)]">
      {error ? (
        <>
          <p className="text-lg font-bold text-black">답변을 불러오지 못했어요</p>
          <p className="mt-2 text-sm leading-6 text-black/50">{error}</p>
          <a
            href="/onboarding/questions?start=1"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-bold text-white"
          >
            질문 다시 시작하기
          </a>
        </>
      ) : (
        <>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-black/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-black/55" />
          </div>
          <p className="mt-5 text-lg font-bold text-black">답변을 저장하고 있어요</p>
          <p className="mt-2 text-sm leading-6 text-black/45">
            잠시만 기다리면 내 추천으로 바로 이동해요.
          </p>
        </>
      )}
    </section>
  );
}
