"use client";

import { startVisiblePolling } from "@/lib/visiblePolling";

import { SafeImage } from "@/components/SafeImage";
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
import { AlgorithmParametersOverlay } from "@/features/app/AlgorithmParametersOverlay";
import {
  CompactParticipationSparkleProgress,
  ParticipationProgressOverlay,
} from "@/features/app/ParticipationSparkleProgress";
import { PreferenceProfileTab } from "@/features/app/PreferenceProfileTab";
import { ProfileQuestionSectionOverlay } from "@/features/app/ProfileQuestionSectionOverlay";
import { ProfileUpgradeLockedTab } from "@/features/app/ProfileUpgradeLockedTab";
import { useDragScroll } from "@/features/app/useDragScroll";
import { MeetingRecommendation } from "@/features/meetings/MeetingRecommendation";
import {
  displayMembershipStatus,
  hasCurrentMembershipAccess,
} from "@/features/membership/membershipTypes";
import { OnboardingGuidePreview } from "@/features/onboarding/OnboardingGuidePreview";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import {
  identifyAnalyticsUser,
  trackEvent,
  trackLoginSuccessFromUrl,
} from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { type MeetingDateApplication } from "@/lib/meetingDateApplications";
import { createClient } from "@/lib/supabase/client";
import {
  clearGuestTicketInteractions,
  isGuestImportTicketInteractionStatus,
  loadGuestTicketInteractions,
  saveGuestTicketInteraction,
} from "@/lib/ticketInteractions";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type { ProfileRow } from "@/types/profile";
import type { ProfileQuestion, QuestionAnswer } from "@/types/question";
import type {
  GatheringTicket,
  TicketInteraction,
  TicketProgressStep,
  UserTicket,
  UserTicketsResponse,
} from "@/types/ticket";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageCircle,
  Sparkles,
  Ticket as TicketIcon,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchBlindDateOffers,
  fetchUserTickets,
  mergeUserTickets,
} from "./data/userTickets";
import { AssignedApplicationTicketDetailView } from "./tickets/TicketApplicationDetail";
import { TicketListTab } from "./tickets/TicketListTab";

const LazyMeetingChat = dynamic(
  () =>
    import("@/features/chat/MeetingChat").then((module) => module.MeetingChat),
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
    ? (row.answer_values ??
      (question.type === "text"
        ? (row.answer_text ?? row.answer_value ?? "")
        : (row.answer_value ?? "")))
    : "";
  const value =
    question?.type === "single_choice"
      ? typeof storedValue === "string" && optionValues.has(storedValue)
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
const initialUserTicketsLimit = 3;

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
  const [blindDateOffers, setBlindDateOffers] = useState<BlindDateUserOffer[]>(
    [],
  );
  const [blindDateOffersLoaded, setBlindDateOffersLoaded] = useState(guestMode);
  const mainDataLoadStartedRef = useRef(guestMode);
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
  const [answers, setAnswers] = useState<AnswerMap>(
    () =>
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
          [
            "offered",
            "waiting_response",
            "scheduled",
            "needs_reschedule",
          ].includes(offer.status),
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
    async (
      response: UserTicketsResponse,
      force = false,
      isCancelled: () => boolean = () => false,
    ) => {
      if (!response.hasMore || typeof response.nextOffset !== "number") return;

      setLoadingRemainingTickets(true);
      await fetchUserTickets({
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
      await loadRemainingUserTickets(response, force, isCancelled);
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
        .select(
          "question_order,answer_value,answer_values,answer_text,other_text",
        )
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
            | "name"
            | "gender"
            | "birth_year"
            | "birth_date"
            | "mbti"
            | "photo_url"
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
    if (readOnly || activeTab !== "recommend" || recommendTabTrackedRef.current)
      return;

    recommendTabTrackedRef.current = true;
    trackEvent("recommend_tab_view");
  }, [activeTab, readOnly]);

  useEffect(() => {
    if (readOnly || activeTab !== "profile" || profileTabTrackedRef.current)
      return;

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
    if (guestMode || (activeTab !== "recommend" && activeTab !== "browse")) {
      return;
    }
    if (mainDataLoadStartedRef.current) return;
    mainDataLoadStartedRef.current = true;

    void loadUserTicketsProgressively();
    if (recommendationProfileReady && currentProfile.profile_completed) {
      void fetchBlindDateOffers().then((offers) => {
        if (offers) setBlindDateOffers(offers);
        setBlindDateOffersLoaded(true);
      });
    } else {
      setBlindDateOffers([]);
      setBlindDateOffersLoaded(true);
    }
  }, [
    activeTab,
    guestMode,
    loadUserTicketsProgressively,
    currentProfile.profile_completed,
    recommendationProfileReady,
  ]);

  useEffect(() => {
    if (guestMode || readOnly || activeTab !== "profile") return;
    let cancelled = false;
    const answerQuestions = usesPreferenceProfile(profile)
      ? preferenceQuestions
      : profileQuestions;

    createClient()
      .from("user_answers")
      .select(
        "question_order,answer_value,answer_values,answer_text,other_text",
      )
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

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    guestMode,
    profile.profile_experience_version,
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
    if (guestMode || (activeTab !== "browse" && activeTab !== "recommend"))
      return;
    let cancelled = false;
    const stop = startVisiblePolling(
      () =>
        loadUserTicketsProgressively({
          force: true,
          isCancelled: () => cancelled,
        }),
      30_000,
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [activeTab, guestMode, loadUserTicketsProgressively]);

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

  const applyTicketInteraction = useCallback(
    (interaction: TicketInteraction) => {
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
    },
    [],
  );

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
    async (application: MeetingDateApplication, ticket: GatheringTicket) => {
      if (guestMode || readOnly) return false;

      const response = await fetch("/api/meeting-date-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          confirmed: true,
        }),
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
      ? ((await response.json().catch(() => null)) as {
          error?: string;
          nextAvailableAt?: string;
        } | null)
      : null;

    if (!response?.ok) {
      const nextDate = body?.nextAvailableAt
        ? formatProfileRegenerationDate(body.nextAvailableAt)
        : null;
      setProfileRegenerationError(
        nextDate
          ? `프로필 새로 만들기는 한 달에 한 번만 가능해요. 다음 재생성 가능일은 ${nextDate}이에요.`
          : (body?.error ??
              "프로필 새로 만들기를 시작하지 못했어요. 잠시 후 다시 시도해주세요."),
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
    currentProfileQuestionSectionIndex <
      profileQuestionSectionSequence.length - 1
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

      {activeTab === "browse" &&
        !ticketTabFocusMode &&
        activeBlindDateOfferCount > 0 && (
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
            activeTab === "browse"
              ? "pointer-events-auto"
              : "pointer-events-none",
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
            opacity: blindDateReturnSettling && activeTab !== "browse" ? 0 : 1,
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
            "application-stone-theme absolute inset-0 h-full overflow-y-auto bg-[#f7f3eb] bg-cover bg-center bg-no-repeat scrollbar-none",
            activeTab === "recommend"
              ? "pointer-events-auto"
              : "pointer-events-none",
          )}
          style={{
            backgroundImage:
              "linear-gradient(rgba(250, 248, 243, 0.18), rgba(250, 248, 243, 0.18)), url('/images/seoul-map-application-background.png')",
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
            ticketAcceptRequestTicketId={ticketAcceptRequest?.ticketId ?? null}
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
            activeTab === "chat"
              ? "pointer-events-auto"
              : "pointer-events-none",
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
              <MessageCircle
                size={28}
                strokeWidth={1.6}
                className="text-black/35"
                aria-hidden
              />
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
            activeTab === "profile"
              ? "pointer-events-auto"
              : "pointer-events-none",
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
          {activeTab === "profile" &&
            (profileQuestionsReady ? (
              <PreferenceProfileTab
                profile={currentProfile}
                initialAccountOpen={initialProfileAccountOpen}
                onBottomNavHiddenChange={setProfileBottomNavHidden}
                loggingOut={loggingOut}
                logoutError={logoutError}
                answers={preferenceProfileEnabled ? answers : {}}
                backgroundAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionBackgroundQuestions,
                )}
                activityAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionActivityQuestions,
                )}
                interestAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionInterestQuestions,
                )}
                valuesAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionValuesQuestions,
                )}
                preferenceAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionPreferenceQuestions,
                )}
                valueAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionValueQuestions,
                )}
                traitsAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionTraitsQuestions,
                )}
                selfAnsweredCount={answeredQuestionCount(
                  answerRows,
                  profileSectionSelfQuestions,
                )}
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
                onOpenValueQuestions={() => openProfileQuestionSection("value")}
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
                onRequestProfileRegeneration={
                  readOnly
                    ? () => undefined
                    : () => void startProfileRegeneration()
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
                onUpgrade={
                  readOnly
                    ? () => undefined
                    : () => void startProfileRegeneration()
                }
                onLogout={logout}
              />
            ))}
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
            onReapply={
              readOnly
                ? undefined
                : () => {
                    const ticket = replayedDeclinedTicket;
                    setReplayedDeclinedTicket(null);
                    requestDeclinedTicketApplication(ticket);
                  }
            }
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
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 18,
                      }}
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
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 24,
                        }}
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
              setCurrentProfile((current) => ({
                ...current,
                photo_url: photoUrl,
              }))
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
                          {String(preferenceQuestions.length + 1).padStart(
                            2,
                            "0",
                          )}
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

const ticketProgressSteps: Array<{ key: TicketProgressStep; label: string }> = [
  { key: "applied", label: "신청 완료" },
  { key: "approved", label: "참여 확정" },
  { key: "pre_start", label: "시작 전 안내" },
  { key: "in_progress", label: "진행 중" },
  { key: "feedback", label: "피드백 작성" },
];

function formatProfileRegenerationDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}
export { ticketResponseRemainingTime } from "./tickets/TicketListTab";
export { StoredTicketDetailView } from "./tickets/TicketProgress";
