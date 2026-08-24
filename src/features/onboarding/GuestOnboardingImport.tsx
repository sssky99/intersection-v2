"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearGuestOnboardingDraft,
  loadGuestOnboardingDraft,
  loadGuestProfilePhoto,
  saveGuestProfilePhoto,
  type GuestOnboardingDraft,
} from "@/lib/guestOnboarding";
import {
  analyticsSessionId,
  trackEvent,
  trackLoginSuccessFromUrl,
} from "@/lib/analytics";
import { uploadProfilePhoto } from "@/lib/profilePhoto";
import {
  isProfileArchetypeId,
  type ProfileArchetypeId,
} from "@/data/profileArchetypes";
import { ProfileArchetypeResult } from "@/features/onboarding/ProfileArchetypeResult";

export function GuestOnboardingImport({ userId }: { userId: string }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [draft, setDraft] = useState<GuestOnboardingDraft | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileArchetypeId, setProfileArchetypeId] =
    useState<ProfileArchetypeId | null>(null);
  const [nextPath, setNextPath] = useState("/meetings?tab=recommend");

  useEffect(() => {
    if (!photo) {
      setPhotoUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(photo);
    setPhotoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackLoginSuccessFromUrl("new");

    void (async () => {
      const storedDraft = loadGuestOnboardingDraft();
      if (!storedDraft.answers.length) {
        setError("임시 저장된 답변을 찾지 못했어요.");
        return;
      }

      try {
        const identityResponse = await fetch("/api/auth/phone/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analyticsSessionId: analyticsSessionId() }),
        });
        const identity = (await identityResponse.json().catch(() => null)) as
          | { loginType?: "new" | "existing"; nextPath?: string }
          | null;
        if (identityResponse.ok && identity?.loginType === "existing") {
          await clearGuestOnboardingDraft();
          router.replace(identity.nextPath ?? "/meetings?tab=recommend");
          router.refresh();
          return;
        }

        const storedPhoto = await loadGuestProfilePhoto(storedDraft.id);
        setDraft(storedDraft);
        setPhoto(storedPhoto);
      } catch (loadError) {
        console.error("Guest onboarding draft load failed:", loadError);
        setError("임시 저장된 답변을 불러오지 못했어요.");
      }
    })();
  }, [router]);

  const choosePhoto = async (file: File | null) => {
    if (!file || !draft || savingPhoto || importing) return;
    setSavingPhoto(true);
    setError(null);
    try {
      await saveGuestProfilePhoto(file, draft.id);
      setPhoto(file);
    } catch (photoError) {
      console.error("Guest profile photo save failed:", photoError);
      setError("사진을 올리지 못했어요. 다른 사진으로 다시 시도해주세요.");
    } finally {
      setSavingPhoto(false);
    }
  };

  const completeProfile = async () => {
    if (!draft || !photo || importing || savingPhoto) return;
    setImporting(true);
    setError(null);

    try {
      const uploadedPhotoUrl = await uploadProfilePhoto(userId, photo);
      const response = await fetch("/api/profile/onboarding/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: draft.answers,
          profile: draft.profile,
          photoUrl: uploadedPhotoUrl,
          analyticsSessionId: analyticsSessionId(),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            existing?: boolean;
            profileArchetypeId?: unknown;
          }
        | null;

      if (response.status === 409 && body?.existing) {
        await clearGuestOnboardingDraft();
        router.replace("/meetings?tab=recommend");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error(body?.error ?? "온보딩 저장 실패");

      const destination = draft.returnMeetingDate
        ? `/meetings?tab=recommend&resumeDate=${encodeURIComponent(draft.returnMeetingDate)}`
        : "/meetings?tab=recommend";
      await clearGuestOnboardingDraft();
      trackEvent("guest_onboarding_import_complete");
      trackEvent("profile_complete", { mode: "guest_import" });

      if (isProfileArchetypeId(body?.profileArchetypeId)) {
        router.prefetch(destination);
        setNextPath(destination);
        setProfileArchetypeId(body.profileArchetypeId);
        return;
      }
      router.replace(destination);
    } catch (importError) {
      console.error("Guest onboarding import failed:", importError);
      setError("답변을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setImporting(false);
    }
  };

  if (profileArchetypeId) {
    return (
      <ProfileArchetypeResult
        archetypeId={profileArchetypeId}
        onContinue={() => {
          router.replace(nextPath);
        }}
      />
    );
  }

  if (!draft) {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F1E8] px-6 text-center text-[#121212] md:min-h-[calc(100dvh-32px)]">
        {error ? (
          <>
            <p className="text-lg font-bold text-black">답변을 불러오지 못했어요</p>
            <p className="mt-2 text-sm leading-6 text-black/50">{error}</p>
            <a
              href="/onboarding/start"
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
            <p className="mt-5 text-lg font-bold text-black">인증을 확인하고 있어요</p>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[#F5F1E8] px-6 pb-5 pt-[calc(14px+env(safe-area-inset-top))] text-[#121212] md:min-h-[calc(100dvh-32px)]">
      <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-accent/15 blur-[80px]" />
      <div className="pointer-events-none absolute -left-20 bottom-28 h-52 w-52 rounded-full bg-[#e8d9c6]/45 blur-[70px]" />

      <header className="relative z-10 shrink-0 pt-10">
        <div
          className="h-[5px] overflow-hidden rounded-full bg-black/[0.07]"
          role="progressbar"
          aria-label="전체 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={96}
        >
          <motion.div
            className="h-full rounded-full bg-black/70"
            initial={{ width: 0 }}
            animate={{ width: "96%" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative z-10 flex flex-1 flex-col"
      >
        <div className="mt-[11vh] text-center">
          <h1 className="mx-auto max-w-[350px] break-keep text-[25px] font-black leading-[1.34] tracking-[-0.035em] text-black/78">
            당신의 사진을 등록해주세요.
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] break-keep text-[13px] font-semibold leading-5 text-black/42">
            나를 알아보기 쉬운 사진이면 충분해요.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[340px]">
          <input
            id="guest-profile-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={savingPhoto || importing}
            onChange={(event) => void choosePhoto(event.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="guest-profile-photo"
            className={`flex min-h-[168px] cursor-pointer items-center justify-center overflow-hidden rounded-[28px] border border-dashed border-black/15 bg-white/60 shadow-[0_18px_50px_rgba(18,18,18,0.05)] transition ${
              savingPhoto || importing ? "cursor-wait opacity-65" : ""
            }`}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="등록한 프로필 사진"
                className="h-[220px] w-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-3 text-black/42">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-white/70">
                  <Camera size={22} aria-hidden />
                </span>
                <span className="text-[13px] font-bold">
                  {savingPhoto ? "사진을 올리고 있어요..." : "사진 선택하기"}
                </span>
              </span>
            )}
          </label>

          <div className="mt-8 flex min-h-12 justify-end">
            <AnimatePresence initial={false}>
              {photoUrl && !savingPhoto && (
                <motion.button
                  type="button"
                  onClick={() => void completeProfile()}
                  disabled={importing}
                  aria-label="사진 저장하고 결과 확인하기"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex h-12 w-12 items-center justify-center text-black transition active:translate-x-0.5 disabled:text-black/20"
                >
                  <ArrowRight size={28} strokeWidth={1.8} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {error && (
        <p className="absolute inset-x-6 bottom-8 z-20 rounded-2xl bg-black px-4 py-3 text-center text-xs font-semibold leading-5 text-white shadow-lg">
          {error}
        </p>
      )}
    </section>
  );
}
