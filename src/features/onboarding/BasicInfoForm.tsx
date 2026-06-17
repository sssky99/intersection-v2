"use client";

import { motion } from "framer-motion";
import { Camera, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { uploadProfilePhoto } from "@/lib/profilePhoto";
import { createClient } from "@/lib/supabase/client";
import type { Gender } from "@/types/user";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

export function BasicInfoForm({
  userId,
  initialValues,
}: {
  userId: string;
  initialValues: {
    name: string;
    phone: string;
    gender: Gender;
    birthYear: string;
    mbti: string;
    photoUrl: string;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = useMemo(
    () =>
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      /^\d{4}$/.test(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti.toUpperCase()) &&
      Boolean(draft.photoUrl),
    [draft],
  );

  const uploadPhoto = async (file: File | null) => {
    if (!file || photoUploading) return;

    setPhotoUploading(true);
    setError(null);
    try {
      const photoUrl = await uploadProfilePhoto(userId, file);
      const { error: profileError } = await createClient()
        .from("profiles")
        .update({ photo_url: photoUrl })
        .eq("user_id", userId);

      if (profileError) throw new Error(profileError.message);

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

    router.replace("/profile/result");
    router.refresh();
  };

  return (
    <section className="flex min-h-dvh flex-col px-5 pb-6 pt-7 md:min-h-[calc(100dvh-32px)]">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          final profile info
        </p>
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
        <Field
          label="이름"
          value={draft.name}
          placeholder="문하늘"
          onChange={(name) => setDraft((current) => ({ ...current, name }))}
        />
        <Field
          label="전화번호"
          value={draft.phone}
          placeholder="010-1234-5678"
          inputMode="tel"
          onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
        />

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

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="출생연도"
            value={draft.birthYear}
            placeholder="1995"
            inputMode="numeric"
            maxLength={4}
            onChange={(birthYear) =>
              setDraft((current) => ({
                ...current,
                birthYear: birthYear.replace(/\D/g, "").slice(0, 4),
              }))
            }
          />
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
        </div>

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
            className="mt-3 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-black/16 bg-black/[0.02] px-4 py-4"
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
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

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
        {saving ? "저장 중..." : photoUploading ? "사진 업로드 중..." : "프로필 완성하기"}
      </motion.button>
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  inputMode,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none placeholder:text-black/25 focus:border-accent"
      />
    </label>
  );
}
