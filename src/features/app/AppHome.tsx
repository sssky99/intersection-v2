"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  LogOut,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  X,
  PenLine,
  Sparkles,
  Ticket as TicketIcon,
  UserRound,
  WandSparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
import { SafeImage } from "@/components/SafeImage";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
  IntersectionTicketCard,
} from "@/components/IntersectionTicketCard";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import { VibeAxisBar, VibeGraph } from "@/components/vibe/VibeGraph";
import {
  vibeAxisConfig,
  type VibeAxis,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";
import {
  preferenceQuestions,
  usesPreferenceProfile,
} from "@/data/preferenceQuestions";
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
import { profileQuestions } from "@/data/profileQuestions";
import {
  MatchingLoader,
  MeetingRecommendation,
} from "@/features/meetings/MeetingRecommendation";
import { useDragScroll } from "@/features/app/useDragScroll";
import {
  CompactParticipationSparkleProgress,
  ParticipationProgressOverlay,
} from "@/features/app/ParticipationSparkleProgress";
import { PreferenceProfileTab } from "@/features/app/PreferenceProfileTab";
import { ProfileUpgradeLockedTab } from "@/features/app/ProfileUpgradeLockedTab";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import { OnboardingGuidePreview } from "@/features/onboarding/OnboardingGuidePreview";
import { ProfileQuestionSectionOverlay } from "@/features/app/ProfileQuestionSectionOverlay";
import { AlgorithmParametersOverlay } from "@/features/app/AlgorithmParametersOverlay";
import {
  TicketDetailContent,
  type TicketDetailSectionKey,
} from "@/features/meetings/TicketDetailContent";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import {
  displayMembershipStatus,
  hasCurrentMembershipAccess,
} from "@/features/membership/membershipTypes";
import {
  identifyAnalyticsUser,
  trackEvent,
  trackLoginSuccessFromUrl,
} from "@/lib/analytics";
import {
  canCancelMeetingDateApplication,
  meetingDateApplicationMatchesTicket,
  meetingDateApplicationStatusLabels,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { createClient } from "@/lib/supabase/client";
import {
  ticketFeedbackBodyText,
  ticketStageText,
} from "@/lib/ticketStageCopy";
import { courseStepOpenOffsetMinutes } from "@/lib/ticketCourse";
import { ticketStartAtInKst } from "@/lib/ticketDate";
import {
  clearGuestTicketInteractions,
  isGuestImportTicketInteractionStatus,
  loadGuestTicketInteractions,
  saveGuestTicketInteraction,
  ticketInteractionBadgeLabel,
  ticketInteractionCanRespond,
  ticketInteractionShowsDeadline,
  ticketInteractionStatusLabel,
} from "@/lib/ticketInteractions";
import type { ProfileRow } from "@/types/profile";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type { ProfileQuestion, QuestionAnswer } from "@/types/question";
import type {
  GatheringTicket,
  TicketArrivalStatus,
  TicketInteraction,
  TicketPlace,
  TicketProgressStep,
  UserTicket,
  UserTicketStatus,
  UserTicketsResponse,
} from "@/types/ticket";
import type { Gender } from "@/types/user";
import type { LucideIcon } from "lucide-react";

const LazyMeetingChat = dynamic(
  () => import("@/features/chat/MeetingChat").then((module) => module.MeetingChat),
  {
    ssr: false,
    loading: () => <ChatTabLoading />,
  },
);

const LazyProfileTab = dynamic(
  () => import("@/features/app/ProfileTab").then((module) => module.ProfileTab),
  {
    ssr: false,
    loading: () => <ProfileTabLoading />,
  },
);

export type AppTab = "browse" | "recommend" | "chat" | "profile";

export type OperatorAccountSwitcher =
  | {
      mode: "operator";
      accounts: Array<{ userId: string; name: string }>;
    }
  | {
      mode: "test";
    }
  | null;

type AnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};

type AnswerMap = Record<number, QuestionAnswer>;

type BasicInfoDraft = {
  nickname: string;
  name: string;
  phone: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
};

const basicInfoBirthYearOptions = Array.from(
  { length: 2007 - 1980 + 1 },
  (_, index) => String(1980 + index),
);

const profileVibeAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
] as const satisfies readonly VibeAxis[];
type ProfileVibeAxis = (typeof profileVibeAxes)[number];
type MeetingRatingKey = "firstPlace" | "secondPlace";
type MeetingRatings = Record<MeetingRatingKey, number | null>;

const tabItems: Array<{ id: AppTab; label: string; Icon: LucideIcon }> = [
  { id: "recommend", label: "신청", Icon: Sparkles },
  { id: "browse", label: "티켓", Icon: TicketIcon },
  { id: "chat", label: "채팅", Icon: MessageCircle },
];

const appTabPositions: Record<AppTab, number> = {
  recommend: 0,
  browse: 1,
  chat: 2,
  profile: 3,
};

const algorithmQuestionSections = [
  { id: "background", questions: profileSectionBackgroundQuestions },
  { id: "activity", questions: profileSectionActivityQuestions },
  { id: "interest", questions: profileSectionInterestQuestions },
  { id: "values", questions: profileSectionValuesQuestions },
  { id: "preference", questions: profileSectionPreferenceQuestions },
  { id: "value", questions: profileSectionValueQuestions },
  { id: "traits", questions: profileSectionTraitsQuestions },
  { id: "self", questions: profileSectionSelfQuestions },
] as const;
type AlgorithmQuestionSectionId =
  | (typeof algorithmQuestionSections)[number]["id"]
  | "basic";
const profileQuestionSectionSequence = [
  "basic",
  "background",
  "activity",
  "interest",
  "values",
  "preference",
  "value",
  "traits",
  "self",
] as const;
const profileQuestionSectionLabels: Record<
  (typeof profileQuestionSectionSequence)[number],
  string
> = {
  basic: "코어 질문",
  background: "배경",
  activity: "활동성",
  interest: "흥미",
  values: "관점",
  preference: "선호",
  value: "가치",
  traits: "성향",
  self: "자기정보",
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "미입력";
  return String(value);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8210")) return `0${digits.slice(2)}`;
  if (digits.startsWith("82") && digits.length > 10) return `0${digits.slice(2)}`;
  return digits;
}

function rowToAnswer(
  row: AnswerRow,
  questions: ProfileQuestion[] = profileQuestions,
): QuestionAnswer {
  const question = questions.find(
    (item) => (item.order ?? item.id) === row.question_order,
  );
  const optionValues = new Set(
    (question?.options ?? []).map((option) =>
      typeof option === "string" ? option : option.value,
    ),
  );
  const storedValue = question
    ? row.answer_values ??
      (question.type === "text"
        ? row.answer_text ?? row.answer_value ?? ""
        : row.answer_value ?? "")
    : "";
  const value =
    question?.type === "single_choice"
      ? typeof storedValue === "string" &&
        optionValues.has(storedValue)
        ? storedValue
        : ""
      : question?.type === "multi_choice"
        ? (Array.isArray(storedValue) ? storedValue : [storedValue])
            .filter((item): item is string => typeof item === "string")
            .filter((item) => optionValues.has(item))
      : storedValue;

  return {
    questionId: question?.id ?? row.question_order,
    value,
    otherText: row.other_text ?? undefined,
  };
}

function answerScore(answer?: QuestionAnswer) {
  const value =
    typeof answer?.value === "number"
      ? answer.value
      : typeof answer?.value === "string"
        ? Number.parseInt(answer.value, 10)
        : null;

  if (value === null || !Number.isFinite(value)) return null;
  return value >= 1 && value <= 5 ? value : null;
}

function clampInternalScore(value: number) {
  return Math.min(100, Math.max(-100, value));
}

function answerScoreToInternalScore(value: number | null) {
  return value === null ? null : clampInternalScore((value - 3) * 50);
}

const profileScoreColumns = {
  temperature: "score_temperature",
  texture: "score_texture",
  tone: "score_tone",
  rhythm: "score_rhythm",
} as const satisfies Record<ProfileVibeAxis, keyof ProfileRow>;

function currentProfileScore(profile: ProfileRow, axis: ProfileVibeAxis) {
  const value = profile[profileScoreColumns[axis]];
  return typeof value === "number" && Number.isFinite(value)
    ? clampInternalScore(value)
    : null;
}

function profileAxisScore(
  profile: ProfileRow,
  answers: AnswerMap,
  axis: ProfileVibeAxis,
  answerOrder: number,
) {
  return (
    currentProfileScore(profile, axis) ??
    answerScoreToInternalScore(answerScore(answers[answerOrder])) ??
    0
  );
}

function profileVibeScores(profile: ProfileRow, answers: AnswerMap): VibeScores {
  return {
    temperature: profileAxisScore(profile, answers, "temperature", 6),
    texture: profileAxisScore(profile, answers, "texture", 7),
    tone: profileAxisScore(profile, answers, "tone", 8),
    rhythm: profileAxisScore(profile, answers, "rhythm", 9),
  };
}

function profileName(profile: ProfileRow) {
  return profile.name?.trim() || "나";
}

function profileInitial(profile: ProfileRow) {
  return profileNickname(profile);
}

function fallbackNickname(name: string | null | undefined) {
  const korean = (name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || "??";
}

function profileNickname(profile: Pick<ProfileRow, "name" | "nickname">) {
  const nickname = profile.nickname?.trim();
  return nickname && /^[가-힣]{2}$/.test(nickname)
    ? nickname
    : fallbackNickname(profile.name);
}

function isValidNickname(value: string) {
  return /^[가-힣]{2}$/.test(value.trim());
}

function isValidBasicInfoBirthYear(value: string) {
  return basicInfoBirthYearOptions.includes(value);
}

function setTabUrl(tab: AppTab) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("profileComplete");
  if (tab === "recommend") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  window.history.replaceState(null, "", url.toString());
}

function hasStoredAnswer(row: AnswerRow) {
  return Boolean(
    row.answer_text || row.answer_value || row.answer_values?.length,
  );
}

function answeredQuestionCount(
  rows: AnswerRow[],
  questions: ProfileQuestion[],
) {
  const questionOrders = new Set(
    questions.map((question) => question.order ?? question.id),
  );
  return rows.filter(
    (row) => questionOrders.has(row.question_order) && hasStoredAnswer(row),
  ).length;
}

const userTicketsCacheTtlMs = 20_000;
const initialUserTicketsLimit = 3;
const userTicketsCache = new Map<
  string,
  { response: UserTicketsResponse; expiresAt: number }
>();
const userTicketsRequests = new Map<string, Promise<UserTicketsResponse | null>>();

type FetchUserTicketsOptions = {
  force?: boolean;
  limit?: number;
  offset?: number;
  scope?: string;
};

function userTicketsRequestKey({
  limit,
  offset = 0,
  scope = "anonymous",
}: FetchUserTicketsOptions) {
  return `${scope}:${offset}:${limit ?? "all"}`;
}

function userTicketsRequestPath({ limit, offset = 0 }: FetchUserTicketsOptions) {
  const params = new URLSearchParams();
  if (typeof limit === "number") params.set("limit", String(limit));
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/api/meetings/my-tickets?${query}` : "/api/meetings/my-tickets";
}

function mergeUserTickets(current: UserTicket[], incoming: UserTicket[]) {
  const merged = new Map(current.map((ticket) => [ticket.id, ticket]));
  for (const ticket of incoming) {
    merged.set(ticket.id, ticket);
  }
  return Array.from(merged.values());
}

async function fetchUserTickets(options: FetchUserTicketsOptions = {}) {
  const { force = false } = options;
  const key = userTicketsRequestKey(options);
  const cached = userTicketsCache.get(key);

  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  const existingRequest = userTicketsRequests.get(key);
  if (!force && existingRequest) return existingRequest;

  const request = fetch(userTicketsRequestPath(options), { cache: "no-store" })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | Partial<UserTicketsResponse>
        | null;

      if (!response.ok) return null;

      const responseData: UserTicketsResponse = {
        tickets: data?.tickets ?? [],
        participationCount:
          typeof data?.participationCount === "number"
            ? data.participationCount
            : 0,
        totalCount:
          typeof data?.totalCount === "number" ? data.totalCount : undefined,
        hasMore: data?.hasMore === true,
        nextOffset:
          typeof data?.nextOffset === "number" ? data.nextOffset : null,
      };
      userTicketsCache.set(key, {
        response: responseData,
        expiresAt: Date.now() + userTicketsCacheTtlMs,
      });

      return responseData;
    })
    .catch(() => null)
    .finally(() => {
      userTicketsRequests.delete(key);
    });

  userTicketsRequests.set(key, request);
  return request;
}

async function fetchBlindDateOffers() {
  const response = await fetch("/api/meetings/blind-dates").catch(() => null);
  if (!response) return null;

  const data = (await response.json().catch(() => null)) as
    | { offers?: BlindDateUserOffer[] }
    | null;

  return response.ok ? data?.offers ?? [] : null;
}

export function AppHome({
  userId,
  profile,
  initialTab = "recommend",
  initialFeedbackParticipationId = null,
  initialProfileAccountOpen = false,
  initialLegacyResultPreview = false,
  operatorAccountSwitcher = null,
  guestMode = false,
  initialAnswerRows = [],
  readOnlyView = null,
  onRequestBasicInfo,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
}: {
  userId: string;
  profile: ProfileRow;
  initialTab?: AppTab;
  initialFeedbackParticipationId?: string | null;
  initialProfileAccountOpen?: boolean;
  initialLegacyResultPreview?: boolean;
  operatorAccountSwitcher?: OperatorAccountSwitcher;
  guestMode?: boolean;
  initialAnswerRows?: AnswerRow[];
  readOnlyView?: { targetName: string } | null;
  onRequestBasicInfo?: (meetingDate?: string) => void;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
}) {
  const readOnly = Boolean(readOnlyView);
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [waitlistedTickets, setWaitlistedTickets] = useState<UserTicket[]>([]);
  const [waitlistedTicketCount, setWaitlistedTicketCount] = useState<
    number | null
  >(null);
  const [dateApplications, setDateApplications] = useState<
    MeetingDateApplication[]
  >([]);
  const [loadingRemainingTickets, setLoadingRemainingTickets] = useState(false);
  const [participationCount, setParticipationCount] = useState(0);
  const [participationProgressOpen, setParticipationProgressOpen] =
    useState(false);
  const [blindDateOffers, setBlindDateOffers] = useState<BlindDateUserOffer[]>([]);
  const [blindDateOffersLoaded, setBlindDateOffersLoaded] = useState(guestMode);
  const [blindDateOpenRequestId, setBlindDateOpenRequestId] = useState(0);
  const [blindDateOpenRequestPending, setBlindDateOpenRequestPending] =
    useState(false);
  const [blindDateOpenRequestOfferId, setBlindDateOpenRequestOfferId] =
    useState<string | null>(null);
  const [blindDateOpenRequestSkipUnlock, setBlindDateOpenRequestSkipUnlock] =
    useState(false);
  const [blindDateReturnSettling, setBlindDateReturnSettling] = useState(false);
  const [answerRows, setAnswerRows] = useState<AnswerRow[]>(initialAnswerRows);
  const [algorithmParametersOpen, setAlgorithmParametersOpen] = useState(false);
  const [algorithmQuestionAnswering, setAlgorithmQuestionAnswering] =
    useState(false);
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    Object.fromEntries(
      initialAnswerRows.map((row) => {
        const answer = rowToAnswer(row, preferenceQuestions);
        return [answer.questionId, answer];
      }),
    ) as AnswerMap,
  );
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [readOnlyControlOpen, setReadOnlyControlOpen] = useState(false);
  const preferenceProfileEnabled = usesPreferenceProfile(currentProfile);
  const profileQuestionsReady = currentProfile.questions_completed === true;
  const recommendationProfileReady = true;
  const algorithmQuestionProgress = useMemo(() => {
    const sections = algorithmQuestionSections.map((section) => ({
      ...section,
      answeredCount: answeredQuestionCount(answerRows, section.questions),
    }));
    const questionCount = sections.reduce(
      (total, section) => total + section.questions.length,
      0,
    );
    const answeredQuestionTotal = sections.reduce(
      (total, section) => total + section.answeredCount,
      0,
    );
    const photoCompleted = Boolean(currentProfile.photo_url);
    const totalCount = questionCount + 1;
    const answeredCount = answeredQuestionTotal + (photoCompleted ? 1 : 0);
    const completionPercent = totalCount
      ? Math.min(100, Math.round((answeredCount / totalCount) * 100))
      : 0;
    const nextSectionId: AlgorithmQuestionSectionId | null =
      sections.find(
        (section) => section.answeredCount < section.questions.length,
      )?.id ?? (!photoCompleted ? "basic" : null);

    return {
      totalCount,
      answeredCount,
      completionPercent,
      unlocked: completionPercent >= 80,
      nextSectionId,
    };
  }, [answerRows, currentProfile.photo_url]);
  const [profileVibeAnimationKey, setProfileVibeAnimationKey] = useState(0);
  const [questionReviewOpen, setQuestionReviewOpen] = useState(false);
  const [questionReviewStartIndex, setQuestionReviewStartIndex] = useState<
    number | "photo" | "guide" | null
  >(null);
  const [profileQuestionSection, setProfileQuestionSection] = useState<
    | "basic"
    | "background"
    | "activity"
    | "interest"
    | "values"
    | "preference"
    | "value"
    | "traits"
    | "self"
    | null
  >(null);
  const [profileRegenerating, setProfileRegenerating] = useState(false);
  const [profileRegenerationError, setProfileRegenerationError] = useState<
    string | null
  >(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );
  const [accountSwitchError, setAccountSwitchError] = useState<string | null>(
    null,
  );
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatRoomOpen, setChatRoomOpen] = useState(false);
  const [recommendationFocusMode, setRecommendationFocusMode] = useState(false);
  const [recommendationBottomNavHidden, setRecommendationBottomNavHidden] =
    useState(false);
  const [profileBottomNavHidden, setProfileBottomNavHidden] = useState(false);
  const [ticketTabFocusMode, setTicketTabFocusMode] = useState(false);
  const [availableMeetingTickets, setAvailableMeetingTickets] = useState<
    GatheringTicket[]
  >([]);
  const [ticketInteractions, setTicketInteractions] = useState<
    TicketInteraction[]
  >([]);
  const [initialTicketsLoaded, setInitialTicketsLoaded] = useState(guestMode);
  const [ticketInteractionsLoaded, setTicketInteractionsLoaded] =
    useState(guestMode);
  const [ticketAcceptRequest, setTicketAcceptRequest] = useState<{
    id: number;
    ticketId: string;
  } | null>(null);
  const [ticketTabFocusRequest, setTicketTabFocusRequest] = useState<{
    id: number;
    ticketId: string;
  } | null>(null);
  const [replayedDeclinedTicket, setReplayedDeclinedTicket] =
    useState<GatheringTicket | null>(null);
  const recommendTabTrackedRef = useRef(false);
  const profileTabTrackedRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const recommendationMembershipStatus = useMemo(() => {
    if (
      hasCurrentMembershipAccess({
        status: currentProfile.membership_status,
        startDate: currentProfile.membership_start_date,
        endDate: currentProfile.membership_end_date,
      })
    ) {
      return "active" as const;
    }

    return displayMembershipStatus({
      status: currentProfile.membership_status,
      endDate: currentProfile.membership_end_date,
    });
  }, [
    currentProfile.membership_end_date,
    currentProfile.membership_start_date,
    currentProfile.membership_status,
  ]);
  const pendingBlindDateOfferCount = useMemo(
    () =>
      blindDateOffers.filter(
        (offer) =>
          !offer.isExpired &&
          offer.ownResponse === "pending" &&
          ["offered", "waiting_response"].includes(offer.status),
      ).length,
    [blindDateOffers],
  );
  const activeBlindDateOfferCount = useMemo(
    () =>
      blindDateOffers.filter(
        (offer) =>
          !offer.isExpired &&
          ["offered", "waiting_response", "scheduled", "needs_reschedule"].includes(
            offer.status,
          ),
      ).length,
    [blindDateOffers],
  );
  useDragScroll(scrollAreaRef, {
    disabled: activeTab === "chat",
  });

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollLeft = 0;
  }, [activeTab]);

  const applyUserTicketsResponse = useCallback(
    (response: UserTicketsResponse, mode: "replace" | "append") => {
      setWaitlistedTickets((current) =>
        mode === "append"
          ? mergeUserTickets(current, response.tickets)
          : response.tickets,
      );
      setWaitlistedTicketCount(response.totalCount ?? response.tickets.length);
      setParticipationCount(response.participationCount);
    },
    [],
  );

  const loadRemainingUserTickets = useCallback(
    (
      response: UserTicketsResponse,
      force = false,
      isCancelled: () => boolean = () => false,
    ) => {
      if (!response.hasMore || typeof response.nextOffset !== "number") return;

      setLoadingRemainingTickets(true);
      void fetchUserTickets({
        force,
        offset: response.nextOffset,
        scope: userId,
      })
        .then((remainingResponse) => {
          if (isCancelled() || !remainingResponse) return;
          applyUserTicketsResponse(remainingResponse, "append");
        })
        .finally(() => {
          if (!isCancelled()) setLoadingRemainingTickets(false);
        });
    },
    [applyUserTicketsResponse, userId],
  );

  const loadUserTicketsProgressively = useCallback(
    async ({
      force = false,
      isCancelled = () => false,
    }: {
      force?: boolean;
      isCancelled?: () => boolean;
    } = {}) => {
      const response = await fetchUserTickets({
        force,
        limit: initialUserTicketsLimit,
        scope: userId,
      });
      setInitialTicketsLoaded(true);
      if (isCancelled() || !response) return null;

      applyUserTicketsResponse(response, "replace");
      loadRemainingUserTickets(response, force, isCancelled);
      return response;
    },
    [applyUserTicketsResponse, loadRemainingUserTickets, userId],
  );

  const refreshAnswers = useCallback(async () => {
    if (guestMode || readOnly) return;
    const answerQuestions = usesPreferenceProfile(currentProfile)
      ? preferenceQuestions
      : profileQuestions;
    const supabase = createClient();
    const [answerResult, profileResult] = await Promise.all([
      supabase
        .from("user_answers")
        .select("question_order,answer_value,answer_values,answer_text,other_text")
        .eq("user_id", userId)
        .order("question_order")
        .returns<AnswerRow[]>(),
      supabase
        .from("profiles")
        .select("name,gender,birth_year,birth_date,mbti,photo_url")
        .eq("user_id", userId)
        .maybeSingle<
          Pick<
            ProfileRow,
            "name" | "gender" | "birth_year" | "birth_date" | "mbti" | "photo_url"
          >
        >(),
    ]);

    if (profileResult.data) {
      setCurrentProfile((current) => ({
        ...current,
        ...profileResult.data,
      }));
    }

    const { data, error } = answerResult;
    if (error || !data) return;

    setAnswerRows(data);
    setAnswers(
      Object.fromEntries(
        data
          .filter((row) =>
            answerQuestions.some(
              (question) =>
                (question.order ?? question.id) === row.question_order,
            ),
          )
          .map((row) => {
            const answer = rowToAnswer(row, answerQuestions);
            return [answer.questionId, answer];
          }),
      ) as AnswerMap,
    );
  }, [currentProfile, guestMode, readOnly, userId]);

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (guestMode || readOnly) return;
    trackLoginSuccessFromUrl("existing");
  }, [guestMode, readOnly]);

  useEffect(() => {
    if (guestMode || readOnly) return;
    identifyAnalyticsUser(userId);
  }, [guestMode, readOnly, userId]);

  useEffect(() => {
    if (readOnly || activeTab !== "recommend" || recommendTabTrackedRef.current) return;

    recommendTabTrackedRef.current = true;
    trackEvent("recommend_tab_view");
  }, [activeTab, readOnly]);

  useEffect(() => {
    if (readOnly || activeTab !== "profile" || profileTabTrackedRef.current) return;

    profileTabTrackedRef.current = true;
    if (preferenceProfileEnabled) {
      trackEvent("profile_tab_view");
      return;
    }

    trackEvent("conversation_result_view", {
      result_code: currentProfile.conversation_result_code,
      result_source: currentProfile.conversation_result_source,
    });
  }, [
    activeTab,
    currentProfile.conversation_result_code,
    currentProfile.conversation_result_source,
    preferenceProfileEnabled,
    readOnly,
  ]);

  useEffect(() => {
    if (guestMode) return;
    let cancelled = false;

    void loadUserTicketsProgressively({
      isCancelled: () => cancelled,
    });
    if (recommendationProfileReady && currentProfile.profile_completed) {
      void fetchBlindDateOffers().then((offers) => {
        if (cancelled) return;

        if (offers) setBlindDateOffers(offers);
        setBlindDateOffersLoaded(true);
      });
    } else {
      setBlindDateOffers([]);
      setBlindDateOffersLoaded(true);
    }
    const answerQuestions = usesPreferenceProfile(profile)
      ? preferenceQuestions
      : profileQuestions;

    if (!readOnly) {
      createClient()
        .from("user_answers")
        .select("question_order,answer_value,answer_values,answer_text,other_text")
        .eq("user_id", userId)
        .order("question_order")
        .returns<AnswerRow[]>()
        .then(({ data, error }) => {
          if (cancelled || error || !data) return;

          setAnswerRows(data);
          setAnswers(
            Object.fromEntries(
              data
                .filter((row) =>
                  answerQuestions.some(
                    (question) =>
                      (question.order ?? question.id) === row.question_order,
                  ),
                )
                .map((row) => {
                  const answer = rowToAnswer(row, answerQuestions);
                  return [answer.questionId, answer];
                }),
            ) as AnswerMap,
          );
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    guestMode,
    loadUserTicketsProgressively,
    currentProfile.profile_completed,
    profile.profile_experience_version,
    recommendationProfileReady,
    readOnly,
    userId,
  ]);

  useEffect(() => {
    let cancelled = false;
    const guestInteractions = loadGuestTicketInteractions();

    if (guestMode) {
      setTicketInteractions(guestInteractions);
      setTicketInteractionsLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      if (
        !readOnly &&
        operatorAccountSwitcher?.mode !== "test" &&
        guestInteractions.length > 0
      ) {
        const importableInteractions = guestInteractions.filter((interaction) =>
          isGuestImportTicketInteractionStatus(interaction.status),
        );
        if (importableInteractions.length > 0) {
          const importResponse = await fetch(
            "/api/meetings/ticket-interactions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                interactions: importableInteractions.map((interaction) => ({
                  ticketInstanceId: interaction.ticket.id,
                  status: interaction.status,
                  openedAt: interaction.openedAt,
                  respondedAt: interaction.respondedAt,
                  paymentStartedAt: interaction.paymentStartedAt,
                  paymentConfirmedAt: interaction.paymentConfirmedAt,
                })),
              }),
            },
          ).catch(() => null);
          if (importResponse?.ok) clearGuestTicketInteractions();
        }
      }

      const response = await fetch("/api/meetings/ticket-interactions", {
        cache: "no-store",
      }).catch(() => null);
      const data = response
        ? ((await response.json().catch(() => null)) as {
            interactions?: TicketInteraction[];
          } | null)
        : null;
      if (!cancelled && response?.ok && data?.interactions) {
        setTicketInteractions(data.interactions);
      }
      if (!cancelled) setTicketInteractionsLoaded(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [guestMode, operatorAccountSwitcher?.mode, readOnly, userId]);

  useEffect(() => {
    if (guestMode) return;
    const refreshTickets = () => {
      void loadUserTicketsProgressively({
        force: true,
      });
    };

    const intervalId = window.setInterval(refreshTickets, 30_000);
    return () => window.clearInterval(intervalId);
  }, [guestMode, loadUserTicketsProgressively, readOnly]);

  const switchTab = (tab: AppTab) => {
    if (tab === activeTab) return;

    if (tab === "profile") {
      setProfileVibeAnimationKey((current) => current + 1);
    }

    setActiveTab(tab);
    setQuestionReviewOpen(false);
    setQuestionReviewStartIndex(null);
    setProfileQuestionSection(null);
    setTabUrl(tab);
  };

  const openParticipationRecord = () => {
    setParticipationProgressOpen(true);
  };

  const openBlindDateStatus = (
    offerId: string | null = null,
    { skipUnlock = false }: { skipUnlock?: boolean } = {},
  ) => {
    setBlindDateReturnSettling(false);
    setActiveTab("recommend");
    setQuestionReviewOpen(false);
    setQuestionReviewStartIndex(null);
    setTabUrl("recommend");
    setBlindDateOpenRequestOfferId(offerId);
    setBlindDateOpenRequestSkipUnlock(skipUnlock);
    setBlindDateOpenRequestId((current) => current + 1);
    setBlindDateOpenRequestPending(true);
  };

  const requestDeclinedTicketApplication = (ticket: GatheringTicket) => {
    setTicketAcceptRequest({ id: Date.now(), ticketId: ticket.id });
    switchTab("recommend");
  };

  const applyTicketInteraction = useCallback((interaction: TicketInteraction) => {
    setTicketInteractions((current) => {
      const existing = current.find(
        (row) => row.ticket.id === interaction.ticket.id,
      );
      if (interaction.status === "open" && existing) return current;

      return [
        ...current.filter((row) => row.ticket.id !== interaction.ticket.id),
        interaction,
      ];
    });
  }, []);

  const declineTicketFromInbox = useCallback(
    async (ticket: GatheringTicket) => {
      if (guestMode) {
        applyTicketInteraction(saveGuestTicketInteraction(ticket, "no"));
        return true;
      }

      const response = await fetch("/api/meetings/ticket-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketInstanceId: ticket.id, status: "no" }),
      }).catch(() => null);
      const data = response
        ? ((await response.json().catch(() => null)) as {
            interactions?: TicketInteraction[];
          } | null)
        : null;
      const interaction = data?.interactions?.find(
        (row) => row.ticket.id === ticket.id,
      );

      if (!response?.ok || !interaction || interaction.status !== "no") {
        return false;
      }

      applyTicketInteraction(interaction);
      return true;
    },
    [applyTicketInteraction, guestMode],
  );

  const cancelMeetingApplication = useCallback(
    async (
      application: MeetingDateApplication,
      ticket: GatheringTicket,
    ) => {
      if (guestMode || readOnly) return false;

      const response = await fetch("/api/meeting-date-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id }),
      }).catch(() => null);
      const data = response
        ? ((await response.json().catch(() => null)) as {
            application?: MeetingDateApplication;
            cancelledAt?: string;
          } | null)
        : null;
      if (!response?.ok || data?.application?.status !== "cancelled") {
        return false;
      }

      setDateApplications((current) =>
        current.filter((row) => String(row.id) !== String(application.id)),
      );
      setWaitlistedTickets((current) =>
        current.filter((row) => row.ticket.id !== ticket.id),
      );
      setWaitlistedTicketCount((current) =>
        current === null ? null : Math.max(0, current - 1),
      );
      setTicketInteractions((current) =>
        current.map((row) =>
          row.ticket.id === ticket.id
            ? {
                ...row,
                status: "open",
                updatedAt: data.cancelledAt ?? new Date().toISOString(),
              }
            : row,
        ),
      );
      return true;
    },
    [guestMode, readOnly],
  );

  const startProfileRegeneration = async () => {
    if (profileRegenerating) return;

    setProfileRegenerating(true);
    setProfileRegenerationError(null);

    const response = await fetch("/api/profile/regeneration/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: preferenceProfileEnabled
          ? "preferences-v2-regeneration"
          : "preferences-v2-upgrade",
      }),
    }).catch(() => null);
    const body = response
      ? ((await response.json().catch(() => null)) as
          | { error?: string; nextAvailableAt?: string }
          | null)
      : null;

    if (!response?.ok) {
      const nextDate = body?.nextAvailableAt
        ? formatProfileRegenerationDate(body.nextAvailableAt)
        : null;
      setProfileRegenerationError(
        nextDate
          ? `프로필 새로 만들기는 한 달에 한 번만 가능해요. 다음 재생성 가능일은 ${nextDate}이에요.`
          : body?.error ??
              "프로필 새로 만들기를 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setProfileRegenerating(false);
      return;
    }

    window.location.href = preferenceProfileEnabled
      ? "/onboarding/questions?regenerate=1&start=1"
      : "/onboarding/questions?upgrade=preferences-v2";
  };

  const openProfileQuestionSection = (
    section:
      | "basic"
      | "background"
      | "activity"
      | "interest"
      | "values"
      | "preference"
      | "value"
      | "traits"
      | "self",
  ) => {
    if (section === "basic" && !preferenceProfileEnabled) {
      void startProfileRegeneration();
      return;
    }
    setProfileQuestionSection(section);
  };
  const currentProfileQuestionSectionIndex = profileQuestionSection
    ? profileQuestionSectionSequence.indexOf(profileQuestionSection)
    : -1;
  const nextProfileQuestionSection =
    currentProfileQuestionSectionIndex >= 0 &&
    currentProfileQuestionSectionIndex < profileQuestionSectionSequence.length - 1
      ? profileQuestionSectionSequence[currentProfileQuestionSectionIndex + 1]
      : null;

  const applyAccountSession = async ({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }) => {
    const { error } = await createClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  };

  const switchToTestAccount = async (targetUserId: string) => {
    if (switchingAccountId) return;

    setSwitchingAccountId(targetUserId);
    setAccountSwitchError(null);
    try {
      const response = await fetch("/api/operator/session-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const body = (await response.json().catch(() => null)) as {
        accessToken?: string;
        refreshToken?: string;
        error?: string;
      } | null;

      if (!response.ok || !body?.accessToken || !body.refreshToken) {
        throw new Error(body?.error ?? "테스트 계정으로 전환하지 못했습니다.");
      }

      await applyAccountSession({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
      });
      window.location.replace("/meetings?tab=recommend");
    } catch (error) {
      setAccountSwitchError(
        error instanceof Error
          ? error.message
          : "테스트 계정으로 전환하지 못했습니다.",
      );
      setSwitchingAccountId(null);
    }
  };

  const returnToOperatorAccount = async () => {
    if (switchingAccountId) return;

    setSwitchingAccountId("operator-return");
    setAccountSwitchError(null);
    setLogoutError(null);
    try {
      const response = await fetch("/api/operator/session-switch", {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as {
        accessToken?: string;
        refreshToken?: string;
        error?: string;
      } | null;

      if (!response.ok || !body?.accessToken || !body.refreshToken) {
        throw new Error(body?.error ?? "운영자 계정으로 돌아가지 못했습니다.");
      }

      await applyAccountSession({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
      });
      window.location.replace("/meetings?tab=recommend");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "운영자 계정으로 돌아가지 못했습니다.";
      setAccountSwitchError(message);
      setLogoutError(message);
      setSwitchingAccountId(null);
      setLoggingOut(false);
    }
  };

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError(null);

    if (operatorAccountSwitcher?.mode === "test") {
      await returnToOperatorAccount();
      return;
    }

    const { error } = await createClient().auth.signOut();

    if (error) {
      setLogoutError("로그아웃에 실패했어요. 잠시 후 다시 시도해주세요.");
      setLoggingOut(false);
      return;
    }

    window.location.replace("/");
  };

  const endReadOnlyView = async () => {
    await fetch("/api/admin/user-view", { method: "DELETE" }).catch(() => null);
    window.location.assign("/admin");
  };

  return (
    <section
      className={cn(
        "relative flex h-dvh flex-col overflow-hidden md:h-[calc(100dvh-32px)]",
        activeTab === "browse" || activeTab === "recommend"
          ? "bg-[radial-gradient(ellipse_at_50%_42%,#fffdf9_0%,rgba(255,253,249,0.48)_35%,rgba(247,244,238,0)_70%),linear-gradient(180deg,#faf8f3_0%,#f7f4ee_52%,#f2eee6_100%)]"
          : "bg-[#f7f4ed]",
      )}
    >
      {readOnlyView &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <aside className="fixed left-[calc(50%+231px)] top-6 z-[100] hidden w-[150px] rounded-2xl border border-amber-300/80 bg-amber-50/95 p-3 text-[#3f3215] shadow-lg backdrop-blur md:block">
              <p className="truncate text-xs font-black">
                {readOnlyView.targetName} 화면
              </p>
              <p className="mt-1 text-[10px] font-semibold text-black/50">
                읽기 전용으로 보는 중
              </p>
              <button
                type="button"
                onClick={() => void endReadOnlyView()}
                className="mt-3 h-9 w-full rounded-full bg-black text-[11px] font-black text-white"
              >
                보기 종료
              </button>
            </aside>

            <div className="fixed right-2.5 top-2.5 z-[100] md:hidden">
              {readOnlyControlOpen ? (
                <div className="w-[min(330px,calc(100vw-20px))] rounded-2xl border border-amber-300/80 bg-amber-50/95 p-3 text-[#3f3215] shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black">
                        {readOnlyView.targetName} 화면 · 읽기 전용
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-black/50">
                        이 화면에서는 정보가 변경되지 않아요.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReadOnlyControlOpen(false)}
                      className="shrink-0 rounded-full border border-black/10 px-3 py-2 text-[10px] font-black"
                    >
                      접기
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void endReadOnlyView()}
                    className="mt-2.5 h-9 w-full rounded-full bg-black text-[11px] font-black text-white"
                  >
                    보기 종료
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReadOnlyControlOpen(true)}
                  className="rounded-full border border-amber-300/80 bg-amber-50/95 px-3 py-2 text-[10px] font-black text-[#3f3215] shadow-lg backdrop-blur"
                >
                  읽기 전용
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
      {activeTab === "recommend" &&
        !chatRoomOpen &&
        !recommendationFocusMode &&
        !recommendationBottomNavHidden &&
        !ticketTabFocusMode &&
        !replayedDeclinedTicket && (
          <button
            type="button"
            onClick={() => setAlgorithmParametersOpen(true)}
            title="알고리즘 조절"
            aria-label="알고리즘 파라미터 조절"
            className="absolute right-[72px] top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d1c4] bg-[#f8f4eb] text-[#5f594f] shadow-[0_5px_14px_rgba(71,62,48,0.1)] transition hover:-translate-y-0.5 hover:text-[#24211d] hover:shadow-[0_8px_18px_rgba(71,62,48,0.14)]"
          >
            <WandSparkles size={20} strokeWidth={1.7} aria-hidden />
          </button>
        )}

      {activeTab === "browse" && activeBlindDateOfferCount > 0 && (
        <button
          type="button"
          onClick={() => openBlindDateStatus()}
          title="블라인드 데이트"
          aria-label={
            pendingBlindDateOfferCount > 0
              ? "메시지 1개"
              : "블라인드 데이트 상태 확인"
          }
          className="absolute right-[72px] top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d1c4] bg-[#f8f4eb] text-[#5f594f] shadow-[0_5px_14px_rgba(71,62,48,0.1)] transition hover:-translate-y-0.5 hover:text-[#24211d] hover:shadow-[0_8px_18px_rgba(71,62,48,0.14)]"
        >
          <Mail size={20} strokeWidth={1.8} aria-hidden />
          {pendingBlindDateOfferCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-black leading-none text-white">
              1
            </span>
          )}
        </button>
      )}

      {activeTab === "recommend" &&
        !chatRoomOpen &&
        !recommendationFocusMode &&
        !recommendationBottomNavHidden &&
        !ticketTabFocusMode &&
        !replayedDeclinedTicket && (
          <div className="absolute left-5 top-[calc(14px+env(safe-area-inset-top))] z-40">
            <CompactParticipationSparkleProgress
              count={participationCount}
              onOpen={openParticipationRecord}
            />
          </div>
        )}

      <AnimatePresence>
        {participationProgressOpen && (
          <ParticipationProgressOverlay
            open
            count={participationCount}
            onClose={() => setParticipationProgressOpen(false)}
          />
        )}
      </AnimatePresence>

      {!chatRoomOpen &&
        !recommendationFocusMode &&
        !ticketTabFocusMode &&
        activeTab !== "profile" &&
        !replayedDeclinedTicket && (
          <button
            type="button"
            onClick={() => switchTab("profile")}
            title="프로필"
            aria-label="프로필 열기"
            className="absolute right-5 top-[calc(14px+env(safe-area-inset-top))] z-40 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-black/12 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_9px_24px_rgba(0,0,0,0.18)]"
          >
            <UserRound size={20} strokeWidth={1.8} aria-hidden />
            <SafeImage
              src={currentProfile.photo_url}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </button>
        )}

      <div
        ref={scrollAreaRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          chatRoomOpen ||
          recommendationFocusMode ||
          recommendationBottomNavHidden ||
          ticketTabFocusMode
            ? "pb-0"
            : "pb-[calc(90px+env(safe-area-inset-bottom))]",
        )}
      >
        <div
          data-testid="app-tab-panel-browse"
          aria-hidden={activeTab !== "browse"}
          className={cn(
            "absolute inset-0 h-full overflow-y-auto scrollbar-none",
            activeTab === "browse" ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            transform:
              (blindDateOpenRequestSkipUnlock && !blindDateReturnSettling) ||
              activeTab === "browse"
                ? "none"
                : `translate3d(${(appTabPositions.browse - appTabPositions[activeTab]) * 100}%, 0, 0)`,
            transition:
              blindDateOpenRequestSkipUnlock || blindDateReturnSettling
              ? "none"
              : "transform 460ms cubic-bezier(0.22, 1, 0.36, 1)",
            opacity:
              blindDateReturnSettling && activeTab !== "browse" ? 0 : 1,
            zIndex: activeTab === "browse" ? 1 : 0,
            willChange: "transform",
          }}
        >
          <TicketListTab
            readOnly={readOnly}
            initialLoading={
              !initialTicketsLoaded ||
              !ticketInteractionsLoaded ||
              !blindDateOffersLoaded
            }
            tickets={waitlistedTickets}
            interactions={ticketInteractions}
            dateApplications={dateApplications}
            blindDateOffers={blindDateOffers}
            availableTickets={availableMeetingTickets}
            totalTicketCount={waitlistedTicketCount ?? waitlistedTickets.length}
            loadingMore={loadingRemainingTickets}
            participantPhotoUrl={currentProfile.photo_url}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            onGoRecommend={() => switchTab("recommend")}
            onReapplyTicket={requestDeclinedTicketApplication}
            onDeclineTicket={declineTicketFromInbox}
            onCancelApplication={cancelMeetingApplication}
            onOpenBlindDate={(offerId) =>
              openBlindDateStatus(offerId, { skipUnlock: true })
            }
            onFocusModeChange={setTicketTabFocusMode}
            focusRequest={ticketTabFocusRequest}
            initialFeedbackParticipationId={initialFeedbackParticipationId}
          />
        </div>
        <div
          data-testid="app-tab-panel-recommend"
          aria-hidden={activeTab !== "recommend"}
          className={cn(
            "application-stone-theme absolute inset-0 h-full overflow-y-auto scrollbar-none",
            activeTab === "recommend"
              ? "pointer-events-auto"
              : "pointer-events-none",
          )}
          style={{
            transform:
              (blindDateOpenRequestSkipUnlock && !blindDateReturnSettling) ||
              activeTab === "recommend"
                ? "none"
                : `translate3d(${(appTabPositions.recommend - appTabPositions[activeTab]) * 100}%, 0, 0)`,
            transition:
              blindDateOpenRequestSkipUnlock || blindDateReturnSettling
              ? "none"
              : "transform 460ms cubic-bezier(0.22, 1, 0.36, 1)",
            opacity:
              blindDateReturnSettling && activeTab !== "recommend" ? 0 : 1,
            zIndex: activeTab === "recommend" ? 1 : 0,
            willChange: "transform",
          }}
        >
          <MeetingRecommendation
              readOnly={readOnly}
              userId={userId}
              profileCompleted
              profileName={currentProfile.name}
              profilePhotoUrl={currentProfile.photo_url}
              previewMatchPhotoUrls={previewMatchPhotoUrls}
              previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
              guestMode={guestMode}
              participationPrecisionCount={
                participationCount +
                (currentProfile.matching_precision_bonus ?? 0)
              }
              onOpenParticipationRecord={openParticipationRecord}
              onFocusModeChange={setRecommendationFocusMode}
              onBottomNavHiddenChange={setRecommendationBottomNavHidden}
              onAvailableTicketsChange={setAvailableMeetingTickets}
              onTicketInteractionChange={applyTicketInteraction}
              onOpenDeclinedTicket={setReplayedDeclinedTicket}
              embedded
              active={activeTab === "recommend"}
              membershipStatus={recommendationMembershipStatus}
              blindDateOffers={blindDateOffers}
              onBlindDateOffersChange={setBlindDateOffers}
              blindDateOpenRequestId={blindDateOpenRequestId}
              blindDateOpenRequestPending={blindDateOpenRequestPending}
              blindDateOpenRequestOfferId={blindDateOpenRequestOfferId}
              blindDateOpenRequestSkipUnlock={blindDateOpenRequestSkipUnlock}
              ticketAcceptRequestId={ticketAcceptRequest?.id ?? 0}
              ticketAcceptRequestTicketId={
                ticketAcceptRequest?.ticketId ?? null
              }
              onTicketAcceptRequestHandled={() => setTicketAcceptRequest(null)}
              onDateApplicationsChange={setDateApplications}
              onOpenTicketTab={(ticketId) => {
                if (ticketId) {
                  setTicketTabFocusRequest({ id: Date.now(), ticketId });
                }
                if (blindDateOpenRequestSkipUnlock) {
                  setBlindDateReturnSettling(true);
                  switchTab("browse");
                  window.requestAnimationFrame(() => {
                    setBlindDateOpenRequestSkipUnlock(false);
                    setBlindDateReturnSettling(false);
                  });
                  return;
                }
                switchTab("browse");
              }}
              onBlindDateOpenRequestHandled={() => {
                setBlindDateOpenRequestPending(false);
                setBlindDateOpenRequestOfferId(null);
              }}
            />
        </div>
        <div
          data-testid="app-tab-panel-chat"
          aria-hidden={activeTab !== "chat"}
          className={cn(
            "absolute inset-0 h-full overflow-hidden",
            activeTab === "chat" ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            transform:
              activeTab === "chat"
                ? "none"
                : `translate3d(${(appTabPositions.chat - appTabPositions[activeTab]) * 100}%, 0, 0)`,
            transition: "transform 460ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {activeTab === "chat" && guestMode ? (
            <section className="flex h-full min-h-[520px] flex-col items-center justify-center bg-[#f7f4ed] px-8 pb-24 text-center">
              <MessageCircle size={28} strokeWidth={1.6} className="text-black/35" aria-hidden />
              <h2 className="mt-5 text-[20px] font-black tracking-[-0.04em] text-black">
                채팅은 신청 후 열려요
              </h2>
              <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-black/45">
                모임 신청을 완료하면 참여자와 대화할 수 있어요.
              </p>
            </section>
          ) : activeTab === "chat" ? (
            <LazyMeetingChat
              userId={userId}
              active
              readOnly={readOnly}
              onUnreadCountChange={setChatUnreadCount}
              onRoomOpenChange={setChatRoomOpen}
            />
          ) : null}
        </div>
        <div
          data-testid="app-tab-panel-profile"
          aria-hidden={activeTab !== "profile"}
          className={cn(
            "absolute inset-0 min-h-full overflow-y-auto scrollbar-none",
            activeTab === "profile" ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            transform:
              activeTab === "profile"
                ? "none"
                : `translate3d(${(appTabPositions.profile - appTabPositions[activeTab]) * 100}%, 0, 0)`,
            transition: "transform 460ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {activeTab === "profile" && (
            profileQuestionsReady ? (
              <PreferenceProfileTab
                profile={currentProfile}
                initialAccountOpen={initialProfileAccountOpen}
                onBottomNavHiddenChange={setProfileBottomNavHidden}
                loggingOut={loggingOut}
                logoutError={logoutError}
                answers={preferenceProfileEnabled ? answers : {}}
                backgroundAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionBackgroundQuestions,
                  )
                }
                activityAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionActivityQuestions,
                  )
                }
                interestAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionInterestQuestions,
                  )
                }
                valuesAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionValuesQuestions,
                  )
                }
                preferenceAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionPreferenceQuestions,
                  )
                }
                valueAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionValueQuestions,
                  )
                }
                traitsAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionTraitsQuestions,
                  )
                }
                selfAnsweredCount={
                  answeredQuestionCount(
                    answerRows,
                    profileSectionSelfQuestions,
                  )
                }
                onProfileUpdated={setCurrentProfile}
                onOpenBasicQuestions={() => openProfileQuestionSection("basic")}
                onOpenBackgroundQuestions={() =>
                  openProfileQuestionSection("background")
                }
                onOpenActivityQuestions={() =>
                  openProfileQuestionSection("activity")
                }
                onOpenInterestQuestions={() =>
                  openProfileQuestionSection("interest")
                }
                onOpenValuesQuestions={() =>
                  openProfileQuestionSection("values")
                }
                onOpenPreferenceQuestions={() =>
                  openProfileQuestionSection("preference")
                }
                onOpenValueQuestions={() =>
                  openProfileQuestionSection("value")
                }
                onOpenTraitsQuestions={() =>
                  openProfileQuestionSection("traits")
                }
                onOpenSelfQuestions={() => openProfileQuestionSection("self")}
                onOpenQuestionReview={() => {
                  setQuestionReviewStartIndex(null);
                  setQuestionReviewOpen(true);
                }}
                showOperatorQuestionReview={
                  operatorAccountSwitcher?.mode === "operator"
                }
                onLogout={logout}
                previewMode={guestMode || readOnly}
              />
            ) : initialLegacyResultPreview ? (
              <LazyProfileTab
                profile={currentProfile}
                answers={answers}
                vibeAnimationKey={profileVibeAnimationKey}
                loggingOut={loggingOut}
                logoutError={logoutError}
                profileRegenerating={profileRegenerating}
                profileRegenerationError={profileRegenerationError}
                onOpenQuestionReview={() => setQuestionReviewOpen(true)}
                onRequestProfileRegeneration={readOnly ? () => undefined : () =>
                  void startProfileRegeneration()
                }
                legacyResultPreview={initialLegacyResultPreview}
                onLogout={logout}
                operatorConversationPreview={
                  operatorAccountSwitcher?.mode === "operator"
                }
              />
            ) : (
              <ProfileUpgradeLockedTab
                profile={currentProfile}
                questionCount={preferenceQuestions.length}
                upgrading={profileRegenerating}
                upgradeError={profileRegenerationError}
                loggingOut={loggingOut}
                logoutError={logoutError}
                onUpgrade={readOnly ? () => undefined : () => void startProfileRegeneration()}
                onLogout={logout}
              />
            )
          )}
        </div>
      </div>

      {replayedDeclinedTicket && (
        <div className="absolute inset-0 z-[60] overflow-y-auto bg-[#f7f4ed] scrollbar-none">
          <AssignedApplicationTicketDetailView
            ticket={replayedDeclinedTicket}
            participantPhotoUrl={currentProfile.photo_url}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            onClose={() => {
              setReplayedDeclinedTicket(null);
              switchTab("browse");
            }}
            onReapply={readOnly ? undefined : () => {
              const ticket = replayedDeclinedTicket;
              setReplayedDeclinedTicket(null);
              requestDeclinedTicketApplication(ticket);
            }}
          />
        </div>
      )}

      {!chatRoomOpen &&
        !recommendationFocusMode &&
        !recommendationBottomNavHidden &&
        !profileBottomNavHidden &&
        !ticketTabFocusMode &&
        !replayedDeclinedTicket && (
        <nav
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-40 px-5 pb-[calc(10px+env(safe-area-inset-bottom))]",
            (activeTab === "browse" || activeTab === "recommend") && "pt-5",
          )}
        >
          <div className="pointer-events-auto relative grid grid-cols-3 gap-1 rounded-full border border-white/[0.24] bg-black/[0.62] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            {tabItems.map(({ id, label, Icon }) => {
              const selected = activeTab === id;

              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => switchTab(id)}
                  className={cn(
                    "relative z-10 flex h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-black transition-all duration-300",
                    selected
                      ? "text-black"
                      : "text-white/[0.62] hover:text-white",
                  )}
                >
                  <motion.span
                    animate={
                      selected ? { y: -1, scale: 1.05 } : { y: 0, scale: 1 }
                    }
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <Icon size={19} strokeWidth={selected ? 2.6 : 2} />
                    <span>{label}</span>
                  </motion.span>

                  {id === "chat" && chatUnreadCount > 0 && (
                    <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black leading-none text-white">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  )}

                  {selected && (
                    <motion.div
                      layoutId="active-tab-bg"
                      className="absolute inset-0 -z-10 rounded-full bg-[#f7f4ed]"
                      transition={{ type: "spring", stiffness: 350, damping: 24 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <AnimatePresence>
        {algorithmParametersOpen && (
          <AlgorithmParametersOverlay
            completionPercent={algorithmQuestionProgress.completionPercent}
            answeredCount={algorithmQuestionProgress.answeredCount}
            totalCount={algorithmQuestionProgress.totalCount}
            answeredQuestionOrders={answerRows
              .filter(hasStoredAnswer)
              .map((row) => row.question_order)}
            answerRows={answerRows}
            unlocked={algorithmQuestionProgress.unlocked}
            onClose={() => setAlgorithmParametersOpen(false)}
            onAnswerMore={() => {
              const nextSectionId =
                algorithmQuestionProgress.nextSectionId ?? "background";
              setAlgorithmParametersOpen(false);
              setAlgorithmQuestionAnswering(true);
              openProfileQuestionSection(nextSectionId);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recommendationProfileReady && profileQuestionSection && (
          <ProfileQuestionSectionOverlay
            key={profileQuestionSection}
            userId={userId}
            title={
              profileQuestionSection === "basic"
                ? "코어 질문"
                : profileQuestionSection === "background"
                  ? "배경"
                  : profileQuestionSection === "activity"
                    ? "활동성"
                    : profileQuestionSection === "interest"
                      ? "흥미"
                      : profileQuestionSection === "values"
                        ? "관점"
                        : profileQuestionSection === "preference"
                          ? "선호"
                          : profileQuestionSection === "value"
                            ? "가치"
                          : profileQuestionSection === "traits"
                            ? "성향"
                            : "자기정보"
            }
            questions={
              profileQuestionSection === "basic"
                ? preferenceQuestions
                : profileQuestionSection === "background"
                  ? profileSectionBackgroundQuestions
                  : profileQuestionSection === "activity"
                    ? profileSectionActivityQuestions
                    : profileQuestionSection === "interest"
                      ? profileSectionInterestQuestions
                      : profileQuestionSection === "values"
                        ? profileSectionValuesQuestions
                        : profileQuestionSection === "preference"
                          ? profileSectionPreferenceQuestions
                          : profileQuestionSection === "value"
                            ? profileSectionValueQuestions
                          : profileQuestionSection === "traits"
                            ? profileSectionTraitsQuestions
                          : profileSectionSelfQuestions
            }
            answerRows={answerRows}
            includePhoto={profileQuestionSection === "self"}
            photoUrl={currentProfile.photo_url ?? ""}
            onClose={() => {
              setProfileQuestionSection(null);
              if (algorithmQuestionAnswering) {
                setAlgorithmQuestionAnswering(false);
                setAlgorithmParametersOpen(true);
              }
            }}
            nextSectionLabel={
              nextProfileQuestionSection
                ? profileQuestionSectionLabels[nextProfileQuestionSection]
                : undefined
            }
            onNextSection={
              nextProfileQuestionSection
                ? () => setProfileQuestionSection(nextProfileQuestionSection)
                : undefined
            }
            onAnswersChanged={refreshAnswers}
            onPhotoChanged={(photoUrl) =>
              setCurrentProfile((current) => ({ ...current, photo_url: photoUrl }))
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {questionReviewOpen && (
          <motion.div
            key="question-review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-50 overflow-y-auto overscroll-contain bg-[#F5F1E8]"
          >
            {questionReviewStartIndex === null ? (
              <section className="min-h-full bg-[#F5F1E8] px-5 pb-12 pt-[calc(28px+env(safe-area-inset-top))] text-[#171714]">
                <header className="sticky top-0 z-10 -mx-5 flex items-center justify-between bg-[#F5F1E8]/95 px-5 pb-5 backdrop-blur">
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.16em] text-black/35">
                      OPERATOR ONLY
                    </p>
                    <h1 className="mt-1 text-[26px] font-black tracking-[-0.055em]">
                      질문 다시보기
                    </h1>
                  </div>
                  <button
                    type="button"
                    title="질문 다시보기 닫기"
                    aria-label="질문 다시보기 닫기"
                    onClick={() => setQuestionReviewOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/55 shadow-sm"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </header>
                <p className="mb-5 break-keep text-[13px] font-semibold leading-6 text-black/45">
                  확인할 질문을 누르면 해당 질문부터 이어서 볼 수 있어요.
                </p>
                <ol className="space-y-2.5">
                  <li>
                    <button
                      type="button"
                      onClick={() => setQuestionReviewStartIndex("guide")}
                      className="flex w-full items-center gap-4 rounded-[20px] border border-black/[0.07] bg-white/65 px-4 py-4 text-left shadow-[0_8px_24px_rgba(18,18,18,0.035)] transition active:scale-[0.99]"
                    >
                      <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-black px-2 text-[9px] font-black tracking-[0.08em] text-white">
                        GUIDE
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold text-black/32">
                          가입 안내
                        </span>
                        <span className="mt-1 block break-keep text-[14px] font-bold leading-5 tracking-[-0.025em] text-black/72">
                          전화번호 인증 후 안내문
                        </span>
                        <span className="mt-1 block text-[11px] font-semibold text-black/35">
                          2페이지 · 타이핑 미리보기
                        </span>
                      </span>
                      <ChevronRight
                        size={17}
                        className="shrink-0 text-black/28"
                        aria-hidden
                      />
                    </button>
                  </li>
                  {(preferenceProfileEnabled
                    ? preferenceQuestions
                    : profileQuestions
                  ).map((question, index) => (
                    <li key={question.id}>
                      <button
                        type="button"
                        onClick={() => setQuestionReviewStartIndex(index)}
                        className="flex w-full items-center gap-4 rounded-[20px] border border-black/[0.07] bg-white/65 px-4 py-4 text-left shadow-[0_8px_24px_rgba(18,18,18,0.035)] transition active:scale-[0.99]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-black tabular-nums text-white">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold text-black/32">
                            {question.category}
                          </span>
                          <span className="mt-1 block whitespace-pre-line break-keep text-[14px] font-bold leading-5 tracking-[-0.025em] text-black/72">
                            {question.question}
                          </span>
                        </span>
                        <ChevronRight
                          size={17}
                          className="shrink-0 text-black/28"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                  {preferenceProfileEnabled && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setQuestionReviewStartIndex("photo")}
                        className="flex w-full items-center gap-4 rounded-[20px] border border-black/[0.07] bg-white/65 px-4 py-4 text-left shadow-[0_8px_24px_rgba(18,18,18,0.035)] transition active:scale-[0.99]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-black tabular-nums text-white">
                          {String(preferenceQuestions.length + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold text-black/32">
                            자기정보
                          </span>
                          <span className="mt-1 block break-keep text-[14px] font-bold leading-5 tracking-[-0.025em] text-black/72">
                            당신의 사진을 등록해주세요.
                          </span>
                        </span>
                        <ChevronRight
                          size={17}
                          className="shrink-0 text-black/28"
                          aria-hidden
                        />
                      </button>
                    </li>
                  )}
                </ol>
              </section>
            ) : (
              <>
                <button
                  type="button"
                  title="질문 목록으로 돌아가기"
                  aria-label="질문 목록으로 돌아가기"
                  onClick={() => setQuestionReviewStartIndex(null)}
                  className="absolute left-4 top-[calc(44px+env(safe-area-inset-top))] z-20 flex h-9 items-center gap-1 rounded-full border border-black/10 bg-white/92 px-3 text-[11px] font-bold text-black/55 shadow-sm backdrop-blur"
                >
                  <ChevronLeft size={15} aria-hidden />
                  목록
                </button>
                <button
                  type="button"
                  title="질문 다시보기 닫기"
                  aria-label="질문 다시보기 닫기"
                  onClick={() => {
                    setQuestionReviewOpen(false);
                    setQuestionReviewStartIndex(null);
                  }}
                  className="absolute right-4 top-[calc(44px+env(safe-area-inset-top))] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/92 text-black/55 shadow-sm backdrop-blur"
                >
                  <X size={17} aria-hidden />
                </button>
                {questionReviewStartIndex === "guide" ? (
                  <OnboardingGuidePreview
                    onComplete={() => setQuestionReviewStartIndex(null)}
                  />
                ) : (
                  <QuestionFlow
                    key={questionReviewStartIndex}
                    userId={userId}
                    mode="preview"
                    initialRows={answerRows}
                    initialPhotoUrl={currentProfile.photo_url ?? ""}
                    initialQuestionIndex={
                      typeof questionReviewStartIndex === "number"
                        ? questionReviewStartIndex
                        : undefined
                    }
                    initialPhotoStep={questionReviewStartIndex === "photo"}
                    questionSet={
                      preferenceProfileEnabled
                        ? preferenceQuestions
                        : profileQuestions
                    }
                    onPreviewComplete={() => {
                      setQuestionReviewOpen(false);
                      setQuestionReviewStartIndex(null);
                      void refreshAnswers();
                    }}
                  />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ChatTabLoading() {
  return (
    <section className="flex h-full min-h-[420px] flex-col bg-[#f7f4ed] px-5 pb-6 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="h-6 w-28 animate-pulse rounded-full bg-black/10" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-20 animate-pulse rounded-[24px] border border-black/5 bg-[#faf8f2]"
          />
        ))}
      </div>
    </section>
  );
}

function ProfileTabLoading() {
  return (
    <div className="h-full min-h-full bg-[#f7f4ed] px-5 pb-7 pt-7">
      <div className="h-3 w-14 animate-pulse rounded-full bg-accent/20" />
      <div className="mt-3 h-8 w-40 animate-pulse rounded-full bg-black/[0.06]" />
      <div className="mt-7 rounded-2xl border border-black/10 bg-[#faf8f2] px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
        <div className="h-3 w-20 animate-pulse rounded-full bg-accent/15" />
        <div className="mt-4 h-6 w-24 animate-pulse rounded-full bg-black/[0.06]" />
        <div className="mt-5 space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-black/[0.05]" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/[0.05]" />
        </div>
      </div>
      <div className="mt-5 h-48 animate-pulse rounded-2xl border border-black/10 bg-[#faf8f2] shadow-[0_10px_28px_rgba(0,0,0,0.035)]" />
    </div>
  );
}

type TicketListItem =
  | {
      kind: "date-application";
      id: string;
      application: MeetingDateApplication;
      ticket: GatheringTicket;
    }
  | { kind: "stored-ticket"; id: string; userTicket: UserTicket }
  | {
      kind: "interaction-ticket";
      id: string;
      interaction: TicketInteraction;
      application: MeetingDateApplication | null;
    }
  | { kind: "blind-date"; id: string; offer: BlindDateUserOffer };

function ticketListItemUpdatedAt(item: TicketListItem) {
  const value =
    item.kind === "stored-ticket"
      ? item.userTicket.updatedAt
      : item.kind === "interaction-ticket"
        ? item.interaction.updatedAt
        : item.kind === "blind-date"
          ? item.offer.createdAt
          : item.application.updatedAt ?? item.application.createdAt;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldShowBlindDateTicket(offer: BlindDateUserOffer) {
  if (
    offer.isExpired ||
    ["pending_admin", "declined", "expired", "cancelled", "completed"].includes(
      offer.status,
    )
  ) {
    return false;
  }

  if (offer.status !== "scheduled" || !offer.feedbackClosesAt) return true;
  const feedbackClosesAt = new Date(offer.feedbackClosesAt).getTime();
  return !Number.isFinite(feedbackClosesAt) || feedbackClosesAt > Date.now();
}

function TicketListTab({
  readOnly,
  initialLoading,
  tickets,
  interactions,
  dateApplications,
  blindDateOffers,
  availableTickets,
  totalTicketCount,
  loadingMore,
  participantPhotoUrl,
  previewMatchPhotoUrls,
  previewOtherMemberPhotoUrls,
  onGoRecommend,
  onReapplyTicket,
  onDeclineTicket,
  onCancelApplication,
  onOpenBlindDate,
  onFocusModeChange,
  focusRequest,
  initialFeedbackParticipationId,
}: {
  readOnly: boolean;
  initialLoading: boolean;
  tickets: UserTicket[];
  interactions: TicketInteraction[];
  dateApplications: MeetingDateApplication[];
  blindDateOffers: BlindDateUserOffer[];
  availableTickets: GatheringTicket[];
  totalTicketCount: number;
  loadingMore: boolean;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls: string[];
  previewOtherMemberPhotoUrls: string[];
  onGoRecommend: () => void;
  onReapplyTicket: (ticket: GatheringTicket) => void;
  onDeclineTicket: (ticket: GatheringTicket) => Promise<boolean>;
  onCancelApplication: (
    application: MeetingDateApplication,
    ticket: GatheringTicket,
  ) => Promise<boolean>;
  onOpenBlindDate: (offerId: string) => void;
  onFocusModeChange: (focused: boolean) => void;
  focusRequest: { id: number; ticketId: string } | null;
  initialFeedbackParticipationId: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [selectedApplicationTicket, setSelectedApplicationTicket] =
    useState<GatheringTicket | null>(null);
  const [selectedApplicationTicketDeclined, setSelectedApplicationTicketDeclined] =
    useState(false);
  const [selectedApplicationTicketOpen, setSelectedApplicationTicketOpen] =
    useState(false);
  const [declinedViewOpen, setDeclinedViewOpen] = useState(false);
  const [declinedTickets, setDeclinedTickets] = useState<GatheringTicket[]>([]);
  const [declinedLoading, setDeclinedLoading] = useState(false);
  const [declinedError, setDeclinedError] = useState<string | null>(null);
  const dragState = useRef({
    active: false,
    interacting: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    startIndex: 0,
  });
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const feedbackDeepLinkOpenedRef = useRef(false);

  useEffect(() => {
    if (
      !initialFeedbackParticipationId ||
      feedbackDeepLinkOpenedRef.current
    ) {
      return;
    }

    const feedbackTicket = tickets.find(
      (ticket) => ticket.waitlistId === initialFeedbackParticipationId,
    );
    if (!feedbackTicket) return;

    feedbackDeepLinkOpenedRef.current = true;
    setSelectedTicket(feedbackTicket);
  }, [initialFeedbackParticipationId, tickets]);

  useEffect(() => {
    const focused = Boolean(
      selectedTicket ||
        (selectedApplicationTicket &&
          (selectedApplicationTicketDeclined || selectedApplicationTicketOpen)),
    );
    onFocusModeChange(focused);
    return () => onFocusModeChange(false);
  }, [
    onFocusModeChange,
    selectedApplicationTicket,
    selectedApplicationTicketDeclined,
    selectedApplicationTicketOpen,
  ]);

  const availableTicketById = useMemo(
    () => new Map(availableTickets.map((ticket) => [ticket.id, ticket])),
    [availableTickets],
  );
  const applicationByEventId = useMemo(
    () =>
      new Map<string, MeetingDateApplication>(
        dateApplications.flatMap((application) =>
          application.eventId
            ? [[application.eventId, application] as const]
            : [],
        ),
      ),
    [dateApplications],
  );
  const selectedTicketApplication = useMemo(() => {
    if (!selectedTicket) return null;

    return (
      dateApplications.find(
        (application) =>
          meetingDateApplicationMatchesTicket(
            application,
            selectedTicket.ticket.id,
            selectedTicket.waitlistId,
          ) &&
          canCancelMeetingDateApplication(application.status),
      ) ?? null
    );
  }, [dateApplications, selectedTicket]);
  const ticketItems = useMemo<TicketListItem[]>(() => {
    const applicationItems = dateApplications.flatMap(
      (application): TicketListItem[] => {
        if (
          ["cancelled", "not_selected", "feedback_done", "completed"].includes(
            application.status,
          )
        ) {
          return [];
        }

        if (!application.assignedTicketInstanceId) return [];

        const ticket =
          availableTicketById.get(application.assignedTicketInstanceId) ?? null;

        // Applications without a concrete program are legacy/incomplete data.
        // They must not create placeholder cards in the ticket tab.
        if (!ticket) return [];

        return [
          {
            kind: "date-application",
            id: `date-application:${application.id}`,
            application,
            ticket,
          },
        ];
      },
    );
    const authoritativeProgramDates = new Set(
      [
        ...applicationItems
          .filter(
            (item) =>
              item.kind === "date-application" &&
              Boolean(item.application.assignedTicketInstanceId),
          )
          .map((item) =>
            item.kind === "date-application"
              ? `${item.ticket.templateId}|${item.ticket.date}`
              : "",
          ),
        ...tickets.map(
          (userTicket) =>
            `${userTicket.ticket.templateId}|${userTicket.ticket.date}`,
        ),
      ].filter(Boolean),
    );
    const visibleInteractions = interactions.filter(
      (interaction) =>
        !authoritativeProgramDates.has(
          `${interaction.ticket.templateId}|${interaction.ticket.date}`,
        ),
    );
    const candidates: TicketListItem[] = [
      ...applicationItems,
      ...tickets.map((userTicket): TicketListItem => ({
        kind: "stored-ticket" as const,
        id: `stored-ticket:${userTicket.id}`,
        userTicket,
      })),
      ...visibleInteractions.map((interaction): TicketListItem => ({
        kind: "interaction-ticket",
        id: `interaction-ticket:${interaction.ticket.id}`,
        interaction,
        application: applicationByEventId.get(interaction.ticket.id) ?? null,
      })),
      ...blindDateOffers
        .filter(shouldShowBlindDateTicket)
        .map((offer): TicketListItem => ({
          kind: "blind-date",
          id: `blind-date:${offer.id}`,
          offer,
        })),
    ];
    const latestItemByTicket = new Map<string, TicketListItem>();
    for (const item of candidates) {
      if (item.kind === "blind-date") {
        latestItemByTicket.set(item.id, item);
        continue;
      }
      const ticketId =
        item.kind === "stored-ticket"
          ? item.userTicket.ticket.id
          : item.kind === "interaction-ticket"
            ? item.interaction.ticket.id
            : item.ticket.id;
      if (!ticketId) {
        latestItemByTicket.set(item.id, item);
        continue;
      }

      const current = latestItemByTicket.get(ticketId);
      if (
        !current ||
        ticketListItemUpdatedAt(item) > ticketListItemUpdatedAt(current)
      ) {
        latestItemByTicket.set(ticketId, item);
      }
    }
    const items = Array.from(latestItemByTicket.values());
    return items.sort((left, right) => {
      const leftDate =
        left.kind === "stored-ticket"
          ? left.userTicket.ticket.date
          : left.kind === "interaction-ticket"
            ? left.interaction.ticket.date
            : left.kind === "blind-date"
              ? left.offer.scheduledDate ?? left.offer.createdAt.slice(0, 10)
              : left.application.meetingDate;
      const rightDate =
        right.kind === "stored-ticket"
          ? right.userTicket.ticket.date
          : right.kind === "interaction-ticket"
            ? right.interaction.ticket.date
            : right.kind === "blind-date"
              ? right.offer.scheduledDate ?? right.offer.createdAt.slice(0, 10)
              : right.application.meetingDate;
      return leftDate.localeCompare(rightDate);
    });
  }, [
    availableTicketById,
    applicationByEventId,
    interactions,
    dateApplications,
    blindDateOffers,
    tickets,
  ]);
  const itemCount = ticketItems.length;
  const carouselItemCount = itemCount;

  useEffect(() => {
    if (!focusRequest) return;
    const targetIndex = ticketItems.findIndex((item) => {
      const ticketId =
        item.kind === "stored-ticket"
          ? item.userTicket.ticket.id
          : item.kind === "interaction-ticket"
            ? item.interaction.ticket.id
            : item.kind === "blind-date"
              ? null
              : item.ticket.id;
      return ticketId === focusRequest.ticketId;
    });
    if (targetIndex < 0) return;

    setActiveIndex(targetIndex);
    window.requestAnimationFrame(() => {
      const viewport = carouselRef.current;
      const target = viewport?.querySelector<HTMLElement>(
        `[data-ticket-slide-index="${targetIndex}"]`,
      );
      if (!viewport || !target) return;

      const targetLeft =
        target.offsetLeft - (viewport.clientWidth - target.offsetWidth) / 2;
      viewport.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
    });
  }, [focusRequest, ticketItems]);

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(carouselItemCount - 1, 0)),
    );
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });

    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, [carouselItemCount]);

  const closestSlide = (viewport: HTMLDivElement) => {
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-ticket-slide]"),
    );

    if (slides.length === 0) return null;

    return slides.reduce(
      (closest, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        return distance < closest.distance
          ? { index, slide, distance }
          : closest;
      },
      {
        index: 0,
        slide: slides[0],
        distance: Number.POSITIVE_INFINITY,
      },
    );
  };

  const currentSlideIndex = (viewport: HTMLDivElement) =>
    closestSlide(viewport)?.index ?? activeIndex;

  const snapToClosestSlide = (
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || carouselItemCount === 0) return;

    const closest = closestSlide(viewport);
    if (!closest) return;

    const targetLeft =
      closest.slide.offsetLeft +
      closest.slide.offsetWidth / 2 -
      viewport.clientWidth / 2;

    setActiveIndex(closest.index);
    viewport.scrollTo({ left: targetLeft, behavior });
  };

  const snapToSlideIndex = (
    index: number,
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || carouselItemCount === 0) return;

    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-ticket-slide]"),
    );
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[nextIndex];
    if (!slide) return;

    const targetLeft =
      slide.offsetLeft + slide.offsetWidth / 2 - viewport.clientWidth / 2;

    setActiveIndex(nextIndex);
    viewport.scrollTo({ left: targetLeft, behavior });
  };

  const updateActiveSlide = (event: React.UIEvent<HTMLDivElement>) => {
    if (carouselItemCount === 0) return;

    const viewport = event.currentTarget;
    const closest = closestSlide(viewport);
    if (closest) setActiveIndex(closest.index);

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    snapTimerRef.current = window.setTimeout(() => {
      if (!dragState.current.interacting) {
        snapToClosestSlide(viewport);
      }
    }, 120);
  };

  const startDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (
      (event.target as HTMLElement).closest("[data-drag-scroll-ignore]")
    ) {
      return;
    }

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    dragState.current = {
      active: true,
      interacting: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: currentSlideIndex(event.currentTarget),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;

    event.preventDefault();
    if (Math.abs(event.clientX - dragState.current.startX) > 8) {
      dragState.current.moved = true;
    }
    event.currentTarget.scrollLeft =
      dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
  };

  const finishDesktopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasActive = dragState.current.active;
    const dragDistance = event.clientX - dragState.current.startX;
    const threshold = 22;
    const targetElement = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    const tappedSlide = targetElement?.closest<HTMLElement>(
      "[data-ticket-slide-index]",
    );
    const tappedIndex =
      tappedSlide?.dataset.ticketSlideIndex !== undefined
        ? Number(tappedSlide.dataset.ticketSlideIndex)
        : Number.NaN;
    const tappedItem = Number.isInteger(tappedIndex)
      ? ticketItems[tappedIndex]
      : null;
    dragState.current.active = false;
    dragState.current.interacting = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "blind-date"
    ) {
      onOpenBlindDate(tappedItem.offer.id);
      return;
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "stored-ticket"
    ) {
      setSelectedTicket(tappedItem.userTicket);
      return;
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "date-application" &&
      tappedItem.ticket
    ) {
      setSelectedApplicationTicketDeclined(false);
      setSelectedApplicationTicketOpen(false);
      setSelectedApplicationTicket(tappedItem.ticket);
      return;
    }

    if (
      !dragState.current.moved &&
      Math.abs(dragDistance) <= 8 &&
      tappedItem?.kind === "interaction-ticket"
    ) {
      setSelectedApplicationTicketDeclined(
        tappedItem.interaction.status === "no",
      );
      setSelectedApplicationTicketOpen(
        ticketInteractionCanRespond(tappedItem.interaction),
      );
      setSelectedApplicationTicket(tappedItem.interaction.ticket);
      return;
    }

    if (dragState.current.moved) {
      window.setTimeout(() => {
        dragState.current.moved = false;
      }, 0);
    }

    if (!wasActive) return;

    if (Math.abs(dragDistance) > threshold) {
      snapToSlideIndex(
        dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
        event.currentTarget,
      );
    } else {
      snapToSlideIndex(dragState.current.startIndex, event.currentTarget);
    }
  };

  const startTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    if (
      (event.target as HTMLElement).closest("[data-drag-scroll-ignore]")
    ) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    dragState.current = {
      active: false,
      interacting: true,
      moved: false,
      startX: touch.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: currentSlideIndex(event.currentTarget),
    };
  };

  const moveTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !dragState.current.interacting) return;

    if (Math.abs(touch.clientX - dragState.current.startX) > 8) {
      dragState.current.moved = true;
    }
  };

  const finishTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.interacting) return;

    const touch = event.changedTouches[0];
    const dragDistance = touch
      ? touch.clientX - dragState.current.startX
      : 0;
    const moved = dragState.current.moved;
    dragState.current.interacting = false;

    if (moved) {
      if (Math.abs(dragDistance) > 54) {
        snapToSlideIndex(
          dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
          event.currentTarget,
        );
      } else {
        snapToClosestSlide(event.currentTarget);
      }

      window.setTimeout(() => {
        dragState.current.moved = false;
      }, 180);
    }
  };

  const openStoredTicket = (ticket: UserTicket) => {
    if (dragState.current.moved) return;
    setSelectedTicket(ticket);
  };

  const openDeclinedReview = async () => {
    setDeclinedViewOpen(true);
    setDeclinedLoading(true);
    setDeclinedError(null);
    const locallyDeclined = availableTickets.filter((ticket) => ticket.rejected);

    try {
      const response = await fetch(
        "/api/meetings/available-tickets?view=declined",
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | { tickets?: GatheringTicket[]; error?: string }
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "declined-tickets-load-failed");
      }
      const mergedTickets = new Map(
        [...locallyDeclined, ...(data.tickets ?? [])].map((ticket) => [
          ticket.id,
          ticket,
        ]),
      );
      setDeclinedTickets(Array.from(mergedTickets.values()));
    } catch (loadError) {
      setDeclinedError(
        loadError instanceof Error &&
          loadError.message !== "declined-tickets-load-failed"
          ? loadError.message
          : "거절한 티켓을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setDeclinedLoading(false);
    }
  };

  return (
    <TabMotion>
      <AnimatePresence mode="wait" initial={false}>
        {selectedTicket ? (
          <StoredTicketDetailView
            key={`stored-ticket-detail-${selectedTicket.id}`}
            userTicket={selectedTicket}
            participantPhotoUrl={participantPhotoUrl}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            onClose={() => setSelectedTicket(null)}
            onCancelApplication={
              !readOnly && selectedTicketApplication
                ? async () => {
                    const cancelled = await onCancelApplication(
                      selectedTicketApplication,
                      selectedTicket.ticket,
                    );
                    if (cancelled) setSelectedTicket(null);
                    return cancelled;
                  }
                : undefined
            }
          />
        ) : selectedApplicationTicket ? (
          <AssignedApplicationTicketDetailView
            key={`assigned-application-ticket-${selectedApplicationTicket.id}`}
            ticket={selectedApplicationTicket}
            participantPhotoUrl={participantPhotoUrl}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            onClose={() => {
              setSelectedApplicationTicket(null);
              setSelectedApplicationTicketDeclined(false);
              setSelectedApplicationTicketOpen(false);
            }}
            onReapply={
              !readOnly && selectedApplicationTicketDeclined
                ? () => {
                  const ticket = selectedApplicationTicket;
                  setSelectedApplicationTicket(null);
                  setSelectedApplicationTicketDeclined(false);
                  setSelectedApplicationTicketOpen(false);
                  onReapplyTicket(ticket);
                }
                : undefined
            }
            onAccept={
              !readOnly && selectedApplicationTicketOpen
                ? () => {
                    const ticket = selectedApplicationTicket;
                    setSelectedApplicationTicket(null);
                    setSelectedApplicationTicketOpen(false);
                    onReapplyTicket(ticket);
                  }
                : undefined
            }
            onDecline={
              !readOnly && selectedApplicationTicketOpen
                ? async () => {
                    const declined = await onDeclineTicket(
                      selectedApplicationTicket,
                    );
                    if (!declined) return false;
                    setSelectedApplicationTicket(null);
                    setSelectedApplicationTicketOpen(false);
                    return true;
                  }
                : undefined
            }
          />
        ) : declinedViewOpen ? (
          <DeclinedTicketReview
            key="declined-ticket-review"
            tickets={declinedTickets}
            loading={declinedLoading}
            error={declinedError}
            onBack={() => setDeclinedViewOpen(false)}
            onOpen={(ticket) => {
              setSelectedApplicationTicketDeclined(true);
              setSelectedApplicationTicketOpen(false);
              setSelectedApplicationTicket(ticket);
            }}
          />
        ) : (
          <motion.section
            key="stored-ticket-list"
            aria-busy={loadingMore}
            exit={{ opacity: 0, y: -8 }}
            transition={ticketFadeTransition}
            className="flex h-full min-h-full flex-col overflow-hidden bg-transparent pb-2 pt-[calc(16px+env(safe-area-inset-top))] text-[#24211d]"
          >
            {initialLoading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-24 pt-4">
                <MatchingLoader message="티켓을 준비중이에요." />
              </div>
            ) : itemCount === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-3 pt-4">
                <div className="relative flex aspect-[1/1.618] w-full max-w-[340px] flex-col justify-center bg-[#f8f4eb] px-7 py-10 text-center shadow-[0_24px_60px_rgba(39,34,24,0.09)] before:pointer-events-none before:absolute before:inset-0 before:border before:border-black/[0.11] after:pointer-events-none after:absolute after:inset-2 after:border after:border-black/[0.055]">
                  <div className="relative">
                    <TicketIcon
                      size={22}
                      strokeWidth={1.35}
                      className="mx-auto text-black/38"
                      aria-hidden
                    />
                    <h2 className="mt-6 text-[22px] font-bold leading-[1.34] tracking-[-0.045em] text-black">
                      신청 탭에서 나에게 온
                      <br />
                      초대장을 확인해보세요.
                    </h2>
                    <button
                      type="button"
                      onClick={onGoRecommend}
                      className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-black/[0.88] px-5 text-[13px] font-bold text-white transition hover:bg-black active:scale-[0.99]"
                    >
                      이번 주 초대 보러 가기
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-center pb-3 pt-4">
                <div
                  ref={carouselRef}
                  onScroll={updateActiveSlide}
                  onPointerDown={startDesktopDrag}
                  onPointerMove={moveDesktopDrag}
                  onPointerUp={finishDesktopDrag}
                  onPointerCancel={finishDesktopDrag}
                  onTouchStart={startTouchScroll}
                  onTouchMove={moveTouchScroll}
                  onTouchEnd={finishTouchScroll}
                  onTouchCancel={finishTouchScroll}
                  style={{
                    scrollBehavior: "smooth",
                    WebkitOverflowScrolling: "touch",
                  }}
                  className="-my-10 flex shrink-0 cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-[11%] py-10 scrollbar-none overscroll-x-contain touch-pan-x active:cursor-grabbing"
                >
                  {ticketItems.map((item, index) => (
                    <div
                      key={item.id}
                      data-ticket-slide
                      data-ticket-slide-index={index}
                      className="w-[min(78vw,340px)] shrink-0 snap-center snap-always"
                    >
                      {item.kind === "stored-ticket" ? (
                        <StoredTicketCard
                          userTicket={item.userTicket}
                          onOpen={() => openStoredTicket(item.userTicket)}
                        />
                      ) : item.kind === "interaction-ticket" ? (
                        <InteractionTicketCard
                          interaction={item.interaction}
                          application={item.application}
                          onOpen={() => {
                            setSelectedApplicationTicketDeclined(
                              item.interaction.status === "no",
                            );
                            setSelectedApplicationTicketOpen(
                              ticketInteractionCanRespond(item.interaction),
                            );
                            setSelectedApplicationTicket(item.interaction.ticket);
                          }}
                        />
                      ) : item.kind === "blind-date" ? (
                        <BlindDateTicketCard
                          offer={item.offer}
                          onOpen={() => onOpenBlindDate(item.offer.id)}
                        />
                      ) : (
                        <AssignedApplicationTicketCard
                          application={item.application}
                          ticket={item.ticket}
                          onOpen={() => {
                            setSelectedApplicationTicketDeclined(false);
                            setSelectedApplicationTicketOpen(false);
                            setSelectedApplicationTicket(item.ticket);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {carouselItemCount > 1 && (
                  <div
                    className="mt-1.5 flex shrink-0 justify-center gap-1.5"
                    aria-label={`티켓 ${activeIndex + 1}/${carouselItemCount}`}
                  >
                    {Array.from({ length: carouselItemCount }, (_, index) => (
                      <span
                        key={`ticket-page-${index}`}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition",
                          activeIndex === index ? "bg-black/70" : "bg-black/15",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </TabMotion>
  );
}

function DeclinedTicketReview({
  tickets,
  loading,
  error,
  onBack,
  onOpen,
}: {
  tickets: GatheringTicket[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onOpen: (ticket: GatheringTicket) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const dragState = useRef({
    active: false,
    interacting: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    startIndex: 0,
  });

  const closestSlide = (viewport: HTMLDivElement) => {
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-declined-ticket-slide]"),
    );
    if (slides.length === 0) return null;

    return slides.reduce(
      (closest, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        return distance < closest.distance
          ? { index, slide, distance }
          : closest;
      },
      {
        index: 0,
        slide: slides[0],
        distance: Number.POSITIVE_INFINITY,
      },
    );
  };

  const snapToSlideIndex = (
    index: number,
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || tickets.length === 0) return;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-declined-ticket-slide]"),
    );
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[nextIndex];
    if (!slide) return;

    setActiveIndex(nextIndex);
    viewport.scrollTo({
      left:
        slide.offsetLeft +
        slide.offsetWidth / 2 -
        viewport.clientWidth / 2,
      behavior,
    });
  };

  const snapToClosestSlide = (
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport) return;
    const closest = closestSlide(viewport);
    if (!closest) return;
    snapToSlideIndex(closest.index, viewport, behavior);
  };

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(tickets.length - 1, 0)),
    );
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });

    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, [tickets.length]);

  const updateActiveSlide = (event: React.UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const closest = closestSlide(viewport);
    if (closest) setActiveIndex(closest.index);

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    snapTimerRef.current = window.setTimeout(() => {
      if (!dragState.current.interacting) snapToClosestSlide(viewport);
    }, 120);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    const closest = closestSlide(event.currentTarget);
    dragState.current = {
      active: true,
      interacting: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: closest?.index ?? activeIndex,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const distance = event.clientX - dragState.current.startX;
    if (Math.abs(distance) > 7) dragState.current.moved = true;
    event.currentTarget.scrollLeft = dragState.current.scrollLeft - distance;
    event.preventDefault();
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dragDistance = event.clientX - dragState.current.startX;
    const moved = dragState.current.moved;
    const tappedSlide = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-declined-ticket-slide-index]");
    const tappedIndex = Number(tappedSlide?.dataset.declinedTicketSlideIndex);

    dragState.current.active = false;
    dragState.current.interacting = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!moved && Math.abs(dragDistance) <= 8 && Number.isInteger(tappedIndex)) {
      const ticket = tickets[tappedIndex];
      if (ticket) onOpen(ticket);
      return;
    }

    if (Math.abs(dragDistance) > 22) {
      snapToSlideIndex(
        dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
        event.currentTarget,
      );
    } else {
      snapToSlideIndex(dragState.current.startIndex, event.currentTarget);
    }

    window.setTimeout(() => {
      dragState.current.moved = false;
    }, 0);
  };

  const startTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    const closest = closestSlide(event.currentTarget);
    dragState.current = {
      active: false,
      interacting: true,
      moved: false,
      startX: touch.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: closest?.index ?? activeIndex,
    };
  };

  const moveTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !dragState.current.interacting) return;
    if (Math.abs(touch.clientX - dragState.current.startX) > 8) {
      dragState.current.moved = true;
    }
  };

  const finishTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.interacting) return;
    const touch = event.changedTouches[0];
    const dragDistance = touch
      ? touch.clientX - dragState.current.startX
      : 0;
    const moved = dragState.current.moved;
    dragState.current.interacting = false;

    if (moved && Math.abs(dragDistance) > 54) {
      snapToSlideIndex(
        dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
        event.currentTarget,
      );
    } else {
      snapToClosestSlide(event.currentTarget);
    }

    window.setTimeout(() => {
      dragState.current.moved = false;
    }, 180);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={ticketFadeTransition}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f4ed] pb-2 pt-[calc(12px+env(safe-area-inset-top))] text-black"
    >
      <header className="shrink-0 px-5 pr-28">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-black/48 transition hover:bg-black/[0.04] hover:text-black"
          aria-label="티켓함으로 돌아가기"
        >
          <ChevronLeft size={21} aria-hidden />
        </button>
        <p className="mt-2 text-[20px] font-extrabold tracking-[-0.04em] text-black">
          거절한 티켓 <span className="ml-1 text-[15px] font-bold text-black/38">{tickets.length}</span>
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs font-bold text-black/38">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          거절한 티켓을 불러오는 중...
        </div>
      ) : error ? (
        <div className="mx-5 mt-10 rounded-[24px] border border-red-100 bg-red-50 px-5 py-6 text-center">
          <p className="text-xs font-semibold leading-5 text-red-600">{error}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 text-xs font-black text-black/55"
          >
            티켓함으로 돌아가기
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-20 text-center">
          <h2 className="text-lg font-bold">거절한 티켓이 없어요.</h2>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 -translate-y-3 flex-col justify-center pb-3 pt-4">
          <div
            ref={carouselRef}
            onScroll={updateActiveSlide}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onTouchStart={startTouchScroll}
            onTouchMove={moveTouchScroll}
            onTouchEnd={finishTouchScroll}
            onTouchCancel={finishTouchScroll}
            style={{
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
            className="-my-10 flex shrink-0 cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-[11%] py-10 scrollbar-none overscroll-x-contain touch-pan-x active:cursor-grabbing"
          >
            {tickets.map((ticket, index) => (
              <div
                key={ticket.id}
                data-declined-ticket-slide
                data-declined-ticket-slide-index={index}
                className="w-[min(78vw,340px)] shrink-0 snap-center snap-always"
              >
                <DeclinedTicketCard
                  ticket={ticket}
                  onOpen={() => {
                    if (!dragState.current.moved) onOpen(ticket);
                  }}
                />
              </div>
            ))}
          </div>
          {tickets.length > 1 && (
            <div className="mt-1.5 flex shrink-0 justify-center gap-1.5">
              {tickets.map((ticket, index) => (
                <span
                  key={`declined-page-${ticket.id}`}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition",
                    activeIndex === index ? "bg-black/70" : "bg-black/15",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

const ticketPaperFrameClass =
  "relative aspect-[1/1.618] w-full rounded-[28px]";

const ticketPaperImageClass = "!h-full !aspect-auto !rounded-[28px] shadow-none";

function DeclinedTicketCard({
  ticket,
  onOpen,
}: {
  ticket: GatheringTicket;
  onOpen: () => void;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title} 거절한 티켓 상세 보기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        ticketPaperFrameClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-4",
      )}
    >
      <IntersectionTicketCard
        title={ticket.title}
        appearance="minimal"
        date={ticket.date}
        time={ticket.time}
        location={`서울\n${ticket.area}`}
        tags={ticket.moodTags}
        badgeLabel={null}
        badgeClassName="border-white/25 bg-white/[0.18] text-white"
        remainingSeatCount={ticket.remainingSeatCount}
        className={cn(ticketPaperImageClass, "grayscale")}
      />
    </motion.div>
  );
}

function StoredTicketCard({
  userTicket,
  onOpen,
}: {
  userTicket: UserTicket;
  onOpen: () => void;
}) {
  const ticket = userTicket.ticket;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title} 자세히 보기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        ticketPaperFrameClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4",
      )}
    >
      <IntersectionTicketCard
        title={ticket.title}
        appearance="minimal"
        date={ticket.date}
        time={ticket.time}
        location={`서울\n${ticket.area}`}
        tags={ticket.moodTags}
        badgeLabel="신청 완료"
        badgeClassName={statusBadgeClass(userTicket.status)}
        remainingSeatCount={ticket.remainingSeatCount}
        className={ticketPaperImageClass}
      />
    </motion.div>
  );
}

function AssignedApplicationTicketDetailView({
  ticket,
  onClose,
  onReapply,
  onAccept,
  onDecline,
  participantPhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
}: {
  ticket: GatheringTicket;
  onClose: () => void;
  onReapply?: () => void;
  onAccept?: () => void;
  onDecline?: () => Promise<boolean>;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
}) {
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const decline = async () => {
    if (!onDecline || responding) return;
    setResponding(true);
    setResponseError(null);
    const declined = await onDecline().catch(() => false);
    if (!declined) {
      setResponseError("선택을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setResponding(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative min-h-full overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f7f4ee_48%,#f2eee6_100%)] px-5 pb-28 pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]"
    >
      <button
        type="button"
        onClick={onClose}
        disabled={responding}
        aria-label="티켓 상세 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center text-[#24211d]/58 transition hover:text-[#24211d]"
      >
        <X size={18} aria-hidden />
      </button>

      <motion.header
        initial={{ y: "32vh" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        className="px-10 text-center"
      >
        <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
          {ticket.title}
        </h1>
        <p className="font-ticket-latin mt-4 text-[13px] font-medium text-[#24211d]/58">
          {[formatTicketDateLabel(ticket.date), formatTicketTimeLabel(ticket.time)]
            .filter(Boolean)
            .join(" · ")}
          {ticket.area ? ` · 서울 ${ticket.area}` : ""}
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 text-[#24211d]"
      >
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          sections={["summary", "course"]}
          className="pb-5"
        />
      </motion.div>
      {responseError && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {responseError}
        </p>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          onAccept && onDecline ? (
            <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] grid h-[68px] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 grid-cols-[0.72fr_2.1fr] items-center gap-2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
              <motion.button
                type="button"
                whileTap={!responding ? { scale: 0.98 } : undefined}
                disabled={responding}
                onClick={() => void decline()}
                className="flex h-[56px] items-center justify-center rounded-full bg-transparent text-[15px] font-black tracking-[0.04em] text-black/42 disabled:opacity-40"
              >
                NO
              </motion.button>
              <motion.button
                type="button"
                whileTap={!responding ? { scale: 0.98 } : undefined}
                disabled={responding}
                onClick={onAccept}
                className="font-ticket-latin flex h-[56px] items-center justify-center rounded-full bg-black text-[18px] font-bold italic tracking-[0.08em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] disabled:bg-black/20"
              >
                YES
              </motion.button>
            </div>
          ) : onReapply ? (
            <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={onReapply}
                className="font-ticket-latin flex h-[56px] w-full items-center justify-center rounded-full bg-black text-[18px] font-bold italic tracking-[0.08em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)]"
              >
                YES
              </motion.button>
            </div>
          ) : null,
          document.body,
        )}
    </motion.section>
  );
}

function AssignedApplicationTicketCard({
  application,
  ticket,
  onOpen,
}: {
  application: MeetingDateApplication;
  ticket: GatheringTicket;
  onOpen: () => void;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title} 자세히 보기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={cn(
        ticketPaperFrameClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-4",
      )}
    >
      <IntersectionTicketCard
        title={ticket.title}
        appearance="minimal"
        date={application.meetingDate || ticket.date}
        time={application.meetingTime || ticket.time}
        location={`서울\n${ticket.area || application.region}`}
        tags={ticket.moodTags}
        badgeLabel="신청 완료"
        badgeClassName={dateApplicationBadgeClass(application)}
        remainingSeatCount={ticket.remainingSeatCount}
        className={ticketPaperImageClass}
      />
    </motion.div>
  );
}

function InteractionTicketCard({
  interaction,
  application,
  onOpen,
}: {
  interaction: TicketInteraction;
  application: MeetingDateApplication | null;
  onOpen: () => void;
}) {
  const { ticket, status } = interaction;
  const applicationComplete = Boolean(
    application && ["waitlisted", "on_hold"].includes(application.status),
  );
  const showsDeadline =
    !applicationComplete && ticketInteractionShowsDeadline(status);
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${ticket.title} 자세히 보기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        ticketPaperFrameClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-4",
      )}
    >
      <IntersectionTicketCard
        title={ticket.title}
        appearance="minimal"
        date={ticket.date}
        time={ticket.time}
        location={`서울\n${ticket.area}`}
        tags={ticket.moodTags}
        badgeLabel={
          showsDeadline
            ? null
            : applicationComplete
              ? "신청 완료"
              : ticketInteractionBadgeLabel(status)
        }
        badgeClassName={
          status === "payment_confirmed"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-none"
            : status === "payment_pending"
              ? "border-amber-200 bg-amber-50 text-amber-700 shadow-none"
              : status === "no"
                ? "border-white/30 bg-black/55 text-white shadow-none"
                : "border-white/25 bg-white/[0.18] text-white"
        }
        remainingSeatCount={ticket.remainingSeatCount}
        className={ticketPaperImageClass}
      />
      {showsDeadline && (
        <UnansweredTicketCountdown ticket={ticket} />
      )}
    </motion.div>
  );
}

function BlindDateTicketCard({
  offer,
  onOpen,
}: {
  offer: BlindDateUserOffer;
  onOpen: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const feedbackOpensAt = offer.feedbackOpensAt
    ? new Date(offer.feedbackOpensAt).getTime()
    : Number.NaN;
  const feedbackClosesAt = offer.feedbackClosesAt
    ? new Date(offer.feedbackClosesAt).getTime()
    : Number.NaN;
  const feedbackIsOpen =
    Number.isFinite(feedbackOpensAt) &&
    Number.isFinite(feedbackClosesAt) &&
    nowMs >= feedbackOpensAt &&
    nowMs < feedbackClosesAt;
  const feedbackRemainingSeconds = feedbackIsOpen
    ? Math.max(0, Math.ceil((feedbackClosesAt - nowMs) / 1000))
    : null;
  const feedbackRemainingTime =
    feedbackRemainingSeconds === null
      ? null
      : [
          Math.floor(feedbackRemainingSeconds / 3600),
          Math.floor((feedbackRemainingSeconds % 3600) / 60),
          feedbackRemainingSeconds % 60,
        ]
          .map((value) => String(value).padStart(2, "0"))
          .join(":");

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="블라인드 데이트 티켓 자세히 보기"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        ticketPaperFrameClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-[#765a69] focus-visible:ring-offset-4",
      )}
    >
      <IntersectionTicketCard
        title="BLIND DATE"
        appearance="minimal"
        minimalTone="blind-date"
        date={offer.scheduledDate}
        time={offer.timeLabel}
        location={offer.region}
        badgeLabel={
          feedbackRemainingTime
            ? `마감까지 ${feedbackRemainingTime}`
            : "초대 도착"
        }
        badgeClassName="border-[#bda9b4]/70 bg-[#f8f3f5]/70 text-[#765a69] shadow-none"
        className={ticketPaperImageClass}
      />
    </motion.div>
  );
}

function ticketResponseDeadline(ticket: GatheringTicket) {
  if (ticket.applicationClosesAt) {
    const configuredDeadline = new Date(ticket.applicationClosesAt);
    if (Number.isFinite(configuredDeadline.getTime())) return configuredDeadline;
  }

  const startsAt = ticketStartAtInKst(ticket.date, ticket.time);
  return startsAt
    ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000)
    : null;
}

export function ticketResponseRemainingTime(
  ticket: GatheringTicket,
  nowMs = Date.now(),
) {
  const deadline = ticketResponseDeadline(ticket);
  if (!deadline) return null;

  const totalSeconds = Math.max(
    0,
    Math.ceil((deadline.getTime() - nowMs) / 1000),
  );
  const totalHours = Math.floor(totalSeconds / 3600);
  const days = totalHours >= 72 ? Math.floor(totalHours / 24) : 0;
  const hours = days > 0 ? totalHours % 24 : totalHours;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(" : ");
  return days > 0 ? `${days}d : ${clock}` : clock;
}

function UnansweredTicketCountdown({ ticket }: { ticket: GatheringTicket }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingTime = ticketResponseRemainingTime(ticket, nowMs);
  if (!remainingTime) return null;

  return (
    <time
      dateTime={ticketResponseDeadline(ticket)?.toISOString()}
      aria-label={`마감까지 ${remainingTime}`}
      className="pointer-events-none absolute inset-x-6 bottom-7 z-10 text-center text-[12px] font-semibold tabular-nums text-[#24211d]/75"
    >
      마감까지 {remainingTime}
    </time>
  );
}

function dateApplicationBadgeClass(application: MeetingDateApplication) {
  if (application.status === "payment_pending") {
    return "border-amber-200 bg-amber-50 text-amber-700 shadow-none";
  }

  if (application.status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-none";
  }

  return "border-white/25 bg-white/[0.18] text-white";
}

export function StoredTicketDetailView({
  userTicket,
  onClose,
  onCancelApplication,
  previewMode = false,
  participantPhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
  selectedProgressStep: controlledProgressStep,
  onProgressStepChange,
}: {
  userTicket: UserTicket;
  onClose: () => void;
  onCancelApplication?: () => Promise<boolean>;
  previewMode?: boolean;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
  selectedProgressStep?: TicketProgressViewStepKey;
  onProgressStepChange?: (step: TicketProgressViewStepKey) => void;
}) {
  const ticket = userTicket.ticket;
  const matchedMembers = userTicket.members.filter((member) => !member.isSelf);
  const matchedMemberPhotoUrls = matchedMembers
    .map((member) => member.photoUrl?.trim())
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
  const hasAuthoritativeMembers = userTicket.members.length > 0;
  const displayedMatchPhotoUrls = hasAuthoritativeMembers
    ? matchedMemberPhotoUrls
    : previewMatchPhotoUrls;
  const displayedMatchMemberCount = hasAuthoritativeMembers
    ? matchedMembers.length
    : undefined;
  const currentGroupMemberIds = new Set(
    userTicket.members.map((member) => member.id),
  );
  const otherGroupMembers = (userTicket.feedbackMembers ?? []).filter(
    (member) => !member.isSelf && !currentGroupMemberIds.has(member.id),
  );
  const otherGroupPhotoUrls = otherGroupMembers
    .map((member) => member.photoUrl?.trim())
    .filter((photoUrl): photoUrl is string => Boolean(photoUrl));
  const displayedOtherMemberPhotoUrls = otherGroupMembers.length > 0
    ? otherGroupPhotoUrls.slice(0, 6)
    : previewOtherMemberPhotoUrls;
  const [progressNow, setProgressNow] = useState(() => new Date());
  const [statusOpen, setStatusOpen] = useState(true);
  const [internalProgressStep, setInternalProgressStep] =
    useState<TicketProgressViewStepKey>(() =>
      defaultProgressViewStepKey(
        ticket,
        userTicket.progressStep,
        userTicket.meetingStartAt,
      ),
    );
  const selectedProgressStep = controlledProgressStep ?? internalProgressStep;
  const activeProgressStep = defaultProgressViewStepKey(
    ticket,
    userTicket.progressStep,
    userTicket.meetingStartAt,
    progressNow,
  );

  useEffect(() => {
    const timer = window.setInterval(() => setProgressNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (controlledProgressStep) return;
    setInternalProgressStep(activeProgressStep);
  }, [activeProgressStep, controlledProgressStep, userTicket.id, userTicket.progressStep]);

  useEffect(() => {
    if (controlledProgressStep) return;
    setInternalProgressStep((current) => {
      const currentIndex = progressViewStepIndex(
        ticketProgressViewSteps(ticket),
        current,
      );
      const activeIndex = progressViewStepIndex(
        ticketProgressViewSteps(ticket),
        activeProgressStep,
      );
      return currentIndex < activeIndex ? activeProgressStep : current;
    });
  }, [activeProgressStep, controlledProgressStep, ticket]);

  const handleProgressStepChange = useCallback(
    (step: TicketProgressViewStepKey) => {
      if (!controlledProgressStep) setInternalProgressStep(step);
      onProgressStepChange?.(step);
    },
    [controlledProgressStep, onProgressStepChange],
  );

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative min-h-full overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f7f4ee_48%,#f2eee6_100%)] px-5 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="티켓 상세 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center text-[#24211d]/58 transition hover:text-[#24211d]"
      >
        <X size={18} aria-hidden />
      </button>

      <motion.header
        initial={{ y: "32vh" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        className="px-10 text-center"
      >
        <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
          {ticket.title}
        </h1>
        <p className="font-ticket-latin mt-4 text-[13px] font-medium text-[#24211d]/58">
          {[formatTicketDateLabel(ticket.date), formatTicketTimeLabel(ticket.time)]
            .filter(Boolean)
            .join(" · ")}
          {ticket.area ? ` · 서울 ${ticket.area}` : ""}
        </p>
        <button
          type="button"
          aria-expanded={statusOpen}
          onClick={() => setStatusOpen((current) => !current)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#d0cbbc] px-4 py-2 text-[11px] font-semibold text-[#24211d]/58 transition hover:border-[#a9a294] hover:text-[#24211d]"
        >
          {userTicket.statusLabel}
          {statusOpen ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        </button>
      </motion.header>

      <motion.article
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 pt-1 text-[#24211d]"
      >
          <TicketStatusOverview
            userTicket={userTicket}
            now={progressNow}
            open={statusOpen}
            selectedProgressStep={selectedProgressStep}
            onSelectProgressStep={handleProgressStepChange}
          />
          <TicketStageContent
            userTicket={userTicket}
            progressStep={selectedProgressStep}
            previewMode={previewMode}
            participantPhotoUrl={participantPhotoUrl}
            previewMatchPhotoUrls={displayedMatchPhotoUrls}
            previewOtherMemberPhotoUrls={displayedOtherMemberPhotoUrls}
            matchMemberCount={displayedMatchMemberCount}
            onCancelApplication={onCancelApplication}
          />
      </motion.article>

    </motion.section>
  );
}

function statusBadgeClass(_status: UserTicketStatus) {
  return "border-white/25 bg-white/20 text-white shadow-[0_10px_22px_rgba(0,0,0,0.2)]";
}

function detailStatusBadgeClass(status: UserTicketStatus) {
  if (status === "payment_pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "waitlisted") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (status === "feedback_open") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (status === "in_progress") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-black/10 bg-black/[0.04] text-black/65";
}

const ticketProgressSteps: Array<{ key: TicketProgressStep; label: string }> = [
  { key: "applied", label: "신청 완료" },
  { key: "approved", label: "참여 확정" },
  { key: "pre_start", label: "시작 전 안내" },
  { key: "in_progress", label: "진행 중" },
  { key: "feedback", label: "피드백 작성" },
];

type TicketActivityCourseStep = NonNullable<GatheringTicket["courseSteps"]>[number];
type TicketProgressViewStepKey = TicketProgressStep | `activity:${string}`;
type TicketProgressViewStep = {
  key: TicketProgressViewStepKey;
  label: string;
  baseStep: TicketProgressStep;
  courseStep?: TicketActivityCourseStep;
};

const ticketBaseProgressSteps: Array<{
  key: Exclude<TicketProgressStep, "in_progress">;
  label: string;
}> = [
  { key: "applied", label: "신청 완료" },
  { key: "approved", label: "참여 확정" },
  { key: "pre_start", label: "시작 전 안내" },
  { key: "feedback", label: "피드백 작성" },
];

const activityStepLabels = [
  "첫 활동",
  "두 번째 활동",
  "세 번째 활동",
  "네 번째 활동",
  "다섯 번째 활동",
] as const;

function activityStepLabel(index: number) {
  return activityStepLabels[index] ?? `${index + 1}번째 활동`;
}

function cleanActivityCourseSteps(ticket: GatheringTicket) {
  return (ticket.courseSteps ?? []).filter((step) =>
    Boolean(
      step.title?.trim() ||
        step.activityType?.trim() ||
        step.imageUrl?.trim() ||
        step.placeName?.trim() ||
        step.address?.trim() ||
        step.place,
    ),
  );
}

function ticketProgressViewSteps(ticket: GatheringTicket): TicketProgressViewStep[] {
  const activitySteps = cleanActivityCourseSteps(ticket);
  const activities =
    activitySteps.length > 0
      ? activitySteps
      : [
          {
            id: "activity-1",
            order: 1,
            isMainActivity: true,
          } as TicketActivityCourseStep,
        ];

  return [
    {
      key: "applied",
      label: ticketBaseProgressSteps[0].label,
      baseStep: "applied",
    },
    {
      key: "approved",
      label: ticketBaseProgressSteps[1].label,
      baseStep: "approved",
    },
    {
      key: "pre_start",
      label: ticketBaseProgressSteps[2].label,
      baseStep: "pre_start",
    },
    ...activities.map((courseStep, index) => ({
      key: `activity:${courseStep.id || index + 1}` as TicketProgressViewStepKey,
      label: activityStepLabel(index),
      baseStep: "in_progress" as TicketProgressStep,
      courseStep,
    })),
    {
      key: "feedback",
      label: ticketBaseProgressSteps[3].label,
      baseStep: "feedback",
    },
  ];
}

function progressViewBaseStep(step: TicketProgressViewStepKey): TicketProgressStep {
  return step.startsWith("activity:") ? "in_progress" : (step as TicketProgressStep);
}

function progressViewStepIndex(
  steps: TicketProgressViewStep[],
  stepKey: TicketProgressViewStepKey,
) {
  const directIndex = steps.findIndex((step) => step.key === stepKey);
  if (directIndex >= 0) return directIndex;

  const baseStep = progressViewBaseStep(stepKey);
  return Math.max(
    steps.findIndex((step) => step.baseStep === baseStep),
    0,
  );
}

function defaultProgressViewStepKey(
  ticket: GatheringTicket,
  progressStep: TicketProgressStep,
  meetingStartAt: string | null = null,
  now = new Date(),
): TicketProgressViewStepKey {
  if (progressStep === "in_progress") {
    return currentActivityProgressViewStepKey(ticket, meetingStartAt, now);
  }

  return progressStep;
}

function currentActivityProgressViewStepKey(
  ticket: GatheringTicket,
  meetingStartAt: string | null,
  now: Date,
) {
  const activitySteps = ticketProgressViewSteps(ticket).filter(
    (step) => step.baseStep === "in_progress",
  );
  const firstActivity = activitySteps[0];
  if (!firstActivity) return "in_progress" as TicketProgressViewStepKey;

  const startAt = meetingStartAt ? new Date(meetingStartAt) : null;
  if (!startAt || !Number.isFinite(startAt.getTime())) return firstActivity.key;

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - startAt.getTime()) / (60 * 1000)),
  );
  let activeActivity = firstActivity;

  for (const [index, activity] of activitySteps.entries()) {
    if (
      courseStepOpenOffsetMinutes(activity.courseStep?.openOffsetMinutes, index) <=
      elapsedMinutes
    ) {
      activeActivity = activity;
    }
  }

  return activeActivity.key;
}

function reachedProgressViewStepIndex(
  ticket: GatheringTicket,
  progressStep: TicketProgressStep,
  meetingStartAt: string | null = null,
  now = new Date(),
) {
  const steps = ticketProgressViewSteps(ticket);

  if (progressStep === "in_progress") {
    return progressViewStepIndex(
      steps,
      currentActivityProgressViewStepKey(ticket, meetingStartAt, now),
    );
  }

  return progressViewStepIndex(
    steps,
    defaultProgressViewStepKey(ticket, progressStep, meetingStartAt, now),
  );
}

const introDetailSections: TicketDetailSectionKey[] = [
  "summary",
  "course",
];
const appliedDetailSections: TicketDetailSectionKey[] = [
  "summary",
  "course",
];
const ticketGuidanceClass =
  "mt-4 rounded-2xl border border-[#d8d1c3]/80 bg-[#eee9df] px-4 py-3 text-xs font-bold leading-5 text-[#4b443b]";

function progressStepIndex(step: TicketProgressStep) {
  return Math.max(
    ticketProgressSteps.findIndex((progressStep) => progressStep.key === step),
    0,
  );
}

function countdownText(targetIso: string | null, label: string, now: Date) {
  if (!targetIso) return null;
  const target = new Date(targetIso);
  const remainingMs = target.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeText =
    hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return `${label} ${timeText} 남았어요`;
}

function ticketActivityOpensAt(
  ticket: GatheringTicket,
  meetingStartAt: string | null,
  activityIndex: number,
) {
  const startAt = meetingStartAt ? new Date(meetingStartAt) : null;
  if (!startAt || !Number.isFinite(startAt.getTime())) return null;

  const activity = ticketProgressViewSteps(ticket).filter(
    (step) => step.baseStep === "in_progress",
  )[activityIndex];
  if (!activity) return null;

  const openOffsetMinutes = courseStepOpenOffsetMinutes(
    activity.courseStep?.openOffsetMinutes,
    activityIndex,
  );
  return new Date(
    startAt.getTime() + openOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function useTicketCountdown(userTicket: UserTicket) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (userTicket.progressStep === "approved") {
    const text = countdownText(
      userTicket.arrivalOpensAt,
      "시작 전 안내까지",
      now,
    );
    return text ? { text } : null;
  }

  if (userTicket.progressStep === "pre_start") {
    const text = countdownText(
      ticketActivityOpensAt(userTicket.ticket, userTicket.meetingStartAt, 0) ??
        userTicket.meetingStartAt,
      "첫 활동까지",
      now,
    );
    return text ? { text } : null;
  }

  if (userTicket.progressStep === "in_progress") {
    const activitySteps = ticketProgressViewSteps(userTicket.ticket).filter(
      (step) => step.baseStep === "in_progress",
    );
    const activeActivityKey = currentActivityProgressViewStepKey(
      userTicket.ticket,
      userTicket.meetingStartAt,
      now,
    );
    const activeActivityIndex = Math.max(
      activitySteps.findIndex((step) => step.key === activeActivityKey),
      0,
    );
    const nextActivity = activitySteps[activeActivityIndex + 1];
    const targetIso = nextActivity
      ? ticketActivityOpensAt(
          userTicket.ticket,
          userTicket.meetingStartAt,
          activeActivityIndex + 1,
        )
      : userTicket.feedbackOpensAt;
    const label = nextActivity ? `${nextActivity.label}까지` : "피드백 작성까지";
    const text = countdownText(
      targetIso,
      label,
      now,
    );
    return text ? { text } : null;
  }

  return null;
}

function TicketStatusOverview({
  userTicket,
  now,
  open,
  selectedProgressStep,
  onSelectProgressStep,
}: {
  userTicket: UserTicket;
  now: Date;
  open: boolean;
  selectedProgressStep: TicketProgressViewStepKey;
  onSelectProgressStep: (step: TicketProgressViewStepKey) => void;
}) {
  const ticket = userTicket.ticket;
  const countdown = useTicketCountdown(userTicket);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key="ticket-status-overview"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden border-b border-black/8"
        >
          <div className="py-5">
            <div className="flex w-full items-start justify-between gap-3 text-left">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-black/42">
                  current status
                </p>
                <h2 className="mt-1 text-[17px] font-black text-black">
                  {userTicket.statusLabel}
                </h2>
              </div>
              {countdown && (
                <motion.p
                  key={countdown.text}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 shrink-0 rounded-full border border-[#d0cbbc] bg-[#f7f4ed] px-3 py-1.5 text-right text-[11px] font-black leading-4 text-black/62 shadow-[0_8px_18px_rgba(66,57,44,0.08)]"
                >
                  {countdown.text}
                </motion.p>
              )}
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold text-black/58">
              <TicketMetaLine Icon={CalendarDays}>
                {formatTicketDateLabel(ticket.date)} {formatTicketTimeLabel(ticket.time)}
              </TicketMetaLine>
              <TicketMetaLine Icon={MapPin}>{ticket.area}</TicketMetaLine>
            </div>

            <TicketProgressSteps
              userTicket={userTicket}
              now={now}
              selectedProgressStep={selectedProgressStep}
              onSelectProgressStep={onSelectProgressStep}
            />
            <TicketStatusGuidance
              userTicket={userTicket}
              selectedProgressStep={selectedProgressStep}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function TicketMetaLine({
  Icon,
  children,
}: {
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-sm font-black leading-5 text-black tabular-nums">
      <Icon size={14} className="shrink-0 text-black/35" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function TicketProgressSteps({
  userTicket,
  now,
  selectedProgressStep,
  onSelectProgressStep,
}: {
  userTicket: UserTicket;
  now: Date;
  selectedProgressStep: TicketProgressViewStepKey;
  onSelectProgressStep: (step: TicketProgressViewStepKey) => void;
}) {
  const steps = ticketProgressViewSteps(userTicket.ticket);
  const visibleStepCount = Math.min(5, steps.length);
  const maxWindowStart = Math.max(0, steps.length - visibleStepCount);
  const [windowStart, setWindowStart] = useState(0);
  const progressViewportRef = useRef<HTMLDivElement | null>(null);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const selectedIndex = progressViewStepIndex(steps, selectedProgressStep);
  const activeIndex = reachedProgressViewStepIndex(
    userTicket.ticket,
    userTicket.progressStep,
    userTicket.meetingStartAt,
    now,
  );
  const visibleSteps = steps.slice(windowStart, windowStart + visibleStepCount);
  const canMoveLeft = windowStart > 0;
  const feedbackVisible = visibleSteps.some((step) => step.baseStep === "feedback");
  const canMoveRight = windowStart < maxWindowStart && !feedbackVisible;
  const progressGapRem = 0.375;
  const visibleGapWidth = `${progressGapRem * Math.max(0, visibleStepCount - 1)}rem`;
  const progressTrackStyle: CSSProperties = {
    gridAutoColumns: `calc((100% - ${visibleGapWidth}) / ${visibleStepCount})`,
  };

  useEffect(() => {
    setWindowStart((current) => Math.min(current, maxWindowStart));
  }, [maxWindowStart, steps.length]);

  useEffect(() => {
    const viewport = progressViewportRef.current;
    const track = progressTrackRef.current;
    const firstStep = track?.firstElementChild as HTMLElement | null | undefined;
    if (!viewport || !track || !firstStep) return;

    const columnGap = Number.parseFloat(
      window.getComputedStyle(track).columnGap || "0",
    );
    const stepWidth = firstStep.getBoundingClientRect().width + columnGap;

    viewport.scrollTo({
      left: Math.round(windowStart * stepWidth),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [prefersReducedMotion, steps.length, visibleStepCount, windowStart]);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-[26px_minmax(0,1fr)_26px] items-start gap-1.5">
        <ProgressWindowButton
          direction="left"
          disabled={!canMoveLeft}
          onClick={() => setWindowStart((current) => Math.max(0, current - 1))}
        />
        <div ref={progressViewportRef} className="overflow-hidden">
          <div
            ref={progressTrackRef}
            className="grid grid-flow-col gap-1.5"
            style={progressTrackStyle}
          >
          {steps.map((step, index) => {
          const active = index <= activeIndex;
          const current = index === activeIndex;
          const selected = index === selectedIndex;
          const disabled = index > activeIndex;
          const visible =
            index >= windowStart && index < windowStart + visibleStepCount;

          return (
            <div key={step.key} className="min-w-0" aria-hidden={!visible}>
              <div
                className={cn(
                  "h-1.5 rounded-full transition",
                  active ? "bg-[#8f877a]" : "bg-black/8",
                )}
              />
              <div className="mt-2 flex min-h-10 flex-col items-center text-center">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${step.label} 단계 보기`}
                  aria-pressed={selected}
                  aria-current={current ? "step" : undefined}
                  tabIndex={visible ? undefined : -1}
                  onClick={() => onSelectProgressStep(step.key)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition",
                    selected
                      ? "bg-[#24211d] text-white shadow-[0_4px_12px_rgba(36,33,29,0.22)] ring-2 ring-[#d0cbbc] ring-offset-2 ring-offset-[#f7f4ed]"
                      : active
                        ? "bg-black text-white"
                        : "bg-black/[0.05] text-black/30",
                    active &&
                      !selected &&
                      "hover:-translate-y-0.5 hover:bg-black/[0.08]",
                    disabled && "cursor-default",
                  )}
                >
                  {active ? <Check size={13} aria-hidden /> : index + 1}
                </button>
                <span
                  className={cn(
                    "mt-1 text-[10px] font-black leading-3",
                    selected
                      ? "text-black"
                      : current
                        ? "text-black/75"
                        : active
                        ? "text-black/52"
                        : "text-black/25",
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
          })}
          </div>
        </div>
        <ProgressWindowButton
          direction="right"
          disabled={!canMoveRight}
          onClick={() =>
            setWindowStart((current) => Math.min(maxWindowStart, current + 1))
          }
        />
      </div>
    </div>
  );
}

function ProgressWindowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={
        direction === "left" ? "이전 진행 단계 보기" : "다음 진행 단계 보기"
      }
      className={cn(
        "mt-[14px] flex h-6 w-6 items-center justify-center rounded-full border text-black/48 transition",
        disabled
          ? "cursor-default border-black/5 bg-black/[0.025] text-black/15"
          : "border-black/10 bg-[#faf8f2] shadow-sm hover:-translate-y-0.5 hover:border-black/25 hover:text-black",
      )}
    >
      <Icon size={14} aria-hidden />
    </button>
  );
}

function TicketStatusGuidance({
  userTicket,
  selectedProgressStep,
}: {
  userTicket: UserTicket;
  selectedProgressStep: TicketProgressViewStepKey;
}) {
  const { stageCopy } = userTicket.ticket;
  const baseProgressStep = progressViewBaseStep(selectedProgressStep);

  if (
    baseProgressStep === "applied" &&
    userTicket.status === "payment_pending"
  ) {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "paymentPending")}
      </p>
    );
  }

  if (
    baseProgressStep === "applied" &&
    userTicket.status === "waitlisted"
  ) {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "waitlisted")}
      </p>
    );
  }

  if (baseProgressStep === "applied") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "applied")}
      </p>
    );
  }

  if (baseProgressStep === "pre_start") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "preStart")}
      </p>
    );
  }

  if (baseProgressStep === "in_progress") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "inProgress")}
      </p>
    );
  }

  if (baseProgressStep === "feedback") {
    return (
      <p className={ticketGuidanceClass}>
        {ticketStageText(stageCopy, "feedbackOpen")}
      </p>
    );
  }

  return (
    <p className={ticketGuidanceClass}>
      {ticketStageText(stageCopy, "approved")}
    </p>
  );
}

function selectedActivityCourseStep(
  ticket: GatheringTicket,
  stepKey: TicketProgressViewStepKey,
) {
  if (!stepKey.startsWith("activity:")) return null;

  return (
    ticketProgressViewSteps(ticket).find((step) => step.key === stepKey)
      ?.courseStep ?? null
  );
}

function courseStepPlace(step: TicketActivityCourseStep | null): TicketPlace | null {
  if (!step) return null;

  const place = step.place ?? {
    name: step.placeName ?? null,
    address: step.address ?? null,
  };
  const hasPlaceDetails = Boolean(
    place.name?.trim() ||
      place.address?.trim() ||
      typeof place.mapx === "number" ||
      typeof place.mapy === "number",
  );

  return hasPlaceDetails ? place : null;
}

function TicketStageContent({
  userTicket,
  progressStep,
  previewMode = false,
  participantPhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
  matchMemberCount,
  onCancelApplication,
}: {
  userTicket: UserTicket;
  progressStep: TicketProgressViewStepKey;
  previewMode?: boolean;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
  matchMemberCount?: number;
  onCancelApplication?: () => Promise<boolean>;
}) {
  const ticket = userTicket.ticket;
  const baseProgressStep = progressViewBaseStep(progressStep);
  const selectedCourseStep = selectedActivityCourseStep(ticket, progressStep);
  const selectedPlace = courseStepPlace(selectedCourseStep) ?? userTicket.place;
  const reservationName =
    selectedCourseStep?.reservationName?.trim() ||
    ticket.courseSteps?.[0]?.reservationName?.trim() ||
    ticket.reservationName?.trim() ||
    null;
  const [arrivalStatus, setArrivalStatus] = useState<TicketArrivalStatus | null>(
    userTicket.arrivalStatus,
  );

  useEffect(() => {
    setArrivalStatus(userTicket.arrivalStatus);
  }, [userTicket.arrivalStatus, userTicket.waitlistId]);

  if (baseProgressStep === "feedback") {
    return <TicketFeedbackForm userTicket={userTicket} previewMode={previewMode} />;
  }

  if (baseProgressStep === "in_progress") {
    return (
      <>
        <ArrivalStatusPanel
          userTicket={userTicket}
          reservationName={reservationName}
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
          previewMode={previewMode}
        />
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          participantArrivalStatus={arrivalStatus}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          matchMemberCount={matchMemberCount}
          sections={introDetailSections}
          className="mt-0"
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              place={selectedPlace}
              revealDetails
              onCancelApplication={onCancelApplication}
            />
          }
        />
        <FeedbackGuide userTicket={userTicket} />
      </>
    );
  }

  if (baseProgressStep === "pre_start") {
    return (
      <>
        <ArrivalStatusPanel
          userTicket={userTicket}
          reservationName={reservationName}
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
          previewMode={previewMode}
        />
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          participantArrivalStatus={arrivalStatus}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          matchMemberCount={matchMemberCount}
          sections={introDetailSections}
          className="mt-0"
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              revealDetails
              onCancelApplication={onCancelApplication}
            />
          }
        />
      </>
    );
  }

  if (baseProgressStep === "approved") {
    return (
      <>
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          matchMemberCount={matchMemberCount}
          sections={introDetailSections}
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              revealDetails
              onCancelApplication={onCancelApplication}
            />
          }
        />
      </>
    );
  }

  return (
    <TicketDetailContent
      ticket={ticket}
      participantPhotoUrl={participantPhotoUrl}
      previewMatchPhotoUrls={previewMatchPhotoUrls}
      previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
      matchMemberCount={matchMemberCount}
      sections={appliedDetailSections}
      className="mt-0"
      afterActivities={
        <PlaceSection
          userTicket={userTicket}
          onCancelApplication={onCancelApplication}
        />
      }
    />
  );
}

function PlaceSection({
  userTicket,
  place = userTicket.place,
  revealDetails = false,
  onCancelApplication,
}: {
  userTicket: UserTicket;
  place?: TicketPlace | null;
  revealDetails?: boolean;
  onCancelApplication?: () => Promise<boolean>;
}) {
  const hasPlace = Boolean(
    place?.name?.trim() || place?.address?.trim(),
  );
  const hasDetailedPlace = revealDetails && hasPlace;
  const hasMap =
    place?.source === "naver" &&
    typeof place.mapx === "number" &&
    typeof place.mapy === "number" &&
    Boolean(place.name);

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">만나는 곳</h2>
      <div className="mt-4 rounded-2xl border border-[#d8d0c3] bg-[#f3eee5] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
        {hasDetailedPlace ? (
          <div className="space-y-3">
            {place?.name && (
              <TicketMetaLine Icon={MapPin}>{place.name}</TicketMetaLine>
            )}
            {place?.address && (
              <p className="text-sm font-semibold leading-6 text-black/62">
                {place.address}
              </p>
            )}
            <TicketMetaLine Icon={Clock3}>
              {formatTicketDateLabel(userTicket.ticket.date)}{" "}
              {formatTicketTimeLabel(userTicket.ticket.time)}
            </TicketMetaLine>
            {hasMap && (
              <NaverMapPreview
                place={{
                  name: place.name ?? "장소",
                  mapx: place.mapx!,
                  mapy: place.mapy!,
                }}
                className="mt-3 border-[#cec6b8] bg-[#e7e0d4] [&>div:first-child]:brightness-[0.96] [&>div:first-child]:saturate-[0.68] [&>div:first-child]:sepia-[0.08]"
                heightClassName="h-[172px]"
              />
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <TicketMetaLine Icon={MapPin}>{userTicket.ticket.area}</TicketMetaLine>
            <p className="text-sm font-semibold leading-6 text-black/50">
              상세 장소는 확정되면 공개돼요.
            </p>
          </div>
        )}
      </div>
      {onCancelApplication && (
        <DetailApplicationCancellationControl onCancel={onCancelApplication} />
      )}
    </section>
  );
}

function DetailApplicationCancellationControl({
  onCancel,
}: {
  onCancel: () => Promise<boolean>;
}) {
  const [cancelling, setCancelling] = useState(false);

  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    const cancelled = await onCancel().catch(() => false);
    if (!cancelled) setCancelling(false);
  };

  return (
    <button
      type="button"
      disabled={cancelling}
      onClick={() => void cancel()}
      className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border border-[#d8d0c3] bg-[#faf8f3] text-[12px] font-bold text-[#24211d]/58 transition hover:border-[#bdb5a7] hover:text-[#24211d]/78 disabled:opacity-40"
    >
      신청 취소
    </button>
  );
}


const arrivalOptions: Array<{
  value: TicketArrivalStatus;
  label: string;
}> = [
  { value: "on_time", label: "정상 도착 예정이에요" },
  { value: "late_10", label: "조금 늦어요 · 10분 정도" },
  { value: "late_20", label: "조금 늦어요 · 20분 정도" },
  { value: "late_30_plus", label: "조금 늦어요 · 30분 이상" },
];

function arrivalStatusLabel(status: TicketArrivalStatus | null) {
  if (status === "no_show") return "불참";
  return (
    arrivalOptions.find((option) => option.value === status)?.label ??
    "아직 선택 전"
  );
}

function arrivalStatusToneClass(status: TicketArrivalStatus | null) {
  if (status === "on_time") {
    return "border-[#aaa294] bg-[#e2dccf] text-[#24211d]";
  }
  if (status) {
    return "border-[#b8aa92] bg-[#e8decd] text-[#4a4032]";
  }
  return "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/48";
}

function arrivalOptionActiveClass(_status: TicketArrivalStatus) {
  return "border-[#24211d] bg-[#24211d] text-[#faf8f3] shadow-[0_8px_18px_rgba(36,33,29,0.14)]";
}

function arrivalCheckClass(_status: TicketArrivalStatus) {
  return "text-[#faf8f3]";
}

function ArrivalStatusPanel({
  userTicket,
  reservationName,
  selectedArrivalStatus,
  onArrivalStatusChange,
  previewMode = false,
}: {
  userTicket: UserTicket;
  reservationName?: string | null;
  selectedArrivalStatus?: TicketArrivalStatus | null;
  onArrivalStatusChange?: (arrivalStatus: TicketArrivalStatus) => void;
  previewMode?: boolean;
}) {
  const [selected, setSelected] = useState<TicketArrivalStatus | null>(
    selectedArrivalStatus ?? userTicket.arrivalStatus,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(selectedArrivalStatus ?? userTicket.arrivalStatus);
  }, [selectedArrivalStatus, userTicket.arrivalStatus, userTicket.waitlistId]);

  const saveArrivalStatus = async (arrivalStatus: TicketArrivalStatus) => {
    if (saving || !userTicket.canSetArrival) return;
    if (previewMode) {
      setSelected(arrivalStatus);
      onArrivalStatusChange?.(arrivalStatus);
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/meetings/my-tickets/arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waitlistId: userTicket.waitlistId,
        arrivalStatus,
      }),
    });

    if (!response.ok) {
      setError("도착 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    setSelected(arrivalStatus);
    onArrivalStatusChange?.(arrivalStatus);
    setSaving(false);
  };

  return (
    <section className="border-t border-black/8 py-5">
      {reservationName && (
        <div className="mb-5 rounded-2xl border border-[#d8d1c3]/80 bg-[#eee9df] px-4 py-3.5">
          <div className="flex min-h-7 items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-bold text-black/52">
              <UserRound size={15} className="text-black/38" aria-hidden />
              예약자명
            </span>
            <strong
              aria-label={selected ? reservationName : "도착 상태 선택 후 공개"}
              className={cn(
                "text-[15px] font-black tracking-[-0.02em] text-black transition-[filter,opacity] duration-300",
                selected ? "blur-0 opacity-100" : "select-none blur-[5px] opacity-55",
              )}
            >
              {reservationName}
            </strong>
          </div>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-black/42">
            하단 도착상태를 표시하고, 예약자명을 확인하세요.
          </p>
        </div>
      )}
      <h2 className="text-[15px] font-black text-black">도착 상태</h2>
      {!userTicket.canSetArrival ? (
        <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
          도착 상태는 모임 시작 3시간 전부터 선택할 수 있어요.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {arrivalOptions.map((option) => {
            const active = selected === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => void saveArrivalStatus(option.value)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:opacity-45",
                  active
                    ? arrivalOptionActiveClass(option.value)
                    : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/58 hover:border-[#aaa294] hover:text-[#24211d]",
                )}
              >
                <span>{option.label}</span>
                {active && (
                  <Check
                    size={16}
                    className={arrivalCheckClass(option.value)}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
      <MemberArrivalStatusAccordion members={userTicket.members} />
    </section>
  );
}

function MemberArrivalStatusAccordion({
  members,
}: {
  members: UserTicket["members"];
}) {
  const [open, setOpen] = useState(false);
  const otherMembers = members.filter((member) => !member.isSelf);
  const ArrowIcon = open ? ChevronUp : ChevronDown;

  if (otherMembers.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#d8d1c3]/90 bg-[#eee9df]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-black text-black">
            다른 멤버 도착 상태
          </span>
          <span className="mt-0.5 block text-[11px] font-bold text-black/38">
            {otherMembers.length}명
          </span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/45">
          <ArrowIcon size={16} aria-hidden />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="member-arrival-statuses"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 border-t border-black/8 px-3 py-3">
              {otherMembers.map((member) => (
                <div
                  key={member.id}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5",
                    arrivalStatusToneClass(member.arrivalStatus),
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-black text-black">
                      <span className="truncate">
                        {member.nickname?.trim() || member.name || "멤버"}
                      </span>
                      <span
                        aria-hidden
                        className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/8 bg-[#eee9df] text-[8px] font-black text-black/45"
                      >
                        {fallbackNickname(member.nickname || member.name)}
                        <SafeImage
                          src={member.photoUrl}
                          alt=""
                          draggable={false}
                          className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] scale-125 object-cover blur-[5px]"
                        />
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-black">
                    {arrivalStatusLabel(member.arrivalStatus)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedbackGuide({ userTicket }: { userTicket: UserTicket }) {
  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="text-[15px] font-black text-black">피드백 안내</h2>
      <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/55">
        피드백은 모임 시작 3시간 후에 열려요. 남겨주신 피드백은 다음 자리의
        큐레이션을 더 잘 맞추기 위한 참고로만 사용돼요.
      </p>
      {userTicket.feedbackOpensAt && (
        <p className="mt-2 text-xs font-bold text-black/35">
          오픈 예정: {formatKoreanDateTime(userTicket.feedbackOpensAt)}
        </p>
      )}
    </section>
  );
}

function memberRealName(member: UserTicket["members"][number]) {
  return member.name?.trim() || member.nickname?.trim() || "멤버";
}

function feedbackOwnerPossessive(member?: UserTicket["members"][number]) {
  const displayName = member?.nickname?.trim() || member?.name?.trim() || "회원";
  return displayName.endsWith("님") ? `${displayName}의` : `${displayName}님의`;
}

function TicketFeedbackForm({
  userTicket,
  previewMode = false,
}: {
  userTicket: UserTicket;
  previewMode?: boolean;
}) {
  const selfMember = useMemo(
    () => userTicket.members.find((member) => member.isSelf),
    [userTicket.members],
  );
  const feedbackOwner = feedbackOwnerPossessive(selfMember);
  const feedbackTitle = ticketStageText(userTicket.ticket.stageCopy, "feedbackTitle");
  const feedbackBody = ticketFeedbackBodyText(
    userTicket.ticket.stageCopy,
    feedbackOwner,
  );
  const otherMembers = useMemo(
    () => userTicket.members.filter((member) => !member.isSelf),
    [userTicket.members],
  );
  const overallMembers = useMemo(
    () =>
      (userTicket.feedbackMembers ?? userTicket.members).filter(
        (member) => !member.isSelf,
      ),
    [userTicket.feedbackMembers, userTicket.members],
  );
  const dateCandidateMembers = useMemo(() => {
    return otherMembers;
  }, [otherMembers]);
  const joinsAtSecondActivity =
    (userTicket.ticket.startsFromStageSequence ?? 1) > 1;
  const feedbackStepOrder = joinsAtSecondActivity
    ? ([1, 3, 4] as const)
    : ([0, 1, 2, 3, 4] as const);
  const firstPlaceName =
    joinsAtSecondActivity
      ? null
      : userTicket.ticket.courseSteps?.[0]?.placeName?.trim() || "1차 장소";
  const secondPlaceName =
    (joinsAtSecondActivity
      ? userTicket.ticket.courseSteps?.[0]?.placeName?.trim()
      : userTicket.ticket.courseSteps?.[1]?.placeName?.trim()) || "2차 장소";
  const [meetingRatings, setMeetingRatings] = useState<MeetingRatings>({
    firstPlace: null,
    secondPlace: null,
  });
  const [dateMemberIds, setDateMemberIds] = useState<string[]>([]);
  const [vibeMemberIds, setVibeMemberIds] = useState<string[]>([]);
  const [dateMembersUnsure, setDateMembersUnsure] = useState(false);
  const [vibeMembersUnsure, setVibeMembersUnsure] = useState(false);
  const [disruptiveMemberNote, setDisruptiveMemberNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedbackStepIndex, setFeedbackStepIndex] = useState(0);
  const [feedbackStepDirection, setFeedbackStepDirection] = useState(1);
  const [feedbackPhotoPreview, setFeedbackPhotoPreview] = useState<{
    url: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setMeetingRatings({ firstPlace: null, secondPlace: null });
    setDateMemberIds([]);
    setVibeMemberIds([]);
    setDateMembersUnsure(false);
    setVibeMembersUnsure(false);
    setDisruptiveMemberNote("");
    setSubmitting(false);
    setSubmitted(false);
    setSubmitError(null);
    setFeedbackStepIndex(0);
    setFeedbackStepDirection(1);
    setFeedbackPhotoPreview(null);
  }, [joinsAtSecondActivity, otherMembers, overallMembers, userTicket.waitlistId]);

  useEffect(() => {
    if (!feedbackPhotoPreview) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFeedbackPhotoPreview(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [feedbackPhotoPreview]);

  const meetingRatingsComplete = joinsAtSecondActivity
    ? typeof meetingRatings.secondPlace === "number"
    : Object.values(meetingRatings).every(
        (value) => typeof value === "number",
      );
  const canSubmit = meetingRatingsComplete;
  const feedbackStepCount = feedbackStepOrder.length;
  const feedbackStep = feedbackStepOrder[feedbackStepIndex] ?? feedbackStepOrder[0];
  const canAdvanceFeedbackStep =
    (feedbackStep === 0 && (dateMemberIds.length > 0 || dateMembersUnsure)) ||
    (feedbackStep === 1 && (vibeMemberIds.length > 0 || vibeMembersUnsure)) ||
    (feedbackStep === 2 && meetingRatings.firstPlace !== null) ||
    (feedbackStep === 3 && meetingRatings.secondPlace !== null);
  const selectedPositiveMemberIds = Array.from(
    new Set([...dateMemberIds, ...vibeMemberIds]),
  );

  const selectDateMember = (memberId: string) => {
    setDateMembersUnsure(false);
    setDateMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const selectVibeMember = (memberId: string) => {
    setVibeMembersUnsure(false);
    setVibeMemberIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }
      return current.length >= 3 ? current : [...current, memberId];
    });
  };

  const moveFeedbackStep = (nextStepIndex: number) => {
    const boundedStep = Math.max(
      0,
      Math.min(feedbackStepCount - 1, nextStepIndex),
    );
    setFeedbackStepDirection(boundedStep >= feedbackStepIndex ? 1 : -1);
    setFeedbackStepIndex(boundedStep);
    setSubmitError(null);
  };

  const submitLabel = (() => {
    if (submitting) return "저장 중이에요";
    if (!meetingRatingsComplete) return "장소 별점을 남겨주세요";
    return "피드백 제출하기";
  })();

  const payloadMemberFeedback = () => {
    return Object.fromEntries(
      vibeMemberIds.map((memberId) => [
        memberId,
        {
          status: "done",
          temperature: null,
          texture: null,
          tone: null,
          rhythm: null,
        },
      ]),
    );
  };

  const payloadMeetingFeedback = () => ({
    place_ratings: {
      first: joinsAtSecondActivity
        ? null
        : {
            name: firstPlaceName,
            rating: meetingRatings.firstPlace,
          },
      second: {
        name: secondPlaceName,
        rating: meetingRatings.secondPlace,
      },
    },
    dinner_member_ids: dateMemberIds,
    overall_member_ids: vibeMemberIds,
    dinner_member_unsure: dateMembersUnsure,
    overall_member_unsure: vibeMembersUnsure,
    disruptive_member_note: disruptiveMemberNote.trim() || null,
  });

  const submitFeedback = async () => {
    if (submitting || !canSubmit) return;
    if (previewMode) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/meetings/my-tickets/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waitlistId: userTicket.waitlistId,
          selectedMemberIds: selectedPositiveMemberIds,
          memberFeedback: payloadMemberFeedback(),
          placeFeedback: payloadMeetingFeedback(),
        }),
      });

      if (!response.ok) throw new Error("feedback-submit-failed");

      setSubmitted(true);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setSubmitError("피드백을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  if (
    submitted ||
    userTicket.rawStatus === "feedback_done" ||
    userTicket.rawStatus === "completed"
  ) {
    return (
      <div className="py-5">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600">
            <Check size={20} aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-black text-emerald-950">
            피드백 작성을 완료했어요.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800/70">
            이 모임은 채팅이 닫힐 때까지 티켓 목록에 남아 있어요.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="py-5">
      <section>
        <h2 className="text-[22px] font-black text-black">{feedbackTitle}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-black/52">
          {feedbackBody}
        </p>
      </section>

      <div className="mt-8 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={feedbackStepDirection}>
          <motion.section
            key={feedbackStep}
            custom={feedbackStepDirection}
            initial={{ opacity: 0, x: feedbackStepDirection * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: feedbackStepDirection * -20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-[340px] py-2"
          >
            {feedbackStep === 0 && (
              <>
                <h3 className="text-[17px] font-black leading-7 text-black">
                  저녁 멤버 중에서 단 둘이 만나고 싶은 사람이 있나요?
                  <span className="block font-medium text-black/35">(중복 선택 가능)</span>
                </h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-black/42">
                  서로 선택한 경우 1:1 만남 자리를 준비해드려요.
                </p>
                {dateCandidateMembers.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {dateCandidateMembers.map((member) => {
                      const selected = dateMemberIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => selectDateMember(member.id)}
                          className={cn(
                            "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                            selected
                              ? "border-black bg-black text-white"
                              : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/62 hover:border-[#aaa294] hover:text-[#24211d]",
                          )}
                        >
                          {memberRealName(member)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-6 bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
                    선택 가능한 멤버가 없어요.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDateMemberIds([]);
                    setDateMembersUnsure(true);
                  }}
                  className={cn(
                    "mt-3 min-h-10 rounded-full border px-4 text-sm font-bold transition",
                    dateMembersUnsure
                      ? "border-black bg-black text-white"
                      : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/62 hover:border-[#aaa294] hover:text-[#24211d]",
                  )}
                >
                  잘 모르겠어요
                </button>
              </>
            )}

            {feedbackStep === 1 && (
              <>
                <h3 className="text-[17px] font-black leading-7 text-black">
                  전체 멤버 중에서 단 둘이 만나고 싶은 사람이 있나요?
                  <span className="block font-medium text-black/35">
                    (최대 3명까지 선택 가능)
                  </span>
                </h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-black/42">
                  서로 선택한 경우 1:1 만남 자리를 준비해드려요.
                </p>
                {overallMembers.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {overallMembers.map((member) => {
                      const selected = vibeMemberIds.includes(member.id);
                      return (
                        <div
                          key={member.id}
                          className={cn(
                            "inline-flex min-h-10 items-center gap-2 rounded-full border py-1.5 pl-2 text-sm font-bold transition",
                            selected
                              ? "border-black bg-black text-white"
                              : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/62 hover:border-[#aaa294] hover:text-[#24211d]",
                          )}
                        >
                          {member.photoUrl ? (
                            <button
                              type="button"
                              aria-label={`${memberRealName(member)} 사진 크게 보기`}
                              onClick={() =>
                                setFeedbackPhotoPreview({
                                  url: member.photoUrl!,
                                  name: memberRealName(member),
                                })
                              }
                              className={cn(
                                "relative h-7 w-7 shrink-0 overflow-hidden rounded-full border transition active:scale-95",
                                selected
                                  ? "border-white/20 bg-white/12"
                                  : "border-black/8 bg-[#e2dccf]",
                              )}
                            >
                              <SafeImage
                                src={member.photoUrl}
                                alt=""
                                draggable={false}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </button>
                          ) : (
                            <span
                              aria-hidden
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-black opacity-55",
                                selected
                                  ? "border-white/20 bg-white/12"
                                  : "border-black/8 bg-[#e2dccf]",
                              )}
                            >
                                {fallbackNickname(member.nickname || member.name)}
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={!selected && vibeMemberIds.length >= 3}
                            onClick={() => selectVibeMember(member.id)}
                            className="min-h-7 pr-4 text-left disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {memberRealName(member)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-6 bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
                    함께한 멤버 정보가 없어요.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setVibeMemberIds([]);
                    setVibeMembersUnsure(true);
                  }}
                  className={cn(
                    "mt-3 min-h-10 rounded-full border px-4 text-sm font-bold transition",
                    vibeMembersUnsure
                      ? "border-black bg-black text-white"
                      : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/62 hover:border-[#aaa294] hover:text-[#24211d]",
                  )}
                >
                  잘 모르겠어요
                </button>
              </>
            )}

            {feedbackStep === 2 && (
              <MeetingStarRating
                label={`첫 장소 피드백 (${firstPlaceName})`}
                value={meetingRatings.firstPlace}
                onChange={(rating) =>
                  setMeetingRatings((current) => ({ ...current, firstPlace: rating }))
                }
              />
            )}

            {feedbackStep === 3 && (
              <MeetingStarRating
                label={`두 번째 장소 피드백 (${secondPlaceName})`}
                value={meetingRatings.secondPlace}
                onChange={(rating) =>
                  setMeetingRatings((current) => ({ ...current, secondPlace: rating }))
                }
              />
            )}

            {feedbackStep === 4 && (
              <>
                <label
                  htmlFor={`disruptive-member-note-${userTicket.waitlistId}`}
                  className="block text-[17px] font-black leading-7 text-black"
                >
                  모임 분위기를 해치거나, 주변 사람들의 기분을 상하게 하는 사람이
                  있다면 적어주세요.
                  <span className="ml-1 font-medium text-black/35">(선택)</span>
                </label>
                <textarea
                  id={`disruptive-member-note-${userTicket.waitlistId}`}
                  value={disruptiveMemberNote}
                  maxLength={500}
                  rows={6}
                  placeholder="내용을 입력해주세요."
                  onChange={(event) => setDisruptiveMemberNote(event.target.value)}
                  className="mt-6 w-full resize-none rounded-2xl border border-[#d8d1c3]/90 bg-[#eee9df] px-4 py-3 text-sm font-semibold leading-6 text-[#24211d] outline-none placeholder:text-[#24211d]/28 focus:border-[#aaa294]"
                />
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {submitError && (
        <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="이전 질문"
          disabled={feedbackStepIndex === 0 || submitting}
          onClick={() => moveFeedbackStep(feedbackStepIndex - 1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d8d1c3] bg-[#eee9df] text-[#24211d] transition disabled:invisible"
        >
          <ChevronLeft size={19} aria-hidden />
        </button>
        {feedbackStepIndex < feedbackStepCount - 1 && canAdvanceFeedbackStep ? (
          <button
            type="button"
            aria-label="다음 질문"
            onClick={() => moveFeedbackStep(feedbackStepIndex + 1)}
            className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#24211d] text-[#faf8f3] shadow-[0_10px_24px_rgba(36,33,29,0.18)] transition hover:bg-black"
          >
            <ArrowRight size={19} aria-hidden />
          </button>
        ) : feedbackStepIndex === feedbackStepCount - 1 ? (
          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={() => void submitFeedback()}
            className="h-12 flex-1 rounded-full bg-[#24211d] text-sm font-black text-[#faf8f3] shadow-[0_10px_24px_rgba(36,33,29,0.18)] transition hover:bg-black disabled:cursor-not-allowed disabled:bg-black/20 disabled:shadow-none"
          >
            {submitLabel}
          </button>
        ) : null}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {feedbackPhotoPreview && (
              <motion.div
                key="feedback-photo-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFeedbackPhotoPreview(null)}
                className="fixed inset-0 z-[150] flex items-center justify-center bg-black/58 px-6 backdrop-blur-[3px]"
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${feedbackPhotoPreview.name} 프로필 사진`}
                  initial={{ opacity: 0, scale: 0.92, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(event) => event.stopPropagation()}
                  className="relative w-[min(66vw,272px)] overflow-hidden rounded-[22px] border border-white/18 bg-[#eee9df] p-2.5 shadow-[0_28px_80px_rgba(0,0,0,0.34)]"
                >
                  <button
                    type="button"
                    aria-label="사진 닫기"
                    onClick={() => setFeedbackPhotoPreview(null)}
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/72 text-white shadow-sm backdrop-blur transition hover:bg-black"
                  >
                    <X size={17} aria-hidden />
                  </button>
                  <SafeImage
                    src={feedbackPhotoPreview.url}
                    alt={`${feedbackPhotoPreview.name} 프로필`}
                    className="max-h-[58vh] w-full rounded-[16px] object-contain"
                    onLoadError={() => setFeedbackPhotoPreview(null)}
                  />
                  <p className="px-1 pb-1 pt-3 text-center text-sm font-black text-[#24211d]">
                    {feedbackPhotoPreview.name}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function MeetingStarRating({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (rating: number) => void;
  value: number | null;
}) {
  return (
    <div>
      <p className="text-sm font-black leading-6 text-black">{label}</p>
      <div
        className="mt-3 grid"
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;

          return (
            <motion.button
              key={rating}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onChange(rating)}
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${rating}점`}
              className={cn(
                "relative flex h-12 min-w-0 items-center justify-center bg-transparent text-[22px] font-medium tabular-nums transition",
                selected
                  ? "scale-125 font-black text-black"
                  : "text-black/18 hover:text-black/50",
              )}
            >
              <span>{rating}</span>
              {selected && (
                <motion.span
                  layoutId={`meeting-rating-${label}`}
                  className="absolute bottom-0 h-0.5 w-5 rounded-full bg-black"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold text-black/35">
        <span>아쉬워요</span>
        <span>좋았어요</span>
      </div>
    </div>
  );
}

function TicketFeedbackPlaceholder() {
  return (
    <div className="py-5">
      <section className="rounded-3xl border border-black/10 bg-white px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
          <PenLine size={20} aria-hidden />
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          feedback
        </p>
        <h2 className="mt-2 text-[23px] font-black text-black">피드백 작성 ✒️</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-black/52">
          이 자리에 대한 피드백을 남기는 화면이에요.
          <br />
          입력 항목은 곧 준비될 예정입니다.
        </p>
      </section>
    </div>
  );
}

type ProfileGenerateResponse = {
  intro?: string | null;
  generatedAt?: string | null;
  model?: string | null;
  notice?: string;
  error?: string;
};

const profileCompletionMessages = [
  "{name}님의 결을 정리하고 있어요.",
  "답변을 바탕으로 교집합 프로필을 만들고 있어요.",
  "요즘 관심사를 반영하고 있어요.",
  "거의 다 완성 됐어요.",
];

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ProfileCompletionModal({
  userId,
  profile,
  answers,
  animationKey,
  onComplete,
}: {
  userId: string;
  profile: ProfileRow;
  answers: AnswerMap;
  animationKey: number;
  onComplete: (profile: Partial<ProfileRow>) => void;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const displayName = profileNickname(profile);
  const [phase, setPhase] = useState<"loading" | "typing" | "error">("loading");
  const [messageIndex, setMessageIndex] = useState(0);
  const [intro, setIntro] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    profile.public_intro_generated_at,
  );
  const [model, setModel] = useState<string | null>(profile.public_intro_model);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typingDone, setTypingDone] = useState(false);
  const [completionScreen, setCompletionScreen] = useState<"intro" | "vibe">(
    "intro",
  );
  const [introAdvanceVisible, setIntroAdvanceVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const modalProfile = useMemo(
    () => ({
      ...profile,
      public_intro: intro || profile.public_intro,
    }),
    [intro, profile],
  );
  const modalVibeScores = useMemo(
    () => profileVibeScores(modalProfile, answers),
    [answers, modalProfile],
  );

  useEffect(() => {
    let alive = true;
    let messageTimer: number | null = null;

    setPhase("loading");
    setMessageIndex(0);
    setIntro("");
    setGeneratedAt(profile.public_intro_generated_at);
    setModel(profile.public_intro_model);
    setNotice(null);
    setError(null);
    setTypingDone(false);
    setCompletionScreen("intro");
    setIntroAdvanceVisible(false);
    setClosing(false);

    messageTimer = window.setInterval(() => {
      setMessageIndex((current) =>
        Math.min(current + 1, profileCompletionMessages.length - 1),
      );
    }, 500);

    const loadProfile = async () => {
      const existingIntro = profile.public_intro?.trim();
      try {
        const fallbackIntro =
          "프로필을 준비하고 있어요.\n\n잠시 후 오른쪽 위 프로필 버튼에서 다시 확인할 수 있어요.";
        const profilePromise = Promise.resolve<ProfileGenerateResponse>({
          intro: existingIntro || fallbackIntro,
          generatedAt: profile.public_intro_generated_at,
          model: profile.public_intro_model,
          notice: existingIntro
            ? undefined
            : "잠시 후 오른쪽 위 프로필 버튼에서 다시 확인할 수 있어요.",
        });

        const [result] = await Promise.all([profilePromise, wait(2500)]);
        if (!alive) return;

        setIntro(result.intro?.trim() || existingIntro || "");
        setGeneratedAt(result.generatedAt ?? profile.public_intro_generated_at);
        setModel(result.model ?? profile.public_intro_model);
        setNotice(result.notice ?? null);
        setPhase("typing");
      } catch {
        if (!alive) return;
        setIntro(
          existingIntro ||
            "프로필을 준비하고 있어요.\n\n잠시 후 오른쪽 위 프로필 버튼에서 다시 확인할 수 있어요.",
        );
        setNotice("잠시 후 오른쪽 위 프로필 버튼에서 다시 확인할 수 있어요.");
        setError(null);
        setPhase("typing");
      } finally {
        if (messageTimer !== null) window.clearInterval(messageTimer);
      }
    };

    void loadProfile();

    return () => {
      alive = false;
      if (messageTimer !== null) window.clearInterval(messageTimer);
    };
  }, [
    animationKey,
    profile.public_intro,
    profile.public_intro_generated_at,
    profile.public_intro_model,
  ]);

  useEffect(() => {
    if (!typingDone) return;

    const timer = window.setTimeout(() => setIntroAdvanceVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, [typingDone]);

  const finish = async () => {
    if (closing) return;
    setClosing(true);

    const revealedGeneratedAt = generatedAt ?? profile.public_intro_generated_at;
    if (revealedGeneratedAt) {
      await createClient()
        .from("profiles")
        .update({ public_intro_revealed_generated_at: revealedGeneratedAt })
        .eq("user_id", userId);
    }

    onComplete({
      public_intro: intro || profile.public_intro,
      public_intro_generated_at: revealedGeneratedAt,
      public_intro_revealed_generated_at: revealedGeneratedAt,
      public_intro_model: model ?? profile.public_intro_model,
    });
  };

  const loadingMessage = profileCompletionMessages[messageIndex].replace(
    "{name}",
    displayName,
  );

  return (
    <motion.div
      key="profile-completion-modal"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      className="absolute inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-white/74 px-4 py-8 backdrop-blur-[5px]"
    >
      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="w-full max-w-[390px] rounded-[30px] border border-black/10 bg-white px-5 py-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.14)]"
      >
        {phase === "loading" && (
          <div className="flex min-h-[420px] flex-col items-center justify-center">
            <ProfileCompletionLogo />
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingMessage}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  textShadow: "0 0 18px rgba(126,179,199,0.34)",
                }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="mt-8 min-h-6 text-sm font-black leading-6 text-black"
              >
                {loadingMessage}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {phase === "error" && (
          <div className="flex min-h-[360px] flex-col items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <X size={20} aria-hidden />
            </div>
            <p className="mt-5 text-sm font-bold leading-6 text-red-600">
              {error}
            </p>
          </div>
        )}

        {phase === "typing" && (
          <AnimatePresence mode="wait" initial={false}>
            {completionScreen === "intro" ? (
              <motion.div
                key="profile-completion-intro"
                initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -14 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="flex min-h-[438px] flex-col text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  profile complete
                </p>
                <h2 className="mt-2 text-[24px] font-black leading-8 text-black">
                  <span>{displayName}님의 프로필이 만들어졌어요</span>
                </h2>
                <div className="mt-5 min-h-[258px] rounded-[24px] border border-black/8 bg-[#fbfbfa] px-4 py-4">
                  <div className="mb-4 text-xl font-black leading-7 text-black">
                    {displayName}
                  </div>
                  <ProfileCompletionTypewriter
                    text={intro}
                    onComplete={() => setTypingDone(true)}
                  />
                </div>
                {notice && (
                  <p className="mt-3 rounded-2xl bg-accent/[0.08] px-4 py-3 text-[11px] font-semibold leading-5 text-black/48">
                    {notice}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-end pt-5">
                  <AnimatePresence>
                    {introAdvanceVisible && (
                      <motion.button
                        type="button"
                        title="나의 대화결 보기"
                        aria-label="나의 대화결 보기"
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, x: 10 }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        exit={
                          shouldReduceMotion
                            ? undefined
                            : { opacity: 0, x: 8 }
                        }
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setCompletionScreen("vibe")}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(0,0,0,0.18)]"
                      >
                        <ArrowRight size={19} aria-hidden />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="profile-completion-vibe"
                initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: 10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="flex min-h-[438px] flex-col text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  conversation vibe
                </p>
                <VibeGraph
                  title="나의 대화결"
                  description="교집합이 자리를 제안할 때 참고하는 분위기예요."
                  scores={modalVibeScores}
                  visibleAxes={profileVibeAxes}
                  showAxisHeader={false}
                  scoreScale="internal"
                  animationKey={`completion-${animationKey}-${generatedAt ?? "new"}-${completionScreen}`}
                  className="mt-3 !rounded-[24px] !shadow-none"
                />
                <motion.button
                  type="button"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                  transition={{ delay: shouldReduceMotion ? 0 : 0.26 }}
                  whileTap={!closing ? { scale: 0.98 } : undefined}
                  disabled={closing}
                  onClick={() => void finish()}
                  className="mt-auto h-[52px] w-full rounded-full bg-black px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.16)] disabled:bg-black/25"
                >
                  {closing ? "이동 중..." : "나에게 맞는 자리 추천받기"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.section>
    </motion.div>
  );
}

function ProfileCompletionLogo() {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const strokeWidth = 2;
  const lensTopY = 30.25;
  const lensBottomY = 97.75;
  const lensHeight = lensBottomY - lensTopY;
  const leftCirclePath =
    "M71 22 A42 42 0 1 1 71 106 A42 42 0 1 1 71 22";
  const rightCirclePath =
    "M121 22 A42 42 0 1 1 121 106 A42 42 0 1 1 121 22";
  const lensPath = `M96 ${lensTopY} A42 42 0 0 1 96 ${lensBottomY} A42 42 0 0 1 96 ${lensTopY} Z`;
  const circlePathLength = 264;
  const lensPathLength = 182;
  const drawTransition = {
    duration: shouldReduceMotion ? 0 : 0.9,
    ease: "easeInOut" as const,
  };
  const hiddenStroke = shouldReduceMotion
    ? false
    : { opacity: 0, strokeDashoffset: circlePathLength };

  return (
    <div className="relative flex h-28 w-56 items-center justify-center" aria-hidden>
      <motion.svg
        viewBox="0 0 192 128"
        className="h-28 w-48 overflow-visible drop-shadow-[0_18px_28px_rgba(0,0,0,0.08)]"
      >
        <defs>
          <clipPath
            id="profile-completion-logo-lens-fill"
            clipPathUnits="userSpaceOnUse"
          >
            <motion.rect
              x="79"
              width="34"
              initial={shouldReduceMotion ? false : { y: lensBottomY, height: 0 }}
              animate={{ y: lensTopY, height: lensHeight }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.52,
                ease: [0.16, 1, 0.3, 1],
                delay: shouldReduceMotion ? 0 : 1.62,
              }}
            />
          </clipPath>
        </defs>

        <motion.g
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        >
          <path d={leftCirclePath} fill="transparent" />
          <path d={rightCirclePath} fill="transparent" />
        </motion.g>

        <motion.path
          d={leftCirclePath}
          fill="none"
          stroke="#0b0b0b"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circlePathLength}
          vectorEffect="non-scaling-stroke"
          initial={hiddenStroke}
          animate={{ opacity: 1, strokeDashoffset: 0 }}
          transition={drawTransition}
        />
        <motion.path
          d={rightCirclePath}
          fill="none"
          stroke="#0b0b0b"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circlePathLength}
          vectorEffect="non-scaling-stroke"
          initial={hiddenStroke}
          animate={{ opacity: 1, strokeDashoffset: 0 }}
          transition={{ ...drawTransition, delay: shouldReduceMotion ? 0 : 0.52 }}
        />
        <motion.path
          d={lensPath}
          fill="#0b0b0b"
          clipPath="url(#profile-completion-logo-lens-fill)"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.12,
            delay: shouldReduceMotion ? 0 : 1.62,
          }}
        />
        <motion.path
          d={lensPath}
          fill="none"
          stroke="#0b0b0b"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          strokeDasharray={lensPathLength}
          vectorEffect="non-scaling-stroke"
          initial={
            shouldReduceMotion
              ? false
              : { opacity: 0, strokeDashoffset: lensPathLength }
          }
          animate={{ opacity: 1, strokeDashoffset: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.42,
            ease: "easeInOut",
            delay: shouldReduceMotion ? 0 : 1.24,
          }}
        />
      </motion.svg>
    </div>
  );
}

function ProfileCompletionTypewriter({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const onCompleteRef = useRef(onComplete);
  const [displayText, setDisplayText] = useState(shouldReduceMotion ? text : "");

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayText(text);
      onCompleteRef.current();
      return;
    }

    const characters = Array.from(text);
    let index = 0;
    setDisplayText("");

    if (characters.length === 0) {
      onCompleteRef.current();
      return;
    }

    const timer = window.setInterval(() => {
      index += 1;
      setDisplayText(characters.slice(0, index).join(""));
      if (index >= characters.length) {
        window.clearInterval(timer);
        onCompleteRef.current();
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [shouldReduceMotion, text]);

  return (
    <p className="min-h-[112px] whitespace-pre-line text-sm font-semibold leading-7 text-black/68">
      {displayText}
      {!shouldReduceMotion && displayText.length < text.length && (
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-black/42" />
      )}
    </p>
  );
}

function formatKoreanDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatProfileRegenerationDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function BasicInfoPanel({
  profile,
  operatorAccountSwitcher,
  switchingAccountId,
  accountSwitchError,
  onProfileUpdated,
  onClose,
  onSwitchAccount,
  onReturnToOperator,
}: {
  profile: ProfileRow;
  operatorAccountSwitcher: OperatorAccountSwitcher;
  switchingAccountId: string | null;
  accountSwitchError: string | null;
  onProfileUpdated: (profile: ProfileRow) => void;
  onClose: () => void;
  onSwitchAccount: (targetUserId: string) => Promise<void>;
  onReturnToOperator: () => Promise<void>;
}) {
  const initialDraft = useMemo<BasicInfoDraft>(
    () => ({
      nickname: profileNickname(profile),
      name: profile.name ?? "",
      phone: profile.phone ?? profile.phone_normalized ?? "",
      gender: profile.gender ?? "",
      birthYear: profile.birth_year == null ? "" : String(profile.birth_year),
      mbti: profile.mbti ?? "",
    }),
    [
      profile.birth_year,
      profile.gender,
      profile.mbti,
      profile.name,
      profile.nickname,
      profile.phone,
      profile.phone_normalized,
    ],
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = useMemo(
    () =>
      isValidNickname(draft.nickname) &&
      draft.name.trim().length > 1 &&
      normalizePhone(draft.phone).length >= 10 &&
      (draft.gender === "여성" || draft.gender === "남성") &&
      isValidBasicInfoBirthYear(draft.birthYear) &&
      mbtiOptions.includes(draft.mbti.toUpperCase()),
    [draft],
  );
  const fields = [
    { label: "닉네임", value: profileNickname(profile) },
    { label: "이름", value: displayValue(profile.name) },
    {
      label: "전화번호",
      value: displayValue(profile.phone ?? profile.phone_normalized),
    },
    { label: "성별", value: displayValue(profile.gender) },
    { label: "출생연도", value: displayValue(profile.birth_year) },
    { label: "MBTI", value: displayValue(profile.mbti) },
  ];

  useEffect(() => {
    if (!editing) setDraft(initialDraft);
  }, [editing, initialDraft]);

  const save = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    const normalizedPhone = normalizePhone(draft.phone);
    const nextProfile: ProfileRow = {
      ...profile,
      nickname: draft.nickname.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      phone_normalized: normalizedPhone,
      gender: draft.gender,
      birth_year: draft.birthYear,
      mbti: draft.mbti.toUpperCase(),
    };

    const { error: saveError } = await createClient()
      .from("profiles")
      .update({
        nickname: nextProfile.nickname,
        name: nextProfile.name,
        phone: nextProfile.phone,
        phone_normalized: nextProfile.phone_normalized,
        gender: nextProfile.gender,
        birth_year: nextProfile.birth_year,
        mbti: nextProfile.mbti,
      })
      .eq("user_id", profile.user_id);

    if (saveError) {
      setError("기본정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    onProfileUpdated(nextProfile);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const cancelEdit = () => {
    setDraft(initialDraft);
    setError(null);
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
          <h2 className="mt-0.5 text-base font-bold text-black">
            기본정보 카드
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="h-8 rounded-full border border-black/10 px-3 text-[11px] font-semibold text-black/50"
            >
              취소
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={saving}
              title="기본정보 수정"
              aria-label="기본정보 수정"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-black/50 disabled:opacity-50"
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

      {editing ? (
        <div className="mt-4 space-y-4 border-t border-black/8 pt-4">
          <BasicInfoField
            label="닉네임"
            labelAside="두 글자로 입력해주세요."
            value={draft.nickname}
            maxLength={2}
            onChange={(nickname) =>
              setDraft((current) => ({
                ...current,
                nickname: nickname.replace(/[^가-힣]/g, "").slice(0, 2),
              }))
            }
          />
          <BasicInfoField
            label="이름"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <BasicInfoField
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
                  className={cn(
                    "h-11 rounded-2xl border text-xs font-semibold transition",
                    draft.gender === gender
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/50",
                  )}
                >
                  {gender}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <BasicInfoBirthYearSelect
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
              <span className="flex items-baseline gap-2 text-xs font-semibold text-black/45">
                <span>MBTI</span>
              </span>
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

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}

          <motion.button
            type="button"
            whileTap={canSave && !saving ? { scale: 0.98 } : undefined}
            disabled={!canSave || saving}
            onClick={() => void save()}
            title="변경사항 저장"
            aria-label="변경사항 저장"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:bg-black/[0.08] disabled:text-black/30"
          >
            <Check size={15} aria-hidden />
            {saving ? "저장 중..." : "변경사항 저장"}
          </motion.button>
        </div>
      ) : (
        <>
          <dl className="mt-4 space-y-2.5 border-t border-black/8 pt-4">
            {fields.map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-4 py-1"
              >
                <dt className="shrink-0 text-xs font-semibold text-black/45">
                  {field.label}
                </dt>
                <dd className="text-right text-xs font-semibold text-black/70">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          {saved && (
            <p className="mt-4 rounded-2xl bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
              기본정보가 저장됐어요.
            </p>
          )}

          {operatorAccountSwitcher?.mode === "operator" && (
            <section className="mt-4 border-t border-black/8 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/35">
                test account
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
                실제 사용자 세션으로 전환합니다.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {operatorAccountSwitcher.accounts.map((account) => {
                  const switching = switchingAccountId === account.userId;
                  return (
                    <button
                      key={account.userId}
                      type="button"
                      disabled={Boolean(switchingAccountId)}
                      onClick={() => void onSwitchAccount(account.userId)}
                      className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white text-xs font-bold text-black/65 transition hover:border-black/25 hover:text-black disabled:cursor-wait disabled:opacity-45"
                    >
                      {switching && (
                        <Loader2
                          size={13}
                          className="animate-spin"
                          aria-hidden
                        />
                      )}
                      {account.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {operatorAccountSwitcher?.mode === "test" && (
            <section className="mt-4 border-t border-black/8 pt-4">
              <button
                type="button"
                disabled={Boolean(switchingAccountId)}
                onClick={() => void onReturnToOperator()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-500 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-45"
              >
                {switchingAccountId === "operator-return" ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <LogOut size={14} aria-hidden />
                )}
                로그아웃
              </button>
              <p className="mt-2 text-center text-[11px] font-semibold text-black/38">
                원래 운영자 계정으로 돌아갑니다.
              </p>
            </section>
          )}

          {accountSwitchError && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold leading-5 text-red-600">
              {accountSwitchError}
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}

function BasicInfoBirthYearSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedValue = basicInfoBirthYearOptions.includes(value) ? value : "";

  return (
    <label className="block">
      <span className="flex items-baseline gap-2 text-xs font-semibold text-black/45">
        <span>{label}</span>
      </span>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "mt-1.5 h-12 w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none focus:border-accent",
          selectedValue ? "text-black/70" : "text-black/30",
        )}
      >
        <option value="">출생연도 선택</option>
        {basicInfoBirthYearOptions.map((year) => (
          <option key={year} value={year}>
            {year}년생
          </option>
        ))}
      </select>
    </label>
  );
}

function BasicInfoField({
  label,
  labelAside,
  value,
  inputMode,
  maxLength,
  onChange,
}: {
  label: string;
  labelAside?: string;
  value: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2 text-xs font-semibold text-black/45">
        <span>{label}</span>
        {labelAside && (
          <span className="text-[10px] font-semibold text-black/32">
            {labelAside}
          </span>
        )}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none focus:border-accent"
      />
    </label>
  );
}

function TabMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full min-h-full"
    >
      {children}
    </motion.div>
  );
}
