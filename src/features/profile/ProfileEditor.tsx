"use client";

import { motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { createClient } from "@/lib/supabase/client";
import type { Gender } from "@/types/user";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

const BIRTH_YEAR_MIN = 1992;
const BIRTH_YEAR_MAX = 2007;
const birthYearOptions = Array.from(
  { length: BIRTH_YEAR_MAX - BIRTH_YEAR_MIN + 1 },
  (_, index) => String(BIRTH_YEAR_MIN + index),
);

function isValidBirthYear(value: string) {
  return birthYearOptions.includes(value);
}

export function ProfileEditor({
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
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = useMemo(
    () =>
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      isValidBirthYear(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti),
    [draft],
  );

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await createClient()
        .from("profiles")
        .update({
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          phone_normalized: normalizePhone(draft.phone),
          gender: draft.gender,
          birth_year: draft.birthYear,
          mbti: draft.mbti,
        })
        .eq("user_id", userId);

      if (saveError) throw new Error(saveError.message);

      router.replace("/meetings?tab=profile");
      router.refresh();
    } catch {
      setError("프로필 수정에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
    }
  };

  return (
    <section className="flex min-h-dvh flex-col px-5 pb-6 pt-7 md:min-h-[calc(100dvh-32px)]">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 self-start text-xs font-semibold text-black/45"
      >
        <ChevronLeft size={15} aria-hidden />
        돌아가기
      </button>

      <header className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          edit profile
        </p>
        <h1 className="mt-2 text-[27px] font-bold leading-9 text-black">
          기본정보를
          <br />
          수정할 수 있어요.
        </h1>
      </header>

      <div className="mt-7 space-y-5">
        <Field
          label="이름"
          value={draft.name}
          onChange={(name) => setDraft((current) => ({ ...current, name }))}
        />
        <Field
          label="전화번호"
          value={draft.phone}
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
                className={`h-12 rounded-2xl border text-xs font-semibold ${
                  draft.gender === gender
                    ? "border-black bg-black text-white"
                    : "border-black/10 text-black/50"
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <BirthYearSelect
            label="출생연도"
            value={draft.birthYear}
            onChange={(birthYear) =>
              setDraft((current) => ({
                ...current,
                birthYear,
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
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <motion.button
        type="button"
        whileTap={canSave && !saving ? { scale: 0.98 } : undefined}
        disabled={!canSave || saving}
        onClick={() => void save()}
        className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:bg-black/[0.08] disabled:text-black/30"
      >
        <Check size={16} aria-hidden />
        {saving ? "저장 중..." : "변경사항 저장"}
      </motion.button>
    </section>
  );
}

function BirthYearSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedValue = birthYearOptions.includes(value) ? value : "";

  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 h-12 w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-accent ${
          selectedValue ? "text-black" : "text-black/30"
        }`}
      >
        <option value="">출생연도 선택</option>
        {birthYearOptions.map((year) => (
          <option key={year} value={year}>
            {year}년생
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  inputMode,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
