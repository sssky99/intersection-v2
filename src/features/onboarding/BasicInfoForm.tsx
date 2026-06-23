"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { uploadProfilePhoto } from "@/lib/profilePhoto";
import { createClient } from "@/lib/supabase/client";
import type { Gender } from "@/types/user";

type BasicInfoValues = {
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
  returnPath = "/meetings?tab=recommend&profileComplete=1",
}: {
  userId: string;
  initialValues: BasicInfoValues;
  mode?: "onboarding" | "regeneration";
  returnPath?: string;
}) {
  const router = useRouter();
  const isRegeneration = mode === "regeneration";
  const [draft, setDraft] = useState(initialValues);
  const [visibleStepCount, setVisibleStepCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    ? isRegeneration
      ? "프로필 새로 만드는 중..."
      : "저장 중..."
    : photoUploading
      ? "사진 업로드 중..."
      : canSave
        ? isRegeneration
          ? "새 프로필 완성하기"
          : "프로필 완성하기"
        : finalIncompleteLabel;

  useEffect(() => {
    setDraft(initialValues);
    setVisibleStepCount(1);
  }, [initialValues]);

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
        "사진 업로드에 실패했어요. 파일과 profile-photos 버킷 설정을 확인해주세요.",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setError(null);
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

      router.replace("/meetings?tab=recommend&profileComplete=1");
      router.refresh();
      return;
    }

    const { error: saveError } = await createClient()
      .from("profiles")
      .update({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        phone_normalized: normalizePhone(draft.phone),
        gender: draft.gender,
        birth_year: draft.birthYear,
        mbti: draft.mbti.toUpperCase(),
        photo_url: draft.photoUrl,
        profile_completed: true,
      })
      .eq("user_id", userId);

    if (saveError) {
      setError("기본정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

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
          placeholder="문하늘"
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
          <legend className="text-xs font-semibold text-black/45">성별</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["여성", "남성"] as Gender[]).map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() =>
                  setDraft((current) => ({ ...current, gender }))
                }
                className={`h-12 rounded-2xl border text-xs font-semibold transition ${
                  draft.gender === gender
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/50"
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
          <span className="text-xs font-semibold text-black/45">MBTI</span>
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
        <p className="text-xs font-semibold text-black/45">사진 업로드</p>
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
          className={`mt-3 flex items-center justify-between rounded-2xl border border-dashed border-black/16 bg-black/[0.02] px-4 py-4 ${
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
    <section className="flex min-h-dvh flex-col px-5 pb-6 pt-7 md:min-h-[calc(100dvh-32px)]">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            final profile info
          </p>
          <span className="text-[10px] font-semibold text-black/35">
            {visibleStepCount}/{basicInfoSteps.length}
          </span>
        </div>
        <h1 className="mt-2 text-[27px] font-bold leading-9 tracking-tight text-black">
          마지막으로 기본 정보를 입력하면
          <br />
          프로필이 완성돼요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/48">
          이 정보는 교집합이 더 잘 맞는 사람들과 자리를 구성하고,
          <br />
          함께 자리한 분들이 서로를 자연스럽게 알아볼 수 있도록 사용돼요.
        </p>
      </header>

      <div className="mt-8 space-y-5">
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
        <motion.button
          type="button"
          whileTap={canSave && !saving ? { scale: 0.98 } : undefined}
          disabled={!canSave || saving || photoUploading}
          onClick={() => void save()}
          className={`mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
            canSave && !saving
              ? "bg-black text-white"
              : "bg-black/[0.06] text-black/30"
          }`}
        >
          <Check size={16} aria-hidden />
          {ctaLabel}
        </motion.button>
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
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <select
        aria-label={label}
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 h-12 w-full appearance-none rounded-2xl border bg-white px-4 text-sm font-semibold outline-none focus:border-accent ${
          helperTone === "error" ? "border-red-300" : "border-black/10"
        } ${selectedValue ? "text-black" : "text-black/30"}`}
      >
        <option value="">출생연도 선택</option>
        {birthYearOptions.map((year) => (
          <option key={year} value={year}>
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
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <span className="relative mt-1.5 block">
        <input
          aria-label={label}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          className={`h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none placeholder:text-black/25 focus:border-accent ${
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
