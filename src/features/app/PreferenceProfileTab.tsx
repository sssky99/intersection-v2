"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  Crown,
  Footprints,
  Gem,
  Heart,
  Info,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  PenLine,
  Scale,
  Sparkles,
  UserRound,
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
import type { ProfileRow } from "@/types/profile";
import type { QuestionAnswer } from "@/types/question";
import type { Gender } from "@/types/user";
import {
  activityLabels,
  interestLabels,
} from "@/data/recommendationAudience";
import {
  displayMembershipStatus,
  isMembershipPlan,
  membershipPlanLabels,
} from "@/features/membership/membershipTypes";
import { AccountDeletionButton } from "@/features/app/AccountDeletionButton";

export { activityLabels, interestLabels } from "@/data/recommendationAudience";

type ProfileDraft = {
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
    name: profile.name ?? "",
    phone: profile.phone ?? profile.phone_normalized ?? "",
    gender: profile.gender ?? "",
    birthYear: profile.birth_year == null ? "" : String(profile.birth_year),
    mbti: profile.mbti ?? "",
  };
}

function formatMembershipDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function MembershipStatusCard({ profile }: { profile: ProfileRow }) {
  const status = displayMembershipStatus({
    status: profile.membership_status,
    endDate: profile.membership_end_date,
  });
  const hasMembership = status === "active";
  const planLabel = isMembershipPlan(profile.membership_plan)
    ? membershipPlanLabels[profile.membership_plan]
    : null;
  const startDate = formatMembershipDate(profile.membership_start_date);
  const endDate = formatMembershipDate(profile.membership_end_date);
  const period =
    startDate && endDate
      ? `${startDate} - ${endDate}`
      : startDate
        ? `${startDate}부터`
        : endDate
          ? `${endDate}까지`
          : null;
  const statusLabel = hasMembership
    ? planLabel ?? "멤버십 이용 중"
    : "멤버십 없음";
  const periodLabel = hasMembership
    ? period
      ? `이용 기간 ${period}`
      : "이용 기간을 확인하고 있어요."
    : "현재 이용 중인 멤버십이 없어요.";

  return (
    <section className="mt-5">
      <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/42">
        내 멤버십
      </p>
      <div
        className={cn(
          "relative overflow-hidden rounded-[24px] border px-5 py-5 shadow-[0_14px_40px_rgba(24,24,20,0.05)]",
          hasMembership
            ? "border-[#a79b78]/25 bg-[#f4f0e5]"
            : "border-black/[0.09] bg-[#faf8f2]",
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
              hasMembership
                ? "border-[#a79b78]/25 bg-[#e8dfc8] text-[#766a49]"
                : "border-black/10 bg-[#f1eee6] text-black/45",
            )}
          >
            <Crown size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-black text-black">
              {statusLabel}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-black/42">
              <CalendarDays size={12} aria-hidden className="shrink-0" />
              {periodLabel}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black",
              status === "active"
                ? "bg-[#766a49] text-white"
                : "bg-black/[0.055] text-black/38",
            )}
          >
            {status === "active"
              ? "이용 중"
              : "없음"}
          </span>
        </div>
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
  photoCompleted,
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
  photoCompleted: boolean;
}) {
  const answeredCount = preferenceQuestions.filter((question) => {
    const value = answers[question.id]?.value;
    return Array.isArray(value)
      ? value.length > 0
      : value !== undefined && value !== "";
  }).length;
  const coreAnsweredCount = answeredCount;
  const coreQuestionCount = preferenceQuestions.length;
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
  const selfQuestionCount = profileSectionSelfQuestions.length + 1;
  const selfPercent = Math.round(
    ((selfAnsweredCount + (photoCompleted ? 1 : 0)) / selfQuestionCount) * 100,
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
              {coreAnsweredCount}/{coreQuestionCount} 답변 완료
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
                  {selfQuestionCount}개 항목
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
  onOpenQuestionReview = () => undefined,
  showOperatorQuestionReview = false,
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
  onOpenQuestionReview?: () => void;
  showOperatorQuestionReview?: boolean;
  onLogout: () => Promise<void>;
  previewMode?: boolean;
}) {
  const initialDraft = useMemo(() => initialProfileDraft(profile), [profile]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const archetypeId = isProfileArchetypeId(profile.profile_archetype_id)
    ? profile.profile_archetype_id
    : null;
  const archetype = archetypeId ? profileArchetypes[archetypeId] : null;

  useEffect(() => {
    if (!editing) setDraft(initialDraft);
  }, [editing, initialDraft]);

  const canSave = useMemo(
    () =>
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      birthYearOptions.includes(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti.toUpperCase()),
    [draft],
  );

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const normalizedPhone = normalizePhone(draft.phone);
    const nextProfile: ProfileRow = {
      ...profile,
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="font-profile-kmu-serif relative min-h-full overflow-hidden bg-[#f7f4ed]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden bg-[#292c24]">
        {archetypeId && archetype ? (
          <Image
            src={profileArchetypeBackgrounds[archetypeId]}
            alt=""
            fill
            priority
            sizes="(max-width: 430px) 100vw, 430px"
            className={cn(
              "scale-[1.03] object-cover",
              archetypeId === "visionary"
                ? "object-[center_72%]"
                : "object-center",
            )}
          />
        ) : (
          <>
            <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#d8caa8]/30 blur-3xl" />
            <div className="absolute left-0 top-40 h-64 w-64 rounded-full bg-[#506052]/40 blur-3xl" />
          </>
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-[#f7f4ed]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent via-[#f7f4ed]/80 to-[#f7f4ed]" />
      </div>

      <section className="relative z-10 px-5 pb-28 pt-7">
        <header className="pr-16">
          <h1 className="font-profile-kmu-serif text-[29px] leading-9 tracking-[-0.035em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.45)]">
            profile
          </h1>
        </header>

        <section className="mt-5">
          <div className="relative px-5 pb-8 pt-5 text-white">
            {!profile.profile_completed ? (
              <>
              <div className="relative flex min-h-[300px] flex-col items-center justify-center px-4 py-7 text-center">
                <p className="text-[17px] font-black tracking-[-0.04em] text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.5)]">
                  질문을 이어서 답해주세요
                </p>
                {archetype && (
                  <>
                    <p className="font-profile-kmu-serif mt-4 text-[38px] italic leading-none tracking-[-0.045em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]">
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
                    window.location.assign("/onboarding/questions");
                  }}
                  className="mt-7 h-11 rounded-full border border-white/25 bg-[#faf8f2] px-6 text-[12px] font-black text-black shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition active:scale-[0.98]"
                >
                  질문 이어가기
                </button>
              </div>
              </>
            ) : (
              <>
            <div className="relative flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <div className="min-w-0 max-w-full">
                <p className="truncate text-[17px] font-black tracking-[-0.04em] drop-shadow-[0_3px_14px_rgba(0,0,0,0.5)]">
                  {profile.name?.trim() || "이름 미입력"}
                </p>
              </div>
              {archetype && (
                <>
                  <p className="font-profile-kmu-serif mt-1 text-[38px] italic leading-none tracking-[-0.045em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.5)]">
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
                    className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-bold text-white/75 backdrop-blur-md"
                  >
                    {value}
                  </span>
                ),
              )}
            </div>
              </>
            )}
          </div>

          <div
            className={cn(
              editing || saved
                ? "rounded-[28px] border border-black/[0.07] bg-[#faf8f2]/95 p-5 shadow-[0_24px_70px_rgba(24,24,20,0.09)] backdrop-blur-xl"
                : "hidden",
            )}
          >
            {editing ? (
              <div className="space-y-5">
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

        <MembershipStatusCard profile={profile} />

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
          photoCompleted={Boolean(profile.photo_url)}
        />

        {showOperatorQuestionReview && (
          <button
            type="button"
            onClick={onOpenQuestionReview}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#faf8f2] text-xs font-semibold text-black/55 transition hover:border-black/18 hover:bg-[#f1eee6] hover:text-black/70"
          >
            <PenLine size={15} aria-hidden />
            질문 다시보기
          </button>
        )}

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

        {!previewMode && <AccountDeletionButton />}

        {logoutError && (
          <p className="mt-3 rounded-[16px] bg-red-50 px-4 py-3 text-center text-[11px] font-bold leading-5 text-red-600">
            {logoutError}
          </p>
        )}
      </section>
    </motion.div>
  );
}
