"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { identifyAnalyticsUser, trackEvent } from "@/lib/analytics";
import { uploadProfilePhoto } from "@/lib/profilePhoto";
import { createClient } from "@/lib/supabase/client";
import type { Gender } from "@/types/user";

export type BasicInfoValues = {
  name: string;
  phone: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
  photoUrl: string;
};

type BasicInfoStepKey =
  | "name"
  | "phone"
  | "gender"
  | "birthYear"
  | "mbti"
  | "photo";

const basicInfoSteps: Array<{ key: BasicInfoStepKey; label: string }> = [
  { key: "name", label: "이름" },
  { key: "phone", label: "전화번호" },
  { key: "gender", label: "성별" },
  { key: "birthYear", label: "출생연도" },
  { key: "mbti", label: "MBTI" },
  { key: "photo", label: "사진" },
];

const basicInfoStepViewEvents: Record<BasicInfoStepKey, string> = {
  name: "basic_info_name_view",
  phone: "basic_info_phone_view",
  gender: "basic_info_gender_view",
  birthYear: "basic_info_birth_year_view",
  mbti: "basic_info_mbti_view",
  photo: "basic_info_photo_view",
};

const BIRTH_YEAR_MIN = 1992;
const BIRTH_YEAR_MAX = 2007;
const birthYearOptions = Array.from(
  { length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 },
  (_, index) => String(BIRTH_YEAR_MIN + index),
);

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

function isValidBirthYear(value: string) {
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  return year >= BIRTH_YEAR_MIN && year <= BIRTH_YEAR_MAX;
}

function isStepComplete(stepKey: BasicInfoStepKey, draft: BasicInfoValues) {
  switch (stepKey) {
    case "name":
      return draft.name.trim().length > 1;
    case "phone":
      return normalizePhone(draft.phone).length === 11;
    case "gender":
      return draft.gender === "여성" || draft.gender === "남성";
    case "birthYear":
      return isValidBirthYear(draft.birthYear);
    case "mbti":
      return mbtiOptions.includes(draft.mbti.toUpperCase());
    case "photo":
      return Boolean(draft.photoUrl);
    default:
      return false;
  }
}

export function BasicInfoForm({
  userId,
  initialValues,
  mode = "onboarding",
  returnPath = "/meetings?tab=profile",
  onGuestDraftChange,
  onGuestPhotoChange,
  onGuestComplete,
  presentation = "page",
  onClose,
}: {
  userId?: string;
  initialValues: BasicInfoValues;
  mode?: "guest" | "onboarding" | "regeneration";
  returnPath?: string;
  onGuestDraftChange?: (values: BasicInfoValues) => void;
  onGuestPhotoChange?: (file: File) => Promise<void>;
  onGuestComplete?: (values: BasicInfoValues) => Promise<void>;
  presentation?: "page" | "modal";
  onClose?: () => void;
}) {
  const router = useRouter();
  const isGuest = mode === "guest";
  const isRegeneration = mode === "regeneration";
  const isModal = presentation === "modal";
  const [draft, setDraft] = useState(initialValues);
  const [visibleStepCount, setVisibleStepCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTrackedRef = useRef(false);
  const viewedStepsRef = useRef(new Set<BasicInfoStepKey>());
  const canSave = useMemo(
    () => basicInfoSteps.every((step) => isStepComplete(step.key, draft)),
    [draft],
  );
  const visibleSteps = basicInfoSteps.slice(0, visibleStepCount);
  const allStepsVisible = visibleStepCount >= basicInfoSteps.length;
  const currentStep = basicInfoSteps[visibleStepCount - 1];
  const currentStepComplete = currentStep
    ? isStepComplete(currentStep.key, draft)
    : false;
  const birthYearHasFourDigits = draft.birthYear.length === 4;
  const birthYearOutOfRange =
    birthYearHasFourDigits && !isStepComplete("birthYear", draft);
  const finalIncompleteLabel = birthYearOutOfRange
    ? "1992~2007년생만 가능해요"
    : !isStepComplete("photo", draft)
      ? "사진을 선택해주세요"
      : "입력 정보를 확인해주세요";
  const finalButtonVisible = allStepsVisible;
  const ctaLabel = saving
    ? isGuest
      ? "카카오로 이동 중..."
      : isRegeneration
      ? "프로필 새로 만드는 중..."
      : "저장 중..."
    : photoUploading
      ? "사진 업로드 중..."
      : canSave
        ? isGuest
          ? "카카오로 로그인하고 저장하기"
          : isRegeneration
          ? "새 프로필 완성하기"
          : "프로필 완성하기"
        : finalIncompleteLabel;

  useEffect(() => {
    if (isGuest) return;
    setDraft(initialValues);
    setVisibleStepCount(1);
  }, [initialValues, isGuest]);

  useEffect(() => {
    if (!userId) return;
    identifyAnalyticsUser(userId);
  }, [userId]);

  useEffect(() => {
    if (!isGuest) return;
    onGuestDraftChange?.(draft);
  }, [draft, isGuest, onGuestDraftChange]);

  useEffect(() => {
    if (isRegeneration || startTrackedRef.current) return;

    startTrackedRef.current = true;
    trackEvent("basic_info_start");
  }, [isRegeneration]);

  useEffect(() => {
    const stepKey = currentStep?.key;
    if (isRegeneration || !stepKey || viewedStepsRef.current.has(stepKey)) return;

    viewedStepsRef.current.add(stepKey);
    trackEvent(basicInfoStepViewEvents[stepKey], {
      mode: isGuest ? "guest" : "onboarding",
      step: stepKey,
      step_index: basicInfoSteps.findIndex((step) => step.key === stepKey) + 1,
      step_total: basicInfoSteps.length,
    });
  }, [currentStep?.key, isGuest, isRegeneration]);

  useEffect(() => {
    if (visibleStepCount >= basicInfoSteps.length) return;

    const lastVisibleStep = basicInfoSteps[visibleStepCount - 1];
    if (!lastVisibleStep || lastVisibleStep.key === "name") return;
    if (!isStepComplete(lastVisibleStep.key, draft)) return;

    const timer = window.setTimeout(() => {
      setVisibleStepCount((current) =>
        Math.min(current + 1, basicInfoSteps.length),
      );
    }, 220);

    return () => window.clearTimeout(timer);
  }, [draft, visibleStepCount]);

  const revealNextStep = () => {
    setVisibleStepCount((current) =>
      Math.min(current + 1, basicInfoSteps.length),
    );
  };

  const uploadPhoto = async (file: File | null) => {
    if (!file || photoUploading) return;

    setPhotoUploading(true);
    setError(null);
    try {
      if (isGuest) {
        await onGuestPhotoChange?.(file);
        const previewUrl = URL.createObjectURL(file);
        setDraft((current) => {
          if (current.photoUrl.startsWith("blob:")) {
            URL.revokeObjectURL(current.photoUrl);
          }
          return { ...current, photoUrl: previewUrl };
        });
        return;
      }

      if (!userId) throw new Error("Authenticated photo upload requires userId.");
      const photoUrl = await uploadProfilePhoto(userId, file);
      if (!isRegeneration) {
        const { error: profileError } = await createClient()
          .from("profiles")
          .update({ photo_url: photoUrl })
          .eq("user_id", userId);

        if (profileError) throw new Error(profileError.message);
      }

      setDraft((current) => ({ ...current, photoUrl }));
    } catch {
      setError(
        isGuest
          ? "사진을 임시 저장하지 못했어요. 잠시 후 다시 선택해주세요."
          : "사진 업로드에 실패했어요. 파일과 profile-photos 버킷 설정을 확인해주세요.",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setError(null);
    if (isGuest) {
      trackEvent("basic_info_complete", { mode: "guest" });
      try {
        await onGuestComplete?.(draft);
      } catch {
        setError("카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
        setSaving(false);
      }
      return;
    }

    if (isRegeneration) {
      const response = await fetch("/api/profile/regeneration/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          gender: draft.gender,
          birthYear: draft.birthYear,
          mbti: draft.mbti.toUpperCase(),
          photoUrl: draft.photoUrl,
        }),
      }).catch(() => null);

      const responseBody = response
        ? ((await response.json().catch(() => null)) as
            | { error?: string; nextAvailableAt?: string }
            | null)
        : null;

      if (!response?.ok) {
        setError(
          responseBody?.error ??
            "프로필 새로 만들기에 실패했어요. 잠시 후 다시 시도해주세요.",
        );
        setSaving(false);
        return;
      }

      trackEvent("basic_info_complete", {
        mode: "regeneration",
      });
      router.replace("/meetings?tab=profile");
      router.refresh();
      return;
    }

    const response = await fetch("/api/profile/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        gender: draft.gender,
        birthYear: draft.birthYear,
        mbti: draft.mbti.toUpperCase(),
        photoUrl: draft.photoUrl,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("기본정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    trackEvent("basic_info_complete", {
      mode: "onboarding",
    });
    router.replace(returnPath);
    router.refresh();
  };

  const handleNameComplete = () => {
    if (saving || photoUploading) return;
    if (currentStep?.key === "name" && currentStepComplete) {
      revealNextStep();
    }
  };

  const renderStep = (stepKey: BasicInfoStepKey) => {
    if (stepKey === "name") {
      return (
        <Field
          label="이름"
          value={draft.name}
          placeholder="김서연"
          actionLabel={visibleStepCount === 1 ? "완료" : undefined}
          actionDisabled={!isStepComplete("name", draft) || saving || photoUploading}
          onAction={visibleStepCount === 1 ? handleNameComplete : undefined}
          onChange={(name) => setDraft((current) => ({ ...current, name }))}
        />
      );
    }

    if (stepKey === "phone") {
      return (
        <Field
          label="전화번호"
          value={draft.phone}
          placeholder="010-1234-5678"
          inputMode="tel"
          maxLength={11}
          onChange={(phone) =>
            setDraft((current) => ({
              ...current,
              phone: normalizePhone(phone).slice(0, 11),
            }))
          }
        />
      );
    }

    if (stepKey === "gender") {
      return (
        <fieldset>
          <legend className="text-[11px] font-bold text-black/42">성별</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["여성", "남성"] as Gender[]).map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() =>
                  setDraft((current) => ({ ...current, gender }))
                }
                className={`h-[52px] rounded-[18px] border text-[13px] font-extrabold transition ${
                  draft.gender === gender
                    ? "border-[#171714] bg-[#171714] text-white"
                    : "border-black/[0.08] bg-white/70 text-black/50"
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </fieldset>
      );
    }

    if (stepKey === "birthYear") {
      return (
        <BirthYearSelect
          label="출생연도"
          value={draft.birthYear}
          helperText={
            birthYearOutOfRange
              ? "1992년생부터 2007년생까지만 가능해요."
              : "1992년생부터 2007년생까지 선택할 수 있어요."
          }
          helperTone={birthYearOutOfRange ? "error" : "default"}
          onChange={(birthYear) =>
            setDraft((current) => ({
              ...current,
              birthYear,
            }))
          }
        />
      );
    }

    if (stepKey === "mbti") {
      return (
        <div>
          <span className="text-[11px] font-bold text-black/42">MBTI</span>
          <MbtiSelect
            value={draft.mbti}
            onChange={(mbti) =>
              setDraft((current) => ({
                ...current,
                mbti,
              }))
            }
          />
        </div>
      );
    }

    return (
      <div>
        <p className="text-[11px] font-bold text-black/42">사진 업로드</p>
        <p className="mt-1 text-xs leading-5 text-black/45">
          나중에 함께 자리한 분들이 얼굴과 이름을 헷갈리지 않도록 사진을
          올려주세요.
        </p>
        <p className="mt-1 text-[11px] leading-5 text-black/35">
          정면 사진이 아니어도 괜찮아요. 나를 알아보기 쉬운 사진이면 충분해요.
        </p>

        <input
          id="onboarding-basic-photo"
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={photoUploading || saving}
          onChange={(event) => void uploadPhoto(event.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="onboarding-basic-photo"
          className={`mt-3 flex items-center justify-between rounded-[20px] border border-dashed border-black/14 bg-white/60 px-4 py-4 ${
            photoUploading || saving ? "cursor-wait opacity-70" : "cursor-pointer"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-black">
              {photoUploading
                ? "사진을 올리고 있어요..."
                : draft.photoUrl
                  ? "사진 변경하기"
                  : "사진 선택하기"}
            </span>
            <span className="mt-1 block truncate text-xs text-black/45">
              {draft.photoUrl ? "사진이 저장됐어요." : "JPG, PNG 이미지를 선택해주세요."}
            </span>
          </span>
          <span className="ml-3 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white text-black/45">
            {draft.photoUrl ? (
              <img
                src={draft.photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera size={20} aria-hidden />
            )}
          </span>
        </label>
      </div>
    );
  };

  return (
    <section
      className={`flex flex-col bg-[#F7F5EF] px-5 pb-6 pt-5 ${
        isModal
          ? "h-full min-h-0 overflow-y-auto"
          : "min-h-dvh md:min-h-[calc(100dvh-32px)]"
      }`}
    >
      <header className={isModal ? "relative pr-11" : undefined}>
        {isModal && onClose && (
          <button
            type="button"
            aria-label="기본정보 입력 닫기"
            onClick={onClose}
            className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-[#faf8f2] text-black/55 transition hover:bg-[#f1eee6] hover:text-black"
          >
            <X size={18} aria-hidden />
          </button>
        )}
        <h1 className="mt-2 text-[27px] font-extrabold leading-[1.25] tracking-[-0.055em] text-[#171714]">
          프로필을 완성하면
          <br />
          나와 비슷한 나이대의 사람을
          <br />
          추천받을 수 있어요.
        </h1>
      </header>

      <div className="mt-7 space-y-5">
        <AnimatePresence initial={false}>
          {visibleSteps.map((step, index) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={index === visibleSteps.length - 1 ? "pb-1" : undefined}
            >
              {renderStep(step.key)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      {finalButtonVisible ? (
        <div className="mt-auto">
          <motion.button
            type="button"
            whileTap={canSave && !saving ? { scale: 0.98 } : undefined}
            disabled={!canSave || saving || photoUploading}
            onClick={() => void save()}
            className={`flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[19px] text-[14px] font-extrabold transition ${
              canSave && !saving
                ? "bg-[#171714] text-white"
                : "bg-black/[0.06] text-black/30"
            }`}
          >
            <Check size={16} aria-hidden />
            {ctaLabel}
          </motion.button>
        </div>
      ) : (
        <div className="mt-auto h-14" aria-hidden />
      )}
    </section>
  );
}

function BirthYearSelect({
  label,
  value,
  helperText,
  helperTone = "default",
  onChange,
}: {
  label: string;
  value: string;
  helperText?: string;
  helperTone?: "default" | "error";
  onChange: (value: string) => void;
}) {
  const selectedValue = birthYearOptions.includes(value) ? value : "";

  return (
    <label className="block">
      <span className="text-[11px] font-bold text-black/42">{label}</span>
      <select
        aria-label={label}
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 h-[52px] w-full appearance-none rounded-[18px] border bg-white/75 px-4 text-[13px] font-bold outline-none focus:border-black/35 ${
          helperTone === "error" ? "border-red-300" : "border-black/10"
        } ${selectedValue ? "text-black" : "text-black/30"}`}
      >
        <option value="">출생연도 선택</option>
        {birthYearOptions.map((year) => (
          <option key={year} value={year} style={{ color: "#111111" }}>
            {year}년생
          </option>
        ))}
      </select>
      {helperText && (
        <span
          className={`mt-1.5 block text-[11px] font-semibold leading-4 ${
            helperTone === "error" ? "text-red-500" : "text-black/35"
          }`}
        >
          {helperText}
        </span>
      )}
    </label>
  );
}

function Field({
  label,
  value,
  placeholder,
  inputMode,
  maxLength,
  helperText,
  helperTone = "default",
  actionLabel,
  actionDisabled,
  onAction,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  helperText?: string;
  helperTone?: "default" | "error";
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="block">
      <span className="text-[11px] font-bold text-black/42">{label}</span>
      <span className="relative mt-2 block">
        <input
          aria-label={label}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          className={`h-[52px] w-full rounded-[18px] border bg-white/75 px-4 text-[13px] font-semibold outline-none placeholder:text-black/25 focus:border-black/35 ${
            actionLabel ? "pr-[76px]" : ""
          } ${helperTone === "error" ? "border-red-300" : "border-black/10"}`}
        />
        {actionLabel && onAction && (
          <button
            type="button"
            disabled={actionDisabled}
            onClick={(event) => {
              event.preventDefault();
              onAction();
            }}
            className="absolute right-2 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center rounded-full bg-black px-3 text-[11px] font-bold text-white transition disabled:bg-black/[0.08] disabled:text-black/30"
          >
            {actionLabel}
          </button>
        )}
      </span>
      {helperText && (
        <span
          className={`mt-1.5 block text-[11px] font-semibold leading-4 ${
            helperTone === "error" ? "text-red-500" : "text-black/35"
          }`}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}
