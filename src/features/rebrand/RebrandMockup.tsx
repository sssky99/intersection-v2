"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Heart,
  Home,
  List,
  MessageCircle,
  PenLine,
  Plus,
  Search,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { availableDates } from "@/data/mockTickets";
import { mockQuestions, questionCategories } from "@/data/mockQuestions";
import { mockExistingUser } from "@/data/mockUser";
import { createClient } from "@/lib/supabase/client";
import type {
  ProfileAnswers,
  ProfileQuestion,
  QuestionCategory,
  QuestionAnswer,
  QuestionOption,
} from "@/types/question";
import type { ProfileRow } from "@/types/profile";
import type {
  AvailableDate,
  GatheringTicket,
  WaitlistRegistration,
} from "@/types/ticket";
import type { Gender, UserProfile } from "@/types/user";
import type { LucideIcon } from "lucide-react";

type Route = "landing" | "detail" | "auth" | "app";
type AppTab = "browse" | "recommend" | "profile";
type RecommendationMode =
  | "calendar"
  | "drawing"
  | "detail";

type BasicDraft = {
  name: string;
  phone: string;
  nickname: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
  photoLabel: string;
  photoFile: File | null;
  photoUrl: string;
};

type RebrandMockupProps = {
  authUserId: string;
  initialProfile: ProfileRow | null;
  initialRoute?: Route;
  continuePath?: string;
};

const mbtiOptions = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
];

const categoryIcons: Record<QuestionCategory, LucideIcon> = {
  Communication: MessageCircle,
  Lifestyle: Coffee,
  Preference: X,
  Relationship: Users,
  Values: Sparkles,
  Background: Briefcase,
  Interests: Heart,
  TicketPreference: Sparkles,
  Story: PenLine,
  Picture: Camera,
};

const tabItems: Array<{ id: AppTab; label: string; Icon: LucideIcon }> = [
  { id: "browse", label: "목록", Icon: List },
  { id: "recommend", label: "추천", Icon: Sparkles },
  { id: "profile", label: "프로필", Icon: UserRound },
];

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

function suggestNickname(name: string) {
  const compact = name.replace(/\s/g, "");
  if (compact.length >= 3) {
    return compact.slice(1, 3);
  }
  return compact.slice(0, 2);
}

function isAnswerComplete(answer: QuestionAnswer | undefined) {
  if (!answer) return false;
  const value = answer.value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return value > 0;
  return Boolean(value?.toString().trim());
}

const requiredQuestionIds = mockQuestions.map((question) => question.id);

function getQuestionOptionValue(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.value;
}

function getQuestionOptionLabel(option: string | QuestionOption) {
  return typeof option === "string" ? option : option.label;
}

function getQuestionOptionMeta(
  question: ProfileQuestion,
  value: string,
): QuestionOption | undefined {
  return question.options
    ?.map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    )
    .find((option) => option.value === value || option.label === value);
}

function isSingleChoiceQuestion(question: ProfileQuestion) {
  return (
    question.type === "single" ||
    question.type === "singleWithOther" ||
    question.type === "scale" ||
    question.type === "single_choice"
  );
}

function isMultiChoiceQuestion(question: ProfileQuestion) {
  return (
    question.type === "multiple" ||
    question.type === "multipleWithOther" ||
    question.type === "multi_choice"
  );
}

function profileProgressStep(
  user: UserProfile | null,
  answers: ProfileAnswers,
  profileCompleted: boolean,
  communityGuidelinesAgreed: boolean,
) {
  if (!user) return 0;
  if (!profileCompleted) return 1;

  const hasQuestions = requiredQuestionIds.every((id) =>
    isAnswerComplete(answers[id]),
  );

  return hasQuestions && communityGuidelinesAgreed ? 3 : 2;
}

function groupedQuestions() {
  return mockQuestions.reduce(
    (groups, question) => {
      groups[question.category] = groups[question.category] ?? [];
      groups[question.category].push(question);
      return groups;
    },
    {} as Record<QuestionCategory, ProfileQuestion[]>,
  );
}

function completedMockAnswers(): ProfileAnswers {
  return Object.fromEntries(
    mockQuestions.map((question) => {
      const value =
        question.type === "photo_upload"
          ? "uploaded"
          : question.type === "text"
            ? "completed"
            : isMultiChoiceQuestion(question)
              ? [getQuestionOptionValue(question.options?.[0] ?? "")]
              : getQuestionOptionValue(question.options?.[0] ?? "");

      return [
        question.id,
        {
          questionId: question.id,
          value,
        },
      ];
    }),
  );
}

function profileValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function profileToUser(userId: string, profile: ProfileRow | null): UserProfile {
  const name = profileValue(profile?.name);
  const phone = normalizePhone(
    profileValue(profile?.phone_normalized) || profileValue(profile?.phone),
  );
  const photoUrl = profileValue(profile?.photo_url);

  return {
    id: userId,
    name,
    phone,
    nickname: suggestNickname(name),
    gender: profile?.gender ?? "",
    birthYear: profileValue(profile?.birth_year),
    mbti: profileValue(profile?.mbti).toUpperCase(),
    photoLabel: photoUrl ? "등록된 프로필 사진" : "",
    photoUrl,
    isExistingUser: Boolean(profile?.profile_completed),
  };
}

function profileToBasicDraft(
  profile: ProfileRow | null,
  user: UserProfile,
): BasicDraft {
  return {
    name: user.name,
    phone: profileValue(profile?.phone) || user.phone,
    nickname: user.nickname,
    gender: user.gender,
    birthYear: user.birthYear,
    mbti: user.mbti,
    photoLabel: user.photoLabel,
    photoFile: null,
    photoUrl: user.photoUrl,
  };
}

function sanitizeStorageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadProfilePhotoFile(userId: string, file: File) {
  const supabase = createClient();
  const storagePath = `${userId}/${Date.now()}-${sanitizeStorageFileName(
    file.name,
  )}`;
  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(storagePath, file, { upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("profile-photos")
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

function answerPayload(answer: QuestionAnswer) {
  const value = answer.value;

  if (Array.isArray(value)) {
    return {
      answer_value: null,
      answer_values: value,
      answer_text: null,
    };
  }

  if (typeof value === "number") {
    return {
      answer_value: String(value),
      answer_values: null,
      answer_text: null,
    };
  }

  return {
    answer_value: value,
    answer_values: null,
    answer_text: value,
  };
}

// ==========================================
// 1. BRAND VISUALS & LOADERS
// ==========================================

function IntersectionSymbol({
  className = "w-20 h-20",
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 100" className={cn("overflow-visible select-none pointer-events-none", className)}>
      <motion.circle
        cx={animate ? ([24, 38, 38, 24] as any) : 38}
        cy="50"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transition={
          animate
            ? {
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      />
      <motion.circle
        cx={animate ? ([76, 62, 62, 76] as any) : 62}
        cy="50"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        transition={
          animate
            ? {
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      />
      <motion.path
        d="M 50 24.7 A 28 28 0 0 1 50 75.3 A 28 28 0 0 1 50 24.7 Z"
        fill="#7eb3c7"
        initial={{ opacity: 0 }}
        animate={
          animate
            ? {
                opacity: [0, 0.1, 0.9, 0.9, 0.1, 0],
                scale: [0.95, 0.95, 1.05, 1, 0.95, 0.95],
              }
            : { opacity: 0.9 }
        }
        transition={
          animate
            ? {
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.2, 0.4, 0.75, 0.9, 1],
              }
            : undefined
        }
        style={{ transformOrigin: "50px 50px" }}
      />
    </svg>
  );
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="relative w-20 h-8 flex items-center justify-center overflow-visible select-none">
      <div className="flex items-center gap-2.5">
        {[1, 2, 3].map((dot) => (
          <motion.div
            key={dot}
            initial={false}
            animate={{
              scale: step >= dot ? 1.12 : 1,
              backgroundColor: step >= dot ? "#7eb3c7" : "rgba(0,0,0,0.10)",
            }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="h-2 w-2 rounded-full"
          />
        ))}
      </div>
    </div>
  );
}

function ProgressPulse({ step }: { step: number }) {
  return (
    <motion.div
      key={step}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 18 }}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#7eb3c7]/50"
    >
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: step / 3 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="h-6 w-6 rounded-full bg-[#7eb3c7]"
      />
    </motion.div>
  );
}

function TicketDrawingLoader({
  selectedDate,
  ticket,
  onYes,
  onNo,
  onChangeDate,
}: {
  selectedDate: AvailableDate;
  ticket: GatheringTicket;
  onYes: () => void;
  onNo: () => void;
  onChangeDate: () => void;
}) {
  const visual = getTicketVisual(ticket);
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    setIsDrawn(false);
    const timer = window.setTimeout(() => setIsDrawn(true), 1350);
    return () => window.clearTimeout(timer);
  }, [ticket.id]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-4"
    >
      <div className="flex min-h-10 items-start justify-between gap-3 pr-12">
        <div>
          <p className="text-[10px] font-bold uppercase text-accent">
            invitation
          </p>
          <motion.h2
            key={isDrawn ? "drawn-title" : "drawing-title"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-lg font-bold text-black"
          >
            {isDrawn
              ? "이 초대장이 마음에 드나요?"
              : "초대장을 그리고 있어요"}
          </motion.h2>
        </div>
      </div>

      <div className="relative mx-auto mt-4 aspect-[1/1.62] w-[88%] max-w-[330px] overflow-hidden rounded-[28px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.35 }}
          className="absolute inset-1 overflow-hidden rounded-[25px] bg-black"
        >
          <Image
            src={visual.image}
            alt=""
            fill
            sizes="330px"
            className="object-cover"
          />
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.35 }}
            transition={{ delay: 0.62, duration: 0.38 }}
            className="absolute inset-0 bg-white"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/75" />
        </motion.div>

        <svg viewBox="0 0 100 162" className="absolute inset-0 z-10 h-full w-full text-black">
          <motion.path
            d="M 8,1 L 92,1 A 7,7 0 0,1 99,8 L 99,154 A 7,7 0 0,1 92,161 L 8,161 A 7,7 0 0,1 1,154 L 1,8 A 7,7 0 0,1 8,1 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.58, ease: "easeInOut" }}
          />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.28 }}
          className="absolute inset-x-0 bottom-0 z-20 p-6 text-left text-white"
        >
          <h3 className="text-[28px] font-bold leading-8">{ticket.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-white/76">
            <span>{selectedDate.label}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/50" />
            <span>{ticket.time}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/50" />
            <span>{ticket.area}</span>
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {isDrawn ? (
          <motion.div
            key="invitation-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onNo}
                className="flex h-[58px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black"
              >
                <span className="text-sm font-bold">No</span>
                <span className="mt-0.5 text-[10px] font-medium text-black/40">
                  다른 추천 보기
                </span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onYes}
                className="flex h-[58px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm"
              >
                <span className="text-sm font-bold">Yes</span>
                <span className="mt-0.5 text-[10px] font-medium text-white/60">
                  자세히 보고 신청
                </span>
              </motion.button>
            </div>
            <button
              type="button"
              onClick={onChangeDate}
              className="mx-auto mt-3 block text-[10px] font-semibold text-black/38 underline underline-offset-4"
            >
              날짜 다시 고르기
            </button>
          </motion.div>
        ) : (
          <motion.p
            key="drawing-guide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-[11px] text-black/38"
          >
            대화 카드와 관심사 카드의 흐름을 살펴보는 중이에요.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function QuestionCompletionLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center h-[55dvh] select-none">
      <div className="mb-6">
        <ProgressDots step={3} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.3 }}
      >
        <h3 className="text-lg font-bold text-black">
          성향 분석이 완료되었습니다
        </h3>
        <p className="mt-2 text-xs text-black/45">
          교집합 분석기가 어울리는 매칭을 조립하고 있습니다...
        </p>
      </motion.div>
    </div>
  );
}

// ==========================================
// 2. MICRO-INTERACTION ELEMENTS
// ==========================================

function MbtiSlots({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const letters = value.split("");

  return (
    <div className="relative">
      <input
        value={value}
        maxLength={4}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        placeholder="INFP"
      />
      <div className="grid grid-cols-4 gap-2.5 mt-2">
        {Array.from({ length: 4 }).map((_, i) => {
          const char = letters[i] || "";
          return (
            <div
              key={i}
              className={cn(
                "h-12 rounded-xl border flex items-center justify-center text-sm font-bold transition-all",
                char ? "border-accent bg-accent/5 text-black" : "border-black/10 bg-white text-black/20"
              )}
            >
              <AnimatePresence mode="popLayout">
                {char ? (
                  <motion.span
                    key={`${char}-${i}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    {char}
                  </motion.span>
                ) : (
                  <span className="opacity-30">-</span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CameraShutter({ active }: { active: boolean }) {
  return (
    <div className="relative w-10 h-10 rounded-full border border-black/10 bg-black/[0.03] overflow-hidden flex items-center justify-center shrink-0">
      <motion.div
        animate={active ? { rotate: 90, scale: [1, 0.7, 1] } : { rotate: 0 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
        className="absolute inset-0 flex items-center justify-center text-black/40"
      >
        <svg viewBox="0 0 100 100" className="w-7 h-7">
          <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="6" />
          <path d="M 50,15 L 85,50 L 50,85 L 15,50 Z" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="50" cy="50" r="10" fill="currentColor" />
        </svg>
      </motion.div>
    </div>
  );
}

function PhotoUploadField({
  value,
  onChange,
  inputId = "profile-photo-upload-custom",
}: {
  value: string;
  onChange: (file: File | null) => void;
  inputId?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-black/45">사진</p>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          onChange(file);
        }}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "mt-2 flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition-all",
          value
            ? "border-accent bg-accent/5"
            : "border-dashed border-black/16 bg-black/[0.02]"
        )}
      >
        <span className="min-w-0 flex-1 pr-3">
          <span className="block text-sm font-semibold">
            {value ? "사진이 등록되었습니다" : "사진 선택하기"}
          </span>
          <span className="mt-0.5 block truncate text-xs text-black/45">
            {value || "감성이 담긴 일상 스냅을 선택해주세요."}
          </span>
        </span>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all",
            value
              ? "border-accent bg-accent text-white"
              : "border-black/10 bg-white text-black/45",
          )}
        >
          <Camera size={18} aria-hidden />
        </span>
      </label>
    </div>
  );
}

// ==========================================
// 3. TICKET COMPONENTS
// ==========================================

function getTicketVisual(ticket: GatheringTicket) {
  const visuals: Record<string, { image: string; mood: string; tone: string }> = {
    "ticket-calm-table": {
      image: "/images/landing-gathering.png",
      mood: "조용한 식탁, 천천히 열리는 대화",
      tone: "대화 깊이",
    },
    "ticket-light-walk": {
      image: "/images/landing-people.jpg",
      mood: "가벼운 산책과 웃음이 있는 자리",
      tone: "분위기 온도",
    },
    "ticket-riverside-tea": {
      image: "/images/landing-people.jpg",
      mood: "강변 산책 뒤 이어지는 차 한 잔",
      tone: "대화의 여백",
    },
    "ticket-book-film": {
      image: "/images/landing-cinematic.png",
      mood: "취향을 따라 천천히 머무는 오후",
      tone: "관심사 결",
    },
    "ticket-soft-dinner": {
      image: "/images/landing-gathering.png",
      mood: "편안한 식사, 부담 없는 리듬",
      tone: "관계 속도",
    },
    "ticket-gallery": {
      image: "/images/landing-cinematic.png",
      mood: "전시와 감상 사이의 고요한 대화",
      tone: "감상 밀도",
    },
    "ticket-weekend-ease": {
      image: "/images/landing-people.jpg",
      mood: "주말의 느슨함을 닮은 초대",
      tone: "여유감",
    },
  };

  return (
    visuals[ticket.id] ?? {
      image: "/images/landing-cinematic.png",
      mood: ticket.title,
      tone: "자리의 결",
    }
  );
}

// ==========================================
// 4. MAIN LAYOUT AND PAGES
// ==========================================

export function RebrandMockup({
  authUserId,
  initialProfile,
  initialRoute = "app",
  continuePath = "/browse",
}: RebrandMockupProps) {
  const router = useRouter();
  const initialUser = useMemo(
    () => profileToUser(authUserId, initialProfile),
    [authUserId, initialProfile],
  );
  const questionsInitiallyCompleted = Boolean(initialProfile?.questions_completed);
  const [route, setRoute] = useState<Route>(initialRoute);
  const [activeTab, setActiveTab] = useState<AppTab>("recommend");
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [profileCompleted, setProfileCompleted] = useState(
    Boolean(initialProfile?.profile_completed),
  );
  const [communityGuidelinesAgreed, setCommunityGuidelinesAgreed] = useState(
    Boolean(initialProfile?.community_guidelines_agreed),
  );
  const [basicInfoSaving, setBasicInfoSaving] = useState(false);
  const [basicInfoError, setBasicInfoError] = useState<string | null>(null);
  const [questionFlowError, setQuestionFlowError] = useState<string | null>(
    null,
  );
  const [basicDraft, setBasicDraft] = useState<BasicDraft>(() =>
    profileToBasicDraft(initialProfile, initialUser),
  );
  const [answers, setAnswers] = useState<ProfileAnswers>(() =>
    questionsInitiallyCompleted ? completedMockAnswers() : {},
  );
  const [recommendationMode, setRecommendationMode] =
    useState<RecommendationMode>("calendar");
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [waitlistRegistration, setWaitlistRegistration] =
    useState<WaitlistRegistration | null>(null);
  const [savedRegistrations, setSavedRegistrations] = useState<
    WaitlistRegistration[]
  >([]);
  const [profileInfoOpen, setProfileInfoOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<QuestionCategory | null>(null);
  const questionsSyncedRef = useRef(questionsInitiallyCompleted);

  const progressStep = profileProgressStep(
    user,
    answers,
    profileCompleted,
    communityGuidelinesAgreed,
  );
  const selectedDate = availableDates.find((item) => item.id === selectedDateId);
  const questionGroups = useMemo(groupedQuestions, []);

  useEffect(() => {
    if (progressStep !== 3 || questionsSyncedRef.current) return;

    questionsSyncedRef.current = true;
    const supabase = createClient();

    supabase
      .from("profiles")
      .update({ questions_completed: true })
      .eq("user_id", authUserId)
      .then(({ error }) => {
        if (error) {
          console.error("Questions completion sync error:", error.message);
          questionsSyncedRef.current = false;
        }
      });
  }, [authUserId, progressStep]);

  const syncAnswer = (question: ProfileQuestion, answer: QuestionAnswer) => {
    const now = new Date().toISOString();

    createClient()
      .from("user_answers")
      .upsert(
        {
          user_id: authUserId,
          question_order: question.order ?? question.id,
          category: question.category,
          question_type: question.type,
          ...answerPayload(answer),
          other_text: answer.otherText ?? null,
          created_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,question_order" },
      )
      .then(({ error }) => {
        if (error) {
          console.warn("Question answer sync skipped:", error.message);
        }
      });
  };

  const updateAnswer = (question: ProfileQuestion, value: string | string[] | number, otherText?: string) => {
    const nextAnswer = {
      questionId: question.id,
      value,
      otherText,
    };

    setAnswers((current) => ({
      ...current,
      [question.id]: nextAnswer,
    }));
    syncAnswer(question, nextAnswer);
  };

  const updateMultipleAnswer = (question: ProfileQuestion, option: string, otherText?: string) => {
    setAnswers((current) => {
      const currentAnswer = current[question.id];
      const values = currentAnswer && Array.isArray(currentAnswer.value) ? currentAnswer.value : [];
      const selectedOption = getQuestionOptionMeta(question, option);
      const exclusiveValues =
        question.options
          ?.filter((item) => typeof item !== "string" && item.exclusive)
          .map((item) => getQuestionOptionValue(item)) ?? [];

      let nextValues: string[];
      if (selectedOption?.exclusive) {
        nextValues = [option];
      } else {
        const filtered = values.filter((val) => !exclusiveValues.includes(val));
        if (filtered.includes(option)) {
          nextValues = filtered.filter((val) => val !== option);
        } else {
          nextValues = [...filtered, option];
        }
      }

      const nextAnswer = {
        questionId: question.id,
        value: nextValues,
        otherText: nextValues.some((item) => getQuestionOptionMeta(question, item)?.hasTextInput)
          ? (otherText ?? currentAnswer?.otherText ?? "")
          : undefined,
      };

      syncAnswer(question, nextAnswer);

      return {
        ...current,
        [question.id]: nextAnswer,
      };
    });
  };

  const enterWithUser = (name: string, phone: string) => {
    const normalizedPhone = normalizePhone(phone);
    const isExisting = normalizedPhone === "01012345678";

    if (isExisting) {
      const existingUser = {
        ...mockExistingUser,
        name: name.trim() || mockExistingUser.name,
      };

      setUser(existingUser);
      setBasicDraft({
        name: existingUser.name,
        phone: existingUser.phone,
        nickname: existingUser.nickname,
        gender: existingUser.gender,
        birthYear: existingUser.birthYear,
        mbti: existingUser.mbti,
        photoLabel: existingUser.photoLabel,
        photoFile: null,
        photoUrl: existingUser.photoUrl,
      });
      setAnswers(completedMockAnswers());
      setProfileCompleted(true);
      setActiveTab("recommend");
      setRecommendationMode("calendar");
      setSelectedDateId(null);
      setWaitlistRegistration(null);
      setSavedRegistrations([]);
      setRoute("app");
      return;
    }

    const nextNickname = suggestNickname(name);

    const nextUser: UserProfile = {
      id: `user-local-${Date.now()}`,
      name,
      phone: normalizedPhone,
      nickname: nextNickname,
      gender: "",
      birthYear: "",
      mbti: "",
      photoLabel: "",
      photoUrl: "",
      isExistingUser: isExisting,
    };

    setUser(nextUser);
    setBasicDraft({
      name,
      phone: normalizedPhone,
      nickname: nextNickname,
      gender: "",
      birthYear: "",
      mbti: "",
      photoLabel: "",
      photoFile: null,
      photoUrl: "",
    });
    setAnswers({});
    setProfileCompleted(false);
    setActiveTab("browse");
    setRecommendationMode("calendar");
    setSelectedDateId(null);
    setWaitlistRegistration(null);
    setSavedRegistrations([]);
    setRoute("app");
  };

  const saveBasicInfo = async () => {
    if (!user) return;

    setBasicInfoSaving(true);
    setBasicInfoError(null);

    const supabase = createClient();

    const name = basicDraft.name.trim();
    const phone = basicDraft.phone.trim();
    const normalizedPhone = normalizePhone(phone);
    const nickname = suggestNickname(name);
    const mbti = basicDraft.mbti.toUpperCase();

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: authUserId,
        provider: initialProfile?.provider ?? "kakao",
        name,
        phone,
        phone_normalized: normalizedPhone,
        gender: basicDraft.gender,
        birth_year: basicDraft.birthYear,
        mbti,
        profile_completed: true,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      setBasicInfoError(
        "기본정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      setBasicInfoSaving(false);
      return;
    }

    setUser({
      ...user,
      name,
      phone: normalizedPhone,
      nickname,
      gender: basicDraft.gender,
      birthYear: basicDraft.birthYear,
      mbti,
      photoLabel: basicDraft.photoLabel,
      photoUrl: basicDraft.photoUrl,
      isExistingUser: true,
    });
    setBasicDraft((current) => ({
      ...current,
      name,
      phone: normalizedPhone,
      nickname,
      mbti,
    }));
    setProfileCompleted(true);
    setBasicInfoSaving(false);
  };

  const uploadQuestionPhoto = async (file: File) => {
    setQuestionFlowError(null);

    try {
      const photoUrl = await uploadProfilePhotoFile(authUserId, file);
      const { error } = await createClient()
        .from("profiles")
        .update({ photo_url: photoUrl })
        .eq("user_id", authUserId);

      if (error) {
        throw new Error(error.message);
      }

      setUser((current) =>
        current
          ? {
              ...current,
              photoLabel: file.name,
              photoUrl,
            }
          : current,
      );
      setBasicDraft((current) => ({
        ...current,
        photoLabel: file.name,
        photoFile: null,
        photoUrl,
      }));

      return photoUrl;
    } catch (error) {
      setQuestionFlowError(
        "사진 업로드에 실패했어요. profile-photos 버킷 설정을 확인해주세요.",
      );
      throw error;
    }
  };

  const saveCommunityGuidelinesAgreement = async () => {
    setQuestionFlowError(null);

    const { error } = await createClient()
      .from("profiles")
      .update({
        community_guidelines_agreed: true,
        community_guidelines_agreed_at: new Date().toISOString(),
        questions_completed: true,
      })
      .eq("user_id", authUserId);

    if (error) {
      setQuestionFlowError(
        "참여 원칙 동의 저장에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      return false;
    }

    questionsSyncedRef.current = true;
    setCommunityGuidelinesAgreed(true);
    return true;
  };

  const registerWaitlist = (ticket: GatheringTicket) => {
    const registration: WaitlistRegistration = {
      ticket,
      status: "waitlisted",
    };

    setWaitlistRegistration(registration);
    setSavedRegistrations((current) =>
      current.some((item) => item.ticket.id === ticket.id)
        ? current
        : [...current, registration],
    );
  };

  return (
    <div className="flex min-h-dvh justify-center bg-outer text-foreground">
      <main className="relative h-dvh min-h-dvh w-full max-w-[430px] overflow-hidden bg-background md:my-4 md:h-[calc(100dvh-32px)] md:min-h-0 md:rounded-[32px] md:shadow-frame">
        <AnimatePresence>
          {route === "landing" && (
            <DetailPage
              key="landing-detail"
              onBack={() => setRoute("app")}
              onContinue={() => setRoute(user ? "app" : "auth")}
            />
          )}
          {route === "detail" && (
            <DetailPage
              key="detail"
              onBack={() =>
                initialRoute === "detail"
                  ? router.push("/")
                  : setRoute("landing")
              }
              onContinue={() =>
                initialRoute === "detail"
                  ? router.push(continuePath)
                  : setRoute("auth")
              }
            />
          )}
          {route === "auth" && (
            <AuthPage
              key="auth"
              onBack={() => setRoute("detail")}
              onEnter={enterWithUser}
            />
          )}
          {route === "app" && user && (
            <AppShell
              key="app"
              authUserId={authUserId}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              user={user}
              setUser={setUser}
              profileInfoOpen={profileInfoOpen}
              setProfileInfoOpen={setProfileInfoOpen}
            >
              <AnimatePresence mode="wait">
                {activeTab === "browse" && (
                  <TicketArchiveView
                    key="browse"
                    registrations={savedRegistrations}
                    onOpenTicket={(registration) => {
                      setWaitlistRegistration(registration);
                      setRecommendationMode("detail");
                      setActiveTab("recommend");
                    }}
                    onReceiveInvitation={() => {
                      setRecommendationMode("calendar");
                      setSelectedDateId(null);
                      setActiveTab("recommend");
                    }}
                  />
                )}
                {activeTab === "recommend" && (
                  <RecommendTabV3
                    key="recommend"
                    user={user}
                    progressStep={progressStep}
                    basicDraft={basicDraft}
                    setBasicDraft={setBasicDraft}
                    saveBasicInfo={saveBasicInfo}
                    basicInfoSaving={basicInfoSaving}
                    basicInfoError={basicInfoError}
                    answers={answers}
                    questionFlowError={questionFlowError}
                    updateAnswer={updateAnswer}
                    updateMultipleAnswer={updateMultipleAnswer}
                    uploadProfilePhoto={uploadQuestionPhoto}
                    communityGuidelinesAgreed={communityGuidelinesAgreed}
                    saveCommunityGuidelinesAgreement={saveCommunityGuidelinesAgreement}
                    recommendationMode={recommendationMode}
                    setRecommendationMode={setRecommendationMode}
                    selectedDate={selectedDate}
                    selectedDateId={selectedDateId}
                    setSelectedDateId={setSelectedDateId}
                    waitlistRegistration={waitlistRegistration}
                    registerWaitlist={registerWaitlist}
                    onOpenTickets={() => {
                      setRecommendationMode("calendar");
                      setSelectedDateId(null);
                      setActiveTab("browse");
                    }}
                  />
                )}
                {activeTab === "profile" && (
                  <ProfileTabV2
                    key="profile"
                    user={user}
                    answers={answers}
                    updateAnswer={updateAnswer}
                    updateMultipleAnswer={updateMultipleAnswer}
                    questionGroups={questionGroups}
                    editingCategory={editingCategory}
                    setEditingCategory={setEditingCategory}
                  />
                )}
              </AnimatePresence>
            </AppShell>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ==========================================
// 5. LANDING & INTRO PAGES
// ==========================================

function LandingHeroPage({ onStart }: { onStart: () => void }) {
  return (
    <motion.section
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.32, 0.94, 0.6, 1] }}
      className="absolute inset-0 flex h-full min-h-full w-full flex-col overflow-hidden px-6 pb-7 pt-7 text-white"
    >
      <Image
        src="/images/landing-cinematic.png"
        alt="분위기 식탁 사진"
        fill
        priority
        sizes="430px"
        className="object-cover object-center saturate-[0.92]"
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/90" />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black via-black/82 to-transparent" />

      <header className="relative z-10 flex items-center justify-between">
        <span className="text-lg font-bold tracking-[0] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
          교집합
        </span>
        <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
          beta
        </span>
      </header>

      <div className="relative z-10 mt-auto pb-7">
        <p className="text-xs font-semibold text-white/60 tracking-wider">새로운 만남의 기준</p>
        <h1 className="mt-3 text-balance text-[38px] font-bold leading-[1.08] tracking-tight text-white">
          우연보다
          <br />
          섬세하게
        </h1>
        <p className="mt-4 max-w-[310px] text-[14px] leading-6 text-white/70">
          교집합은 감성과 관계 속도를 바탕으로, 함께 시간을 채워도 차분하고 익숙할 사람들을 이어갑니다.
        </p>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        className="relative z-10 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-black shadow-[0_12px_36px_rgba(0,0,0,0.3)]"
      >
        <Search size={17} aria-hidden />
        내 교집합 시작하기
      </motion.button>
    </motion.section>
  );
}

function DetailPage({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const sections = [
    {
      title: "교집합이 추구하는 태도",
      body: "요란스러운 친목보다는 처음 함께 앉는 자리의 침묵도 부드럽게 흐르기를 목표로 조율합니다.",
    },
    {
      title: "연결되는 사람들의 기준",
      body: "대화 속도, 주말을 소비하는 분위기, 가치관의 결이 서로 비슷한 방향을 그립니다.",
    },
    {
      title: "나에게 닿는 추천 티켓",
      body: "18개의 질문과 공개 프로필을 바탕으로, 그날의 나와 어울리는 초대장을 하나씩 준비합니다.",
    },
  ];

  return (
    <motion.section
      key="detail"
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.55, ease: [0.32, 0.94, 0.6, 1] }}
      className="absolute inset-0 flex h-full min-h-full w-full flex-col px-6 py-7 overflow-y-auto scrollbar-none"
    >
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-black/50"
        >
          이전
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-black/80">서비스 소개</span>
        <span className="w-8" />
      </header>

      <article className="mt-10">
        <p className="text-xs font-bold text-accent tracking-wider uppercase">교집합</p>
        <h2 className="mt-3 text-[28px] font-bold leading-9 tracking-tight text-black">
          불필요한 관계 피로 없이,
          <br />
          필요한 만큼만 차분하게.
        </h2>
      </article>

      <div className="mt-8 border-y border-black/10">
        {sections.map((section, index) => (
          <motion.section
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.28 }}
            className={cn("py-5", index > 0 && "border-t border-black/10")}
          >
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-bold text-black">{section.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-black/50">
                  {section.body}
                </p>
              </div>
            </div>
          </motion.section>
        ))}
      </div>

      <motion.div
        layoutId="auth-card"
        className="mt-auto pt-7 w-full bg-white rounded-t-[28px] border-t border-black/5"
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onContinue}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white"
        >
          <Sparkles size={16} aria-hidden />
          프로필 시작하기
        </motion.button>
      </motion.div>
    </motion.section>
  );
}

function AuthPage({
  onBack,
  onEnter,
}: {
  onBack: () => void;
  onEnter: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const canEnter = name.trim().length > 1 && normalizePhone(phone).length >= 10;

  return (
    <motion.section
      key="auth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex h-full min-h-full w-full flex-col px-6 py-7"
    >
      <header className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-black/50"
        >
          이전
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-black/80">본인 확인</span>
        <span className="w-8" />
      </header>

      <motion.div
        layoutId={isEntering ? undefined : "auth-card"}
        className="flex-1 flex flex-col justify-between bg-white rounded-[28px] border border-black/10 p-5 shadow-sm"
      >
        <div className="space-y-6">
          <div className="text-center py-4">
            <h2 className="text-xl font-bold tracking-tight text-black">
              이름과 연락처로 시작하기
            </h2>
            <p className="mt-1 text-xs text-black/40">
              입력 정보는 목업 로컬 세션에만 임시 보관됩니다.
            </p>
          </div>

          <div className="flex justify-center my-2">
            <motion.div
              layoutId="user-avatar"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-black/15 bg-black/[0.03] text-[22px] font-bold text-black/70 shadow-inner"
            >
              {name.trim() ? suggestNickname(name) : "?"}
            </motion.div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canEnter) {
                setIsEntering(true);
                onEnter(name.trim(), phone);
              }
            }}
          >
            <LabeledInput
              label="이름"
              value={name}
              placeholder="홍길동"
              onChange={setName}
            />
            <LabeledInput
              label="전화번호"
              value={phone}
              placeholder="010-1234-5678"
              inputMode="tel"
              onChange={setPhone}
            />

            <motion.button
              type="submit"
              disabled={!canEnter}
              whileTap={canEnter ? { scale: 0.97 } : undefined}
              className={cn(
                "mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition",
                canEnter
                  ? "bg-black text-white"
                  : "bg-black/[0.06] text-black/35",
              )}
            >
              <Home size={16} aria-hidden />
              서비스 입장하기
            </motion.button>
          </form>
        </div>
      </motion.div>
    </motion.section>
  );
}

// ==========================================
// 6. MAIN APP SHELL & TAB WRAPPERS
// ==========================================

function AppShell({
  children,
  authUserId,
  activeTab,
  setActiveTab,
  user,
  setUser,
  profileInfoOpen,
  setProfileInfoOpen,
}: {
  children: React.ReactNode;
  authUserId: string;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  profileInfoOpen: boolean;
  setProfileInfoOpen: (open: boolean) => void;
}) {
  return (
    <section className="absolute inset-0 flex h-full min-h-full w-full flex-col bg-white">
      <button
        type="button"
        aria-label="기본정보 카드 열기"
        aria-expanded={profileInfoOpen}
        onClick={() => setProfileInfoOpen(!profileInfoOpen)}
        className="absolute right-4 top-[calc(14px+env(safe-area-inset-top))] z-50"
      >
        <motion.span
          layoutId="user-avatar"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border bg-white text-xs font-bold text-black shadow-sm transition",
            profileInfoOpen ? "border-black" : "border-black/15",
          )}
        >
          {user.nickname || user.name.slice(-2)}
        </motion.span>
      </button>

      <AnimatePresence>
        {profileInfoOpen && (
          <>
            <motion.button
              type="button"
              aria-label="기본정보 카드 닫기"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProfileInfoOpen(false)}
              className="absolute inset-0 z-30 bg-black/10"
            />
            <BasicInfoPanel
              key="basic-info-panel"
              authUserId={authUserId}
              user={user}
              setUser={setUser}
              onClose={() => setProfileInfoOpen(false)}
            />
          </>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-[calc(16px+env(safe-area-inset-top))] scrollbar-none">
        {children}
      </div>

      <nav className="shrink-0 border-t border-black/10 bg-white px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-1.5 shadow-lg">
        <div className="grid grid-cols-3 gap-1 relative">
          {tabItems.map(({ id, label, Icon }) => {
            const selected = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => {
                  setProfileInfoOpen(false);
                  setActiveTab(id);
                }}
                className={cn(
                  "relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-all duration-300 z-10",
                  selected ? "text-white" : "text-black/35 hover:text-black/55"
                )}
              >
                <motion.span
                  animate={selected ? { y: -1, scale: 1.05 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <Icon size={17} strokeWidth={selected ? 2.5 : 1.8} />
                  <span>{label}</span>
                </motion.span>

                {selected && (
                  <motion.div
                    layoutId="active-tab-bg"
                    className="absolute inset-x-1 inset-y-1 bg-[#7eb3c7] rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 24 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}

function BasicInfoPanel({
  authUserId,
  user,
  setUser,
  onClose,
}: {
  authUserId: string;
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    nickname: user.nickname,
    name: user.name,
    phone: user.phone,
    gender: user.gender,
    birthYear: user.birthYear,
    mbti: user.mbti,
    photoLabel: user.photoLabel,
    photoFile: null as File | null,
    photoUrl: user.photoUrl,
  });

  const openEditor = () => {
    setError(null);
    setDraft({
      nickname: user.nickname,
      name: user.name,
      phone: user.phone,
      gender: user.gender,
      birthYear: user.birthYear,
      mbti: user.mbti,
      photoLabel: user.photoLabel,
      photoFile: null,
      photoUrl: user.photoUrl,
    });
    setEditing(true);
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);

    const name = draft.name.trim() || user.name;
    const phone = normalizePhone(draft.phone) || user.phone;
    const nickname = (draft.nickname || user.nickname)
      .replace(/\s/g, "")
      .slice(0, 2);
    const mbti = draft.mbti.toUpperCase();
    let photoUrl = draft.photoUrl;

    if (draft.photoFile) {
      try {
        photoUrl = await uploadProfilePhotoFile(authUserId, draft.photoFile);
      } catch (error) {
        setError("사진 업로드에 실패했어요. profile-photos 버킷 설정을 확인해주세요.");
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await createClient()
      .from("profiles")
      .update({
        name,
        phone: draft.phone.trim() || phone,
        phone_normalized: phone,
        gender: draft.gender,
        birth_year: draft.birthYear,
        mbti,
        photo_url: photoUrl,
      })
      .eq("user_id", authUserId);

    if (updateError) {
      setError("기본정보 수정에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    setUser((current) =>
      current
        ? {
            ...current,
            nickname,
            name,
            phone,
            gender: draft.gender,
            birthYear: draft.birthYear,
            mbti,
            photoLabel: draft.photoFile ? draft.photoFile.name : draft.photoLabel,
            photoUrl,
          }
        : current,
    );
    setDraft((current) => ({
      ...current,
      photoFile: null,
      photoLabel: current.photoFile ? current.photoFile.name : current.photoLabel,
      photoUrl,
    }));
    setSaving(false);
    setEditing(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute inset-x-4 top-[calc(64px+env(safe-area-inset-top))] z-40 max-h-[calc(100%_-_148px_-_env(safe-area-inset-top))] overflow-y-auto rounded-[20px] border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.16)] scrollbar-none"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase text-black/35">
            profile
          </p>
          <h2 className="mt-0.5 text-base font-bold text-black">기본정보 카드</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && (
            <button
              type="button"
              title="기본정보 수정"
              aria-label="기본정보 수정"
              onClick={openEditor}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-black/50"
            >
              <PenLine size={14} aria-hidden />
            </button>
          )}
          <button
            type="button"
            title="닫기"
            aria-label="닫기"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-black/45"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="mt-4 space-y-2.5 border-t border-black/8 pt-4">
          <InfoRow label="닉네임" value={user.nickname} />
          <InfoRow label="이름" value={user.name} />
          <InfoRow label="전화번호" value={user.phone} />
          <InfoRow label="성별" value={user.gender || "미입력"} />
          <InfoRow label="출생연도" value={user.birthYear || "미입력"} />
          <InfoRow label="MBTI" value={user.mbti || "미입력"} />
          <InfoRow label="사진" value={user.photoUrl ? "등록됨" : "미등록"} />
        </div>
      ) : (
        <div className="mt-4 space-y-4 border-t border-black/8 pt-4">
          <label className="block">
            <span className="text-xs font-semibold text-black/45">닉네임</span>
            <input
              value={draft.nickname}
              maxLength={2}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  nickname: event.target.value.replace(/\s/g, "").slice(0, 2),
                }))
              }
              className="mt-1.5 h-11 w-full rounded-[14px] border border-black/10 px-3.5 text-sm outline-none focus:border-accent"
            />
          </label>
          {draft.photoUrl && (
            <div className="relative aspect-[1/1.24] w-full overflow-hidden rounded-[18px] bg-black/[0.04]">
              <img
                src={draft.photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <PhotoUploadField
            inputId="profile-card-photo-upload"
            value={draft.photoLabel}
            onChange={(file) =>
              setDraft((current) => ({
                ...current,
                photoFile: file,
                photoLabel: file ? file.name : current.photoLabel,
              }))
            }
          />
          <LabeledInput
            label="이름"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <LabeledInput
            label="전화번호"
            value={draft.phone}
            inputMode="tel"
            onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
          />
          <SegmentedField
            label="성별"
            value={draft.gender}
            options={["여성", "남성"]}
            onChange={(gender) =>
              setDraft((current) => ({
                ...current,
                gender: gender as Gender,
              }))
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-black/45">
                출생연도
              </span>
              <input
                value={draft.birthYear}
                inputMode="numeric"
                maxLength={4}
                placeholder="1995"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    birthYear: event.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none placeholder:text-black/25 focus:border-accent"
              />
            </label>
            <div>
              <span className="text-xs font-semibold text-black/45">MBTI</span>
              <MbtiSlots
                value={draft.mbti}
                onChange={(mbti) =>
                  setDraft((current) => ({ ...current, mbti }))
                }
              />
            </div>
          </div>
          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="h-11 rounded-[14px] border border-black/10 text-xs font-semibold text-black/50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="h-11 rounded-[14px] bg-black text-xs font-semibold text-white disabled:bg-black/[0.08] disabled:text-black/35"
            >
              {saving ? "저장 중..." : "변경사항 저장"}
            </button>
          </div>
        </div>
      )}
    </motion.section>
  );
}

function TicketArchiveView({
  registrations,
  onOpenTicket,
  onReceiveInvitation,
}: {
  registrations: WaitlistRegistration[];
  onOpenTicket: (registration: WaitlistRegistration) => void;
  onReceiveInvitation: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dragState = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
  });
  const totalSlides = registrations.length + 1;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, totalSlides - 1));
  }, [totalSlides]);

  const updateActiveSlide = (event: React.UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-ticket-slide]"),
    );

    const nextIndex = slides.reduce(
      (closest, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;

    setActiveIndex(nextIndex);
  };

  const startDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;

    dragState.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;

    const distance = event.clientX - dragState.current.startX;
    if (Math.abs(distance) > 5) {
      dragState.current.moved = true;
      event.preventDefault();
    }
    event.currentTarget.scrollLeft =
      dragState.current.scrollLeft - distance;
  };

  const finishDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;

    dragState.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const preventClickAfterDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.current.moved) return;

    event.preventDefault();
    event.stopPropagation();
    dragState.current.moved = false;
  };

  return (
    <TabMotion>
      <section className="-mx-5">
        <div className="px-5 pr-16">
          <p className="text-[10px] font-bold uppercase text-accent">
            invites {registrations.length}
          </p>
          <h1 className="mt-1 text-xl font-bold text-black">내 티켓</h1>
          <p className="mt-1 text-xs leading-5 text-black/45">
            좌우로 넘겨 보관된 초대장을 확인해보세요.
          </p>
        </div>

        <div
          onScroll={updateActiveSlide}
          onPointerDown={startDesktopDrag}
          onPointerMove={moveDesktopDrag}
          onPointerUp={finishDesktopDrag}
          onPointerCancel={finishDesktopDrag}
          onClickCapture={preventClickAfterDrag}
          className="mt-5 flex cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto pb-2 scrollbar-none overscroll-x-contain touch-pan-x active:cursor-grabbing"
        >
          {registrations.map((registration, index) => {
            const ticket = registration.ticket;
            const visual = getTicketVisual(ticket);

            return (
              <div
                key={ticket.id}
                data-ticket-slide
                style={
                  index === 0
                    ? {
                        marginLeft:
                          "max(9%, calc((100% - 330px) / 2))",
                      }
                    : undefined
                }
                className="w-[82%] max-w-[330px] shrink-0 snap-center"
              >
                <button
                  type="button"
                  aria-label={`${ticket.title} 티켓 열기`}
                  onClick={() => onOpenTicket(registration)}
                  className="relative block aspect-[1/1.62] w-full overflow-hidden rounded-[24px] border border-black/12 bg-black text-left shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
                >
                  <Image
                    src={visual.image}
                    alt={visual.mood}
                    fill
                    priority
                    draggable={false}
                    sizes="330px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/28 to-black/78" />

                  <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-white">
                    <h2 className="text-[28px] font-bold leading-9">
                      {ticket.title}
                    </h2>
                    <div className="mt-5 flex items-start justify-center gap-7 text-[11px] font-semibold leading-5 text-white/72">
                      <span>
                        {ticket.date.slice(2).replaceAll("-", ".")}
                        <br />
                        {ticket.time}
                      </span>
                      <span className="text-left">
                        서울
                        <br />
                        {ticket.area}
                      </span>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2 text-[10px] font-semibold text-white/66">
                    <Check size={13} aria-hidden />
                    <span>대기 등록된 초대장</span>
                  </div>
                </button>
              </div>
            );
          })}

          <div
            data-ticket-slide
            style={{
              marginLeft:
                registrations.length === 0
                  ? "max(9%, calc((100% - 330px) / 2))"
                  : undefined,
              marginRight: "max(9%, calc((100% - 330px) / 2))",
            }}
            className="w-[82%] max-w-[330px] shrink-0 snap-center"
          >
            <button
              type="button"
              onClick={onReceiveInvitation}
              className="flex aspect-[1/1.62] w-full flex-col items-center justify-center rounded-[24px] border border-black/12 bg-black/[0.025] px-7 text-center shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black text-black">
                <Plus size={25} aria-hidden />
              </span>
              <h2 className="mt-6 text-xl font-bold text-black">
                새로운 초대장 받기
              </h2>
              <p className="mt-3 text-xs leading-5 text-black/45">
                다른 날짜도 살펴볼게요.
                <br />
                준비된 날짜 중에서 새 초대장을 받아볼 수 있어요.
              </p>
              <span className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                초대장 선택하기
              </span>
            </button>
          </div>
        </div>

        <div
          className="mt-1 flex h-4 items-center justify-center gap-1.5"
          aria-label={`${activeIndex + 1} / ${totalSlides}`}
        >
          {Array.from({ length: totalSlides }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                index === activeIndex ? "bg-black" : "bg-black/20",
              )}
            />
          ))}
        </div>
      </section>
    </TabMotion>
  );
}

// ==========================================
// 7. RECOMMEND TAB & WORKFLOW
// ==========================================

function TopProgressHeader({ step }: { step: number }) {
  const displayStep = Math.max(step, 1);
  return (
    <section className="rounded-[20px] border border-black/10 bg-white px-4 py-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
      <div>
        <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider">프로필 완성도</p>
        <p className="mt-0.5 text-[15px] font-bold text-black tracking-tight">{displayStep} / 3 단계</p>
      </div>
      <ProgressPulse step={displayStep} />
    </section>
  );
}

function ProgressFillScreen({ step }: { step: number }) {
  const percent = Math.min(100, Math.max(0, (step / 3) * 100));

  return (
    <motion.div
      key={step}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex h-[58dvh] items-center justify-center bg-white"
    >
      <motion.div
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="flex flex-col items-center"
      >
        <div className="relative h-28 w-28 rounded-full border border-black/10 bg-black/[0.04]">
          <motion.div
            initial={{ background: "conic-gradient(#7eb3c7 0deg, rgba(0,0,0,0.08) 0deg)" }}
            animate={{
              background: `conic-gradient(#7eb3c7 ${percent * 3.6}deg, rgba(0,0,0,0.08) ${percent * 3.6}deg)`,
            }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-2 rounded-full"
          />
          <div className="absolute inset-8 rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
        </div>
        <p className="mt-4 text-sm font-bold text-black">{step} / 3</p>
      </motion.div>
    </motion.div>
  );
}

function RecommendTabV3({
  user,
  progressStep,
  basicDraft,
  setBasicDraft,
  saveBasicInfo,
  basicInfoSaving,
  basicInfoError,
  answers,
  questionFlowError,
  updateAnswer,
  updateMultipleAnswer,
  uploadProfilePhoto,
  communityGuidelinesAgreed,
  saveCommunityGuidelinesAgreement,
  recommendationMode,
  setRecommendationMode,
  selectedDate,
  selectedDateId,
  setSelectedDateId,
  waitlistRegistration,
  registerWaitlist,
  onOpenTickets,
}: {
  user: UserProfile;
  progressStep: number;
  basicDraft: BasicDraft;
  setBasicDraft: React.Dispatch<React.SetStateAction<BasicDraft>>;
  saveBasicInfo: () => Promise<void>;
  basicInfoSaving: boolean;
  basicInfoError: string | null;
  answers: ProfileAnswers;
  questionFlowError: string | null;
  updateAnswer: (question: ProfileQuestion, value: string | string[] | number, otherText?: string) => void;
  updateMultipleAnswer: (question: ProfileQuestion, option: string, otherText?: string) => void;
  uploadProfilePhoto: (file: File) => Promise<string>;
  communityGuidelinesAgreed: boolean;
  saveCommunityGuidelinesAgreement: () => Promise<boolean>;
  recommendationMode: RecommendationMode;
  setRecommendationMode: (mode: RecommendationMode) => void;
  selectedDate?: AvailableDate;
  selectedDateId: string | null;
  setSelectedDateId: (dateId: string | null) => void;
  waitlistRegistration: WaitlistRegistration | null;
  registerWaitlist: (ticket: GatheringTicket) => void;
  onOpenTickets: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);

  const basicComplete =
    basicDraft.name.trim().length > 1 &&
    normalizePhone(basicDraft.phone).length >= 10 &&
    (basicDraft.gender === "여성" || basicDraft.gender === "남성") &&
    /^\d{4}$/.test(basicDraft.birthYear) &&
    /^[A-Za-z]{4}$/.test(basicDraft.mbti);

  const questionsComplete = requiredQuestionIds.every((id) =>
    isAnswerComplete(answers[id]),
  );

  return (
    <TabMotion>
      <div className="h-full">
        <AnimatePresence mode="wait">
          {progressStep === 1 ? (
            <motion.section
              key="step-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="pr-12">
                <h2 className="text-lg font-bold text-black">기본 정보를 입력해주세요</h2>
                <p className="mt-1 text-xs text-black/50">
                  초대장을 만들기 위해 성향과 함께 살펴볼 기본 정보입니다.
                </p>
              </div>

              <MinimalBasicInfoForm
                draft={basicDraft}
                setDraft={setBasicDraft}
              />

              {basicInfoError && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                  {basicInfoError}
                </p>
              )}

              <motion.button
                whileTap={basicComplete && !basicInfoSaving ? { scale: 0.97 } : undefined}
                type="button"
                disabled={!basicComplete || basicInfoSaving}
                onClick={() => void saveBasicInfo()}
                className={cn(
                  "flex h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition",
                  basicComplete && !basicInfoSaving
                    ? "bg-black text-white shadow-sm"
                    : "bg-black/[0.06] text-black/35",
                )}
              >
                <Check size={16} aria-hidden />
                {basicInfoSaving ? "저장 중..." : "기본정보 확인"}
              </motion.button>
            </motion.section>
          ) : progressStep === 2 ? (
            <motion.section
              key={questionsComplete ? "community-guidelines" : "step-2"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              {questionsComplete && !communityGuidelinesAgreed ? (
                <CommunityGuidelinesAgreement
                  error={questionFlowError}
                  onAgree={saveCommunityGuidelinesAgreement}
                />
              ) : (
                <OneQuestionFlow
                  questionIndex={questionIndex}
                  setQuestionIndex={setQuestionIndex}
                  answers={answers}
                  updateAnswer={updateAnswer}
                  updateMultipleAnswer={updateMultipleAnswer}
                  uploadProfilePhoto={uploadProfilePhoto}
                  questionFlowError={questionFlowError}
                />
              )}
            </motion.section>
          ) : progressStep === 3 ? (
            <motion.section
              key="step-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <RecommendationReadyV3
                recommendationMode={recommendationMode}
                setRecommendationMode={setRecommendationMode}
                selectedDate={selectedDate}
                selectedDateId={selectedDateId}
                setSelectedDateId={setSelectedDateId}
                waitlistRegistration={waitlistRegistration}
                registerWaitlist={registerWaitlist}
                onOpenTickets={onOpenTickets}
              />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </TabMotion>
  );
}

function MinimalBasicInfoForm({
  draft,
  setDraft,
}: {
  draft: BasicDraft;
  setDraft: React.Dispatch<React.SetStateAction<BasicDraft>>;
}) {
  return (
    <div className="space-y-4">
      <LabeledInput
        label="이름"
        value={draft.name}
        placeholder="문하늘"
        onChange={(name) =>
          setDraft((current) => ({
            ...current,
            name,
            nickname: current.nickname || suggestNickname(name),
          }))
        }
      />

      <LabeledInput
        label="전화번호"
        value={draft.phone}
        placeholder="010-1234-5678"
        inputMode="tel"
        onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
      />

      <SegmentedField
        label="성별"
        value={draft.gender}
        options={["여성", "남성"]}
        onChange={(gender) =>
          setDraft((current) => ({ ...current, gender: gender as Gender }))
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-black/45">출생연도</span>
          <input
            value={draft.birthYear}
            inputMode="numeric"
            maxLength={4}
            placeholder="1995"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                birthYear: event.target.value.replace(/\D/g, "").slice(0, 4),
              }))
            }
            className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none placeholder:text-black/25 focus:border-accent"
          />
        </label>
        <div>
          <span className="text-xs font-semibold text-black/45">MBTI</span>
          <MbtiSlots
            value={draft.mbti}
            onChange={(mbti) => setDraft((current) => ({ ...current, mbti }))}
          />
        </div>
      </div>
    </div>
  );
}

function OneQuestionFlow({
  questionIndex,
  setQuestionIndex,
  answers,
  updateAnswer,
  updateMultipleAnswer,
  uploadProfilePhoto,
  questionFlowError,
}: {
  questionIndex: number;
  setQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  answers: ProfileAnswers;
  updateAnswer: (question: ProfileQuestion, value: string | string[] | number, otherText?: string) => void;
  updateMultipleAnswer: (question: ProfileQuestion, option: string, otherText?: string) => void;
  uploadProfilePhoto: (file: File) => Promise<string>;
  questionFlowError: string | null;
}) {
  const question = mockQuestions[questionIndex];
  const value = answers[question.id];

  const handleOtherTextChange = (text: string) => {
    updateAnswer(question, value?.value ?? "", text);
  };

  const currentComplete = isAnswerComplete(value);
  const autoAdvances = isSingleChoiceQuestion(question);
  const selectedNeedsTextInput = Array.isArray(value?.value)
    ? value.value.some((item) => getQuestionOptionMeta(question, item)?.hasTextInput)
    : typeof value?.value === "string" &&
      Boolean(getQuestionOptionMeta(question, value.value)?.hasTextInput);
  const showNextButton =
    (!autoAdvances || selectedNeedsTextInput) &&
    question.type !== "photo_upload" &&
    questionIndex < mockQuestions.length - 1;

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <QuestionStepCard
            index={questionIndex}
            totalQuestions={mockQuestions.length}
            question={question}
            value={value}
            onAnswer={(nextValue) => {
              updateAnswer(question, nextValue);

              const needsTextInput =
                typeof nextValue === "string" &&
                Boolean(getQuestionOptionMeta(question, nextValue)?.hasTextInput);

              if (autoAdvances && !needsTextInput && questionIndex < mockQuestions.length - 1) {
                window.setTimeout(() => {
                  setQuestionIndex((current) =>
                    Math.min(mockQuestions.length - 1, current + 1),
                  );
                }, 220);
              }
            }}
            onMultipleAnswer={(option) => {
              updateMultipleAnswer(question, option);
            }}
            onOtherTextChange={handleOtherTextChange}
            onPhotoUpload={uploadProfilePhoto}
            questionFlowError={questionFlowError}
          />
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-0 z-20 mt-auto flex items-center justify-between bg-white/95 px-1 py-2 backdrop-blur">
        <button
          type="button"
          aria-label="이전 질문"
          disabled={questionIndex === 0}
          onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full border text-[0px] transition-all",
            questionIndex === 0
              ? "border-transparent text-black/18"
              : "border-transparent text-black/58 hover:text-black",
          )}
        >
          <ChevronLeft
            size={18}
            aria-hidden
            className={cn(
              "absolute",
              questionIndex === 0 ? "text-black/18" : "text-black/58",
            )}
          />
          이전
        </button>

        {showNextButton ? (
          <button
            type="button"
            aria-label="다음 질문"
            disabled={!currentComplete}
            onClick={() => setQuestionIndex((current) => current + 1)}
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-full text-[0px] transition-all",
              currentComplete
                ? "bg-transparent text-black/58 hover:text-black"
                : "bg-transparent text-black/18",
            )}
          >
            <ChevronRight
              size={18}
              aria-hidden
              className={cn("absolute", currentComplete ? "text-black/58" : "text-black/18")}
            />
            다음
          </button>
        ) : (
          <div className="w-12 h-11" />
        )}
      </div>
    </div>
  );
}

function QuestionStepCard({
  question,
  value,
  index,
  totalQuestions,
  onAnswer,
  onMultipleAnswer,
  onOtherTextChange,
  onPhotoUpload,
  questionFlowError,
}: {
  question: ProfileQuestion;
  value?: QuestionAnswer;
  index: number;
  totalQuestions: number;
  onAnswer: (value: string | string[] | number, otherText?: string) => void;
  onMultipleAnswer: (option: string, otherText?: string) => void;
  onOtherTextChange: (text: string) => void;
  onPhotoUpload: (file: File) => Promise<string>;
  questionFlowError: string | null;
}) {
  const ansValue = value?.value;
  const otherText = value?.otherText;
  const options = question.options ?? [];
  const selectedValues = Array.isArray(ansValue)
    ? ansValue
    : typeof ansValue === "string"
      ? [ansValue]
      : [];
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const showOtherInput =
    selectedValues.some((item) => getQuestionOptionMeta(question, item)?.hasTextInput) ||
    (question.type === "singleWithOther" && ansValue === "직접 입력") ||
    (question.type === "multipleWithOther" && Array.isArray(ansValue) && ansValue.includes("직접 입력"));

  const progressPercent = ((index + 1) / totalQuestions) * 100;
  const textValue = typeof ansValue === "string" ? ansValue : "";
  const photoValue =
    typeof ansValue === "string" && ansValue.startsWith("http")
      ? ansValue
      : "";

  const handlePhotoChange = async (file: File | null) => {
    if (!file) return;

    setPhotoError(null);
    setPhotoUploading(true);

    try {
      const photoUrl = await onPhotoUpload(file);
      onAnswer(photoUrl);
    } catch (error) {
      setPhotoError("사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div>
        <div className="mb-5">
          <div className="flex items-center justify-between pr-12">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
              질문 진행도 {index + 1}/{totalQuestions}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    i === index ? "bg-accent w-2.5" : i < index ? "bg-accent/40" : "bg-black/10"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="mb-5">
          <span className="text-[10px] font-bold tracking-wider uppercase text-accent">
            {questionCategories.find((cat) => cat.key === question.category)?.label || question.category}
          </span>
          <h3 className="mt-1 text-lg font-bold leading-6 tracking-tight text-black">
            {question.question}
          </h3>
          {question.description && (
            <p className="mt-1 text-[11px] leading-relaxed text-black/45">
              {question.description}
            </p>
          )}
        </div>

        <div className="mt-3">
          {question.type === "scale" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                {[1, 2, 3, 4, 5].map((num) => {
                  const selected = ansValue === num;

                  return (
                    <motion.button
                      key={num}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => onAnswer(num)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all",
                        selected
                          ? "bg-black text-white shadow-sm"
                          : "bg-transparent text-black/48 hover:bg-black/[0.04] hover:text-black/70",
                      )}
                    >
                      {num}
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {ansValue !== undefined && (
                  <motion.div
                    key={String(ansValue)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-[16px] border border-[#7eb3c7]/20 bg-[#7eb3c7]/5 p-3 min-h-[56px] flex items-center justify-center text-center text-xs font-semibold leading-relaxed text-black/70"
                  >
                    {typeof ansValue === "number"
                      ? getQuestionOptionLabel(options[ansValue - 1] ?? "")
                      : String(ansValue)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {(question.type === "single" ||
            question.type === "singleWithOther" ||
            question.type === "single_choice") && (
            <div className="space-y-2">
              {options.map((option) => {
                const optionValue = getQuestionOptionValue(option);
                const optionLabel = getQuestionOptionLabel(option);
                const selected = ansValue === optionValue;
                return (
                  <motion.button
                    key={optionValue}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => onAnswer(optionValue)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all",
                      selected
                        ? "border-black bg-black text-white shadow-sm"
                      : "border-black/10 bg-white hover:border-black/20 text-black/70"
                    )}
                  >
                    <span>{optionLabel}</span>
                    {selected && <Check size={13} className="text-white" />}
                  </motion.button>
                );
              })}
            </div>
          )}

          {(question.type === "multiple" ||
            question.type === "multipleWithOther" ||
            question.type === "multi_choice") && (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const optionValue = getQuestionOptionValue(option);
                const optionLabel = getQuestionOptionLabel(option);
                const selected =
                  Array.isArray(ansValue) && ansValue.includes(optionValue);
                return (
                  <motion.button
                    key={optionValue}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => onMultipleAnswer(optionValue)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-[10px] font-semibold transition-all",
                      selected
                        ? "border-black bg-black text-white shadow-sm"
                      : "border-black/10 bg-white text-black/60 hover:border-black/20"
                    )}
                  >
                    {optionLabel}
                  </motion.button>
                );
              })}
            </div>
          )}

          {question.type === "text" && (
            <textarea
              value={textValue}
              placeholder={question.placeholder ?? "편하게 적어주세요."}
              onChange={(event) => onAnswer(event.target.value)}
              className="min-h-[148px] w-full resize-none rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-black/25 focus:border-accent"
            />
          )}

          {question.type === "photo_upload" && (
            <div className="space-y-3">
              {photoValue && (
                <div className="relative aspect-[1/1.24] overflow-hidden rounded-[20px] bg-black/[0.04]">
                  <img
                    src={photoValue}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <PhotoUploadField
                inputId={`question-photo-upload-${question.id}`}
                value={
                  photoUploading
                    ? "업로드 중..."
                    : photoValue
                      ? "사진 업로드 완료"
                      : ""
                }
                onChange={handlePhotoChange}
              />
              {(photoError || questionFlowError) && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                  {photoError || questionFlowError}
                </p>
              )}
            </div>
          )}

          <AnimatePresence>
            {showOtherInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
                className="overflow-hidden mt-2"
              >
                <input
                  type="text"
                  placeholder="이곳에 내용을 입력해주세요."
                  value={otherText || ""}
                  onChange={(e) => onOtherTextChange(e.target.value)}
                  className="w-full h-10 rounded-xl border border-black/10 bg-white px-3.5 text-xs outline-none focus:border-accent"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CommunityGuidelinesAgreement({
  error,
  onAgree,
}: {
  error: string | null;
  onAgree: () => Promise<boolean>;
}) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const guidelines: Array<{ Icon: LucideIcon; text: string }> = [
    { Icon: Coffee, text: "과한 음주를 권하거나 분위기로 압박하지 않기" },
    { Icon: Heart, text: "연애나 이성 목적의 접근을 하지 않기" },
    { Icon: MessageCircle, text: "상대가 불편해하는 질문을 반복하지 않기" },
    { Icon: CalendarDays, text: "시간 약속과 응답 약속을 가볍게 여기지 않기" },
    { Icon: Users, text: "모임 후 원치 않는 연락을 강요하지 않기" },
  ];

  const handleAgree = async () => {
    if (!checked || saving) return;

    setSaving(true);
    const success = await onAgree();
    if (!success) {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="pr-12">
        <p className="text-[10px] font-bold uppercase text-accent">
          community guide
        </p>
        <h2 className="mt-1 text-xl font-bold leading-7 text-black">
          좋은 자리를 위해 이것만 약속해주세요
        </h2>
        <p className="mt-2 text-xs leading-5 text-black/45">
          교집합은 편하게 만나되, 서로의 속도와 경계를 존중하는 자리를 지향해요.
        </p>
      </div>

      <div className="mt-6 space-y-2.5">
        {guidelines.map(({ Icon, text }) => (
          <div
            key={text}
            className="flex items-start gap-3 rounded-[18px] border border-black/8 bg-white px-4 py-3"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Icon size={16} aria-hidden />
            </span>
            <p className="pt-1 text-sm font-semibold leading-5 text-black/72">
              {text}
            </p>
          </div>
        ))}
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[18px] border border-black/10 bg-black/[0.02] px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1 h-4 w-4 accent-black"
        />
        <span className="text-xs font-semibold leading-5 text-black/60">
          위 원칙을 확인했고, 초대장 기반 모임에서 서로의 안전과 경계를 존중하겠습니다.
        </span>
      </label>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <motion.button
        whileTap={checked && !saving ? { scale: 0.98 } : undefined}
        type="button"
        disabled={!checked || saving}
        onClick={() => void handleAgree()}
        className={cn(
          "mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition",
          checked && !saving
            ? "bg-black text-white shadow-sm"
            : "bg-black/[0.06] text-black/35",
        )}
      >
        <Check size={16} aria-hidden />
        {saving ? "저장 중..." : "동의하고 초대장 보기"}
      </motion.button>
    </div>
  );
}

function RecommendationReadyV3({
  recommendationMode,
  setRecommendationMode,
  selectedDate,
  selectedDateId,
  setSelectedDateId,
  waitlistRegistration,
  registerWaitlist,
  onOpenTickets,
}: {
  recommendationMode: RecommendationMode;
  setRecommendationMode: (mode: RecommendationMode) => void;
  selectedDate?: AvailableDate;
  selectedDateId: string | null;
  setSelectedDateId: (dateId: string | null) => void;
  waitlistRegistration: WaitlistRegistration | null;
  registerWaitlist: (ticket: GatheringTicket) => void;
  onOpenTickets: () => void;
}) {
  const [currentRecommendationIndex, setCurrentRecommendationIndex] =
    useState(0);
  const currentSelectedDate = resolveSelectedDate(selectedDateId, selectedDate);
  const currentInvitation =
    currentSelectedDate?.tickets[currentRecommendationIndex];

  const returnToCalendar = () => {
    setRecommendationMode("calendar");
    setSelectedDateId(null);
    setCurrentRecommendationIndex(0);
  };

  const openDateRecommendations = (dateId: string) => {
    const nextDate = availableDates.find((item) => item.id === dateId);
    setSelectedDateId(dateId);
    setCurrentRecommendationIndex(0);

    if (!nextDate || nextDate.tickets.length === 0) {
      returnToCalendar();
      return;
    }

    setRecommendationMode("drawing");
  };

  const handleNo = () => {
    if (!currentSelectedDate) return;
    const nextIndex = currentRecommendationIndex + 1;

    if (nextIndex >= currentSelectedDate.tickets.length) {
      returnToCalendar();
      return;
    }

    setCurrentRecommendationIndex(nextIndex);
    setRecommendationMode("drawing");
  };

  const handleYes = () => {
    if (!currentInvitation) return;
    registerWaitlist(currentInvitation);
    setRecommendationMode("detail");
  };

  return (
    <AnimatePresence mode="wait">
      {recommendationMode === "calendar" ? (
        <motion.section
          key="invitation-calendar"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-4"
        >
          <div className="pr-12">
            <p className="text-[10px] font-bold uppercase text-accent">
              invitation date
            </p>
            <h2 className="mt-1 text-lg font-bold text-black">
              어느 날의 초대장을 받아볼까요?
            </h2>
            <p className="mt-1 text-xs leading-5 text-black/45">
              날짜를 고르면 교집합이 어울리는 자리를 하나씩 준비해드려요.
            </p>
          </div>

          <CalendarSelectorV3
            selectedDateId={selectedDateId}
            onSelect={openDateRecommendations}
          />
        </motion.section>
      ) : recommendationMode === "drawing" &&
        currentSelectedDate &&
        currentInvitation ? (
        <TicketDrawingLoader
          key={`drawing-${currentInvitation.id}`}
          selectedDate={currentSelectedDate}
          ticket={currentInvitation}
          onYes={handleYes}
          onNo={handleNo}
          onChangeDate={() => returnToCalendar()}
        />
      ) : recommendationMode === "detail" && waitlistRegistration ? (
        <InvitationDetailView
          key={`detail-${waitlistRegistration.ticket.id}`}
          registration={waitlistRegistration}
          onBackToTickets={onOpenTickets}
        />
      ) : (
        <motion.div
          key="recommendation-recovery"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 text-center"
        >
          <p className="text-sm font-semibold text-black/60">
            초대장을 다시 준비하고 있어요.
          </p>
          <button
            type="button"
            onClick={() => returnToCalendar()}
            className="mt-4 text-xs font-bold text-black underline underline-offset-4"
          >
            날짜 다시 고르기
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function resolveSelectedDate(dateId: string | null, fallback?: AvailableDate) {
  return availableDates.find((item) => item.id === dateId) ?? fallback;
}

function InvitationDetailView({
  registration,
  onBackToTickets,
}: {
  registration: WaitlistRegistration;
  onBackToTickets: () => void;
}) {
  const { ticket } = registration;
  const visual = getTicketVisual(ticket);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="pb-5"
    >
      <div className="flex items-start gap-3 pr-12">
        <button
          type="button"
          aria-label="내 티켓으로 돌아가기"
          title="내 티켓으로 돌아가기"
          onClick={onBackToTickets}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/60"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase text-accent">
            waitlist received
          </p>
          <h2 className="mt-1 text-lg font-bold text-black">
            초대장 신청이 접수되었어요
          </h2>
        </div>
      </div>

      <div className="relative mt-5 aspect-[16/10] overflow-hidden rounded-[20px] bg-black">
        <Image
          src={visual.image}
          alt={visual.mood}
          fill
          priority
          sizes="390px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-black/8 to-black/75" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <span className="inline-flex rounded-full border border-white/30 bg-black/20 px-2.5 py-1 text-[9px] font-bold backdrop-blur-sm">
            대기 등록
          </span>
          <h3 className="mt-1 text-[24px] font-bold leading-7">{ticket.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-white/72">
            <span>{ticket.date.slice(5).replace("-", ".")}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/50" />
            <span>{ticket.time}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/50" />
            <span>{ticket.area}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 border-y border-accent/30 bg-accent/[0.07] px-4 py-4">
        <div className="flex items-center gap-2">
          <Check size={15} className="text-accent" aria-hidden />
          <p className="text-xs font-bold text-black/70">대기 등록이 완료됐어요</p>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-black/48">
          교집합이 자리 구성을 확인한 뒤 참여 가능 여부와 결제 안내를
          보내드릴게요.
        </p>
      </div>

      <section className="mt-5">
          <p className="text-[10px] font-bold text-accent">이후 진행 순서</p>
          <div className="mt-3 space-y-3">
            {[
              "교집합이 자리 구성을 확인해요.",
              "참여 가능 시 결제 안내를 보내드려요.",
              "결제가 완료되면 최종 참여가 확정돼요.",
            ].map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-xs leading-5 text-black/60">{step}</p>
              </div>
            ))}
          </div>
      </section>
    </motion.section>
  );
}

function CalendarSelectorV3({
  selectedDateId,
  onSelect,
  ticketRatio = true,
}: {
  selectedDateId: string | null;
  onSelect: (dateId: string) => void;
  ticketRatio?: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState<"june" | "july">(
    selectedDateId === "date-2026-07-04" ? "july" : "june"
  );

  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

  const getDateEntry = (month: "june" | "july", day: number) => {
    const monthNumber = month === "june" ? "06" : "07";
    const date = `2026-${monthNumber}-${String(day).padStart(2, "0")}`;
    return availableDates.find((item) => item.date === date);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-[24px] border border-black/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.01)]",
        ticketRatio ? "aspect-[1/1.62] overflow-hidden p-4" : "p-5",
      )}
    >
      <div className={cn("flex items-center justify-between", ticketRatio ? "mb-3" : "mb-4")}>
        <h3 className="text-sm font-bold text-black">
          {currentMonth === "june" ? "2026년 6월" : "2026년 7월"}
        </h3>
        <div className="flex gap-1 bg-black/[0.04] p-1 rounded-full text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setCurrentMonth("june")}
            className={cn(
              "px-3 py-1 rounded-full transition-all",
              currentMonth === "june" ? "bg-white text-black shadow-sm" : "text-black/40"
            )}
          >
            6월
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth("july")}
            className={cn(
              "px-3 py-1 rounded-full transition-all",
              currentMonth === "july" ? "bg-white text-black shadow-sm" : "text-black/40"
            )}
          >
            7월
          </button>
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-7 gap-1 text-center font-bold text-black/35",
        ticketRatio ? "mb-2 text-[9px]" : "mb-2.5 text-[10px]",
      )}>
        {weekdays.map((w) => (
          <span key={w} className="py-0.5">{w}</span>
        ))}
      </div>

      <div className={cn("grid grid-cols-7 text-center", ticketRatio ? "gap-1.5" : "gap-2")}>
        {Array.from({ length: currentMonth === "june" ? 0 : 2 }).map((_, idx) => (
          <span key={`empty-${idx}`} />
        ))}

        {Array.from({ length: currentMonth === "june" ? 30 : 31 }).map((_, idx) => {
          const day = idx + 1;
          const dateEntry = getDateEntry(currentMonth, day);
          const selectable = Boolean(dateEntry);
          const dateId = dateEntry?.id ?? "";
          const selected = selectedDateId === dateId && dateId !== "";

          return (
            <motion.button
              key={`day-${day}`}
              whileTap={selectable ? { scale: 0.9 } : undefined}
              onClick={() => {
                if (selectable) onSelect(dateId);
              }}
              type="button"
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-full font-semibold transition-all border",
                ticketRatio ? "text-[10px]" : "text-xs",
                selectable
                  ? "cursor-pointer border-black/10 text-black hover:border-black/30 bg-white"
                  : "border-transparent text-black/15 pointer-events-none"
              )}
              animate={selected ? { scale: 1.15 } : { scale: 1 }}
            >
              {day}

              {selectable && !selected && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#7eb3c7] shadow-sm" />
              )}

              <AnimatePresence>
                {selected && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.85 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", damping: 9, stiffness: 220 }}
                    className="absolute inset-0 bg-[#7eb3c7] rounded-full -z-10"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      <p className={cn(
        "text-center font-medium leading-relaxed text-black/35",
        ticketRatio ? "mt-3 text-[9px]" : "mt-4 text-[10px]",
      )}>
        * 파란 점이 있는 날짜를 탭하면 교집합이 초대장을 준비해드려요.
      </p>
    </motion.section>
  );
}

// ==========================================
// 8. PROFILE TAB & EDITORS
// ==========================================

function ProfileTabV2({
  user,
  answers,
  updateAnswer,
  updateMultipleAnswer,
  questionGroups,
  editingCategory,
  setEditingCategory,
}: {
  user: UserProfile;
  answers: ProfileAnswers;
  updateAnswer: (question: ProfileQuestion, value: string | string[] | number, otherText?: string) => void;
  updateMultipleAnswer: (question: ProfileQuestion, option: string, otherText?: string) => void;
  questionGroups: Record<QuestionCategory, ProfileQuestion[]>;
  editingCategory: QuestionCategory | null;
  setEditingCategory: (category: QuestionCategory | null) => void;
}) {
  const categories = Object.keys(questionGroups) as QuestionCategory[];

  return (
    <TabMotion>
      <section className="space-y-6">
        <div className="pr-12">
          <p className="text-[10px] font-bold uppercase text-accent">
            question cards
          </p>
          <h1 className="mt-1 text-xl font-bold text-black">
            {user.nickname}님의 질문 카드첩
          </h1>
          <p className="mt-1 text-xs leading-5 text-black/45">
            카드를 열어 답변을 확인하거나 수정할 수 있어요.
          </p>
        </div>

        <section>
          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            {categories.map((category) => {
              const Icon = categoryIcons[category];
              const completeCount = questionGroups[category].filter((question) =>
                isAnswerComplete(answers[question.id]),
              ).length;
              const selected = editingCategory === category;
              const categoryMeta = questionCategories.find((cat) => cat.key === category);
              const label = categoryMeta ? categoryMeta.label : category;

              return (
                <button
                  key={category}
                  type="button"
                  title={`${label} 답변 수정`}
                  aria-label={`${label} 답변 수정`}
                  onClick={() => setEditingCategory(selected ? null : category)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold transition-all",
                    selected
                      ? "border-black bg-black text-white shadow-sm"
                      : "border-black/10 bg-white text-black/55 hover:border-black/20",
                  )}
                >
                  <Icon size={18} aria-hidden />
                  <span className="scale-95">{label}</span>
                  <span className="text-[9px] font-medium opacity-65">
                    {completeCount}/{questionGroups[category].length}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {editingCategory && (
            <motion.section
              key={editingCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border-t border-black/10 pt-5 space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-black">
                  {questionCategories.find((cat) => cat.key === editingCategory)?.label || editingCategory} 카드 목록
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/55"
                >
                  목록 접기
                </button>
              </div>

              <div className="space-y-3">
                {questionGroups[editingCategory].map((question, index) => (
                  <QuestionItem
                    key={question.id}
                    index={index}
                    question={question}
                    value={answers[question.id]}
                    updateAnswer={updateAnswer}
                    updateMultipleAnswer={updateMultipleAnswer}
                    compact
                  />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </section>
    </TabMotion>
  );
}

function QuestionItem({
  question,
  value,
  index,
  updateAnswer,
  updateMultipleAnswer,
  compact = false,
}: {
  question: ProfileQuestion;
  value?: QuestionAnswer;
  index: number;
  updateAnswer: (question: ProfileQuestion, value: string | string[] | number, otherText?: string) => void;
  updateMultipleAnswer: (question: ProfileQuestion, option: string, otherText?: string) => void;
  compact?: boolean;
}) {
  const ansValue = value?.value;
  const otherText = value?.otherText;
  const options = question.options ?? [];
  const selectedValues = Array.isArray(ansValue)
    ? ansValue
    : typeof ansValue === "string"
      ? [ansValue]
      : [];

  const showOtherInput =
    selectedValues.some((item) => getQuestionOptionMeta(question, item)?.hasTextInput) ||
    (question.type === "singleWithOther" && ansValue === "직접 입력") ||
    (question.type === "multipleWithOther" && Array.isArray(ansValue) && ansValue.includes("직접 입력"));

  return (
    <article
      className={cn(
        "rounded-[22px] border border-black/10 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.01)]",
        compact && "p-3.5",
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold text-accent tracking-wider uppercase">
            {questionCategories.find((cat) => cat.key === question.category)?.label || question.category}
          </p>
          <h3
            className={cn(
              "mt-0.5 font-bold leading-5 text-black/85",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {question.question}
          </h3>
          {question.description && (
            <p className="mt-1 text-[10px] leading-relaxed text-black/40">
              {question.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5">
        {question.type === "scale" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              {[1, 2, 3, 4, 5].map((num) => {
                const selected = ansValue === num;

                return (
                  <motion.button
                    key={num}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => updateAnswer(question, num, otherText)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                      selected
                        ? "bg-black text-white shadow-sm"
                        : "bg-transparent text-black/45 hover:bg-black/[0.04] hover:text-black/70",
                    )}
                  >
                    {num}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {ansValue !== undefined && (
                <motion.div
                  key={String(ansValue)}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="rounded-xl border border-[#7eb3c7]/20 bg-[#7eb3c7]/5 p-2.5 text-center text-[10px] font-semibold leading-relaxed text-black/70"
                >
                  {typeof ansValue === "number"
                    ? getQuestionOptionLabel(options[ansValue - 1] ?? "")
                    : String(ansValue)}
                </motion.div>
              )}
            </AnimatePresence>

            {false && question.allowPrivate && options.length > 5 && (
              <div className="flex justify-center gap-1 pt-1">
                {options.slice(5).map((opt) => {
                  const optionValue = getQuestionOptionValue(opt);
                  const optionLabel = getQuestionOptionLabel(opt);
                  const selected = ansValue === optionValue;
                  return (
                    <button
                      key={optionValue}
                      type="button"
                      onClick={() => updateAnswer(question, optionValue, otherText)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[9px] font-semibold transition-all border",
                        selected
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white text-black/50 hover:border-black/20"
                      )}
                    >
                      {optionLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(question.type === "single" ||
          question.type === "singleWithOther" ||
          question.type === "single_choice") && (
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const optionValue = getQuestionOptionValue(option);
              const optionLabel = getQuestionOptionLabel(option);
              const selected = ansValue === optionValue;
              return (
                <ChipButton
                  key={optionValue}
                  selected={selected}
                  onClick={() => updateAnswer(question, optionValue, otherText)}
                >
                  {optionLabel}
                </ChipButton>
              );
            })}
          </div>
        )}

        {(question.type === "multiple" ||
          question.type === "multipleWithOther" ||
          question.type === "multi_choice") && (
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const optionValue = getQuestionOptionValue(option);
              const optionLabel = getQuestionOptionLabel(option);
              const selected =
                Array.isArray(ansValue) && ansValue.includes(optionValue);
              return (
                <ChipButton
                  key={optionValue}
                  selected={selected}
                  onClick={() => updateMultipleAnswer(question, optionValue, otherText)}
                >
                  {optionLabel}
                </ChipButton>
              );
            })}
          </div>
        )}

        {question.type === "text" && (
          <textarea
            value={typeof ansValue === "string" ? ansValue : ""}
            placeholder={question.placeholder ?? "편하게 적어주세요."}
            onChange={(event) =>
              updateAnswer(question, event.target.value, otherText)
            }
            className="min-h-[120px] w-full resize-none rounded-[16px] border border-black/10 bg-white px-3 py-2.5 text-xs leading-5 outline-none placeholder:text-black/25 focus:border-accent"
          />
        )}

        {question.type === "photo_upload" && (
          <div className="rounded-[16px] border border-black/10 bg-black/[0.02] px-3.5 py-3 text-[11px] font-semibold leading-5 text-black/50">
            {ansValue ? "사진이 등록되어 있어요. 수정은 우측 상단 프로필 버튼에서 할 수 있어요." : "사진이 아직 등록되지 않았어요."}
          </div>
        )}

        <AnimatePresence>
          {showOtherInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden mt-2"
            >
              <input
                type="text"
                placeholder="이곳에 직접 내용을 적어주세요."
                value={otherText || ""}
                onChange={(e) => updateAnswer(question, ansValue ?? "", e.target.value)}
                className="w-full h-9 rounded-xl border border-black/10 bg-white px-3 text-[11px] outline-none focus:border-accent"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

// ==========================================
// 9. HELPER UTILS
// ==========================================

function LabeledInput({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/45">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition placeholder:text-black/25 focus:border-accent"
      />
    </label>
  );
}

function SegmentedField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-black/45">{label}</legend>
      <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 rounded-2xl border px-2 text-xs font-semibold transition",
              value === option
                ? "border-accent bg-accent/10 text-black"
                : "border-black/10 text-black/45 bg-white hover:border-black/20",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ChipButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-all",
        selected
          ? "border-black bg-black text-white shadow-sm"
          : "border-black/10 bg-white text-black/50 hover:border-black/20",
      )}
    >
      {children}
    </motion.button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="shrink-0 text-xs font-semibold text-black/45">
        {label}
      </span>
      <span className="text-right text-xs font-semibold text-black/70">
        {value}
      </span>
    </div>
  );
}

function TabMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
