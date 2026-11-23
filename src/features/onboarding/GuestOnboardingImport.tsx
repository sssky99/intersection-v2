"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyticsSessionId, trackEvent } from "@/lib/analytics";
import { clearGuestOnboardingDraft, loadGuestOnboardingDraft } from "@/lib/guestOnboarding";
import { fetchJsonWithTimeout } from "@/lib/fetchJsonWithTimeout";
import { isProfileArchetypeId, type ProfileArchetypeId } from "@/data/profileArchetypes";
import { ProfileArchetypeResult } from "./ProfileArchetypeResult";

export function GuestOnboardingImport() {
  const router = useRouter();
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<ProfileArchetypeId | null>(null);
  const [destination, setDestination] = useState("/meetings?tab=recommend");
  const save = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError("");
    try {
      const draft = loadGuestOnboardingDraft();
      if (draft.phase !== "auth" || !draft.answers.length) {
        router.replace("/onboarding/start");
        return;
      }
      const { response, body } = await fetchJsonWithTimeout<{ existing?: boolean; profileArchetypeId?: unknown; error?: string }>(
        "/api/profile/onboarding/import", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: draft.answers, questionnaireVersion: draft.questionnaireVersion, analyticsSessionId: analyticsSessionId() }) });
      if (response.status === 409 && body?.existing) {
        await clearGuestOnboardingDraft();
        router.replace("/meetings?tab=recommend");
        return;
      }
      if (!response.ok || !isProfileArchetypeId(body?.profileArchetypeId)) throw new Error(body?.error || "답변을 저장하지 못했어요.");
      setType(body.profileArchetypeId);
      if (draft.returnMeetingDate) setDestination("/meetings?tab=recommend&resumeDate=" + encodeURIComponent(draft.returnMeetingDate));
      await clearGuestOnboardingDraft();
      trackEvent("guest_onboarding_import_complete");
      trackEvent("profile_complete", { mode: "guest_import" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      busy.current = false;
    }
  }, [router]);
  useEffect(() => { void save(); }, [save]);
  if (type) return <ProfileArchetypeResult archetypeId={type} onContinue={() => router.replace(destination)} />;
  return <section className="grid min-h-dvh place-content-center gap-5 px-7 text-center" aria-live="polite">
    <p>{error || "나의 유형을 확인하고 있어요."}</p>
    {error && <button onClick={() => void save()} className="rounded-full bg-black px-6 py-3 text-white">다시 시도하기</button>}
  </section>;
}
