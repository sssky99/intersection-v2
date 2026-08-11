"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Brain,
  Check,
  ChevronRight,
  Footprints,
  Gem,
  Gift,
  Heart,
  Info,
  LockKeyhole,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  PenLine,
  Scale,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { preferenceQuestions } from "@/data/preferenceQuestions";
import {
  isProfileArchetypeId,
  profileArchetypeBackgrounds,
  profileArchetypes,
} from "@/data/profileArchetypes";
import {
  profileSectionActivityQuestions,
  profileSectionBackgroundQuestions,
  profileSectionInterestQuestions,
  profileSectionPreferenceQuestions,
  profileSectionSelfQuestions,
  profileSectionTraitsQuestions,
  profileSectionValueQuestions,
  profileSectionValuesQuestions,
} from "@/data/profileDetailQuestions";
import {
  resolvedProfileEmoji,
  singleEmojiFromInput,
} from "@/lib/profileEmoji";
import type { ProfileRow } from "@/types/profile";
import type { QuestionAnswer } from "@/types/question";
import type { Gender } from "@/types/user";
import {
  activityLabels,
  interestLabels,
} from "@/data/recommendationAudience";

export { activityLabels, interestLabels } from "@/data/recommendationAudience";

type ProfileDraft = {
  emoji: string;
  name: string;
  phone: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
};

const birthYearOptions = Array.from(
  { length: 2007 - 1980 + 1 },
  (_, index) => String(1980 + index),
);

export const activityIcons: Record<string, string> = {
  meal: "🍽️",
  culture: "🎨",
  outdoor: "🚶",
  play: "🎲",
  reading: "📚",
  taste: "🛍️",
};

export const interestIcons: Record<string, string> = {
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
    <section
      data-participation-record
      className="mt-5 rounded-[24px] border border-black/[0.07] bg-[#faf8f2] px-5 py-5 shadow-[0_14px_40px_rgba(24,24,20,0.05)]"
    >
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
          const fill = reached ? "#121212" : "#F1EEE6";
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

function BasicQuestionsSection({
  answers,
  backgroundAnsweredCount,
  activityAnsweredCount,
  interestAnsweredCount,
  valuesAnsweredCount,
  preferenceAnsweredCount,
  valueAnsweredCount,
  traitsAnsweredCount,
  selfAnsweredCount,
  onOpenBasic,
  onOpenBackground,
  onOpenActivity,
  onOpenInterest,
  onOpenValues,
  onOpenPreference,
  onOpenValue,
  onOpenTraits,
  onOpenSelf,
}: {
  answers: Record<number, QuestionAnswer>;
  backgroundAnsweredCount: number;
  activityAnsweredCount: number;
  interestAnsweredCount: number;
  valuesAnsweredCount: number;
  preferenceAnsweredCount: number;
  valueAnsweredCount: number;
  traitsAnsweredCount: number;
  selfAnsweredCount: number;
  onOpenBasic: () => void;
  onOpenBackground: () => void;
  onOpenActivity: () => void;
  onOpenInterest: () => void;
  onOpenValues: () => void;
  onOpenPreference: () => void;
  onOpenValue: () => void;
  onOpenTraits: () => void;
  onOpenSelf: () => void;
}) {
  const answeredCount = preferenceQuestions.filter((question) => {
    const value = answers[question.id]?.value;
    return Array.isArray(value)
      ? value.length > 0
      : value !== undefined && value !== "";
  }).length;
  const backgroundPercent = Math.round(
    (backgroundAnsweredCount / profileSectionBackgroundQuestions.length) * 100,
  );
  const activityPercent = Math.round(
    (activityAnsweredCount / profileSectionActivityQuestions.length) * 100,
  );
  const interestPercent = Math.round(
    (interestAnsweredCount / profileSectionInterestQuestions.length) * 100,
  );
  const valuesPercent = Math.round(
    (valuesAnsweredCount / profileSectionValuesQuestions.length) * 100,
  );
  const preferencePercent = Math.round(
    (preferenceAnsweredCount / profileSectionPreferenceQuestions.length) * 100,
  );
  const valuePercent = Math.round(
    (valueAnsweredCount / profileSectionValueQuestions.length) * 100,
  );
  const traitsPercent = Math.round(
    (traitsAnsweredCount / profileSectionTraitsQuestions.length) * 100,
  );
  const selfPercent = Math.round(
    (selfAnsweredCount / profileSectionSelfQuestions.length) * 100,
  );
  const detailQuestionCount =
    profileSectionBackgroundQuestions.length +
    profileSectionActivityQuestions.length +
    profileSectionInterestQuestions.length +
    profileSectionValuesQuestions.length +
    profileSectionPreferenceQuestions.length +
    profileSectionValueQuestions.length +
    profileSectionTraitsQuestions.length +
    profileSectionSelfQuestions.length;
  const profilePercent = Math.round(
    ((backgroundAnsweredCount +
      activityAnsweredCount +
      interestAnsweredCount +
      valuesAnsweredCount +
      preferenceAnsweredCount +
      valueAnsweredCount +
      traitsAnsweredCount +
      selfAnsweredCount) /
      detailQuestionCount) *
      100,
  );

  return (
    <section className="mt-5 space-y-8">
      <div>
        <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/42">
          코어 질문
        </p>
        <button
          type="button"
          onClick={onOpenBasic}
          className="flex w-full items-center gap-4 rounded-[24px] border border-black/[0.09] bg-[#faf8f2] px-5 py-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/70">
            <PenLine size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-black text-black">코어 질문</span>
            <span className="mt-1 block text-xs font-semibold text-black/40">
              {answeredCount}/{preferenceQuestions.length} 답변 완료
            </span>
          </span>
          <ChevronRight size={20} aria-hidden className="shrink-0 text-black/42" />
        </button>
      </div>

      <div>
        <div className="mb-4 flex items-end justify-between px-1">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-black/42">
              질문 프로필
            </p>
            <p className="mt-1 text-[10px] font-semibold text-black/30">
              나를 더 알려줄수록, 더 잘 맞는 사람을 만날 수 있어요.
            </p>
          </div>
          <span className="text-[17px] font-black text-black">
            {profilePercent}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenBackground}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {backgroundPercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <MapPin size={19} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  배경
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionBackgroundQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenActivity}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {activityPercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <Footprints size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  활동성
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionActivityQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenInterest}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {interestPercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <Sparkles size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  흥미
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionInterestQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenValues}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {valuesPercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <Scale size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  관점
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionValuesQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenPreference}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {preferencePercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <Heart size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  선호
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionPreferenceQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenTraits}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {traitsPercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <Brain size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  성향
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionTraitsQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenValue}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {valuePercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <Gem size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  가치
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionValueQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSelf}
            className="group relative aspect-square overflow-hidden rounded-[24px] border border-black/[0.08] bg-[#faf8f2] p-5 text-left shadow-[0_14px_40px_rgba(24,24,20,0.05)] transition hover:-translate-y-0.5 hover:bg-[#f1eee6]"
          >
            <span className="absolute right-4 top-4 text-[11px] font-black text-black/36">
              {selfPercent}%
            </span>
            <span className="flex h-full flex-col justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f1eee6] text-black/60">
                <UserRound size={20} aria-hidden />
              </span>
              <span>
                <span className="block text-[16px] font-black tracking-[-0.03em] text-black">
                  자기정보
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-black/38">
                  {profileSectionSelfQuestions.length}개 질문
                </span>
              </span>
            </span>
          </button>

        </div>
      </div>
    </section>
  );
}

export function SelectionColumn({
  label,
  values,
  labels,
  icons,
  matchedValues = [],
}: {
  label: string;
  values: string[];
  labels: Record<string, string>;
  icons: Record<string, string>;
  matchedValues?: string[];
}) {
  const matchedValueSet = new Set(matchedValues);

  return (
    <div className="rounded-[18px] bg-black/[0.025] p-4">
      <p className="text-[10px] font-bold tracking-[0.08em] text-black/34">
        {label}
      </p>
      <div className="mt-3 space-y-2">
        {values.length > 0 ? (
          values.map((value) => (
            <div
              key={value}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-[11px]",
                matchedValueSet.has(value) &&
                  "-mx-1 bg-[#f4d35e]/35 px-1 py-1",
              )}
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white text-sm shadow-[0_3px_10px_rgba(0,0,0,0.04)]"
              >
                {icons[value] ?? "•"}
              </span>
              <span className="min-w-0 truncate text-[11px] font-extrabold tracking-[-0.02em] text-black/70">
                {labels[value] ?? value}
              </span>
              {matchedValueSet.has(value) && (
                <span className="ml-auto shrink-0 rounded-full bg-[#f4d35e] px-1.5 py-0.5 text-[8px] font-black text-black/72">
                  일치
                </span>
              )}
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
  answers = {},
  backgroundAnsweredCount = 0,
  activityAnsweredCount = 0,
  interestAnsweredCount = 0,
  valuesAnsweredCount = 0,
  preferenceAnsweredCount = 0,
  valueAnsweredCount = 0,
  traitsAnsweredCount = 0,
  selfAnsweredCount = 0,
  participationCount = 0,
  onProfileUpdated,
  onOpenBasicQuestions = () => undefined,
  onOpenBackgroundQuestions = () => undefined,
  onOpenActivityQuestions = () => undefined,
  onOpenInterestQuestions = () => undefined,
  onOpenValuesQuestions = () => undefined,
  onOpenPreferenceQuestions = () => undefined,
  onOpenValueQuestions = () => undefined,
  onOpenTraitsQuestions = () => undefined,
  onOpenSelfQuestions = () => undefined,
  onRequestBasicInfo,
  onLogout,
  previewMode = false,
}: {
  profile: ProfileRow;
  loggingOut: boolean;
  logoutError: string | null;
  answers?: Record<number, QuestionAnswer>;
  backgroundAnsweredCount?: number;
  activityAnsweredCount?: number;
  interestAnsweredCount?: number;
  valuesAnsweredCount?: number;
  preferenceAnsweredCount?: number;
  valueAnsweredCount?: number;
  traitsAnsweredCount?: number;
  selfAnsweredCount?: number;
  participationCount?: number;
  onProfileUpdated: (profile: ProfileRow) => void;
  onOpenBasicQuestions?: () => void;
  onOpenBackgroundQuestions?: () => void;
  onOpenActivityQuestions?: () => void;
  onOpenInterestQuestions?: () => void;
  onOpenValuesQuestions?: () => void;
  onOpenPreferenceQuestions?: () => void;
  onOpenValueQuestions?: () => void;
  onOpenTraitsQuestions?: () => void;
  onOpenSelfQuestions?: () => void;
  onRequestBasicInfo?: () => void;
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
  const archetypeId = isProfileArchetypeId(profile.profile_archetype_id)
    ? profile.profile_archetype_id
    : null;
  const archetype = archetypeId ? profileArchetypes[archetypeId] : null;

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
      className="min-h-full bg-[#f7f4ed]"
    >
      <section className="px-5 pb-7 pt-7">
        <header className="pr-16">
          <h1 className="text-[29px] font-black leading-9 tracking-[-0.055em] text-black">
            profile
          </h1>
        </header>

        <section className="mt-7 overflow-hidden rounded-[30px] border border-black/[0.07] bg-[#faf8f2] shadow-[0_24px_70px_rgba(24,24,20,0.09)]">
          <div className="relative overflow-hidden bg-[#171714] px-5 pb-6 pt-5 text-white">
            {archetypeId && archetype ? (
              <>
                <Image
                  src={profileArchetypeBackgrounds[archetypeId]}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 430px) calc(100vw - 40px), 390px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/28" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/80" />
              </>
            ) : (
              <>
                <div className="absolute -right-12 -top-20 h-48 w-48 rounded-full bg-[#e8dfcf]/20 blur-3xl" />
                <div className="absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              </>
            )}

            {!profile.profile_completed ? (
              <>
              <div className="hidden">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-white/76">
                  <LockKeyhole size={22} strokeWidth={1.8} aria-hidden />
                </span>
                <h2 className="mt-5 text-[18px] font-black tracking-[-0.035em] text-white">
                  프로필이 잠겨 있어요
                </h2>
                <p className="mt-2 break-keep text-[12px] font-semibold leading-5 text-white/52">
                  간단한 정보를 입력하고 프로필을 완성하세요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onRequestBasicInfo) {
                      onRequestBasicInfo();
                      return;
                    }
                    window.location.assign("/onboarding/profile?from=profile");
                  }}
                  className="mt-5 h-11 rounded-full bg-[#faf8f2] px-6 text-[12px] font-black text-black shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition active:scale-[0.98]"
                >
                  기본정보 입력하기
                </button>
              </div>
              <div className="relative flex min-h-[280px] flex-col items-center justify-center px-4 py-7 text-center">
                <p className="text-[17px] font-black tracking-[-0.04em] text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.5)]">
                  이름을 알려주세요
                </p>
                {archetype && (
                  <>
                    <p className="mt-4 font-serif text-[38px] italic leading-none tracking-[-0.045em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]">
                      {archetype.englishName.toUpperCase()}
                    </p>
                    <p className="mt-3 text-[20px] font-black tracking-[-0.05em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.5)]">
                      {archetype.koreanName}
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (onRequestBasicInfo) {
                      onRequestBasicInfo();
                      return;
                    }
                    window.location.assign("/onboarding/profile?from=profile");
                  }}
                  className="mt-7 h-11 rounded-full border border-white/25 bg-[#faf8f2] px-6 text-[12px] font-black text-black shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition active:scale-[0.98]"
                >
                  기본정보 입력하기
                </button>
              </div>
              </>
            ) : (
              <>
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

            <div className="relative mt-3 flex min-h-[210px] flex-col items-center justify-center gap-3 text-center">
              <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/80 bg-white text-[24px] font-black shadow-[0_8px_22px_rgba(0,0,0,0.12)]">
                {editing ? draft.emoji : displayEmoji}
              </span>
              <div className="min-w-0 max-w-full">
                <p className="truncate text-[17px] font-black tracking-[-0.04em] drop-shadow-[0_3px_14px_rgba(0,0,0,0.5)]">
                  {profile.name?.trim() || "이름 미입력"}
                </p>
              </div>
              {archetype && (
                <>
                  <p className="mt-1 font-serif text-[38px] italic leading-none tracking-[-0.045em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]">
                    {archetype.englishName.toUpperCase()}
                  </p>
                  <p className="text-[20px] font-black tracking-[-0.05em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.5)]">
                    {archetype.koreanName}
                  </p>
                </>
              )}
            </div>

            <div className="relative mt-1 flex flex-wrap justify-center gap-2">
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
              </>
            )}
          </div>

          <div className={cn(editing || saved ? "p-5" : "hidden")}>
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
            ) : null}

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

        <BasicQuestionsSection
          answers={answers}
          backgroundAnsweredCount={backgroundAnsweredCount}
          activityAnsweredCount={activityAnsweredCount}
          interestAnsweredCount={interestAnsweredCount}
          valuesAnsweredCount={valuesAnsweredCount}
          preferenceAnsweredCount={preferenceAnsweredCount}
          valueAnsweredCount={valueAnsweredCount}
          traitsAnsweredCount={traitsAnsweredCount}
          selfAnsweredCount={selfAnsweredCount}
          onOpenBasic={onOpenBasicQuestions}
          onOpenBackground={onOpenBackgroundQuestions}
          onOpenActivity={onOpenActivityQuestions}
          onOpenInterest={onOpenInterestQuestions}
          onOpenValues={onOpenValuesQuestions}
          onOpenPreference={onOpenPreferenceQuestions}
          onOpenValue={onOpenValueQuestions}
          onOpenTraits={onOpenTraitsQuestions}
          onOpenSelf={onOpenSelfQuestions}
        />

        {!previewMode && (
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void onLogout()}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-red-200/80 bg-[#faf8f2] text-xs font-semibold text-red-500 transition hover:bg-[#f1eee6] disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut size={15} aria-hidden />
            {loggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        )}

        <a
          href="http://pf.kakao.com/_xnweQn/chat"
          target="_blank"
          rel="noreferrer"
          className={`${previewMode ? "mt-8" : "mt-3"} flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#faf8f2] text-xs font-semibold text-black/55 transition hover:border-black/18 hover:bg-[#f1eee6] hover:text-black/70`}
        >
          <MessageCircle size={15} aria-hidden />
          문의하기
        </a>

        <a
          href="/privacy"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#faf8f2] text-xs font-semibold text-black/55 transition hover:border-black/18 hover:bg-[#f1eee6] hover:text-black/70"
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
