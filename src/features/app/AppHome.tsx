"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
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
  MapPin,
  MessageCircle,
  X,
  PenLine,
  Sparkles,
  Ticket as TicketIcon,
  UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MbtiSelect, mbtiOptions } from "@/components/MbtiSelect";
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
import { profileQuestions } from "@/data/profileQuestions";
import {
  MeetingRecommendation,
} from "@/features/meetings/MeetingRecommendation";
import { useDragScroll } from "@/features/app/useDragScroll";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import {
  TicketDetailContent,
  type TicketDetailSectionKey,
} from "@/features/meetings/TicketDetailContent";
import {
  TicketDetailHero,
  ticketFadeTransition,
} from "@/features/meetings/TicketDetailHero";
import {
  MembershipFloatingButton,
  MembershipModal,
  type CurrentMembership,
} from "@/features/membership/MembershipModal";
import {
  displayMembershipStatus,
  isMembershipPlan,
} from "@/features/membership/membershipTypes";
import {
  identifyAnalyticsUser,
  trackEvent,
  trackLoginSuccessFromUrl,
} from "@/lib/analytics";
import {
  meetingDateApplicationStatusLabels,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { createClient } from "@/lib/supabase/client";
import {
  ticketFeedbackBodyText,
  ticketStageText,
} from "@/lib/ticketStageCopy";
import { ticketBackgroundImageUrls } from "@/lib/ticketImages";
import { courseStepOpenOffsetMinutes } from "@/lib/ticketCourse";
import type { ProfileRow } from "@/types/profile";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type { QuestionAnswer } from "@/types/question";
import type {
  GatheringTicket,
  TicketArrivalStatus,
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
  { length: 2007 - 1992 + 1 },
  (_, index) => String(1992 + index),
);

const profileVibeAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
] as const satisfies readonly VibeAxis[];
type ProfileVibeAxis = (typeof profileVibeAxes)[number];
type MeetingRatingKey = "overall" | "expectationMatch";
type MeetingRatings = Record<MeetingRatingKey, number | null>;
type NegativeFeedbackReason =
  | "no_show"
  | "not_my_vibe"
  | "uncomfortable_conversation"
  | "rude_or_aggressive"
  | "romantic_pressure"
  | "religion_or_sales"
  | "other";

type NegativeMemberFeedbackDraft = {
  reasons: NegativeFeedbackReason[];
  otherText: string;
};

const tabItems: Array<{ id: AppTab; label: string; Icon: LucideIcon }> = [
  { id: "recommend", label: "신청", Icon: Sparkles },
  { id: "browse", label: "티켓", Icon: TicketIcon },
  { id: "chat", label: "채팅", Icon: MessageCircle },
  { id: "profile", label: "프로필", Icon: UserRound },
];

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

function rowToAnswer(row: AnswerRow): QuestionAnswer {
  const question = profileQuestions.find(
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
    temperature: profileAxisScore(profile, answers, "temperature", 1),
    texture: profileAxisScore(profile, answers, "texture", 2),
    tone: profileAxisScore(profile, answers, "tone", 3),
    rhythm: profileAxisScore(profile, answers, "rhythm", 4),
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

function profileEmoji(profile: Pick<ProfileRow, "public_emoji">) {
  return profile.public_emoji?.trim() || "💎";
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
};

function userTicketsRequestKey({ limit, offset = 0 }: FetchUserTicketsOptions) {
  return `${offset}:${limit ?? "all"}`;
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

  const request = fetch(userTicketsRequestPath(options))
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

function currentMembershipFromProfile(profile: ProfileRow): CurrentMembership {
  if (
    displayMembershipStatus({
      status: profile.membership_status,
      endDate: profile.membership_end_date,
    }) !== "active" ||
    !isMembershipPlan(profile.membership_plan)
  ) {
    return null;
  }

  return {
    planId: profile.membership_plan,
    startedAt: profile.membership_start_date,
    expiresAt: profile.membership_end_date,
  };
}

export function AppHome({
  userId,
  profile,
  initialTab = "recommend",
  initialProfileCompletionOpen = false,
  operatorAccountSwitcher = null,
}: {
  userId: string;
  profile: ProfileRow;
  initialTab?: AppTab;
  initialProfileCompletionOpen?: boolean;
  operatorAccountSwitcher?: OperatorAccountSwitcher;
}) {
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
  const [blindDateOffers, setBlindDateOffers] = useState<BlindDateUserOffer[]>([]);
  const [blindDateOpenRequestId, setBlindDateOpenRequestId] = useState(0);
  const [blindDateOpenRequestPending, setBlindDateOpenRequestPending] =
    useState(false);
  const [answerRows, setAnswerRows] = useState<AnswerRow[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [profileVibeAnimationKey, setProfileVibeAnimationKey] = useState(0);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [questionReviewOpen, setQuestionReviewOpen] = useState(false);
  const [profileCompletionOpen, setProfileCompletionOpen] = useState(
    initialProfileCompletionOpen,
  );
  const [profileCompletionReplayKey, setProfileCompletionReplayKey] = useState(0);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [membershipTicket, setMembershipTicket] =
    useState<GatheringTicket | null>(null);
  const [profileRegenerationConfirmOpen, setProfileRegenerationConfirmOpen] =
    useState(false);
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
  const recommendTabTrackedRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const currentMembership = useMemo(
    () => currentMembershipFromProfile(currentProfile),
    [currentProfile],
  );
  const recommendationMembershipStatus = useMemo(
    () =>
      displayMembershipStatus({
        status: currentProfile.membership_status,
        endDate: currentProfile.membership_end_date,
      }),
    [currentProfile.membership_end_date, currentProfile.membership_status],
  );
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
      void fetchUserTickets({ force, offset: response.nextOffset })
        .then((remainingResponse) => {
          if (isCancelled() || !remainingResponse) return;
          applyUserTicketsResponse(remainingResponse, "append");
        })
        .finally(() => {
          if (!isCancelled()) setLoadingRemainingTickets(false);
        });
    },
    [applyUserTicketsResponse],
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
      });
      if (isCancelled() || !response) return null;

      applyUserTicketsResponse(response, "replace");
      loadRemainingUserTickets(response, force, isCancelled);
      return response;
    },
    [applyUserTicketsResponse, loadRemainingUserTickets],
  );

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  useEffect(() => {
    trackLoginSuccessFromUrl("existing");
  }, []);

  useEffect(() => {
    identifyAnalyticsUser(userId);
  }, [userId]);

  useEffect(() => {
    if (activeTab !== "recommend" || recommendTabTrackedRef.current) return;

    recommendTabTrackedRef.current = true;
    trackEvent("recommend_tab_view");
  }, [activeTab]);

  useEffect(() => {
    if (initialProfileCompletionOpen) setProfileCompletionOpen(true);
  }, [initialProfileCompletionOpen]);

  useEffect(() => {
    let cancelled = false;

    void loadUserTicketsProgressively({
      isCancelled: () => cancelled,
    });
    void fetchBlindDateOffers().then((offers) => {
      if (cancelled || !offers) return;

      setBlindDateOffers(offers);
    });
    const supabase = createClient();

    supabase
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
                profileQuestions.some(
                  (question) =>
                    (question.order ?? question.id) === row.question_order,
                ),
              )
              .map((row) => {
                const answer = rowToAnswer(row);
                return [answer.questionId, answer];
              }),
          ) as AnswerMap,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [loadUserTicketsProgressively, userId]);

  useEffect(() => {
    const refreshTickets = () => {
      void loadUserTicketsProgressively({
        force: true,
      });
    };

    const intervalId = window.setInterval(refreshTickets, 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadUserTicketsProgressively]);

  const switchTab = (tab: AppTab) => {
    if (tab === "profile") {
      setProfileVibeAnimationKey((current) => current + 1);
    }

    setActiveTab(tab);
    setProfilePanelOpen(false);
    setQuestionReviewOpen(false);
    setMembershipModalOpen(false);
    setTabUrl(tab);
  };

  const openBlindDateStatus = () => {
    setActiveTab("recommend");
    setProfilePanelOpen(false);
    setQuestionReviewOpen(false);
    setMembershipModalOpen(false);
    setTabUrl("recommend");
    setBlindDateOpenRequestId((current) => current + 1);
    setBlindDateOpenRequestPending(true);
  };

  const openProfileCompletionReplay = () => {
    setMembershipModalOpen(false);
    setProfilePanelOpen(false);
    setQuestionReviewOpen(false);
    setProfileCompletionReplayKey((current) => current + 1);
    setProfileCompletionOpen(true);
  };

  const openProfileRegenerationConfirm = () => {
    setMembershipModalOpen(false);
    setProfilePanelOpen(false);
    setQuestionReviewOpen(false);
    setProfileRegenerationError(null);
    setProfileRegenerationConfirmOpen(true);
  };

  const startProfileRegeneration = async () => {
    if (profileRegenerating) return;

    setProfileRegenerating(true);
    setProfileRegenerationError(null);

    const response = await fetch("/api/profile/regeneration/start", {
      method: "POST",
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

    window.location.href = "/onboarding/questions?regenerate=1&start=1";
  };

  const finishProfileCompletion = (nextProfile: Partial<ProfileRow>) => {
    trackEvent("profile_intro_complete", {
      source: "profile_completion_modal",
    });
    setCurrentProfile((current) => ({ ...current, ...nextProfile }));
    setProfileCompletionOpen(false);
    setActiveTab("recommend");
    setTabUrl("recommend");
  };

  const addWaitlistedTicket = (_ticket: GatheringTicket) => {
    void loadUserTicketsProgressively({
      force: true,
    });
  };

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

  return (
    <section
      className="relative flex h-dvh flex-col overflow-hidden bg-white md:h-[calc(100dvh-32px)]"
    >
      <MembershipFloatingButton
        onClick={() => {
          setProfilePanelOpen(false);
          setMembershipTicket(null);
          setMembershipModalOpen(true);
        }}
      />

      {activeBlindDateOfferCount > 0 && (
        <button
          type="button"
          onClick={openBlindDateStatus}
          title="블라인드 데이트"
          aria-label={
            pendingBlindDateOfferCount > 0
              ? `메시지 ${pendingBlindDateOfferCount}개`
              : "블라인드 데이트 상태 확인"
          }
          className="absolute right-[120px] top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/68 shadow-sm transition hover:-translate-y-0.5 hover:text-black hover:shadow-md"
        >
          <span className="text-lg leading-none" aria-hidden>
            ✉️
          </span>
          {pendingBlindDateOfferCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-black leading-none text-white">
              {pendingBlindDateOfferCount}
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          setMembershipModalOpen(false);
          setProfilePanelOpen((open) => !open);
        }}
        aria-label="기본정보 카드 열기"
        aria-expanded={profilePanelOpen}
        className={cn(
          "absolute right-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border bg-white text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]",
          profilePanelOpen
            ? "border-black text-black shadow-md"
            : "border-black/15 text-black/70 hover:text-black",
        )}
      >
        {profileInitial(currentProfile)}
      </button>

      <AnimatePresence>
        {profilePanelOpen && (
          <>
            <motion.button
              type="button"
              aria-label="기본정보 카드 닫기"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProfilePanelOpen(false)}
              className="absolute inset-0 z-20 bg-black/10"
            />
            <BasicInfoPanel
              key="basic-info-panel"
              profile={currentProfile}
              operatorAccountSwitcher={operatorAccountSwitcher}
              switchingAccountId={switchingAccountId}
              accountSwitchError={accountSwitchError}
              onProfileUpdated={setCurrentProfile}
              onClose={() => setProfilePanelOpen(false)}
              onSwitchAccount={switchToTestAccount}
              onReturnToOperator={returnToOperatorAccount}
            />
          </>
        )}
      </AnimatePresence>

      <MembershipModal
        open={membershipModalOpen}
        userId={userId}
        currentMembership={currentMembership}
        pendingTicket={membershipTicket}
        onClose={() => {
          setMembershipModalOpen(false);
          setMembershipTicket(null);
        }}
      />

      <div
        ref={scrollAreaRef}
        className={cn(
          "min-h-0 flex-1 touch-pan-y scrollbar-none",
          chatRoomOpen
            ? "pb-0"
            : "pb-[calc(90px+env(safe-area-inset-bottom))]",
          activeTab === "chat" ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        <div
          aria-hidden={activeTab !== "browse"}
          className={cn(activeTab === "browse" ? "block h-full" : "hidden")}
        >
          <TicketListTab
            tickets={waitlistedTickets}
            dateApplications={dateApplications}
            totalTicketCount={waitlistedTicketCount ?? waitlistedTickets.length}
            loadingMore={loadingRemainingTickets}
            onGoRecommend={() => switchTab("recommend")}
          />
        </div>
        <div
          aria-hidden={activeTab !== "recommend"}
          className={cn(activeTab === "recommend" ? "block min-h-full" : "hidden")}
        >
          <MeetingRecommendation
            userId={userId}
            recommendationName={profileNickname(currentProfile)}
            embedded
            active={activeTab === "recommend"}
            membershipStatus={recommendationMembershipStatus}
            onWaitlisted={addWaitlistedTicket}
            onOpenList={() => switchTab("browse")}
            blindDateOffers={blindDateOffers}
            onBlindDateOffersChange={setBlindDateOffers}
            blindDateOpenRequestId={blindDateOpenRequestId}
            blindDateOpenRequestPending={blindDateOpenRequestPending}
            onDateApplicationsChange={setDateApplications}
            onBlindDateOpenRequestHandled={() =>
              setBlindDateOpenRequestPending(false)
            }
          />
        </div>
        <div
          aria-hidden={activeTab !== "chat"}
          className={cn(activeTab === "chat" ? "block h-full" : "hidden")}
        >
          {activeTab === "chat" && (
            <LazyMeetingChat
              userId={userId}
              active
              onUnreadCountChange={setChatUnreadCount}
              onRoomOpenChange={setChatRoomOpen}
            />
          )}
        </div>
        <div
          aria-hidden={activeTab !== "profile"}
          className={cn(activeTab === "profile" ? "block min-h-full" : "hidden")}
        >
          {activeTab === "profile" && (
            <LazyProfileTab
              profile={currentProfile}
              answers={answers}
              participationCount={participationCount}
              vibeAnimationKey={profileVibeAnimationKey}
              loggingOut={loggingOut}
              logoutError={logoutError}
              onOpenQuestionReview={() => setQuestionReviewOpen(true)}
              onOpenProfileCompletionReplay={openProfileCompletionReplay}
              onRequestProfileRegeneration={openProfileRegenerationConfirm}
              onLogout={logout}
            />
          )}
        </div>
      </div>

      {!chatRoomOpen && (
        <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-5 pb-[calc(10px+env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto relative grid grid-cols-4 gap-1 rounded-full border border-white/[0.24] bg-black/[0.62] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.18)] backdrop-blur-xl">
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
                      className="absolute inset-0 -z-10 rounded-full bg-white"
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
        {profileCompletionOpen && (
          <ProfileCompletionModal
            key={`profile-completion-${profileCompletionReplayKey}`}
            userId={userId}
            profile={currentProfile}
            answers={answers}
            animationKey={profileCompletionReplayKey}
            onComplete={finishProfileCompletion}
          />
        )}
        {profileRegenerationConfirmOpen && (
          <ProfileRegenerationConfirmModal
            key="profile-regeneration-confirm"
            loading={profileRegenerating}
            error={profileRegenerationError}
            onCancel={() => {
              if (profileRegenerating) return;
              setProfileRegenerationConfirmOpen(false);
            }}
            onConfirm={() => void startProfileRegeneration()}
          />
        )}
        {questionReviewOpen && (
          <motion.div
            key="question-review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-50 overflow-y-auto overscroll-contain bg-white"
          >
            <button
              type="button"
              title="질문 다시보기 닫기"
              aria-label="질문 다시보기 닫기"
              onClick={() => setQuestionReviewOpen(false)}
              className="absolute right-4 top-[calc(44px+env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/92 text-black/55 shadow-sm backdrop-blur"
            >
              <X size={17} aria-hidden />
            </button>
            <QuestionFlow
              mode="preview"
              initialRows={answerRows}
              onPreviewComplete={() => setQuestionReviewOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ChatTabLoading() {
  return (
    <section className="flex h-full min-h-[420px] flex-col bg-[#f7f7f5] px-5 pb-6 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="h-6 w-28 animate-pulse rounded-full bg-black/10" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-20 animate-pulse rounded-[24px] border border-black/5 bg-white"
          />
        ))}
      </div>
    </section>
  );
}

function ProfileTabLoading() {
  return (
    <div className="h-full min-h-full px-5 pb-7 pt-7">
      <div className="h-3 w-14 animate-pulse rounded-full bg-accent/20" />
      <div className="mt-3 h-8 w-40 animate-pulse rounded-full bg-black/[0.06]" />
      <div className="mt-7 rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
        <div className="h-3 w-20 animate-pulse rounded-full bg-accent/15" />
        <div className="mt-4 h-6 w-24 animate-pulse rounded-full bg-black/[0.06]" />
        <div className="mt-5 space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-black/[0.05]" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/[0.05]" />
        </div>
      </div>
      <div className="mt-5 h-48 animate-pulse rounded-2xl border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,0.035)]" />
    </div>
  );
}

type TicketListItem =
  | {
      kind: "date-application";
      id: string;
      application: MeetingDateApplication;
    }
  | { kind: "stored-ticket"; id: string; userTicket: UserTicket };

function isVisibleMysteryApplication(application: MeetingDateApplication) {
  return (
    !application.assignedTicketInstanceId &&
    !["cancelled", "not_selected", "feedback_done", "completed"].includes(
      application.status,
    )
  );
}

function TicketListTab({
  tickets,
  dateApplications,
  totalTicketCount,
  loadingMore,
  onGoRecommend,
}: {
  tickets: UserTicket[];
  dateApplications: MeetingDateApplication[];
  totalTicketCount: number;
  loadingMore: boolean;
  onGoRecommend: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
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
  const mysteryApplications = useMemo(
    () =>
      dateApplications
        .filter(isVisibleMysteryApplication)
        .sort((left, right) => left.meetingDate.localeCompare(right.meetingDate)),
    [dateApplications],
  );
  const ticketItems = useMemo<TicketListItem[]>(
    () => [
      ...mysteryApplications.map((application) => ({
        kind: "date-application" as const,
        id: `date-application:${application.id}`,
        application,
      })),
      ...tickets.map((userTicket) => ({
        kind: "stored-ticket" as const,
        id: `stored-ticket:${userTicket.id}`,
        userTicket,
      })),
    ],
    [mysteryApplications, tickets],
  );
  const itemCount = ticketItems.length;

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(itemCount - 1, 0)),
    );
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });

    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, [itemCount]);

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
    if (!viewport || itemCount === 0) return;

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
    if (!viewport || itemCount === 0) return;

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
    if (itemCount === 0) return;

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
      tappedItem?.kind === "stored-ticket"
    ) {
      setSelectedTicket(tappedItem.userTicket);
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

  return (
    <TabMotion>
      <AnimatePresence mode="wait" initial={false}>
        {selectedTicket ? (
          <StoredTicketDetailView
            key={`stored-ticket-detail-${selectedTicket.id}`}
            userTicket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        ) : (
          <motion.section
            key="stored-ticket-list"
            aria-busy={loadingMore}
            exit={{ opacity: 0, y: -8 }}
            transition={ticketFadeTransition}
            className="flex h-full min-h-0 flex-col overflow-hidden bg-white pb-2 pt-[calc(16px+env(safe-area-inset-top))] text-black"
          >
            <header className="shrink-0 px-5 pr-28">
              <p className="text-[13px] font-bold uppercase italic tracking-wide text-black">
                tickets {totalTicketCount + mysteryApplications.length}
              </p>
            </header>

            {itemCount === 0 ? (
              <div className="mx-5 mt-16 rounded-[28px] border border-black/10 bg-white p-6 text-center shadow-[0_16px_44px_rgba(0,0,0,0.04)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
                  <CalendarDays size={20} aria-hidden />
                </div>
                <h2 className="mt-5 text-lg font-bold text-black">
                  아직 보관된 티켓이 없어요
                </h2>
                <p className="mt-2 text-xs leading-5 text-black/45">
                  신청 탭에서 참여 가능한 날짜를 선택해보세요.
                </p>
                <button
                  type="button"
                  onClick={onGoRecommend}
                  className="mt-6 h-12 w-full rounded-full bg-black text-sm font-semibold text-white"
                >
                  날짜 신청하기
                </button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 -translate-y-3 flex-col justify-center pb-3 pt-4">
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
                  className="flex shrink-0 cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-[11%] pb-2 scrollbar-none overscroll-x-contain touch-pan-x active:cursor-grabbing"
                >
                  {ticketItems.map((item, index) => (
                    <div
                      key={item.id}
                      data-ticket-slide
                      data-ticket-slide-index={index}
                      className="w-[min(78vw,330px,calc(61.73dvh-121px))] shrink-0 snap-center snap-always"
                    >
                      {item.kind === "stored-ticket" ? (
                        <StoredTicketCard
                          userTicket={item.userTicket}
                          onOpen={() => openStoredTicket(item.userTicket)}
                        />
                      ) : (
                        <MysteryApplicationTicketCard
                          application={item.application}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {itemCount > 1 && (
                  <div
                    className="mt-1.5 flex shrink-0 justify-center gap-1.5"
                    aria-label={`티켓 ${activeIndex + 1}/${itemCount}`}
                  >
                    {ticketItems.map((item, index) => (
                      <span
                        key={item.id}
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
      className="relative rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
    >
      <IntersectionTicketCard
        title={ticket.title}
        imageUrl={ticket.imageUrl}
        imageUrls={ticketBackgroundImageUrls(ticket)}
        date={ticket.date}
        time={ticket.time}
        location={`서울\n${ticket.area}`}
        tags={ticket.moodTags}
        badgeLabel={userTicket.statusLabel}
        badgeClassName={statusBadgeClass(userTicket.status)}
        remainingSeatCount={ticket.remainingSeatCount}
        className="shadow-none"
      />
    </motion.div>
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

function dateApplicationConfirmationAt(application: MeetingDateApplication) {
  const dateMatch = application.meetingDate.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );
  const meetingTime =
    meetingDateSchedule(application.meetingDate)?.time ??
    application.meetingTime;
  const timeMatch = meetingTime.match(/^(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;

  const meetingAt = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  ).getTime();

  return Number.isFinite(meetingAt) ? meetingAt - 24 * 60 * 60 * 1000 : null;
}

function formatConfirmationCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return days > 0 ? `${days}일 ${clock}` : clock;
}

function MysteryConfirmationCountdown({
  application,
}: {
  application: MeetingDateApplication;
}) {
  const confirmationAt = dateApplicationConfirmationAt(application);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [confirmationAt]);

  if (confirmationAt === null) {
    return <span className="block">확정 시간을 확인 중이에요</span>;
  }

  const remainingMs = nowMs === null ? null : confirmationAt - nowMs;

  if (remainingMs !== null && remainingMs <= 0) {
    return (
      <span className="block">
        확정 안내를
        <br />
        준비 중이에요
      </span>
    );
  }

  return (
    <span className="block">
      <span className="block text-[17px] font-extrabold leading-6 text-white/75">
        공개까지 남은 시간
      </span>
      <span className="mt-0.5 block text-[38px] font-black leading-none tracking-[-0.03em] text-white tabular-nums">
        {remainingMs === null
          ? "--:--:--"
          : formatConfirmationCountdown(remainingMs)}
      </span>
    </span>
  );
}

function MysteryApplicationTicketCard({
  application,
}: {
  application: MeetingDateApplication;
}) {
  const schedule = meetingDateSchedule(application.meetingDate);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      aria-label={`${meetingDateApplicationStatusLabels[application.status]} 미정 티켓`}
      className="relative"
    >
      <IntersectionTicketCard
        title={
          application.status === "approved" ? (
            "참여가\n확정됐어요"
          ) : (
            <MysteryConfirmationCountdown application={application} />
          )
        }
        date={application.meetingDate}
        time={schedule?.time ?? application.meetingTime}
        location={application.region}
        badgeLabel={meetingDateApplicationStatusLabels[application.status]}
        badgeClassName={dateApplicationBadgeClass(application)}
        className="shadow-none"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[10%] flex h-[62%] items-center justify-center [perspective:700px]"
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? { rotateX: 0, rotateY: 0 }
              : { rotateX: -3, rotateY: 360 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: 3.6,
                  ease: "linear",
                  repeat: Infinity,
                }
          }
          className="flex h-[250px] w-[200px] origin-center items-center justify-center"
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          <span
            className="inline-block bg-gradient-to-r from-white/55 via-white to-white/70 bg-clip-text text-[208px] font-black leading-none text-transparent drop-shadow-[8px_12px_14px_rgba(0,0,0,0.42)]"
            style={{
              fontFamily: '"Arial Black", "Arial Narrow", Arial, sans-serif',
              transform: "scaleX(0.8) scaleY(1.22)",
            }}
          >
            ?
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function StoredTicketDetailView({
  userTicket,
  onClose,
  previewMode = false,
  selectedProgressStep: controlledProgressStep,
  onProgressStepChange,
}: {
  userTicket: UserTicket;
  onClose: () => void;
  previewMode?: boolean;
  selectedProgressStep?: TicketProgressViewStepKey;
  onProgressStepChange?: (step: TicketProgressViewStepKey) => void;
}) {
  const ticket = userTicket.ticket;
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
  const heroImageUrl = ticketProgressHeroImageUrl(ticket, selectedProgressStep);
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={ticketFadeTransition}
      className="min-h-full bg-white px-5 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-black"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="티켓 상세 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm transition hover:-translate-y-0.5 hover:text-black hover:shadow-md"
      >
        <X size={18} aria-hidden />
      </button>

      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04, duration: 0.22, ease: "easeOut" }}
        className="overflow-hidden rounded-[28px] border border-black/12 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
      >
        <TicketDetailHero
          ticket={ticket}
          badgeLabel={userTicket.statusLabel}
          statusExpanded={statusOpen}
          onToggleStatus={() => setStatusOpen((current) => !current)}
          backgroundImageUrls={[heroImageUrl]}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.22, ease: "easeOut" }}
          className="bg-white px-5 pb-5 pt-1"
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
          />
        </motion.div>
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

function ticketProgressHeroImageUrl(
  ticket: GatheringTicket,
  stepKey: TicketProgressViewStepKey,
) {
  const steps = ticketProgressViewSteps(ticket);
  const selectedStep = steps.find((step) => step.key === stepKey);

  if (selectedStep?.baseStep === "in_progress") {
    return selectedStep.courseStep?.imageUrl?.trim() || ticket.imageUrl;
  }

  if (selectedStep?.baseStep === "feedback") {
    const lastActivityImage = steps
      .filter((step) => step.baseStep === "in_progress")
      .at(-1)
      ?.courseStep?.imageUrl?.trim();
    return lastActivityImage || ticket.imageUrl;
  }

  return ticket.imageUrl;
}

const introDetailSections: TicketDetailSectionKey[] = [
  "summary",
  "vibe",
  "activities",
];
const appliedDetailSections: TicketDetailSectionKey[] = [
  "summary",
  "vibe",
  "activities",
  "notice",
];
const ticketGuidanceClass =
  "mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-800";

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
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
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
                  className="mt-1 shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-right text-[11px] font-black leading-4 text-emerald-800 shadow-[0_8px_18px_rgba(16,185,129,0.12)]"
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
                  active ? "bg-accent" : "bg-black/8",
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
                      ? "bg-accent text-white shadow-[0_4px_12px_rgba(126,179,199,0.42)]"
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
          : "border-black/10 bg-white shadow-sm hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent",
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
}: {
  userTicket: UserTicket;
  progressStep: TicketProgressViewStepKey;
  previewMode?: boolean;
}) {
  const ticket = userTicket.ticket;
  const baseProgressStep = progressViewBaseStep(progressStep);
  const selectedCourseStep = selectedActivityCourseStep(ticket, progressStep);
  const selectedPlace = courseStepPlace(selectedCourseStep) ?? userTicket.place;
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
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
          previewMode={previewMode}
        />
        <TicketDetailContent
          ticket={ticket}
          sections={introDetailSections}
          className="mt-0"
          afterActivities={
            <PlaceSection
              userTicket={userTicket}
              place={selectedPlace}
              revealDetails
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
          selectedArrivalStatus={arrivalStatus}
          onArrivalStatusChange={setArrivalStatus}
          previewMode={previewMode}
        />
        <TicketDetailContent
          ticket={ticket}
          sections={introDetailSections}
          className="mt-0"
          afterActivities={
            <PlaceSection userTicket={userTicket} revealDetails />
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
          sections={introDetailSections}
          afterActivities={
            <PlaceSection userTicket={userTicket} revealDetails />
          }
        />
      </>
    );
  }

  return (
    <TicketDetailContent
      ticket={ticket}
      sections={appliedDetailSections}
      className="mt-0"
      afterActivities={<PlaceSection userTicket={userTicket} />}
    />
  );
}

function PlaceSection({
  userTicket,
  place = userTicket.place,
  revealDetails = false,
}: {
  userTicket: UserTicket;
  place?: TicketPlace | null;
  revealDetails?: boolean;
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
      <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
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
                className="mt-3"
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
    </section>
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
  return (
    arrivalOptions.find((option) => option.value === status)?.label ??
    "아직 선택 전"
  );
}

function arrivalStatusToneClass(status: TicketArrivalStatus | null) {
  if (status === "on_time") {
    return "border-emerald-300 bg-emerald-50/60 text-emerald-800";
  }
  if (status) {
    return "border-amber-300 bg-amber-50/70 text-amber-800";
  }
  return "border-black/10 bg-white text-black/45";
}

function arrivalOptionActiveClass(status: TicketArrivalStatus) {
  if (status === "on_time") {
    return "border-emerald-400 bg-emerald-50 text-emerald-900";
  }

  return "border-amber-400 bg-amber-50 text-amber-900";
}

function arrivalCheckClass(status: TicketArrivalStatus) {
  return status === "on_time" ? "text-emerald-600" : "text-amber-600";
}

function ArrivalStatusPanel({
  userTicket,
  selectedArrivalStatus,
  onArrivalStatusChange,
  previewMode = false,
}: {
  userTicket: UserTicket;
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
                    : "border-black/10 bg-white text-black/55 hover:border-black/20",
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
    <div className="mt-4 rounded-2xl border border-black/10 bg-white">
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
                      <span aria-hidden className="shrink-0 text-xs">
                        {member.emoji}
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
  const dateCandidateMembers = useMemo(() => {
    return otherMembers;
  }, [otherMembers]);
  const [meetingRatings, setMeetingRatings] = useState<MeetingRatings>({
    overall: null,
    expectationMatch: null,
  });
  const [dateUnknown, setDateUnknown] = useState(false);
  const [dateMemberIds, setDateMemberIds] = useState<string[]>([]);
  const [vibeUnknown, setVibeUnknown] = useState(false);
  const [vibeMemberIds, setVibeMemberIds] = useState<string[]>([]);
  const [negativeMemberIds, setNegativeMemberIds] = useState<string[]>([]);
  const [expandedNegativeMemberId, setExpandedNegativeMemberId] = useState<
    string | null
  >(null);
  const [negativeFeedback, setNegativeFeedback] = useState<
    Record<string, NegativeMemberFeedbackDraft>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setMeetingRatings({ overall: null, expectationMatch: null });
    setDateUnknown(false);
    setDateMemberIds([]);
    setVibeUnknown(false);
    setVibeMemberIds([]);
    setNegativeMemberIds([]);
    setExpandedNegativeMemberId(null);
    setNegativeFeedback({});
    setSubmitting(false);
    setSubmitted(false);
    setSubmitError(null);
  }, [otherMembers, userTicket.waitlistId]);

  const meetingRatingsComplete = Object.values(meetingRatings).every(
    (value) => typeof value === "number",
  );
  const vibeSelectionComplete =
    otherMembers.length === 0 || vibeUnknown || vibeMemberIds.length > 0;
  const negativeFeedbackComplete = negativeMemberIds.every((memberId) => {
    const draft = negativeFeedback[memberId];
    if (!draft || draft.reasons.length === 0) return false;
    return (
      !draft.reasons.includes("other") || draft.otherText.trim().length > 0
    );
  });
  const canSubmit =
    meetingRatingsComplete &&
    vibeSelectionComplete && negativeFeedbackComplete;
  const selectedPositiveMemberIds = dateMemberIds;
  const negativeMembers = negativeMemberIds
    .map((memberId) => otherMembers.find((member) => member.id === memberId))
    .filter((member): member is UserTicket["members"][number] => Boolean(member));

  const selectDateMember = (memberId: string) => {
    setDateUnknown(false);
    setDateMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const selectDateUnknown = () => {
    setDateMemberIds([]);
    setDateUnknown(true);
  };

  const selectVibeMember = (memberId: string) => {
    setVibeUnknown(false);
    setVibeMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const selectVibeUnknown = () => {
    setVibeMemberIds([]);
    setVibeUnknown(true);
  };

  const toggleNegativeMember = (memberId: string) => {
    const isSelected = negativeMemberIds.includes(memberId);
    if (isSelected && expandedNegativeMemberId !== memberId) {
      setExpandedNegativeMemberId(memberId);
      return;
    }

    setNegativeMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
    setExpandedNegativeMemberId(isSelected ? null : memberId);
    setNegativeFeedback((current) => ({
      ...current,
      [memberId]: current[memberId] ?? { reasons: [], otherText: "" },
    }));
  };

  const toggleNegativeReason = (
    memberId: string,
    reason: NegativeFeedbackReason,
  ) => {
    setNegativeFeedback((current) => {
      const draft = current[memberId] ?? { reasons: [], otherText: "" };
      const selected = draft.reasons.includes(reason);
      const reasons = selected
        ? draft.reasons.filter((item) => item !== reason)
        : [...draft.reasons, reason];

      return {
        ...current,
        [memberId]: {
          ...draft,
          reasons,
          otherText: reasons.includes("other") ? draft.otherText : "",
        },
      };
    });
  };

  const updateNegativeOtherText = (memberId: string, otherText: string) => {
    setNegativeFeedback((current) => {
      const draft = current[memberId] ?? { reasons: [], otherText: "" };
      return {
        ...current,
        [memberId]: {
          ...draft,
          otherText,
        },
      };
    });
  };

  const submitLabel = (() => {
    if (submitting) return "저장 중이에요";
    if (!meetingRatingsComplete) return "모임 별점을 남겨주세요";
    if (!vibeSelectionComplete) return "결이 비슷한 사람을 선택해주세요";
    if (!negativeFeedbackComplete) return "부정 피드백 사유를 선택해주세요";
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
    meeting_ratings: {
      overall: meetingRatings.overall,
      expectation_match: meetingRatings.expectationMatch,
    },
    negative_member_feedback: Object.fromEntries(
      negativeMemberIds.map((memberId) => {
        const draft = negativeFeedback[memberId] ?? {
          reasons: [],
          otherText: "",
        };

        return [
          memberId,
          {
            reasons: draft.reasons,
            otherText: draft.otherText.trim() || null,
          },
        ];
      }),
    ),
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
    <div className="space-y-5 py-5">
      <section className="border border-[#eadfc8] bg-[#fff8ea] px-5 py-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
            feedback
          </p>
          <h2 className="mt-1 text-[22px] font-black text-black">
            {feedbackTitle}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-black/52">
            {feedbackBody}
          </p>
        </div>
      </section>

      <section className="py-5">
        <div className="space-y-5">
          <MeetingStarRating
            label="오늘 자리는 전반적으로 어땠나요?"
            value={meetingRatings.overall}
            onChange={(rating) =>
              setMeetingRatings((current) => ({ ...current, overall: rating }))
            }
          />
          <MeetingStarRating
            label="친구한테 교집합을 추천해주실 의향이 있나요?"
            value={meetingRatings.expectationMatch}
            onChange={(rating) =>
              setMeetingRatings((current) => ({
                ...current,
                expectationMatch: rating,
              }))
            }
          />
        </div>
      </section>

      <section className="border-t border-black/8 py-5">
        <h3 className="text-[15px] font-black leading-6 text-black">
          단둘이 만나고 싶어요.
          <span className="ml-1 font-medium text-black/35">(중복 선택 가능)</span>
        </h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
          서로 선택한 경우 1:1 만남 자리를 준비해드려요.
        </p>
        {dateCandidateMembers.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
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
                      : "border-black/10 bg-white text-black/62 hover:border-black/25",
                  )}
                >
                  {memberRealName(member)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={selectDateUnknown}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                dateUnknown
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-black/[0.03] text-black/55 hover:border-black/25",
              )}
            >
              잘 모르겠어요
            </button>
          </div>
        ) : (
          <p className="mt-4 bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
            선택 가능한 멤버가 없어 이 단계는 건너뛰어요.
          </p>
        )}
      </section>

      <section className="border-t border-black/8 py-5">
        <h3 className="text-[15px] font-black leading-6 text-black">
          이런 결의 사람을 만나고 싶어요.
          <span className="ml-1 font-medium text-black/35">(중복 선택 가능)</span>
        </h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
          다음 만남에서 비슷한 분들로 추천해드려요.
        </p>
        {otherMembers.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {otherMembers.map((member) => {
              const selected = vibeMemberIds.includes(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => selectVibeMember(member.id)}
                  className={cn(
                    "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                    selected
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/62 hover:border-black/25",
                  )}
                >
                  {memberRealName(member)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={selectVibeUnknown}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                vibeUnknown
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-black/[0.03] text-black/55 hover:border-black/25",
              )}
            >
              잘 모르겠어요
            </button>
          </div>
        ) : (
          <p className="mt-4 bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
            함께한 멤버 정보가 없어 이 단계는 건너뛰어요.
          </p>
        )}

      </section>

      <section className="border-t border-black/8 py-5">
        <h3 className="text-[15px] font-black leading-6 text-black">
          이 사람과는 다시 같은 자리에 있고 싶지 않아요.
        </h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
          선택하지 않아도 괜찮아요.
        </p>
        {otherMembers.length > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {otherMembers.map((member) => {
                const selected = negativeMemberIds.includes(member.id);

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleNegativeMember(member.id)}
                    aria-expanded={
                      selected && expandedNegativeMemberId === member.id
                    }
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                      selected
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black/62 hover:border-black/25",
                    )}
                  >
                    {memberRealName(member)}
                  </button>
                );
              })}
            </div>

            {negativeMembers.length > 0 && (
              <div className="mt-5 space-y-4">
                {negativeMembers.map((member) => {
                  if (member.id !== expandedNegativeMemberId) return null;

                  const draft = negativeFeedback[member.id] ?? {
                    reasons: [],
                    otherText: "",
                  };

                  return (
                    <div
                      key={member.id}
                      className="border border-black/8 bg-black/[0.025] px-4 py-4"
                    >
                      <h4 className="text-sm font-black text-black">
                        {memberRealName(member)}
                      </h4>
                      <div className="mt-3 grid gap-2">
                        {negativeFeedbackReasons.map((reason) => {
                          const selected = draft.reasons.includes(reason.value);

                          return (
                            <button
                              key={reason.value}
                              type="button"
                              onClick={() =>
                                toggleNegativeReason(member.id, reason.value)
                              }
                              className={cn(
                                "flex min-h-10 items-center justify-between border px-3 py-2 text-left text-xs font-bold leading-5 transition",
                                selected
                                  ? "border-black bg-black text-white"
                                  : "border-black/10 bg-white text-black/62 hover:border-black/25",
                              )}
                            >
                              <span>{reason.label}</span>
                              {selected && <Check size={13} aria-hidden />}
                            </button>
                          );
                        })}
                      </div>
                      {draft.reasons.includes("other") && (
                        <input
                          value={draft.otherText}
                          placeholder="직접 입력해주세요."
                          onChange={(event) =>
                            updateNegativeOtherText(member.id, event.target.value)
                          }
                          className="mt-3 h-11 w-full border border-black/10 bg-white px-3.5 text-xs font-semibold outline-none placeholder:text-black/25 focus:border-accent"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
            함께한 멤버 정보가 없어 이 단계는 건너뛰어요.
          </p>
        )}
      </section>

      {submitError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
          {submitError}
        </p>
      )}

      <button
        type="button"
        disabled={submitting || !canSubmit}
        onClick={() => void submitFeedback()}
        className="h-12 w-full rounded-full bg-black text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20 disabled:shadow-none"
      >
        {submitLabel}
      </button>
    </div>
  );
}

const negativeFeedbackReasons: Array<{
  value: NegativeFeedbackReason;
  label: string;
}> = [
  { value: "no_show", label: "노쇼했어요." },
  { value: "not_my_vibe", label: "그냥 결이 맞지 않았어요." },
  { value: "uncomfortable_conversation", label: "대화가 불편했어요." },
  {
    value: "rude_or_aggressive",
    label: "무례하거나 공격적인 표현이 있었어요.",
  },
  {
    value: "romantic_pressure",
    label: "노골적인 이성 목적이 느껴졌어요.",
  },
  {
    value: "religion_or_sales",
    label: "종교 포교 / 영업처럼 느껴졌어요.",
  },
  { value: "other", label: "기타 / 직접입력" },
];

function MeetingStarRating({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (rating: number) => void;
  value: number | null;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <div>
      <p className="text-sm font-black leading-6 text-black">{label}</p>
      <div className="mt-2 flex items-center gap-1.5" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const filled = typeof value === "number" && rating <= value;

          return (
            <motion.button
              key={rating}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => onChange(rating)}
              aria-label={`${label} ${rating}점`}
              className="relative flex h-9 w-9 items-center justify-center"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.svg
                  key={filled ? `filled-${value}` : "empty"}
                  viewBox="0 0 32 32"
                  initial={
                    shouldReduceMotion
                      ? false
                      : filled
                        ? { opacity: 0, scale: 0.38, y: 4, rotate: -5 }
                        : { opacity: 0, scale: 0.94 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.2,
                    ease: [0.16, 1, 0.3, 1],
                    delay:
                      filled && !shouldReduceMotion ? (rating - 1) * 0.055 : 0,
                  }}
                  className={cn(
                    "h-7 w-7 overflow-visible",
                    filled ? "text-black" : "text-black/70",
                  )}
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M16 4.75 L19.35 11.25 L26.55 12.35 L21.35 17.45 L22.6 24.65 L16 21.3 L9.4 24.65 L10.65 17.45 L5.45 12.35 L12.65 11.25 Z"
                    fill={filled ? "#f8c945" : "none"}
                    stroke="#0b0b0b"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.9"
                    vectorEffect="non-scaling-stroke"
                  />
                </motion.svg>
              </AnimatePresence>
            </motion.button>
          );
        })}
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
  emoji?: string | null;
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

function ProfileRegenerationConfirmModal({
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <motion.div
      key="profile-regeneration-confirm-modal"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      className="absolute inset-0 z-[75] flex items-center justify-center bg-black/28 px-4 py-8 backdrop-blur-[3px]"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-regeneration-title"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-[390px] rounded-[26px] border border-black/10 bg-white px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle size={20} aria-hidden />
          </span>
          <h2
            id="profile-regeneration-title"
            className="text-[21px] font-black leading-7 text-black"
          >
            프로필을 다시 만들까요?
          </h2>
        </div>

        <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-black/58">
          <p>프로필을 새로 만들면 1번 질문부터 다시 답변하게 됩니다.</p>
          <p>
            또한 이전 교집합 참여와 피드백을 통해 보정되었던 대화 결 점수는
            초기화됩니다.
          </p>
          <p>
            원본 참여 기록과 피드백 기록은 삭제되지 않지만, 새 프로필에는 기존
            보정치가 다시 반영되지 않습니다.
          </p>
          <p>
            <strong className="font-black text-black/75">
              프로필 새로 만들기는 한 달에 한 번만 가능
            </strong>
            합니다.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="h-12 rounded-full border border-black/10 bg-white text-xs font-bold text-black/55 transition hover:border-black/20 disabled:opacity-45"
          >
            취소
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="h-12 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-wait disabled:opacity-55"
          >
            {loading ? "시작 중..." : "정말 프로필 새로 만들기"}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

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
  const [emoji, setEmoji] = useState<string | null>(profile.public_emoji);
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
      public_emoji: emoji ?? profile.public_emoji,
    }),
    [emoji, intro, profile],
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
    setEmoji(profile.public_emoji);
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
        const shouldGenerate =
          !existingIntro ||
          profile.public_intro_model === "fallback" ||
          profile.public_intro_model?.startsWith("fallback:") === true;
        const profilePromise = !shouldGenerate
          ? Promise.resolve<ProfileGenerateResponse>({
              intro: existingIntro,
              emoji: profile.public_emoji,
              generatedAt: profile.public_intro_generated_at,
              model: profile.public_intro_model,
            })
          : fetch("/api/profile/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }).then(async (response) => {
              const body = (await response.json().catch(() => null)) as
                | ProfileGenerateResponse
                | null;
              if (!response.ok || !body?.intro) {
                throw new Error(body?.error ?? "profile-generate-failed");
              }
              return body;
            });

        const [result] = await Promise.all([profilePromise, wait(2500)]);
        if (!alive) return;

        setIntro(result.intro?.trim() || existingIntro || "");
        setEmoji(result.emoji ?? profile.public_emoji);
        setGeneratedAt(result.generatedAt ?? profile.public_intro_generated_at);
        setModel(result.model ?? profile.public_intro_model);
        setNotice(result.notice ?? null);
        setPhase("typing");
      } catch {
        if (!alive) return;
        setIntro(
          existingIntro ||
            "프로필을 준비하고 있어요.\n\n잠시 후 프로필 탭에서 다시 확인할 수 있어요.",
        );
        setNotice("잠시 후 프로필 탭에서 다시 확인할 수 있어요.");
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
    profile.public_emoji,
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
      public_emoji: emoji ?? profile.public_emoji,
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
                  <div className="mb-4 flex items-center gap-2 text-xl font-black leading-7 text-black">
                    <span>{displayName}</span>
                    <span aria-hidden className="text-base leading-none">
                      {emoji ?? profileEmoji(profile)}
                    </span>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full min-h-full"
    >
      {children}
    </motion.div>
  );
}
