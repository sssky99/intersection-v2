"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Gift,
  Info,
  Loader2,
  LogOut,
  MessageCircle,
  PenLine,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import {
  resolvedProfileEmoji,
  singleEmojiFromInput,
} from "@/lib/profileEmoji";
import type { ProfileRow } from "@/types/profile";
import type { Gender } from "@/types/user";

type ProfileDraft = {
  emoji: string;
  name: string;
  phone: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
};

const birthYearOptions = Array.from(
  { length: 2007 - 1992 + 1 },
  (_, index) => String(1992 + index),
);

const activityLabels: Record<string, string> = {
  meal: "식사·카페",
  culture: "문화 콘텐츠",
  outdoor: "활동·체험",
  play: "오락",
  reading: "독서",
  taste: "취향 탐색",
};

const activityIcons: Record<string, string> = {
  meal: "🍽️",
  culture: "🎨",
  outdoor: "🚶",
  play: "🎲",
  reading: "📚",
  taste: "🛍️",
};

const interestLabels: Record<string, string> = {
  travel: "여행",
  food: "맛집·요리",
  coffee: "카페·커피",
  movie: "영화·드라마",
  music: "음악",
  book: "독서",
  exhibition: "전시·디자인",
  fitness: "운동",
  nature: "자연·등산",
  game: "게임·보드게임",
  photo: "사진",
  growth: "심리·성장",
};

const interestIcons: Record<string, string> = {
  travel: "✈️",
  food: "🍳",
  coffee: "☕",
  movie: "🎬",
  music: "🎧",
  book: "📚",
  exhibition: "🎨",
  fitness: "🏃",
  nature: "🌿",
  game: "🎮",
  photo: "📸",
  growth: "🧠",
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function initialProfileDraft(profile: ProfileRow): ProfileDraft {
  return {
    emoji: resolvedProfileEmoji(profile),
    name: profile.name ?? "",
    phone: profile.phone ?? profile.phone_normalized ?? "",
    gender: profile.gender ?? "",
    birthYear: profile.birth_year == null ? "" : String(profile.birth_year),
    mbti: profile.mbti ?? "",
  };
}

function participationPrecisionLevel(count: number) {
  if (!Number.isFinite(count)) return 0;
  return Math.min(5, Math.max(0, Math.floor(count)));
}

function ParticipationGiftButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="absolute -right-2.5 -top-3 z-10">
      <motion.button
        type="button"
        aria-label="5번 참여 구독권 혜택 보기"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [1, 1.08, 1],
                boxShadow: [
                  "0 4px 10px rgba(18,18,18,0.14)",
                  "0 0 0 7px rgba(18,18,18,0.08), 0 8px 18px rgba(18,18,18,0.18)",
                  "0 4px 10px rgba(18,18,18,0.14)",
                ],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 2.2,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.45,
              }
        }
        whileTap={{ scale: 0.94 }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-black/35 bg-white text-black/65 shadow-[0_4px_10px_rgba(18,18,18,0.14)] transition hover:-translate-y-0.5 hover:border-black/60 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2"
      >
        <Gift size={16} strokeWidth={2.5} aria-hidden />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+10px)] z-40 w-[224px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold leading-5 text-black/62 shadow-[0_14px_36px_rgba(0,0,0,0.14)]"
          >
            <span
              aria-hidden
              className="absolute -top-[6px] right-2 h-3 w-3 rotate-45 border-l border-t border-black/10 bg-white"
            />
            <strong className="font-black text-black/78">
              5번 참여 시 1개월 구독권
            </strong>
            을
            <br />
            지급해드려요.
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function ParticipationRecord({ precisionCount }: { precisionCount: number }) {
  const level = participationPrecisionLevel(precisionCount);
  const currentStep = level < 5 ? level + 1 : null;

  return (
    <section className="mt-5 rounded-[24px] border border-black/[0.07] bg-white px-5 py-5 shadow-[0_14px_40px_rgba(24,24,20,0.05)]">
      <h2 className="text-[14px] font-black text-black">참여 기록</h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-black/40">
        참여할수록 추천이 더 정교해져요.
      </p>
      <div
        className="mt-4 grid grid-cols-5 place-items-center gap-3"
        aria-label={`참여 정교화 ${level}/5단계`}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const step = index + 1;
          const reached = step <= level;
          const current = step === currentStep;
          const fill = reached ? "#121212" : "#FFFFFF";
          const stroke =
            reached || current ? "#121212" : "rgba(0,0,0,0.16)";
          const textFill = reached
            ? "#FFFFFF"
            : current
              ? "#121212"
              : "rgba(0,0,0,0.34)";

          return (
            <span
              key={step}
              className="relative inline-flex h-10 w-10 items-center justify-center"
            >
              <svg
                viewBox="0 0 32 42"
                className={cn(
                  "h-10 w-8 shrink-0 overflow-visible transition",
                  current &&
                    "drop-shadow-[0_5px_10px_rgba(18,18,18,0.18)]",
                )}
                aria-hidden
              >
                <path
                  d="M16 2.5 29 21 16 39.5 3 21Z"
                  fill={fill}
                  stroke={stroke}
                  strokeLinejoin="round"
                  strokeWidth={current ? 2.6 : 2}
                />
                <text
                  x="16"
                  y="22"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={textFill}
                  fontSize="10.5"
                  fontWeight="900"
                >
                  {step}
                </text>
              </svg>
              {step === 5 && <ParticipationGiftButton />}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function SelectionColumn({
  label,
  values,
  labels,
  icons,
}: {
  label: string;
  values: string[];
  labels: Record<string, string>;
  icons: Record<string, string>;
}) {
  return (
    <div className="rounded-[18px] bg-black/[0.025] p-4">
      <p className="text-[10px] font-bold tracking-[0.08em] text-black/34">
        {label}
      </p>
      <div className="mt-3 space-y-2">
        {values.length > 0 ? (
          values.map((value) => (
            <div key={value} className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white text-sm shadow-[0_3px_10px_rgba(0,0,0,0.04)]"
              >
                {icons[value] ?? "•"}
              </span>
              <span className="min-w-0 truncate text-[11px] font-extrabold tracking-[-0.02em] text-black/70">
                {labels[value] ?? value}
              </span>
            </div>
          ))
        ) : (
          <p className="text-[10px] font-semibold leading-5 text-black/30">
            아직 선택하지 않았어요
          </p>
        )}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "text" | "tel";
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-[11px] font-bold text-black/48">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-semibold text-black/28">{hint}</span>}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-[16px] border border-black/10 bg-white px-4 text-[13px] font-bold text-black outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/[0.035]"
      />
    </label>
  );
}

export function PreferenceProfileTab({
  profile,
  loggingOut,
  logoutError,
  preferredActivities = [],
  recentInterests = [],
  participationCount = 0,
  onProfileUpdated,
  onLogout,
  previewMode = false,
}: {
  profile: ProfileRow;
  loggingOut: boolean;
  logoutError: string | null;
  preferredActivities?: string[];
  recentInterests?: string[];
  participationCount?: number;
  onProfileUpdated: (profile: ProfileRow) => void;
  onLogout: () => Promise<void>;
  previewMode?: boolean;
}) {
  const initialDraft = useMemo(() => initialProfileDraft(profile), [profile]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const displayEmoji = resolvedProfileEmoji(profile);

  useEffect(() => {
    if (!editing) setDraft(initialDraft);
  }, [editing, initialDraft]);

  useEffect(() => {
    if (profile.public_emoji?.trim()) return;

    const nextProfile = { ...profile, public_emoji: displayEmoji };
    onProfileUpdated(nextProfile);

    if (!previewMode) {
      void fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicEmoji: displayEmoji }),
      });
    }
  }, [displayEmoji, onProfileUpdated, previewMode, profile]);

  const canSave = useMemo(
    () =>
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      birthYearOptions.includes(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti.toUpperCase()),
    [draft],
  );

  const cancelEdit = () => {
    setDraft(initialDraft);
    setSaveError(null);
    setEditing(false);
  };

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const normalizedPhone = normalizePhone(draft.phone);
    const nextProfile: ProfileRow = {
      ...profile,
      public_emoji: draft.emoji,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      phone_normalized: normalizedPhone,
      gender: draft.gender,
      birth_year: draft.birthYear,
      mbti: draft.mbti.toUpperCase(),
    };

    const response = previewMode
      ? null
      : await fetch("/api/profile/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicEmoji: nextProfile.public_emoji,
            name: nextProfile.name,
            phone: nextProfile.phone,
            gender: nextProfile.gender,
            birthYear: nextProfile.birth_year,
            mbti: nextProfile.mbti,
          }),
        }).catch(() => null);

    if (!previewMode && !response?.ok) {
      setSaveError("정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    onProfileUpdated(nextProfile);
    setSaving(false);
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="min-h-full"
    >
      <section className="px-5 pb-7 pt-7">
        <header className="pr-16">
          <h1 className="text-[29px] font-black leading-9 tracking-[-0.055em] text-black">
            profile
          </h1>
        </header>

        <section className="mt-7 overflow-hidden rounded-[30px] border border-black/[0.07] bg-white shadow-[0_24px_70px_rgba(24,24,20,0.09)]">
          <div className="relative overflow-hidden bg-[#171714] px-5 pb-6 pt-5 text-white">
            <div className="absolute -right-12 -top-20 h-48 w-48 rounded-full bg-[#7CAFC0]/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[#B78EA8]/20 blur-3xl" />

            <div className="relative flex items-center justify-end">
              {editing ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[11px] font-bold text-white/70"
                >
                  <X size={13} aria-hidden />
                  취소
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    setEditing(true);
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 text-[11px] font-bold text-white/78"
                >
                  <PenLine size={13} aria-hidden />
                  수정
                </button>
              )}
            </div>

            <div className="relative mt-6 flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/80 bg-white text-[24px] font-black shadow-[0_8px_22px_rgba(0,0,0,0.12)]">
                {editing ? draft.emoji : displayEmoji}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[22px] font-black tracking-[-0.04em]">
                  {profile.name?.trim() || "이름 미입력"}
                </p>
              </div>
            </div>

            <div className="relative mt-5 flex flex-wrap gap-2">
              {[profile.mbti || "MBTI 미입력", profile.gender || "성별 미입력", profile.birth_year ? `${profile.birth_year}년생` : "출생연도 미입력"].map(
                (value) => (
                  <span
                    key={value}
                    className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold text-white/62"
                  >
                    {value}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="p-5">
            {editing ? (
              <div className="space-y-5">
                <fieldset>
                  <legend className="text-[11px] font-bold text-black/48">
                    프로필 이모지
                  </legend>
                  <p className="mt-1 text-[10px] font-semibold text-black/30">
                    입력란을 누르고 이모지 키보드에서 원하는 아이콘을 골라보세요.
                  </p>
                  <label className="mt-3 flex items-center gap-3 rounded-[16px] border border-black/[0.08] bg-black/[0.015] px-3 py-2.5">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white text-xl shadow-[0_3px_12px_rgba(0,0,0,0.05)]"
                    >
                      {draft.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <input
                        value={draft.emoji}
                        inputMode="text"
                        maxLength={16}
                        aria-label="프로필 이모지 직접 입력"
                        onChange={(event) => {
                          const emoji = singleEmojiFromInput(event.target.value);
                          if (emoji) {
                            setDraft((current) => ({ ...current, emoji }));
                          }
                        }}
                        className="w-full bg-transparent text-[11px] font-semibold text-black/35 outline-none"
                      />
                    </span>
                  </label>
                </fieldset>

                <div>
                  <TextField
                    label="이름"
                    value={draft.name}
                    onChange={(name) =>
                      setDraft((current) => ({ ...current, name }))
                    }
                  />
                </div>

                <TextField
                  label="전화번호"
                  value={draft.phone}
                  inputMode="tel"
                  onChange={(phone) =>
                    setDraft((current) => ({ ...current, phone }))
                  }
                />

                <fieldset>
                  <legend className="text-[11px] font-bold text-black/48">
                    성별
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["여성", "남성"] as Gender[]).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({ ...current, gender }))
                        }
                        className={cn(
                          "h-12 rounded-[16px] border text-[12px] font-extrabold transition",
                          draft.gender === gender
                            ? "border-[#171714] bg-[#171714] text-white"
                            : "border-black/10 bg-white text-black/45",
                        )}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] font-bold text-black/48">
                      출생연도
                    </span>
                    <select
                      value={draft.birthYear}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          birthYear: event.target.value,
                        }))
                      }
                      className="mt-2 h-12 w-full appearance-none rounded-[16px] border border-black/10 bg-white px-4 text-[13px] font-bold text-black outline-none"
                    >
                      <option value="">선택</option>
                      {birthYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="text-[11px] font-bold text-black/48">
                      MBTI
                    </span>
                    <MbtiSelect
                      value={draft.mbti}
                      onChange={(mbti) =>
                        setDraft((current) => ({ ...current, mbti }))
                      }
                    />
                  </div>
                </div>

                {saveError && (
                  <p className="rounded-[16px] bg-red-50 px-4 py-3 text-[11px] font-bold leading-5 text-red-600">
                    {saveError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!canSave || saving}
                  onClick={() => void save()}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#171714] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(23,23,20,0.14)] transition active:scale-[0.98] disabled:bg-black/[0.07] disabled:text-black/25 disabled:shadow-none"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Check size={16} aria-hidden />
                  )}
                  {saving ? "저장 중..." : "변경사항 저장"}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <SelectionColumn
                    label="선호 활동"
                    values={preferredActivities}
                    labels={activityLabels}
                    icons={activityIcons}
                  />
                  <SelectionColumn
                    label="최근 관심사"
                    values={recentInterests}
                    labels={interestLabels}
                    icons={interestIcons}
                  />
                </div>
              </>
            )}

            {saved && (
              <p className="mt-4 rounded-[16px] bg-accent/10 px-4 py-3 text-center text-[11px] font-bold text-accent">
                정보가 저장됐어요.
              </p>
            )}
          </div>
        </section>

        <ParticipationRecord
          precisionCount={
            participationCount + (profile.matching_precision_bonus ?? 0)
          }
        />

        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void onLogout()}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
        >
          <LogOut size={15} aria-hidden />
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>

        <a
          href="http://pf.kakao.com/_xnweQn/chat"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
        >
          <MessageCircle size={15} aria-hidden />
          문의하기
        </a>

        <a
          href="/privacy"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-black/55 transition hover:border-black/18 hover:text-black/70"
        >
          <Info size={15} aria-hidden />
          개인정보 처리방침
        </a>

        {logoutError && (
          <p className="mt-3 rounded-[16px] bg-red-50 px-4 py-3 text-center text-[11px] font-bold leading-5 text-red-600">
            {logoutError}
          </p>
        )}
      </section>
    </motion.div>
  );
}
