"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Crown,
  Footprints,
  Gem,
  Heart,
  Info,
  Loader2,
  MapPin,
  Menu,
  MessageCircle,
  PenLine,
  Phone,
  Scale,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { SafeImage } from "@/components/SafeImage";
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
import { uploadProfilePhoto } from "@/lib/profilePhoto";

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

function AccountSettingsCard({ profile }: { profile: ProfileRow }) {
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
    ? planLabel ?? "이용 중"
    : "멤버십 없음";
  const periodLabel = hasMembership
    ? period
      ? `이용 기간 ${period}`
      : "이용 기간을 확인하고 있어요."
    : "현재 이용 중인 멤버십이 없어요.";

  return (
    <section className="mt-8">
      <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/38">
        설정
      </p>
      <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#faf8f2] px-5 shadow-[0_16px_44px_rgba(24,24,20,0.06)]">
        <div className="flex min-h-20 items-center gap-4 py-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55"
          >
            <Crown size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-black text-black">
              교집합 멤버십
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-black/38">
              <CalendarDays size={12} aria-hidden className="shrink-0" />
              {periodLabel}
            </span>
          </span>
          <span
            className="shrink-0 rounded-full bg-black/[0.055] px-3 py-1.5 text-[10px] font-black text-black/45"
          >
            {status === "active"
              ? statusLabel
              : "이용 안 함"}
          </span>
        </div>
      </div>
    </section>
  );
}

const howIntersectionWorksSlides = [
  "모든 교집합 경험은 당신과 가장 잘 어울리는 사람들과 함께하는 따뜻한 식사 자리에서 시작됩니다.\n\n이후 코스에서는 다른 교집합 테이블 사람들도 함께하게 되며, 경험이 계속 이어집니다.",
  "정확한 장소와 사람은 만남 시작 24시간 전까지 공개되지 않습니다.\n\n이것은 교집합이 중요하게 생각하는 운영 철학의 일부입니다.",
  "모든 경험은 공개된 장소에서 그룹 형태로 진행됩니다.\n\n모든 참여자는 경험에 초대되기 전에 검토 과정을 거칩니다.",
  "경험이 진행되는 동안 어디로 이동하고 누구와 만날지 안내받을 수 있습니다.\n\n이는 당신에게 가장 잘 맞는 사람과 장소를 발견하도록 돕기 위한 과정입니다.",
  "열린 마음으로 참여하고, 선입견은 내려놓은 채, 각 사람과 의미 있는 대화를 나눠주세요.\n\n교집합의 경험은 소중하고 진정성 있는 자리이므로 그에 맞게 서로를 존중해 주세요.",
] as const;

function IntersectionHowItWorks({ onClose }: { onClose: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(0);
  const characters = useMemo(
    () => Array.from(howIntersectionWorksSlides[pageIndex]),
    [pageIndex],
  );
  const typing = visibleCharacterCount < characters.length;
  const completedProgress =
    (pageIndex + visibleCharacterCount / Math.max(characters.length, 1)) /
    howIntersectionWorksSlides.length;

  useEffect(() => {
    setVisibleCharacterCount(0);
    const timer = window.setInterval(() => {
      setVisibleCharacterCount((current) => {
        if (current >= characters.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 22);

    return () => window.clearInterval(timer);
  }, [characters]);

  const continueFlow = () => {
    if (typing) return;
    if (pageIndex < howIntersectionWorksSlides.length - 1) {
      setPageIndex((current) => current + 1);
      return;
    }
    onClose();
  };

  const goBack = () => {
    if (pageIndex === 0) {
      onClose();
      return;
    }
    setPageIndex((current) => current - 1);
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-label="교집합 진행 안내"
      tabIndex={0}
      onClick={continueFlow}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          continueFlow();
        }
      }}
      className={cn(
        "font-profile-kmu-serif fixed left-1/2 top-0 z-[120] flex h-dvh w-full max-w-[430px] -translate-x-1/2 flex-col overflow-hidden bg-[#f7f4ed] text-[#171714] outline-none",
        !typing && "cursor-pointer",
      )}
    >
      <header className="relative shrink-0 px-7 pb-5 pt-[calc(28px+env(safe-area-inset-top))] text-center">
        <span className="text-[15px] italic tracking-[0.08em] text-black/38">
          intersection
        </span>
        <div
          role="progressbar"
          aria-label="교집합 진행 안내 완료율"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(completedProgress * 100)}
          className="absolute inset-x-0 bottom-0 h-[2px] bg-black/[0.08]"
        >
          <motion.div
            initial={false}
            animate={{
              width: `${completedProgress * 100}%`,
            }}
            transition={{ duration: 0.1, ease: "linear" }}
            className="h-full bg-[#827656]"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-start px-8 pb-24 pt-[26vh]">
        <AnimatePresence mode="wait">
          <motion.p
            key={pageIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            aria-live="polite"
            className="whitespace-pre-line break-keep text-[18px] font-medium leading-[1.75] tracking-[-0.03em]"
          >
            {characters.slice(0, visibleCharacterCount).join("")}
            {typing && (
              <span aria-hidden className="ml-0.5 animate-pulse text-[#827656]/65">
                |
              </span>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-center px-7 pb-[calc(28px+env(safe-area-inset-bottom))] pt-6 text-black/38">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            goBack();
          }}
          aria-label={pageIndex === 0 ? "안내 닫기" : "이전 장"}
          className="absolute left-7 flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/[0.05] hover:text-black/65"
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
        <AnimatePresence>
          {!typing && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[15px] tracking-[-0.02em]"
            >
              tap to continue
            </motion.span>
          )}
        </AnimatePresence>
      </footer>
    </motion.section>
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
  initialAccountOpen = false,
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
  initialAccountOpen?: boolean;
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
  const [accountOpen, setAccountOpen] = useState(initialAccountOpen);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const archetypeId = isProfileArchetypeId(profile.profile_archetype_id)
    ? profile.profile_archetype_id
    : null;
  const archetype = archetypeId ? profileArchetypes[archetypeId] : null;

  useEffect(() => {
    if (!editing) setDraft(initialDraft);
  }, [editing, initialDraft]);

  useEffect(
    () => () => {
      if (previewPhotoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
    },
    [previewPhotoUrl],
  );

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

  const changePhoto = async (file: File | null) => {
    if (!file || photoUploading) return;

    setPhotoUploading(true);
    setPhotoError(null);
    try {
      if (previewMode) {
        const nextPreviewUrl = URL.createObjectURL(file);
        setPreviewPhotoUrl(nextPreviewUrl);
        onProfileUpdated({ ...profile, photo_url: nextPreviewUrl });
      } else {
        const photoUrl = await uploadProfilePhoto(profile.user_id, file);
        setPreviewPhotoUrl(null);
        onProfileUpdated({ ...profile, photo_url: photoUrl });
      }
    } catch (caught) {
      setPhotoError(
        caught instanceof Error
          ? caught.message
          : "사진을 변경하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  if (howItWorksOpen) {
    return <IntersectionHowItWorks onClose={() => setHowItWorksOpen(false)} />;
  }

  if (accountOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="font-profile-kmu-serif min-h-full bg-[#f7f4ed]"
      >
        <section className="px-5 pb-28 pt-7">
          <header className="relative flex h-10 items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setAccountOpen(false);
                const url = new URL(window.location.href);
                url.searchParams.delete("account");
                window.history.replaceState(
                  null,
                  "",
                  `${url.pathname}${url.search}${url.hash}`,
                );
              }}
              aria-label="프로필로 돌아가기"
              className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black"
            >
              <ChevronLeft size={22} aria-hidden />
            </button>
            <h1 className="text-[24px] leading-none tracking-[-0.035em] text-black">
              account
            </h1>
          </header>

          <section className="mt-8">
            <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/38">
              내 정보
            </p>
            <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#faf8f2] px-5 shadow-[0_16px_44px_rgba(24,24,20,0.06)]">
              <div className="flex min-h-16 items-center gap-4 border-b border-black/[0.07] py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55">
                  <UserRound size={18} aria-hidden />
                </span>
                <span className="text-[14px] font-black text-black">이름</span>
                <span className="ml-auto truncate text-[13px] font-semibold text-black/45">
                  {profile.name?.trim() || "미입력"}
                </span>
              </div>
              <div className="flex min-h-16 items-center gap-4 border-b border-black/[0.07] py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55">
                  <Phone size={18} aria-hidden />
                </span>
                <span className="text-[14px] font-black text-black">전화번호</span>
                <span className="ml-auto truncate text-[13px] font-semibold text-black/45">
                  {profile.phone?.trim() || profile.phone_normalized?.trim() || "미입력"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setEditing((current) => !current);
                }}
                className="flex min-h-16 w-full items-center gap-4 py-4 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55">
                  <PenLine size={17} aria-hidden />
                </span>
                <span className="text-[14px] font-black text-black">프로필 정보 수정</span>
                <ChevronRight size={18} aria-hidden className="ml-auto text-black/32" />
              </button>
            </div>
          </section>

          <AnimatePresence initial={false}>
            {editing && (
              <motion.section
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-5 rounded-[26px] border border-black/[0.08] bg-[#faf8f2] p-5 shadow-[0_16px_44px_rgba(24,24,20,0.06)]">
                  <div>
                    <span className="text-[11px] font-bold text-black/48">
                      프로필 사진
                    </span>
                    <div className="mt-3 flex items-center gap-4 rounded-[18px] border border-black/[0.07] bg-white p-3">
                      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1eee6] text-black/28">
                        <UserRound size={22} aria-hidden />
                        <SafeImage
                          src={previewPhotoUrl ?? profile.photo_url}
                          alt="현재 프로필 사진"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-black text-black">
                          사진 변경
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={photoUploading}
                        onClick={() => photoInputRef.current?.click()}
                        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#171714] px-4 text-[11px] font-black text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-55"
                      >
                        {photoUploading ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden />
                        ) : (
                          <Camera size={14} aria-hidden />
                        )}
                        {photoUploading ? "변경 중" : "선택"}
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        className="hidden"
                        aria-label="프로필 사진 선택"
                        onChange={(event) => void changePhoto(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    {photoError && (
                      <p className="mt-2 rounded-[14px] bg-red-50 px-3 py-2 text-[10px] font-bold leading-4 text-red-600">
                        {photoError}
                      </p>
                    )}
                  </div>
                  <TextField
                    label="이름"
                    value={draft.name}
                    onChange={(name) => setDraft((current) => ({ ...current, name }))}
                  />
                  <TextField
                    label="전화번호"
                    value={draft.phone}
                    inputMode="tel"
                    onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
                  />
                  <fieldset>
                    <legend className="text-[11px] font-bold text-black/48">성별</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["여성", "남성"] as Gender[]).map((gender) => (
                        <button
                          key={gender}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, gender }))}
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
                      <span className="text-[11px] font-bold text-black/48">출생연도</span>
                      <select
                        value={draft.birthYear}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, birthYear: event.target.value }))
                        }
                        className="mt-2 h-12 w-full appearance-none rounded-[16px] border border-black/10 bg-white px-4 text-[13px] font-bold text-black outline-none"
                      >
                        <option value="">선택</option>
                        {birthYearOptions.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="text-[11px] font-bold text-black/48">MBTI</span>
                      <MbtiSelect
                        value={draft.mbti}
                        onChange={(mbti) => setDraft((current) => ({ ...current, mbti }))}
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
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#171714] text-sm font-semibold text-white transition active:scale-[0.98] disabled:bg-black/[0.07] disabled:text-black/25"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
                    {saving ? "저장 중..." : "변경사항 저장"}
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {saved && (
            <p className="mt-3 rounded-[16px] bg-accent/10 px-4 py-3 text-center text-[11px] font-bold text-accent">
              정보가 저장됐어요.
            </p>
          )}

          <AccountSettingsCard profile={profile} />

          <section className="mt-8">
            <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/38">
              지원
            </p>
            <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#faf8f2] px-5 shadow-[0_16px_44px_rgba(24,24,20,0.06)]">
              <a
                href="http://pf.kakao.com/_xnweQn/chat"
                target="_blank"
                rel="noreferrer"
                className="flex min-h-16 items-center gap-4 py-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55">
                  <MessageCircle size={18} aria-hidden />
                </span>
                <span className="text-[14px] font-black text-black">문의하기</span>
                <ChevronRight size={18} aria-hidden className="ml-auto text-black/32" />
              </a>
            </div>
          </section>

          <section className="mt-8">
            <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/38">
              안내
            </p>
            <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#faf8f2] px-5 shadow-[0_16px_44px_rgba(24,24,20,0.06)]">
              <button
                type="button"
                onClick={() => setHowItWorksOpen(true)}
                className="flex min-h-16 w-full items-center gap-4 border-b border-black/[0.07] py-4 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55">
                  <CircleHelp size={18} aria-hidden />
                </span>
                <span className="text-[14px] font-black text-black">
                  교집합은 어떻게 진행되나요?
                </span>
                <ChevronRight size={18} aria-hidden className="ml-auto shrink-0 text-black/32" />
              </button>
              <a href="/privacy?from=account" className="flex min-h-16 items-center gap-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1eee6] text-black/55">
                  <Info size={18} aria-hidden />
                </span>
                <span className="text-[14px] font-black text-black">개인정보 처리방침</span>
                <ChevronRight size={18} aria-hidden className="ml-auto text-black/32" />
              </a>
            </div>
          </section>

          <section className="mt-8">
            <p className="mb-3 px-1 text-[12px] font-black uppercase tracking-[0.12em] text-black/38">
              계정 관리
            </p>
            <div className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#faf8f2] px-5 shadow-[0_16px_44px_rgba(24,24,20,0.06)]">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void onLogout()}
                className="flex min-h-16 w-full items-center border-b border-black/[0.07] py-4 text-left text-[14px] font-black text-black transition hover:text-black/65 disabled:cursor-wait disabled:opacity-50"
              >
                {loggingOut ? "로그아웃 중..." : "로그아웃"}
                <ChevronRight size={18} aria-hidden className="ml-auto text-black/32" />
              </button>
              <AccountDeletionButton variant="menu-row" />
            </div>
          </section>

          {logoutError && (
            <p className="mt-3 rounded-[16px] bg-red-50 px-4 py-3 text-center text-[11px] font-bold leading-5 text-red-600">
              {logoutError}
            </p>
          )}
        </section>
      </motion.div>
    );
  }

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
        <header className="relative pr-16">
          <h1 className="font-profile-kmu-serif text-[29px] leading-9 tracking-[-0.035em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.45)]">
            profile
          </h1>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="계정 메뉴 열기"
            className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/15 text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:bg-black/25"
          >
            <Menu size={22} aria-hidden />
          </button>
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

        </section>

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

      </section>
    </motion.div>
  );
}
