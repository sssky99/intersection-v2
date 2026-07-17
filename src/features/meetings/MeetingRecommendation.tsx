"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Landmark,
  MapPin,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import {
  TicketDetailHero,
  ticketFadeTransition,
} from "@/features/meetings/TicketDetailHero";
import { RecommendationCalendarSelector } from "@/features/meetings/RecommendationCalendarSelector";
import { trackEvent } from "@/lib/analytics";
import {
  MEETING_DATE_DEPOSIT_AMOUNT,
  MEETING_DATE_REGION,
  meetingDateApplicationDates,
  meetingDateLabel,
  meetingDateRelativeWeekLabel,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { isPastTicketDate, todayInKst } from "@/lib/ticketDate";
import { ticketBackgroundImageUrls } from "@/lib/ticketImages";
import type { AvailableDate, GatheringTicket } from "@/types/ticket";
import type { BlindDateUserOffer } from "@/types/blindDate";
import {
  ticketRejectionReasonLabels,
  type TicketRejectionReasonId,
} from "@/types/ticketRejection";

type Screen =
  | "calendar"
  | "curating"
  | "drawing"
  | "waitlisted"
  | "blindDate";
type RecommendationWaitlistStatus = "waitlisted" | "payment_pending";
type DepositMessageRegistration = {
  count: number;
  registered: boolean;
  limitCount: number;
};
type DepositMessageRegistrationSummary = Pick<
  DepositMessageRegistration,
  "count" | "limitCount"
>;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const curationLoadingMs = 2000;
const ticketDatesCacheTtlMs = 30_000;
const noShowDepositBankName = "카카오뱅크";
const noShowDepositAccountNumber = "7942-26-95406";
const noShowDepositAccountText = `${noShowDepositBankName} ${noShowDepositAccountNumber}`;
const meetingApplicationPaymentUrl = "https://www.groble.im/payment/PeXqpV";
const kakaoDepositMessageChatUrl = "http://pf.kakao.com/_xnweQn/chat";
const depositMessageSummaryStorageKey =
  "intersection:deposit-message-summary";
const fallbackDepositMessageBaseCount = 66;
const fallbackDepositMessageLimitCount = 100;
let ticketDatesCache: { dates: AvailableDate[]; expiresAt: number } | null = null;
let ticketDatesRequest: Promise<AvailableDate[]> | null = null;
let depositMessageSummaryCache: DepositMessageRegistrationSummary | null = null;
let depositMessageSummaryRequest: Promise<DepositMessageRegistrationSummary> | null =
  null;
const membershipBurstParticles = [
  { x: -28, y: -24, color: "#38bdf8" },
  { x: -18, y: -36, color: "#f59e0b" },
  { x: 0, y: -40, color: "#f472b6" },
  { x: 20, y: -34, color: "#34d399" },
  { x: 30, y: -18, color: "#60a5fa" },
  { x: -32, y: -8, color: "#a78bfa" },
  { x: 32, y: 2, color: "#fb7185" },
] as const;
const ticketsByDateCache = new Map<
  string,
  { date: AvailableDate; expiresAt: number }
>();
const ticketsByDateRequests = new Map<string, Promise<AvailableDate>>();

function cachedTicketDates() {
  return ticketDatesCache && ticketDatesCache.expiresAt > Date.now()
    ? ticketDatesCache.dates
    : null;
}

async function fetchTicketDates(force = false) {
  const cached = force ? null : cachedTicketDates();
  if (cached) return cached;
  if (ticketDatesRequest) return ticketDatesRequest;

  ticketDatesRequest = fetch("/api/meetings/tickets?mode=dates", {
    cache: "no-store",
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | { dates?: AvailableDate[]; error?: string }
        | null;

      if (!response.ok || !data) {
        throw new Error(data?.error ?? "tickets-load-failed");
      }

      const dates = data.dates ?? [];
      ticketDatesCache = {
        dates,
        expiresAt: Date.now() + ticketDatesCacheTtlMs,
      };

      return dates;
    })
    .finally(() => {
      ticketDatesRequest = null;
    });

  return ticketDatesRequest;
}

async function fetchTicketsForDate(
  date: string,
  force = false,
) {
  const cached = ticketsByDateCache.get(date);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.date;

  const existingRequest = ticketsByDateRequests.get(date);
  if (!force && existingRequest) return existingRequest;

  const request = fetch(
    `/api/meetings/tickets?date=${encodeURIComponent(date)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as
        | { dates?: AvailableDate[]; error?: string }
        | null;

      if (!response.ok || !data) {
        throw new Error(data?.error ?? "tickets-load-failed");
      }

      const dateEntry = data.dates?.find((item) => item.date === date) ?? {
        id: `date-${date}`,
        date,
        label: date,
        tickets: [],
        ticketCount: 0,
      };
      ticketsByDateCache.set(date, {
        date: dateEntry,
        expiresAt: Date.now() + ticketDatesCacheTtlMs,
      });

      return dateEntry;
    })
    .finally(() => {
      ticketsByDateRequests.delete(date);
    });

  ticketsByDateRequests.set(date, request);
  return request;
}

function clearTicketCaches() {
  ticketDatesCache = null;
  ticketDatesRequest = null;
  ticketsByDateCache.clear();
  ticketsByDateRequests.clear();
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isLocalTestHost() {
  if (typeof window === "undefined") return false;

  return ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  );
}

const localDateApplicationsStoragePrefix =
  "intersection:local-date-applications";

function localDateApplicationsStorageKey(userId: string) {
  return `${localDateApplicationsStoragePrefix}:${userId}`;
}

function mergeDateApplications(
  ...applicationGroups: MeetingDateApplication[][]
) {
  const merged = new Map<string, MeetingDateApplication>();

  applicationGroups.flat().forEach((application) => {
    merged.set(application.meetingDate, application);
  });

  return Array.from(merged.values()).sort((left, right) =>
    left.meetingDate.localeCompare(right.meetingDate),
  );
}

function loadLocalDateApplications(userId: string) {
  if (!isLocalTestHost()) return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(localDateApplicationsStorageKey(userId)) ??
        "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (application): application is MeetingDateApplication =>
        Boolean(
          application &&
            typeof application === "object" &&
            "meetingDate" in application &&
            typeof application.meetingDate === "string" &&
            "status" in application &&
            typeof application.status === "string",
        ),
    );
  } catch {
    return [];
  }
}

function saveLocalDateApplications(
  userId: string,
  applications: MeetingDateApplication[],
) {
  if (!isLocalTestHost()) return;

  try {
    window.localStorage.setItem(
      localDateApplicationsStorageKey(userId),
      JSON.stringify(applications),
    );
  } catch {
    // Local preview persistence is best-effort only.
  }
}

async function saveInvitationDecision(
  ticketInstanceId: string,
  action: "viewed",
) {
  const response = await fetch("/api/meetings/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketInstanceId, action }),
  });
  if (!response.ok) throw new Error("invitation-decision-save-failed");
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) throw new Error("copy-failed");
}

async function saveDepositMessageRegistration(ticketId?: string) {
  const response = await fetch("/api/meeting-waitlist/deposit-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticketId ? { ticketId } : {}),
  });

  const data = (await response.json().catch(() => null)) as {
    count?: number;
    registered?: boolean;
    limitCount?: number;
  } | null;

  if (!response.ok || typeof data?.count !== "number") {
    throw new Error("deposit-message-registration-failed");
  }

  const summary = {
    count: data.count,
    limitCount:
      typeof data.limitCount === "number"
        ? data.limitCount
        : fallbackDepositMessageLimitCount,
  };

  cacheDepositMessageSummary(summary);

  return {
    ...summary,
    registered: Boolean(data.registered),
  };
}

function fallbackDepositMessageSummary(): DepositMessageRegistrationSummary {
  return {
    count: fallbackDepositMessageBaseCount,
    limitCount: fallbackDepositMessageLimitCount,
  };
}

function cacheDepositMessageSummary(summary: DepositMessageRegistrationSummary) {
  depositMessageSummaryCache = summary;

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      depositMessageSummaryStorageKey,
      JSON.stringify(summary),
    );
  } catch {
    // Keeping the in-memory value is enough when browser storage is unavailable.
  }
}

function cachedDepositMessageSummary() {
  if (depositMessageSummaryCache) return depositMessageSummaryCache;
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(depositMessageSummaryStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<DepositMessageRegistrationSummary>;
    if (typeof parsed.count !== "number") return null;

    const summary = {
      count: parsed.count,
      limitCount:
        typeof parsed.limitCount === "number"
          ? parsed.limitCount
          : fallbackDepositMessageLimitCount,
    };
    depositMessageSummaryCache = summary;
    return summary;
  } catch {
    return null;
  }
}

async function fetchDepositMessageRegistrationSummary() {
  if (depositMessageSummaryRequest) return depositMessageSummaryRequest;

  depositMessageSummaryRequest = (async () => {
    const response = await fetch("/api/meeting-waitlist/deposit-message", {
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as {
      count?: number;
      limitCount?: number;
    } | null;

    if (!response.ok || typeof data?.count !== "number") {
      throw new Error("deposit-message-summary-load-failed");
    }

    const summary = {
      count: data.count,
      limitCount:
        typeof data.limitCount === "number"
          ? data.limitCount
          : fallbackDepositMessageLimitCount,
    };

    cacheDepositMessageSummary(summary);
    return summary;
  })();

  try {
    return await depositMessageSummaryRequest;
  } finally {
    depositMessageSummaryRequest = null;
  }
}

const ticketRejectionReasonEmojis: Record<TicketRejectionReasonId, string> = {
  time_mismatch: "⏰",
  region_too_far: "📍",
  alcohol_burden: "🍺",
  activity_not_interested: "🎯",
  want_other_activity: "🔎",
  not_sure: "🤔",
};

function normalizedTicketText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("ko-KR") ?? "";
}

function ticketAlcoholScore(ticket: GatheringTicket) {
  const score = ticket.vibeScores?.alcohol;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

type TicketRejectionSessionFilters = {
  ticketIds: Set<string>;
  times: Set<string>;
  areas: Set<string>;
  activityCategories: Set<string>;
  excludeHighAlcohol: boolean;
};

function createTicketRejectionSessionFilters(): TicketRejectionSessionFilters {
  return {
    ticketIds: new Set(),
    times: new Set(),
    areas: new Set(),
    activityCategories: new Set(),
    excludeHighAlcohol: false,
  };
}

function ticketActivityCategory(ticket: GatheringTicket) {
  return (
    normalizedTicketText(ticket.activityType) || `template:${ticket.templateId}`
  );
}

function filtersAfterTicketRejection(
  current: TicketRejectionSessionFilters,
  reason: TicketRejectionReasonId,
  ticket: GatheringTicket,
) {
  const next: TicketRejectionSessionFilters = {
    ticketIds: new Set(current.ticketIds),
    times: new Set(current.times),
    areas: new Set(current.areas),
    activityCategories: new Set(current.activityCategories),
    excludeHighAlcohol: current.excludeHighAlcohol,
  };

  next.ticketIds.add(ticket.id);

  if (reason === "time_mismatch") {
    const time = normalizedTicketText(ticket.time);
    if (time) next.times.add(time);
  } else if (reason === "region_too_far") {
    const area = normalizedTicketText(ticket.area);
    if (area) next.areas.add(area);
  } else if (reason === "activity_not_interested") {
    next.activityCategories.add(ticketActivityCategory(ticket));
  } else if (reason === "alcohol_burden") {
    next.excludeHighAlcohol = true;
  }

  return next;
}

function rejectionReasonsForTicket(ticket: GatheringTicket) {
  const alcoholScore = ticketAlcoholScore(ticket);

  return (Object.keys(ticketRejectionReasonLabels) as TicketRejectionReasonId[])
    .filter(
      (reason) =>
        reason !== "alcohol_burden" ||
        (alcoholScore !== null && alcoholScore >= 4),
    )
    .map((id) => ({ id, label: ticketRejectionReasonLabels[id] }));
}

function findReplacementTicket(
  tickets: GatheringTicket[],
  filters: TicketRejectionSessionFilters,
) {
  return (
    tickets.find((ticket) => {
      if (filters.ticketIds.has(ticket.id)) return false;
      if (filters.times.has(normalizedTicketText(ticket.time))) return false;
      if (filters.areas.has(normalizedTicketText(ticket.area))) return false;
      if (filters.activityCategories.has(ticketActivityCategory(ticket))) {
        return false;
      }

      const alcoholScore = ticketAlcoholScore(ticket);
      if (
        filters.excludeHighAlcohol &&
        alcoholScore !== null &&
        alcoholScore >= 4
      ) {
        return false;
      }

      return true;
    }) ?? null
  );
}

async function saveTicketRejectionReason({
  reason,
  ticket,
  replacementTicket,
}: {
  reason: TicketRejectionReasonId;
  ticket: GatheringTicket;
  replacementTicket: GatheringTicket | null;
}) {
  const response = await fetch("/api/meetings/rejections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, ticket, replacementTicket }),
  });

  if (!response.ok) throw new Error("ticket-rejection-save-failed");
}

function LegacyMeetingRecommendation({
  userId,
  recommendationName,
  embedded = false,
  active = true,
  membershipStatus,
  onWaitlisted,
  onOpenList,
  blindDateOffers = [],
  onBlindDateOffersChange,
  blindDateOpenRequestId = 0,
  blindDateOpenRequestPending = false,
  onBlindDateOpenRequestHandled,
}: {
  userId: string;
  recommendationName?: string;
  embedded?: boolean;
  active?: boolean;
  membershipStatus: MembershipStatus | null;
  onWaitlisted?: (ticket: GatheringTicket) => void;
  onOpenList?: () => void;
  blindDateOffers?: BlindDateUserOffer[];
  onBlindDateOffersChange?: (offers: BlindDateUserOffer[]) => void;
  blindDateOpenRequestId?: number;
  blindDateOpenRequestPending?: boolean;
  onBlindDateOpenRequestHandled?: () => void;
  onDateApplicationsChange?: (applications: MeetingDateApplication[]) => void;
}) {
  const [screen, setScreen] = useState<Screen>("calendar");
  const [selectedDate, setSelectedDate] = useState<AvailableDate | null>(null);
  const [ticketIndex, setTicketIndex] = useState(0);
  const [waitlistedTicket, setWaitlistedTicket] =
    useState<GatheringTicket | null>(null);
  const [waitlistStatus, setWaitlistStatus] =
    useState<RecommendationWaitlistStatus>("waitlisted");
  const [ticketDates, setTicketDates] = useState<AvailableDate[]>(
    () => cachedTicketDates() ?? [],
  );
  const [loadingDates, setLoadingDates] = useState(() => !cachedTicketDates());
  const [loadingTicketDate, setLoadingTicketDate] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionTicket, setRejectionTicket] =
    useState<GatheringTicket | null>(null);
  const [rejectionSavingReason, setRejectionSavingReason] =
    useState<TicketRejectionReasonId | null>(null);
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [depositTicket, setDepositTicket] = useState<GatheringTicket | null>(
    null,
  );
  const [depositAccountCopied, setDepositAccountCopied] = useState(false);
  const [depositCopyError, setDepositCopyError] = useState<string | null>(null);
  const [depositMessageSummary, setDepositMessageSummary] =
    useState<DepositMessageRegistrationSummary | null>(() =>
      cachedDepositMessageSummary(),
    );
  const [selectedBlindDateOfferId, setSelectedBlindDateOfferId] =
    useState<string | null>(null);
  const viewedTicketIdsRef = useRef<Set<string>>(new Set());
  const rejectionSessionFiltersRef = useRef(
    createTicketRejectionSessionFilters(),
  );
  const dateSelectionRunRef = useRef(0);
  const ticket = selectedDate?.tickets[ticketIndex] ?? null;
  const ticketEnded = ticket ? isPastTicketDate(ticket.date) : false;
  const activeBlindDateOffers = blindDateOffers.filter(
    (offer) =>
      !offer.isExpired &&
      ["offered", "waiting_response", "scheduled", "needs_reschedule"].includes(
        offer.status,
      ),
  );
  const answerableBlindDateOffers = blindDateOffers.filter(
    (offer) =>
      !offer.isExpired &&
      offer.ownResponse === "pending" &&
      ["offered", "waiting_response"].includes(offer.status),
  );
  const selectedBlindDateOffer =
    blindDateOffers.find((offer) => offer.id === selectedBlindDateOfferId) ??
    activeBlindDateOffers[0] ??
    null;

  useEffect(() => {
    if (screen !== "drawing" || !ticket) return;
    if (viewedTicketIdsRef.current.has(ticket.id)) return;

    viewedTicketIdsRef.current.add(ticket.id);
    void saveInvitationDecision(ticket.id, "viewed").catch(() => undefined);
    trackEvent("ticket_detail_view", {
      ticket_id: ticket.id,
      template_id: ticket.templateId,
    });
  }, [screen, ticket]);

  useEffect(() => {
    if (!blindDateOpenRequestPending || activeBlindDateOffers.length === 0) {
      return;
    }

    setSelectedBlindDateOfferId(activeBlindDateOffers[0].id);
    setSelectedDate(null);
    setTicketIndex(0);
    setWaitlistedTicket(null);
    setScreen("blindDate");
    onBlindDateOpenRequestHandled?.();
  }, [
    activeBlindDateOffers,
    blindDateOpenRequestId,
    blindDateOpenRequestPending,
    onBlindDateOpenRequestHandled,
  ]);

  useEffect(() => {
    if (!active) return;

    let alive = true;
    const refresh = () => {
      void fetchDepositMessageRegistrationSummary()
        .then((summary) => {
          if (alive) setDepositMessageSummary(summary);
        })
        .catch(() => undefined);
    };

    refresh();
    window.addEventListener("focus", refresh);

    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    let alive = true;
    const refresh = () => {
      void fetchTicketDates(true)
        .then((dates) => {
          if (!alive) return;
          setTicketDates(dates);
          setSelectedDate((current) => {
            if (!current) return current;
            const dateMeta = dates.find((date) => date.date === current.date);
            if (!dateMeta) return null;
            return {
              ...current,
              ticketCount: dateMeta.ticketCount,
            };
          });
          setNotice(null);
        })
        .catch(() => {
          if (alive) {
            setError("초대장 날짜를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
          }
        })
        .finally(() => {
          if (alive) setLoadingDates(false);
        });
    };

    refresh();
    window.addEventListener("focus", refresh);

    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
    };
  }, [active]);

  const selectDate = async (date: AvailableDate) => {
    const runId = dateSelectionRunRef.current + 1;
    dateSelectionRunRef.current = runId;
    rejectionSessionFiltersRef.current = createTicketRejectionSessionFilters();
    setNotice(null);
    setError(null);
    setRejectionTicket(null);
    setRejectionError(null);
    setLoadingTicketDate(date.date);
    setScreen("curating");
    const loadingDelay = wait(curationLoadingMs);

    try {
      const dateWithTickets = await fetchTicketsForDate(date.date);
      await loadingDelay;
      if (dateSelectionRunRef.current !== runId) return;

      if (dateWithTickets.tickets.length === 0) {
        setNotice("이 날짜에는 아직 추천 가능한 모임이 없어요.");
        setScreen("calendar");
        return;
      }

      setSelectedDate(dateWithTickets);
      setTicketIndex(0);
      setScreen("drawing");
    } catch {
      await loadingDelay;
      if (dateSelectionRunRef.current !== runId) return;
      setError("초대장을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      setScreen("calendar");
    } finally {
      if (dateSelectionRunRef.current === runId) {
        setLoadingTicketDate(null);
      }
    }
  };

  const openRejectionSheet = () => {
    if (!ticket || saving || rejectionSavingReason) return;
    setRejectionTicket(ticket);
    setRejectionError(null);
  };

  const submitRejectionReason = async (reason: TicketRejectionReasonId) => {
    if (!selectedDate || !rejectionTicket || rejectionSavingReason) return;

    const nextRejectionFilters = filtersAfterTicketRejection(
      rejectionSessionFiltersRef.current,
      reason,
      rejectionTicket,
    );
    const replacementTicket = findReplacementTicket(
      selectedDate.tickets,
      nextRejectionFilters,
    );

    setRejectionSavingReason(reason);
    setRejectionError(null);

    try {
      await saveTicketRejectionReason({
        reason,
        ticket: rejectionTicket,
        replacementTicket,
      });
    } catch {
      setRejectionError(
        "거절 사유를 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setRejectionSavingReason(null);
      return;
    }

    rejectionSessionFiltersRef.current = nextRejectionFilters;

    trackEvent("ticket_rejection_reason_selected", {
      ticket_id: rejectionTicket.id,
      template_id: rejectionTicket.templateId,
      reason,
      replacement_ticket_id: replacementTicket?.id ?? null,
      replacement_template_id: replacementTicket?.templateId ?? null,
    });

    setRejectionSavingReason(null);
    setRejectionTicket(null);

    if (!replacementTicket) {
      setSelectedDate(null);
      setTicketIndex(0);
      setNotice(
        "조건에 맞는 다른 추천이 아직 없어요. 다른 날짜를 골라주세요.",
      );
      setScreen("calendar");
      return;
    }

    const nextIndex = selectedDate.tickets.findIndex(
      (candidate) => candidate.id === replacementTicket.id,
    );
    setTicketIndex(nextIndex >= 0 ? nextIndex : 0);
    setNotice(null);
    setScreen("drawing");
  };

  const applicationEventPayload = (targetTicket: GatheringTicket) => ({
    application_id: targetTicket.id,
    ticket_id: targetTicket.id,
    template_id: targetTicket.templateId,
    membership_status: membershipStatus,
  });

  const openDepositSheet = () => {
    if (!ticket || saving) return;

    if (isPastTicketDate(ticket.date)) {
      setError("이미 끝이 난 초대장입니다.");
      return;
    }

    trackEvent("application_submit_click", applicationEventPayload(ticket));
    setDepositTicket(ticket);
    setDepositAccountCopied(false);
    setDepositCopyError(null);
    setError(null);
    void fetchDepositMessageRegistrationSummary()
      .then(setDepositMessageSummary)
      .catch(() => undefined);
  };

  const copyDepositAccount = async () => {
    if (!depositTicket || saving) return;

    try {
      await copyTextToClipboard(noShowDepositAccountText);
      setDepositAccountCopied(true);
      setDepositCopyError(null);
      trackEvent("no_show_deposit_account_copy", {
        ...applicationEventPayload(depositTicket),
      });
    } catch {
      setDepositCopyError(
        "계좌번호를 복사하지 못했어요. 직접 선택해서 복사해주세요.",
      );
    }
  };

  const submitDepositPaymentPending = async () => {
    if (!depositTicket || saving) return;

    const targetTicket = depositTicket;
    if (isLocalTestHost()) {
      const currentSummary =
        depositMessageSummary ?? fallbackDepositMessageSummary();
      const registration: DepositMessageRegistration = {
        count: currentSummary.count + 1,
        registered: true,
        limitCount: currentSummary.limitCount,
      };

      setDepositMessageSummary({
        count: registration.count,
        limitCount: registration.limitCount,
      });
      setWaitlistedTicket(targetTicket);
      setWaitlistStatus("payment_pending");
      setDepositTicket(null);
      setDepositAccountCopied(false);
      setDepositCopyError(null);
      setScreen("waitlisted");
      return;
    }

    window.open(kakaoDepositMessageChatUrl, "_blank", "noopener,noreferrer");
    setSaving(true);
    setError(null);

    const response = await fetch("/api/meeting-waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: targetTicket }),
    });

    const data = (await response.json().catch(() => null)) as {
      status?: RecommendationWaitlistStatus;
      code?: string;
      duplicate?: boolean;
    } | null;

    if (!response.ok) {
      setDepositCopyError(
        "입금 확인 요청을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setSaving(false);
      return;
    }

    let registration: DepositMessageRegistration;
    try {
      registration = await saveDepositMessageRegistration(targetTicket.id);
    } catch {
      setDepositCopyError(
        "입금 완료 문자 등록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setSaving(false);
      return;
    }

    setDepositMessageSummary({
      count: registration.count,
      limitCount: registration.limitCount,
    });
    setWaitlistedTicket(targetTicket);
    setWaitlistStatus(data?.status ?? "payment_pending");
    trackEvent("application_created", {
      ...applicationEventPayload(targetTicket),
      status: data?.status ?? "payment_pending",
      duplicate: Boolean(data?.duplicate),
    });
    trackEvent("no_show_deposit_message_click", {
      ...applicationEventPayload(targetTicket),
      registered: registration.registered,
      count: registration.count,
      limit_count: registration.limitCount,
    });
    clearTicketCaches();
    onWaitlisted?.(targetTicket);
    setDepositTicket(null);
    setDepositAccountCopied(false);
    setDepositCopyError(null);
    setScreen("waitlisted");
    setSaving(false);
  };

  return (
    <section
      className={cn(
        "px-5 pb-6 pt-7",
        embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {screen === "calendar" && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <header className="pr-16">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                invitation date
              </p>
              <h1 className="mt-2 text-[27px] font-bold leading-9 tracking-tight text-black">
                어느 날의 초대장을
                <br />
                받아볼까요?
              </h1>
            </header>

            <div>
              <RecommendationCalendarSelector
                dates={ticketDates}
                loading={loadingDates || Boolean(loadingTicketDate)}
                weekOffset={0}
                weekCount={2}
                loadingText={
                  loadingTicketDate
                    ? "선택한 날짜의 초대장을 불러오고 있어요."
                    : undefined
                }
                onSelect={(date) => void selectDate(date)}
              />
            </div>

            {activeBlindDateOffers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBlindDateOfferId(activeBlindDateOffers[0].id);
                  setScreen("blindDate");
                }}
                className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black px-4 py-3 text-left text-sm font-bold text-white shadow-sm transition active:scale-[0.99]"
              >
                <span>
                  {answerableBlindDateOffers.length > 0
                    ? "나에게 온 블라인드 데이트 초대장 보기"
                    : "블라인드 데이트 상태 확인하기"}
                </span>
                {answerableBlindDateOffers.length > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-[11px] font-black text-black">
                    {answerableBlindDateOffers.length}
                  </span>
                )}
              </button>
            )}

            {(notice || error) && (
              <p className="mt-4 rounded-2xl bg-accent/[0.08] px-4 py-3 text-xs font-semibold leading-5 text-black/55">
                {notice ?? error}
              </p>
            )}
          </motion.div>
        )}

        {screen === "curating" && (
          <CurationLoadingScreen recommendationName={recommendationName} />
        )}

        {screen === "drawing" && ticket && selectedDate && (
          <TicketDrawingCard
            key={ticket.id}
            ticket={ticket}
            ended={ticketEnded}
            saving={saving || Boolean(rejectionSavingReason)}
            error={error}
            onNo={openRejectionSheet}
            onYes={openDepositSheet}
            onChangeDate={() => {
              setSelectedDate(null);
              setTicketIndex(0);
              setRejectionTicket(null);
              setRejectionError(null);
              setScreen("calendar");
            }}
          />
        )}

        {screen === "waitlisted" && waitlistedTicket && (
          <motion.div
            key="waitlisted"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              {waitlistStatus === "payment_pending"
                ? "payment pending"
                : "waitlisted"}
            </p>
            <h1 className="mt-2 text-[28px] font-bold leading-9 text-black">
              {waitlistStatus === "payment_pending" ? (
                <>
                  입금 확인 요청이
                  <br />
                  기록됐어요.
                </>
              ) : (
                <>
                  대기열 등록이
                  <br />
                  완료됐어요.
                </>
              )}
            </h1>
            <p className="mt-3 text-sm leading-6 text-black/48">
              {waitlistStatus === "payment_pending"
                ? "입금이 확인되면 안내 문자를 발송해드릴게요."
                : "운영자가 자리 구성을 확인한 뒤 참여 승인 여부를 안내해드릴게요."}
            </p>

            <div className="mt-8 rounded-[24px] border border-black/10 bg-white p-5">
              <h2 className="text-lg font-bold text-black">
                {waitlistedTicket.title}
              </h2>
              <p className="mt-2 text-xs text-black/45">
                {formatTicketDateLabel(waitlistedTicket.date)} ·{" "}
                {formatTicketTimeLabel(waitlistedTicket.time)} · {waitlistedTicket.area}
              </p>
              <div className="mt-5 border-t border-black/8 pt-4">
                {(waitlistStatus === "payment_pending"
                  ? [
                      "입금 확인 필요",
                      "운영자 확인",
                      "모임 대기 등록",
                      "참여 승인 및 안내",
                    ]
                  : [
                      "대기열 등록 완료",
                      "운영자 확인",
                      "참여 승인 및 안내",
                    ]
                ).map((step, index) => (
                  <div key={step} className="flex items-center gap-3 py-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        index === 0
                          ? "bg-black text-white"
                          : "bg-black/[0.05] text-black/35"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-black/58">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setScreen("calendar");
                setSelectedDate(null);
                setWaitlistedTicket(null);
              }}
              className="mt-8 h-[52px] w-full rounded-full border border-black/12 py-3.5 text-sm font-semibold text-black/58"
            >
              다른 티켓 더 신청하기
            </button>
            {onOpenList && (
              <button
                type="button"
                onClick={onOpenList}
                className="mt-2 h-[52px] w-full rounded-full bg-black py-3.5 text-sm font-semibold text-white"
              >
                티켓에서 보기
              </button>
            )}
          </motion.div>
        )}

        {screen === "blindDate" && selectedBlindDateOffer && (
          <BlindDateInvitationFlow
            key={selectedBlindDateOffer.id}
            offer={selectedBlindDateOffer}
            onClose={() => setScreen("calendar")}
            onOffersChange={onBlindDateOffersChange}
          />
        )}

      </AnimatePresence>
      <AnimatePresence>
        {rejectionTicket && (
          <TicketRejectionBottomSheet
            ticket={rejectionTicket}
            savingReason={rejectionSavingReason}
            error={rejectionError}
            onClose={() => {
              if (rejectionSavingReason) return;
              setRejectionTicket(null);
              setRejectionError(null);
            }}
            onSelectReason={(reason) => void submitRejectionReason(reason)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {depositTicket && (
          <NoShowDepositBottomSheet
            saving={saving}
            accountCopied={depositAccountCopied}
            registrationSummary={depositMessageSummary}
            copyError={depositCopyError}
            onCopy={() => void copyDepositAccount()}
            onSubmit={() => void submitDepositPaymentPending()}
            onClose={() => {
              if (saving) return;
              setDepositTicket(null);
              setDepositAccountCopied(false);
              setDepositCopyError(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

type MeetingRecommendationProps = Parameters<typeof LegacyMeetingRecommendation>[0];
type DateApplicationScreen = "intro" | "dates" | "submitted" | "blindDate";

type DateApplicationsResponse = {
  applications?: MeetingDateApplication[];
  totalDepositAmount?: number;
  error?: string;
};

async function fetchDateApplications() {
  const response = await fetch("/api/meeting-date-applications", {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | DateApplicationsResponse
    | null;

  if (!response.ok || !data) {
    throw new Error(data?.error ?? "date-applications-load-failed");
  }

  return data.applications ?? [];
}

function DateApplicationOption({
  date,
  selected,
  application,
  relativeWeekLabel,
  closed,
  disabled,
  onToggle,
}: {
  date: AvailableDate;
  selected: boolean;
  application: MeetingDateApplication | null;
  relativeWeekLabel: string;
  closed: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const schedule = meetingDateSchedule(date.date)!;

  return (
    <motion.button
      type="button"
      data-testid={`meeting-date-${date.date}`}
      aria-pressed={selected}
      disabled={disabled || closed || Boolean(application)}
      whileTap={!disabled && !closed && !application ? { scale: 0.98 } : undefined}
      onClick={onToggle}
      className={cn(
        "relative min-h-[108px] min-w-0 border px-4 py-4 text-left transition",
        closed
          ? "border-black/5 bg-black/[0.035] text-black/32"
          : application
            ? "border-black/10 bg-white text-black"
            : selected
          ? "border-black bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
          : "border-black/10 bg-white text-black hover:border-black/25",
        (disabled || closed || application) && "cursor-default",
      )}
    >
      <span
        className={cn(
          "absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full border px-1 font-black",
          closed || application ? "text-[10px]" : "text-[9px]",
          closed
            ? "border-red-200 bg-red-50 text-red-600"
            : application
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : selected
            ? "border-white/30 bg-white text-black"
            : "border-black/15 bg-white text-transparent",
        )}
      >
        {closed
          ? "마감"
          : application
            ? "신청 완료"
            : selected
              ? <Check size={12} aria-hidden />
              : "-"}
      </span>
      <span className="block pr-9 text-base font-black leading-5">
        {schedule.month}월 {schedule.day}일
      </span>
      <span className={cn("mt-0.5 block text-[13px] font-bold", selected ? "text-white/55" : "text-black/40")}>
        {relativeWeekLabel}
      </span>
      <span className={cn("mt-3 flex items-center gap-1.5 text-[13px] font-bold", selected ? "text-white/78" : "text-black/62")}>
        <Clock3 size={12} aria-hidden />
        {schedule.timeLabel}
        <span className={selected ? "text-white/25" : "text-black/20"}>·</span>
        <MapPin size={12} aria-hidden />
        {MEETING_DATE_REGION}
      </span>
    </motion.button>
  );
}

function DateApplicationIntro({
  recommendationName,
  onContinue,
}: {
  recommendationName?: string;
  onContinue: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const displayName = recommendationName?.trim() || "회원";

  return (
    <motion.div
      key="date-application-intro"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative isolate"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 -z-10 h-44 w-44 rounded-full bg-accent/15 blur-3xl"
      />

      <header className="pr-8">
        <h1 className="text-[30px] font-black leading-[1.22] tracking-[-0.045em] text-black">
          <span className="relative inline-block">
            <span
              aria-hidden
              className="absolute inset-x-[-3px] bottom-1 h-2.5 -rotate-1 rounded-full bg-accent/25"
            />
            <span className="relative">날짜만</span>
          </span>{" "}
          고르면,
          <br />
          만남은 저희가 준비해요.
        </h1>
      </header>

      <div className="mt-8 space-y-3">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.12, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-4 rounded-[22px] border border-black/[0.07] bg-white/90 p-4 shadow-[0_12px_32px_rgba(18,18,18,0.045)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-black text-[15px] font-black tabular-nums text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)]">
            1
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[15px] font-black text-black">
              가능한 날짜를 선택하세요.
            </h2>
            <p className="mt-1.5 text-[13px] font-semibold leading-5 text-black/48">
              날짜만 선택하시면 {displayName}님과 잘 맞는 사람과 활동을
              준비해드려요.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.24, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-4 rounded-[22px] border border-black/[0.07] bg-white/90 p-4 shadow-[0_12px_32px_rgba(18,18,18,0.045)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-black text-[15px] font-black tabular-nums text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)]">
            2
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[15px] font-black text-black">
              장소와 활동은 시작 24시간 전에 공개돼요.
            </h2>
            <p className="mt-1.5 text-[13px] font-semibold leading-5 text-black/48">
              최적의 구성을 위해서, 정확한 장소와 활동은 모임 시작 24시간
              전에 공개 돼요.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.36, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-4 rounded-[22px] border border-black/[0.07] bg-white/90 p-4 shadow-[0_12px_32px_rgba(18,18,18,0.045)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-black text-[15px] font-black tabular-nums text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)]">
            3
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[15px] font-black text-black">
              다시 만나고 싶은 사람을 선택해요.
            </h2>
            <p className="mt-1.5 text-[13px] font-semibold leading-5 text-black/48">
              모임이 끝나면 피드백을 통해서 다시 만나고 싶은 사람을 선택할 수
              있어요. 서로 선택한 경우 1대1로 만날 수 있는 자리를
              준비해드려요.
            </p>
          </div>
        </motion.div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 flex h-[56px] w-full items-center justify-center rounded-[18px] bg-black text-sm font-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition active:scale-[0.985]"
      >
        날짜 선택하기
      </button>
    </motion.div>
  );
}

export function MeetingRecommendation(props: MeetingRecommendationProps) {
  return <MeetingDateApplicationFlow {...props} />;
}

function MeetingDateApplicationFlow({
  userId,
  recommendationName,
  embedded = false,
  active = true,
  membershipStatus,
  blindDateOffers = [],
  onBlindDateOffersChange,
  blindDateOpenRequestId = 0,
  blindDateOpenRequestPending = false,
  onBlindDateOpenRequestHandled,
  onDateApplicationsChange,
}: MeetingRecommendationProps) {
  const [screen, setScreen] = useState<DateApplicationScreen>("intro");
  const [applications, setApplications] = useState<MeetingDateApplication[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [submittedDates, setSubmittedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositSession, setDepositSession] = useState(0);
  const [depositAccountCopied, setDepositAccountCopied] = useState(false);
  const [depositCopyError, setDepositCopyError] = useState<string | null>(null);
  const [depositMessageSummary, setDepositMessageSummary] =
    useState<DepositMessageRegistrationSummary | null>(() =>
      cachedDepositMessageSummary(),
    );
  const [selectedBlindDateOfferId, setSelectedBlindDateOfferId] =
    useState<string | null>(null);

  const today = todayInKst();
  const availableDates = meetingDateApplicationDates(today).map(
    (date): AvailableDate => ({
      id: `meeting-date-${date}`,
      date,
      label: date,
      tickets: [],
      ticketCount: 0,
    }),
  );
  const applicationByDate = new Map(
    applications.map((application) => [application.meetingDate, application]),
  );
  const activeBlindDateOffers = blindDateOffers.filter(
    (offer) =>
      !offer.isExpired &&
      ["offered", "waiting_response", "scheduled", "needs_reschedule"].includes(
        offer.status,
      ),
  );
  const answerableBlindDateOffers = blindDateOffers.filter(
    (offer) =>
      !offer.isExpired &&
      offer.ownResponse === "pending" &&
      ["offered", "waiting_response"].includes(offer.status),
  );
  const selectedBlindDateOffer =
    blindDateOffers.find((offer) => offer.id === selectedBlindDateOfferId) ??
    activeBlindDateOffers[0] ??
    null;

  useEffect(() => {
    if (!blindDateOpenRequestPending || activeBlindDateOffers.length === 0) {
      return;
    }

    setSelectedBlindDateOfferId(activeBlindDateOffers[0].id);
    setScreen("blindDate");
    onBlindDateOpenRequestHandled?.();
  }, [
    activeBlindDateOffers,
    blindDateOpenRequestId,
    blindDateOpenRequestPending,
    onBlindDateOpenRequestHandled,
  ]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const localApplications = loadLocalDateApplications(userId);
      const applicationsResult = await fetchDateApplications().catch(
        () => null,
      );

      if (!alive) return;
      if (applicationsResult || localApplications.length > 0) {
        setApplications(
          mergeDateApplications(
            applicationsResult ?? [],
            localApplications,
          ),
        );
      }
    };

    void load();
    if (active) window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, [active, userId]);

  useEffect(() => {
    onDateApplicationsChange?.(applications);
  }, [applications, onDateApplicationsChange]);

  const toggleDate = (date: string) => {
    if (date < today || applicationByDate.has(date) || saving) return;
    setSelectedDates((current) => (current.includes(date) ? [] : [date]));
    setError(null);
  };

  const copyDepositAccount = async () => {
    if (saving) return;
    try {
      await copyTextToClipboard(noShowDepositAccountText);
      setDepositAccountCopied(true);
      setDepositCopyError(null);
    } catch {
      setDepositCopyError(
        "계좌번호를 복사하지 못했어요. 직접 선택해서 복사해주세요.",
      );
    }
  };

  const submitDateApplications = async (openStoreAfterSave = false) => {
    if (selectedDates.length !== 1 || saving) return;

    const targetDates = [...selectedDates];
    setSaving(true);
    setError(null);
    setDepositCopyError(null);
    trackEvent("application_submit_click", {
      application_type: "meeting_date",
      date_count: targetDates.length,
      deposit_amount: targetDates.length * MEETING_DATE_DEPOSIT_AMOUNT,
      membership_status: membershipStatus,
    });

    if (isLocalTestHost()) {
      const now = new Date().toISOString();
      const localApplications = targetDates.map(
        (date, index): MeetingDateApplication => ({
          id: `local:${date}:${index}`,
          meetingDate: date,
          meetingTime: meetingDateSchedule(date)?.time ?? "",
          region: MEETING_DATE_REGION,
          status: "payment_pending",
          depositAmount: MEETING_DATE_DEPOSIT_AMOUNT,
          depositStatus: "payment_pending",
          assignedTicketInstanceId: null,
          createdAt: now,
        }),
      );
      setApplications((current) => {
        const nextApplications = mergeDateApplications(
          current,
          localApplications,
        );
        saveLocalDateApplications(userId, nextApplications);
        return nextApplications;
      });
      if (openStoreAfterSave) {
        window.location.assign(meetingApplicationPaymentUrl);
        return;
      }
      setSubmittedDates(targetDates);
      setSelectedDates([]);
      setDepositOpen(false);
      setScreen("submitted");
      setSaving(false);
      return;
    }

    if (!openStoreAfterSave) {
      window.open(kakaoDepositMessageChatUrl, "_blank", "noopener,noreferrer");
    }

    try {
      const response = await fetch("/api/meeting-date-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: targetDates }),
      });
      const data = (await response.json().catch(() => null)) as
        | DateApplicationsResponse
        | null;
      if (!response.ok || !data?.applications) {
        throw new Error(data?.error ?? "date-applications-save-failed");
      }

      if (!openStoreAfterSave) {
        const registration = await saveDepositMessageRegistration();
        setDepositMessageSummary({
          count: registration.count,
          limitCount: registration.limitCount,
        });
      }
      setApplications((current) => {
        const next = new Map(
          [...current, ...(data.applications ?? [])].map((application) => [
            application.meetingDate,
            application,
          ]),
        );
        return Array.from(next.values()).sort((left, right) =>
          left.meetingDate.localeCompare(right.meetingDate),
        );
      });
      trackEvent("application_created", {
        application_type: "meeting_date",
        date_count: targetDates.length,
        deposit_amount: targetDates.length * MEETING_DATE_DEPOSIT_AMOUNT,
      });
      if (openStoreAfterSave) {
        window.location.assign(meetingApplicationPaymentUrl);
        return;
      }
      setSubmittedDates(targetDates);
      setSelectedDates([]);
      setDepositOpen(false);
      setScreen("submitted");
    } catch (submissionError) {
      const message =
        submissionError instanceof Error &&
          submissionError.message !== "date-applications-save-failed"
          ? submissionError.message
          : "신청 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.";
      setError(message);
      setDepositCopyError(message);
    } finally {
      setSaving(false);
    }
  };

  if (screen === "blindDate" && selectedBlindDateOffer) {
    return (
      <section
        className={cn(
          "px-5 pb-6 pt-7",
          embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
        )}
      >
        <BlindDateInvitationFlow
          offer={selectedBlindDateOffer}
          onClose={() => setScreen("dates")}
          onOffersChange={onBlindDateOffersChange}
        />
      </section>
    );
  }

  return (
    <section
      className={cn(
        "px-5 pb-8 pt-7",
        embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {screen === "intro" ? (
          <DateApplicationIntro
            recommendationName={recommendationName}
            onContinue={() => {
              trackEvent("application_intro_continue_click");
              setScreen("dates");
            }}
          />
        ) : screen === "submitted" ? (
          <motion.div
            key="date-submitted"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              payment pending
            </p>
            <h1 className="mt-2 text-[28px] font-bold leading-9 text-black">
              입금 확인 요청이
              <br />
              기록됐어요.
            </h1>
            <div className="mt-7 divide-y divide-black/8 border-y border-black/10">
              {submittedDates.map((date) => {
                const schedule = meetingDateSchedule(date)!;
                return (
                  <div
                    key={date}
                    className="flex min-h-[76px] items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-black text-black">
                        {meetingDateLabel(date)}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-black/42">
                        {schedule.timeLabel} · {MEETING_DATE_REGION}
                      </p>
                    </div>
                    <p className="text-sm font-black tabular-nums text-black">
                      {MEETING_DATE_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원
                    </p>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setScreen("dates")}
              className="mt-7 h-[52px] w-full bg-black text-sm font-black text-white"
            >
              다른 날짜 더 선택하기
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="date-options"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <header>
              <h1 className="text-[27px] font-bold leading-9 text-black">
                참여 가능한 날짜
              </h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-black/48">
                배정되면 참여가 확정되니, 가능한 날짜를 선택해주세요.
              </p>
            </header>

            <div className="mt-6 grid grid-cols-2 gap-2.5 overflow-hidden">
              {availableDates.map((date) => (
                <DateApplicationOption
                  key={date.date}
                  date={date}
                  selected={selectedDates.includes(date.date)}
                  application={applicationByDate.get(date.date) ?? null}
                  relativeWeekLabel={meetingDateRelativeWeekLabel(
                    date.date,
                    today,
                  )}
                  closed={date.date < today}
                  disabled={saving}
                  onToggle={() => toggleDate(date.date)}
                />
              ))}
            </div>

            {error && (
              <p className="mt-4 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                {error}
              </p>
            )}

            {selectedDates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 border-t border-black/10 py-4"
              >
                <div>
                  <p className="text-xs font-bold text-black/42">
                    선택한 날짜
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <p className="whitespace-nowrap text-xl font-black text-black">
                      참가비 {MEETING_DATE_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDateApplications(true)}
                  className="mt-4 h-[52px] w-full bg-black text-sm font-black text-white disabled:bg-black/15 disabled:text-black/35"
                >
                  {saving ? "신청 정보를 저장하는 중..." : "신청하기"}
                </button>
              </motion.div>
            )}

            {activeBlindDateOffers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBlindDateOfferId(activeBlindDateOffers[0].id);
                  setScreen("blindDate");
                }}
                className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 border border-black/10 bg-white px-4 py-3 text-left text-sm font-bold text-black"
              >
                <span>
                  {answerableBlindDateOffers.length > 0
                    ? "나에게 온 블라인드 데이트 초대장 보기"
                    : "블라인드 데이트 상태 확인하기"}
                </span>
                {answerableBlindDateOffers.length > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-[11px] font-black text-white">
                    {answerableBlindDateOffers.length}
                  </span>
                )}
              </button>
            )}

            <div className="mt-1">
              <button
                type="button"
                onClick={() => setScreen("intro")}
                className="inline-flex items-center gap-1 py-2 text-[11px] font-bold text-[#92928e] transition hover:text-[#6f6f6b] active:opacity-70"
              >
                <span aria-hidden className="text-[13px] leading-none">
                  ←
                </span>
                설명 다시보기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {depositOpen && (
        <DateDepositBottomSheet
          key={`date-deposit-sheet-${depositSession}`}
          saving={saving}
          accountCopied={depositAccountCopied}
          registrationSummary={depositMessageSummary}
          copyError={depositCopyError}
          onCopy={() => void copyDepositAccount()}
          onSubmit={() => void submitDateApplications()}
          onClose={() => {
            if (saving) return;
            setDepositOpen(false);
            setDepositAccountCopied(false);
            setDepositCopyError(null);
          }}
        />
      )}
    </section>
  );
}

function DateDepositBottomSheet({
  saving,
  accountCopied,
  registrationSummary,
  copyError,
  onCopy,
  onSubmit,
  onClose,
}: {
  saving: boolean;
  accountCopied: boolean;
  registrationSummary: DepositMessageRegistrationSummary | null;
  copyError: string | null;
  onCopy: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"membership" | "deposit">("deposit");
  const [membershipConsented, setMembershipConsented] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);

  return (
    <motion.div
      key="date-deposit-sheet"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/25 px-4 pb-[calc(14px+env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={step === "membership" ? "무료 멤버십 가입 안내" : "참가비 입금 안내"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="flex max-h-[calc(100dvh-28px)] w-full max-w-[390px] flex-col overflow-y-auto rounded-t-[28px] border border-black/10 bg-white px-5 pb-8 pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-black/12" />
        <div className="mt-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-black leading-7 text-black">
            {step === "membership"
              ? "교집합은 베타테스트 중이에요."
              : "참가비 입금"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="참가비 입금 안내 닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/48"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        {step === "membership" ? (
          <motion.div key="date-membership-step" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
            <div className="mt-6 border border-accent/25 bg-accent/[0.08] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center bg-black text-[19px] font-black text-white">₩</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/35">멤버십 참가비</p>
                  <p className="mt-1 text-sm font-black text-black">
                    <span className="text-black/35 line-through">20000원</span>{" "}
                    <span className="text-emerald-600">0원</span>
                  </p>
                </div>
              </div>
            </div>
            <MembershipRegistrationNotice
              baseCount={registrationSummary?.count ?? null}
              limitCount={registrationSummary?.limitCount ?? null}
              consented={membershipConsented}
              touched={consentTouched}
            />
            <label className="mt-5 flex cursor-pointer items-start gap-3 border border-black/10 bg-white px-4 py-4">
              <input
                type="checkbox"
                checked={membershipConsented}
                onChange={(event) => {
                  setConsentTouched(true);
                  setMembershipConsented(event.target.checked);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
              />
              <span className="text-sm font-bold leading-6 text-black/72">
                운영 안내 메시지 수신에 동의합니다.
              </span>
            </label>
            <button
              type="button"
              disabled={!membershipConsented}
              onClick={() => setStep("deposit")}
              className={cn(
                "mt-5 h-[52px] w-full text-sm font-black",
                membershipConsented ? "bg-black text-white" : "bg-black/10 text-black/28",
              )}
            >
              다음으로
            </button>
          </motion.div>
        ) : (
          <motion.div key="date-deposit-step" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
            <div className="mt-4 border-y border-black/10 py-4">
              <div className="flex min-h-[54px] items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold text-black/42">
                    참가비
                  </p>
                  <p className="mt-1 text-xl font-black tabular-nums text-black">
                    {MEETING_DATE_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 border border-black/10 bg-[#fbfbfa] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-black text-white">
                  <Landmark size={19} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/35">계좌번호</p>
                  <p className="mt-1 text-sm font-black text-black">{noShowDepositBankName}</p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onCopy}
                  className="ml-auto flex h-9 items-center gap-1.5 border border-black/10 bg-white px-3 text-[11px] font-black text-black"
                >
                  {accountCopied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  {accountCopied ? "복사됨" : "복사하기"}
                </button>
              </div>
              <p className="mt-4 border border-black/[0.06] bg-black/[0.035] px-4 py-3 text-[13px] font-black tabular-nums text-black/78">
                {noShowDepositAccountNumber}
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={onSubmit}
              className="mt-5 h-[52px] w-full bg-emerald-500 text-sm font-black text-white disabled:bg-black/10 disabled:text-black/28"
            >
              {saving
                ? "저장 중..."
                : "참가비 입금 완료 문자 보내기"}
            </button>
            <p className="mt-3 text-center text-[11px] font-semibold text-black/45">
              성함과 함께 입금 완료 문자를 남겨주세요.
            </p>
            {copyError && (
              <p className="mt-4 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                {copyError}
              </p>
            )}
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}

function MembershipGiftCelebration({ active }: { active: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="relative h-16 w-16 shrink-0">
      <AnimatePresence>
        {active && !shouldReduceMotion &&
          membershipBurstParticles.map((particle, index) => (
            <motion.span
              key={`${particle.x}-${particle.y}`}
              className="absolute left-1/2 top-1/2 z-40 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: particle.color }}
              initial={{ x: -3, y: -3, opacity: 0, scale: 0.4 }}
              animate={{
                x: particle.x,
                y: particle.y,
                opacity: [0, 1, 0],
                scale: [0.4, 1.25, 0.75],
              }}
              exit={{ opacity: 0 }}
              transition={{
                delay: 0.12 + index * 0.025,
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          <motion.img
            key="membership-diamond"
            src="/images/icons/membership-diamond-v2.webp"
            alt=""
            draggable={false}
            className="absolute left-[14px] top-4 z-20 h-9 w-9 object-contain drop-shadow-[0_7px_8px_rgba(14,116,144,0.28)]"
            initial={
              shouldReduceMotion
                ? { opacity: 0, scale: 0.8 }
                : { opacity: 0, y: 18, scale: 0.45, rotate: -8 }
            }
            animate={{ opacity: 1, y: -24, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 10, scale: 0.55 }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.2,
              type: "spring",
              stiffness: 320,
              damping: 18,
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-0 z-10 origin-bottom"
        animate={
          active
            ? { rotate: 0, y: 0, scale: [1, 1.08, 1] }
            : shouldReduceMotion
              ? { rotate: 0, y: 0 }
              : {
                  rotate: [0, -6, 5, -4, 3, 0],
                  y: [0, -1, 0, -1, 0, 0],
                }
        }
        transition={
          active
            ? { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
            : shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: 1.4,
                  repeat: Infinity,
                  repeatDelay: 0.65,
                  ease: [0.4, 0, 0.2, 1],
                }
        }
      >
        <motion.div
          className="absolute left-1 top-2 z-30 h-5 w-14 origin-bottom"
          animate={active ? { x: -3, y: -10, rotate: -14 } : { x: 0, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 20 }}
        >
          <span className="absolute left-[9px] top-0 h-4 w-4 rotate-[-34deg] rounded-full border-[3px] border-rose-400" />
          <span className="absolute right-[9px] top-0 h-4 w-4 rotate-[34deg] rounded-full border-[3px] border-rose-400" />
          <span className="absolute bottom-0 left-0 h-3 w-full rounded-md border border-black/15 bg-rose-400 shadow-sm" />
          <span className="absolute bottom-0 left-[23px] h-3 w-2.5 bg-amber-100" />
        </motion.div>
        <div className="absolute bottom-1 left-2 h-9 w-12 overflow-hidden rounded-b-xl rounded-t-md border border-black/15 bg-rose-400 shadow-[0_7px_14px_rgba(251,113,133,0.28)]">
          <span className="absolute inset-y-0 left-[19px] w-2.5 bg-amber-100" />
          <span className="absolute inset-x-0 top-2.5 h-2 bg-amber-100" />
        </div>
      </motion.div>
    </div>
  );
}

function MembershipRegistrationNotice({
  baseCount,
  limitCount,
  consented,
  touched,
}: {
  baseCount: number | null;
  limitCount: number | null;
  consented: boolean;
  touched: boolean;
}) {
  const count =
    typeof baseCount === "number" ? baseCount + (consented ? 1 : 0) : null;

  return (
    <motion.div
      layout
      className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "whitespace-nowrap font-black",
              count === null ? "text-xl leading-7" : "text-2xl leading-8",
            )}
          >
            {count === null ? (
              "신청 인원 확인 중이에요."
            ) : (
              <>
                현재{" "}
                {touched ? (
                  <AnimatedRegistrationNumber
                    from={consented ? count - 1 : count + 1}
                    to={count}
                  />
                ) : (
                  <span className="tabular-nums">
                    {count.toLocaleString("ko-KR")}
                  </span>
                )}
                명이 신청했어요.
              </>
            )}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-emerald-800/75">
            해당 서비스는 선착순{" "}
            {(limitCount ?? fallbackDepositMessageLimitCount).toLocaleString("ko-KR")}
            명까지만
            <br />
            무료로 진행해요.
          </p>
        </div>
        <MembershipGiftCelebration active={consented} />
      </div>
    </motion.div>
  );
}

function AnimatedRegistrationNumber({
  from,
  to,
}: {
  from: number;
  to: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion || from === to) {
    return (
      <span className="tabular-nums">
        {to.toLocaleString("ko-KR")}
      </span>
    );
  }

  const fromLabel = from.toLocaleString("ko-KR");
  const toLabel = to.toLocaleString("ko-KR");
  const slotCount = Math.max(fromLabel.length, toLabel.length);
  const fromCharacters = fromLabel.padStart(slotCount, " ").split("");
  const toCharacters = toLabel.padStart(slotCount, " ").split("");
  const rollsUp = to > from;
  const digitTransition = {
    duration: 0.7,
    ease: [0.4, 0, 0.2, 1] as const,
  };

  return (
    <span className="tabular-nums">
      <span className="sr-only">{toLabel}</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {toCharacters.map((toCharacter, index) => {
          const fromCharacter = fromCharacters[index];
          const shouldRoll =
            fromCharacter !== toCharacter &&
            /\d/.test(fromCharacter) &&
            /\d/.test(toCharacter);

          if (!shouldRoll) {
            return (
              <span key={`${index}-${toCharacter}`}>
                {toCharacter === " " ? "\u00a0" : toCharacter}
              </span>
            );
          }

          return (
            <span
              key={`${index}-${fromCharacter}-${toCharacter}`}
              className="relative inline-block w-[1ch] overflow-hidden align-baseline"
            >
              <span className="invisible block">{toCharacter}</span>
              <motion.span
                className="absolute inset-0 block text-center"
                initial={{ y: "0%" }}
                animate={{ y: rollsUp ? "-100%" : "100%" }}
                transition={digitTransition}
              >
                {fromCharacter}
              </motion.span>
              <motion.span
                className="absolute inset-0 block text-center"
                initial={{ y: rollsUp ? "100%" : "-100%" }}
                animate={{ y: "0%" }}
                transition={digitTransition}
              >
                {toCharacter}
              </motion.span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function NoShowDepositBottomSheet({
  saving,
  accountCopied,
  registrationSummary,
  copyError,
  onCopy,
  onSubmit,
  onClose,
}: {
  saving: boolean;
  accountCopied: boolean;
  registrationSummary: DepositMessageRegistrationSummary | null;
  copyError: string | null;
  onCopy: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"membership" | "deposit">("deposit");
  const [membershipConsented, setMembershipConsented] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);

  return (
    <motion.div
      key="no-show-deposit-sheet"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/25 px-4 pb-[calc(14px+env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={
          step === "membership" ? "무료 멤버십 가입 안내" : "참가비 입금 안내"
        }
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 28, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-[390px] flex-col rounded-t-[28px] border border-black/10 bg-white px-5 pb-8 pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-black/12" />
        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black leading-7 text-black">
              {step === "membership"
                ? "교집합은 베타테스트 중이에요."
                : "참가비 10,000원을 입금해주세요."}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="참가비 입금 안내 닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/48 shadow-sm transition hover:text-black disabled:opacity-40"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        {step === "membership" ? (
          <motion.div
            key="membership-step"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="mt-6 rounded-[22px] border border-accent/25 bg-accent/[0.08] px-4 py-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-[19px] font-black leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                >
                  ₩
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/35">
                    멤버십 참가비
                  </p>
                  <p className="mt-1 text-sm font-black text-black">
                    <span className="text-black/35 line-through">20000원</span>{" "}
                    <span className="text-emerald-600">0원</span>
                  </p>
                </div>
              </div>
            </div>

            <MembershipRegistrationNotice
              baseCount={registrationSummary?.count ?? null}
              limitCount={registrationSummary?.limitCount ?? null}
              consented={membershipConsented}
              touched={consentTouched}
            />

            <div className="mt-5 rounded-[20px] border border-black/10 bg-white px-4 py-4">
              <p className="text-sm font-semibold leading-6 text-black/58">
                모임이 진행되는 경우 원활한 서비스를 위하여 운영 안내 메시지를
                보내드리고 있습니다.
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-black/[0.035] px-3 py-3">
                <input
                  type="checkbox"
                  checked={membershipConsented}
                  onChange={(event) => {
                    setConsentTouched(true);
                    setMembershipConsented(event.target.checked);
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
                />
                <span className="text-sm font-bold leading-6 text-black/72">
                  운영 안내 메시지를 수신하는데 동의합니다.
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={!membershipConsented}
              onClick={() => setStep("deposit")}
              className={cn(
                "mt-5 h-[52px] w-full rounded-[16px] text-sm font-black transition",
                membershipConsented
                  ? "bg-black text-white hover:bg-black/85"
                  : "cursor-not-allowed bg-black/10 text-black/28",
              )}
            >
              다음으로
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="deposit-step"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="mt-4 rounded-[22px] border border-accent/25 bg-accent/[0.08] px-4 py-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                >
                  <CalendarDays size={19} aria-hidden />
                </span>
                <p className="text-sm font-black text-black">
                  참가비 : {MEETING_DATE_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원
                </p>
              </div>
              <p className="mt-2 pl-3 text-sm font-semibold leading-6 text-black/58">
                모임 참여를 위한 참가비입니다.
              </p>
            </div>

            <div className="mt-5 rounded-[20px] border border-black/10 bg-gradient-to-br from-[#fbfbfa] to-white px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
                  <Landmark size={19} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/35">
                    계좌번호
                  </p>
                  <p className="mt-1 text-sm font-black text-black">
                    {noShowDepositBankName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onCopy}
                  aria-label="계좌 복사하기"
                  className="ml-auto flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-[11px] font-black text-black transition hover:border-black/20 hover:bg-black/[0.03] disabled:opacity-45"
                >
                  {accountCopied ? (
                    <Check size={14} aria-hidden />
                  ) : (
                    <Copy size={14} aria-hidden />
                  )}
                  {accountCopied ? "복사됨" : "복사하기"}
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-black/[0.06] bg-black/[0.035] px-4 py-3">
                <p className="text-[13px] font-black tabular-nums tracking-[0] text-black/78">
                  {noShowDepositAccountNumber}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={onSubmit}
              className={cn(
                "mt-5 h-[52px] w-full rounded-[16px] text-sm font-black transition",
                !saving
                  ? "bg-emerald-500 text-white shadow-[0_12px_26px_rgba(16,185,129,0.28)] hover:bg-emerald-600"
                  : "cursor-not-allowed bg-black/10 text-black/28",
              )}
            >
              {saving ? "저장 중..." : "입금 완료 문자 보내기"}
            </button>

            <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-black/45">
              성함과 함께 입금 완료 문자를 남겨주세요. | 예) 홍길동 - 입금완료
            </p>
            {copyError && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                {copyError}
              </p>
            )}
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}

function TicketRejectionBottomSheet({
  ticket,
  savingReason,
  error,
  onClose,
  onSelectReason,
}: {
  ticket: GatheringTicket;
  savingReason: TicketRejectionReasonId | null;
  error: string | null;
  onClose: () => void;
  onSelectReason: (reason: TicketRejectionReasonId) => void;
}) {
  const reasons = rejectionReasonsForTicket(ticket);

  return (
    <motion.div
      key="ticket-rejection-sheet"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/25 px-4 pb-[calc(14px+env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="거절 사유 선택"
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 28, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
        className="flex min-h-[64dvh] w-full max-w-[390px] flex-col rounded-t-[28px] border border-black/10 bg-white px-5 pb-8 pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-black/12" />
        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-accent">
              reason
            </p>
            <h2 className="mt-2 text-xl font-black leading-7 text-black">
              거절 이유를 알려주세요.
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-black/52">
              거절 이유에 맞춰서 다른 만남을 추천해드려요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(savingReason)}
            aria-label="거절 사유 닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/48 shadow-sm transition hover:text-black disabled:opacity-40"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {reasons.map((reason) => (
            <button
              key={reason.id}
              type="button"
              disabled={Boolean(savingReason)}
              onClick={() => onSelectReason(reason.id)}
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-[16px] border border-black/10 bg-white px-4 py-3 text-left text-sm font-bold text-black transition hover:border-black/20 hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="flex min-w-0 items-center gap-2 break-words">
                <span aria-hidden>{ticketRejectionReasonEmojis[reason.id]}</span>
                <span>{reason.label}</span>
              </span>
              {savingReason === reason.id && (
                <span className="shrink-0 text-[11px] font-black text-accent">
                  저장 중
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
            {error}
          </p>
        )}
      </motion.section>
    </motion.div>
  );
}

function CurationLoadingScreen({
  recommendationName,
}: {
  recommendationName?: string;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const displayName = recommendationName?.trim() || "회원";

  return (
    <motion.div
      key="curating"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="flex min-h-[calc(100dvh-170px)] items-center justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <section className="w-full rounded-[30px] border border-black/10 bg-white px-5 py-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.08)]">
        <div className="flex min-h-[390px] flex-col items-center justify-center">
          <CurationLoadingLogo />
          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              textShadow: "0 0 18px rgba(126,179,199,0.34)",
            }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.1 }}
            className="mt-8 text-[22px] font-black leading-7 text-black"
          >
            {displayName}님에게 딱 맞는 만남을 찾는 중
          </motion.p>
          <CurationLoadingDots shouldReduceMotion={shouldReduceMotion} />
          <p className="mt-2 text-sm font-semibold leading-6 text-black/48">
            선택한 날짜에 어울리는 자리를 살펴보고 있어요.
          </p>
        </div>
      </section>
    </motion.div>
  );
}

function CurationLoadingDots({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean;
}) {
  const opacityKeyframes = [
    [1, 1, 1, 1],
    [0, 1, 1, 0],
    [0, 0, 1, 0],
  ];

  return (
    <div
      className="mt-2 flex h-4 w-12 items-center justify-center gap-1.5"
      aria-hidden
    >
      {opacityKeyframes.map((opacity, index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-accent"
          initial={{ opacity: shouldReduceMotion ? 1 : opacity[0] }}
          animate={{ opacity: shouldReduceMotion ? 1 : opacity }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: 1.2,
                  ease: "linear",
                  repeat: Infinity,
                  times: [0, 0.34, 0.67, 1],
                }
          }
        />
      ))}
    </div>
  );
}

function CurationLoadingLogo() {
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
    duration: shouldReduceMotion ? 0 : 0.42,
    ease: "easeInOut" as const,
  };
  const hiddenCircleStroke = shouldReduceMotion
    ? false
    : { opacity: 0, strokeDashoffset: circlePathLength };

  return (
    <div
      className="relative flex h-28 w-56 items-center justify-center"
      aria-hidden
    >
      <motion.svg
        viewBox="0 0 192 128"
        className="h-28 w-48 overflow-visible drop-shadow-[0_18px_28px_rgba(0,0,0,0.08)]"
      >
        <defs>
          <clipPath
            id="curation-loading-logo-lens-fill"
            clipPathUnits="userSpaceOnUse"
          >
            <motion.rect
              x="79"
              width="34"
              initial={shouldReduceMotion ? false : { y: lensBottomY, height: 0 }}
              animate={{ y: lensTopY, height: lensHeight }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.32,
                ease: [0.16, 1, 0.3, 1],
                delay: shouldReduceMotion ? 0 : 0.5,
              }}
            />
          </clipPath>
        </defs>

        <motion.path
          d={leftCirclePath}
          fill="none"
          stroke="#0b0b0b"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circlePathLength}
          vectorEffect="non-scaling-stroke"
          initial={hiddenCircleStroke}
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
          initial={hiddenCircleStroke}
          animate={{ opacity: 1, strokeDashoffset: 0 }}
          transition={{ ...drawTransition, delay: shouldReduceMotion ? 0 : 0.12 }}
        />
        <motion.path
          d={lensPath}
          fill="#0b0b0b"
          clipPath="url(#curation-loading-logo-lens-fill)"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.12,
            delay: shouldReduceMotion ? 0 : 0.5,
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
            duration: shouldReduceMotion ? 0 : 0.28,
            ease: "easeInOut",
            delay: shouldReduceMotion ? 0 : 0.32,
          }}
        />
      </motion.svg>
    </div>
  );
}

function TicketDrawingCard({
  ticket,
  ended,
  saving,
  error,
  onYes,
  onNo,
  onChangeDate,
}: {
  ticket: GatheringTicket;
  ended: boolean;
  saving: boolean;
  error: string | null;
  onYes: () => void;
  onNo: () => void;
  onChangeDate: () => void;
}) {
  const [isDrawn, setIsDrawn] = useState(false);
  const [isImageVisible, setIsImageVisible] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setIsDrawn(false);
    setIsImageVisible(false);
    setDetailOpen(false);
    const revealTimer = window.setTimeout(() => {
      setIsImageVisible(true);
      setIsDrawn(true);
    }, 650);
    return () => {
      window.clearTimeout(revealTimer);
    };
  }, [ticket.id]);

  const openDetail = () => {
    if (!isDrawn || saving) return;
    setDetailOpen(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-4"
    >
      <AnimatePresence mode="wait">
        {detailOpen ? (
          <TicketInsideView
            key="ticket-inside"
            ticket={ticket}
            ended={ended}
            saving={saving}
            error={error}
            onClose={() => setDetailOpen(false)}
            onNo={onNo}
            onYes={onYes}
            onChangeDate={onChangeDate}
          />
        ) : (
          <motion.div
            key="ticket-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="pr-16">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                invitation
              </p>
              {!isDrawn && (
                <motion.h1
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black"
                >
                  초대장을 그리고 있어요
                </motion.h1>
              )}
            </div>

            <motion.div
              role={isDrawn ? "button" : undefined}
              tabIndex={isDrawn ? 0 : -1}
              aria-label={`${ticket.title} 자세히 보기`}
              onClick={openDetail}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetail();
                }
              }}
              className={cn(
                "mx-auto mt-6 block w-[88%] max-w-[330px] rounded-[28px] text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4",
                isDrawn && !saving && "cursor-pointer active:scale-[0.99]",
              )}
            >
              <TicketDrawingFrame
                motionKey={ticket.id}
                title={ticket.title}
                imageUrl={ticket.imageUrl}
                imageUrls={ticketBackgroundImageUrls(ticket)}
                date={ticket.date}
                time={ticket.time}
                location={`서울\n${ticket.area}`}
                tags={ticket.moodTags}
                remainingSeatCount={ticket.remainingSeatCount}
                drawn={isDrawn}
                imageVisible={isImageVisible}
                className="!mt-0 !w-full !max-w-none"
              />
            </motion.div>

            {isDrawn ? (
              <motion.div
                key="invitation-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5"
              >
                {error && (
                  <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <motion.button
                    whileTap={!saving ? { scale: 0.98 } : undefined}
                    type="button"
                    disabled={saving}
                    onClick={onNo}
                    className="flex h-[58px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black disabled:opacity-40"
                  >
                    <span className="text-sm font-bold">No</span>
                    <span className="mt-0.5 text-[10px] font-medium text-black/40">
                      다른 추천 보기
                    </span>
                  </motion.button>
                  <motion.button
                    whileTap={!saving ? { scale: 0.98 } : undefined}
                    type="button"
                    disabled={saving}
                    onClick={openDetail}
                    className="flex h-[58px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm disabled:bg-black/20"
                  >
                    <span className="text-sm font-bold">Yes</span>
                    <span className="mt-0.5 text-[10px] font-medium text-white/60">
                      자세히 보기
                    </span>
                  </motion.button>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onChangeDate}
                  className="mx-auto mt-3 block text-[10px] font-semibold text-black/55 underline underline-offset-4 disabled:opacity-40"
                >
                  날짜 다시 고르기
                </button>
              </motion.div>
            ) : (
              <motion.span
                key="drawing-guide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 block h-[15px]"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function EndedInvitationNoticeButton() {
  return (
    <button
      type="button"
      disabled
      className="flex h-[58px] w-full items-center justify-center rounded-[16px] bg-black/[0.06] text-sm font-bold text-black/45"
    >
      이미 끝이 난 초대장입니다.
    </button>
  );
}

function TicketInsideView({
  ticket,
  ended,
  saving,
  error,
  onClose,
  onYes,
  onNo,
  onChangeDate,
}: {
  ticket: GatheringTicket;
  ended: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onYes: () => void;
  onNo: () => void;
  onChangeDate: () => void;
}) {
  return (
    <motion.div
      key="ticket-inside"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={ticketFadeTransition}
      className="relative pt-[calc(54px+env(safe-area-inset-top))]"
    >
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        aria-label="초대장 닫기"
        className="absolute left-0 top-[calc(6px+env(safe-area-inset-top))] z-30 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm transition hover:-translate-y-0.5 hover:text-black hover:shadow-md disabled:opacity-40"
      >
        <X size={18} aria-hidden />
      </button>

      <div className="pr-16">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            invitation
          </p>
          <h1 className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black">
            자세히 보고 신청할까요?
          </h1>
        </div>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04, duration: 0.22, ease: "easeOut" }}
        className="mt-5 overflow-hidden rounded-[28px] border border-black/12 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
      >
        <TicketDetailHero ticket={ticket} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.22, ease: "easeOut" }}
          className="bg-white px-5 pb-5 pt-1"
        >
          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}
          <TicketDetailContent ticket={ticket} />
        </motion.div>
      </motion.article>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.2, ease: "easeOut" }}
        className={cn(
          "mt-5",
          ended
            ? "rounded-[18px] bg-black/[0.045] px-4 py-4 text-center"
            : "grid grid-cols-2 gap-2.5",
        )}
      >
        {ended ? (
          <EndedInvitationNoticeButton />
        ) : (
          <>
            <motion.button
              whileTap={!saving ? { scale: 0.98 } : undefined}
              type="button"
              disabled={saving}
              onClick={onNo}
              className="flex h-[58px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black disabled:opacity-40"
            >
              <span className="text-sm font-bold">No</span>
              <span className="mt-0.5 text-[10px] font-medium text-black/40">
                다른 추천 보기
              </span>
            </motion.button>
            <motion.button
              whileTap={!saving ? { scale: 0.98 } : undefined}
              type="button"
              disabled={saving}
              onClick={onYes}
              className="flex h-[58px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm disabled:bg-black/20"
            >
              <span className="text-sm font-bold">Yes</span>
              <span className="mt-0.5 text-[10px] font-medium text-white/60">
                {saving ? "등록 중..." : "신청하기"}
              </span>
            </motion.button>
          </>
        )}
      </motion.div>
      <button
        type="button"
        disabled={saving}
        onClick={onChangeDate}
        className="mx-auto mt-3 block text-[10px] font-semibold text-black/55 underline underline-offset-4 disabled:opacity-40"
      >
        날짜 다시 고르기
      </button>
    </motion.div>
  );
}

function blindDateDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (!Number.isFinite(date.getTime())) return value;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${weekday}`;
}

const blindDateCalendarWeekdays = ["일", "월", "화", "수", "목", "금", "토"];

function isoDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function calendarCellsForMonth(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const dayCount = new Date(year, month, 0).getDate();
  const cells: Array<string | null> = Array.from(
    { length: firstWeekday },
    () => null,
  );

  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(dateKey(year, month, day));
  }

  const remainder = cells.length % 7;
  if (remainder > 0) {
    cells.push(...Array.from({ length: 7 - remainder }, () => null));
  }

  return cells;
}

function remainingTimeText(expiresAt: string, nowMs = Date.now()) {
  const target = new Date(expiresAt);
  const remainingMs = target.getTime() - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const timeText = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

  return `응답 마감까지 ${timeText} 남았어요.`;
}

function useBlindDateRemainingText(expiresAt: string) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return remainingTimeText(expiresAt, nowMs);
}

function BlindDateInvitationFlow({
  offer,
  onClose,
  onOffersChange,
}: {
  offer: BlindDateUserOffer;
  onClose: () => void;
  onOffersChange?: (offers: BlindDateUserOffer[]) => void;
}) {
  const [currentOffer, setCurrentOffer] = useState(offer);
  const [step, setStep] = useState<"invite" | "dates" | "result">(
    offer.ownResponse === "pending" && !offer.isExpired ? "invite" : "result",
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remainingText = useBlindDateRemainingText(currentOffer.expiresAt);
  const responseWindowClosed =
    currentOffer.isExpired ||
    (!remainingText &&
      ["offered", "waiting_response"].includes(currentOffer.status));
  const inviteCopy =
    currentOffer.template.stageCopy?.invite?.trim() ||
    currentOffer.template.shortDescription ||
    "지난 교집합 자리에서 서로 다시 만나보고 싶다고 선택된 분과 단둘이 만날 수 있는 자리가 준비되었어요.\n상대방은 현장에서 알 수 있어요.";

  useEffect(() => {
    setCurrentOffer(offer);
    setStep(offer.ownResponse === "pending" && !offer.isExpired ? "invite" : "result");
    setSelectedDates([]);
    setError(null);
  }, [offer]);

  const respond = async (action: "yes" | "no", availableDates: string[] = []) => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/meetings/blind-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: currentOffer.id,
          action,
          availableDates,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            offer?: BlindDateUserOffer;
            offers?: BlindDateUserOffer[];
            error?: string;
          }
        | null;

      if (!response.ok || !data?.offer) {
        throw new Error(data?.error ?? "blind-date-response-failed");
      }

      setCurrentOffer(data.offer);
      onOffersChange?.(data.offers ?? [data.offer]);
      setStep("result");
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "응답을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleDate = (date: string) => {
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((item) => item !== date)
        : [...current, date].sort(),
    );
  };

  return (
    <motion.div
      key="blind-date-invitation"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={ticketFadeTransition}
      className="relative pb-5 pt-[calc(54px+env(safe-area-inset-top))]"
    >
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        aria-label="블라인드 데이트 초대장 닫기"
        className="absolute left-0 top-[calc(6px+env(safe-area-inset-top))] z-30 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-sm transition hover:-translate-y-0.5 hover:text-black hover:shadow-md disabled:opacity-40"
      >
        <X size={18} aria-hidden />
      </button>

      {step !== "result" && responseWindowClosed ? (
        <BlindDateResultMessage
          tone="muted"
          title="응답 시간이 지나 초대장이 만료되었어요."
          body="만료된 초대장은 추천탭 알림에서 제외돼요."
        />
      ) : step === "dates" ? (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            available dates
          </p>
          <h1 className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black">
            가능한 날짜를
            <br />
            골라주세요.
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-black/48">
            가능한 날짜는 여러 개 선택할 수 있어요. 상대방과 가능한 날짜가
            겹치면 가장 빠른 날짜로 확정돼요.
          </p>

          <BlindDateDateCalendar
            dates={currentOffer.candidateDates}
            selectedDates={selectedDates}
            saving={saving}
            onToggle={toggleDate}
          />

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={saving || selectedDates.length === 0}
            onClick={() => void respond("yes", selectedDates)}
            className="mt-5 h-[54px] w-full rounded-full bg-black text-sm font-bold text-white transition disabled:bg-black/20"
          >
            {saving ? "저장 중..." : "가능한 날짜 제출하기"}
          </button>
        </section>
      ) : step === "result" ? (
        <BlindDateResponseResult offer={currentOffer} remainingText={remainingText} />
      ) : (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            blind date invitation
          </p>
          <h1 className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black">
            블라인드 데이트 제안이
            <br />
            도착했어요.
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-black/48">
            <span className="whitespace-pre-line">{inviteCopy}</span>
          </p>

          <div className="mt-6">
            <TicketDrawingFrame
              motionKey={currentOffer.id}
              title={currentOffer.template.title}
              imageUrl={currentOffer.template.imageUrl}
              time={currentOffer.timeLabel}
              location={`서울\n${currentOffer.region}`}
              tags={["블라인드", "비공개"]}
              drawn
              imageVisible
              className="!mt-0"
            />
          </div>

          <div className="mt-5 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-4 text-xs font-bold text-black/58">
            <p className="flex items-center gap-2">
              <Clock3 size={14} className="text-black/35" aria-hidden />
              <span>{currentOffer.timeLabel}</span>
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={14} className="text-black/35" aria-hidden />
              <span>{currentOffer.region}</span>
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays size={14} className="text-black/35" aria-hidden />
              <span>{remainingText}</span>
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <motion.button
              whileTap={!saving ? { scale: 0.98 } : undefined}
              type="button"
              disabled={saving}
              onClick={() => void respond("no")}
              className="flex h-[58px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black disabled:opacity-40"
            >
              <span className="text-sm font-bold">No</span>
              <span className="mt-0.5 text-[10px] font-medium text-black/40">
                이번엔 지나갈게요
              </span>
            </motion.button>
            <motion.button
              whileTap={!saving ? { scale: 0.98 } : undefined}
              type="button"
              disabled={saving}
              onClick={() => setStep("dates")}
              className="flex h-[58px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm disabled:bg-black/20"
            >
              <span className="text-sm font-bold">Yes</span>
              <span className="mt-0.5 text-[10px] font-medium text-white/60">
                가능한 날짜 선택
              </span>
            </motion.button>
          </div>
        </section>
      )}
    </motion.div>
  );
}

function BlindDateDateCalendar({
  dates,
  selectedDates,
  saving,
  onToggle,
}: {
  dates: string[];
  selectedDates: string[];
  saving: boolean;
  onToggle: (date: string) => void;
}) {
  const enabledDates = new Set(dates);
  const selectedDateSet = new Set(selectedDates);
  const months = dates.length
    ? Array.from(new Set(dates.map((date) => date.slice(0, 7)))).sort()
    : [];
  const [month, setMonth] = useState(months[0] ?? "");

  useEffect(() => {
    if (months.length > 0 && !months.includes(month)) {
      setMonth(months[0]);
    }
  }, [month, months]);

  if (months.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold text-black/45">
        선택 가능한 날짜가 아직 열리지 않았어요.
      </p>
    );
  }

  const visibleMonth = months.includes(month) ? month : months[0];
  const [year, monthNumber] = visibleMonth.split("-").map(Number);
  const activeWeekdays = new Set(
    dates
      .filter((date) => date.startsWith(`${visibleMonth}-`))
      .map((date) => {
        const parts = isoDateParts(date);
        if (!parts) return -1;
        return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
      }),
  );

  return (
    <section className="mt-6 rounded-[24px] border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-black">
          {year}년 {monthNumber}월
        </h2>
        <div className="flex rounded-full bg-black/[0.04] p-1 text-[10px] font-bold">
          {months.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMonth(value)}
              className={cn(
                "rounded-full px-3 py-1 transition-all",
                visibleMonth === value
                  ? "bg-white text-black shadow-sm"
                  : "text-black/40",
              )}
            >
              {Number(value.slice(5, 7))}월
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-black/35">
        {blindDateCalendarWeekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={cn(
              "rounded-full py-1 transition-colors",
              activeWeekdays.has(index)
                ? "bg-[#7eb3c7]/15 font-extrabold text-[#4f9bb8]"
                : "text-black/35",
            )}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {calendarCellsForMonth(year, monthNumber).map((date, index) => {
          if (!date) {
            return <span key={`empty-${index}`} className="aspect-square" />;
          }

          const parts = isoDateParts(date);
          const enabled = enabledDates.has(date);
          const selected = selectedDateSet.has(date);

          return (
            <button
              key={date}
              type="button"
              disabled={!enabled || saving}
              aria-label={blindDateDateLabel(date)}
              aria-pressed={selected}
              onClick={() => onToggle(date)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-full border text-xs font-black transition disabled:cursor-not-allowed",
                selected
                  ? "border-black bg-black text-white shadow-sm"
                  : enabled
                    ? "border-black/10 bg-white text-black hover:border-black/25"
                    : "border-transparent text-black/15",
                saving && enabled && "opacity-45",
              )}
            >
              <span>{parts?.day ?? ""}</span>
              {enabled && !selected && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#7eb3c7] shadow-sm" />
              )}
              {selected && (
                <Check
                  size={10}
                  className="absolute right-1.5 top-1.5"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BlindDateResponseResult({
  offer,
  remainingText,
}: {
  offer: BlindDateUserOffer;
  remainingText: string | null;
}) {
  const stage = blindDateDisplayStage(offer);

  if (stage === "scheduled" || stage === "guidance" || stage === "completed") {
    const isGuidance = stage === "guidance";
    const isCompleted = stage === "completed";
    const placeName = offer.actualPlaceName || "장소 확인 중";
    const address = offer.actualPlaceAddress || "주소 확인 중";
    const title = isCompleted
      ? "블라인드 데이트가 완료되었어요."
      : isGuidance
        ? "오늘 만남을 다시 확인해주세요."
        : "블라인드 데이트 일정이 확정되었어요.";
    const body = blindDateStageCopy(
      offer,
      isCompleted ? "completed" : isGuidance ? "guidance" : "scheduled",
      isCompleted
        ? "짧은 피드백을 남길 수 있도록 준비 중이에요."
        : isGuidance
          ? "장소와 시간을 다시 확인해주세요. 상대방은 현장에서 알 수 있어요."
          : "확정된 날짜와 장소를 확인해주세요. 상대방은 현장에서 알 수 있어요.",
    );

    return (
      <section>
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          {isCompleted ? "feedback" : isGuidance ? "date guidance" : "scheduled"}
        </p>
        <h1 className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black">
          {title}
        </h1>
        <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-black/48">
          {body}
        </p>

        <div className="mt-6">
          <TicketDrawingFrame
            motionKey={`${offer.id}-${stage}`}
            title={offer.template.title}
            imageUrl={offer.template.imageUrl}
            time={offer.timeLabel}
            location={`${offer.region}\n${placeName}`}
            tags={["블라인드", "확정"]}
            drawn
            imageVisible
            className="!mt-0"
          />
        </div>

        <BlindDateDetailList
          items={[
            ["날짜", offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : "-"],
            ["시간", offer.timeLabel],
            ["지역", offer.region],
            ["장소", placeName],
            ["주소", address],
            ["상대", "현장에서 공개"],
          ]}
        />

        {offer.template.guideText && (
          <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-xs font-semibold leading-5 text-black/55">
            {offer.template.guideText}
          </p>
        )}

        {isCompleted && (
          <p className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4 text-xs font-semibold leading-5 text-black/55">
            피드백 기능은 곧 열릴 예정이에요.
          </p>
        )}
      </section>
    );
  }

  if (stage === "needs_reschedule") {
    return (
      <BlindDateResultMessage
        tone="muted"
        title="가능한 날짜가 서로 맞지 않았어요."
        body="운영진이 다른 일정을 확인해볼게요."
      />
    );
  }

  if (stage === "declined") {
    return (
      <BlindDateResultMessage
        tone="muted"
        title="이번 블라인드 데이트 제안은 지나갔어요."
        body="다음 교집합에서 더 잘 맞는 자리를 제안드릴게요."
      />
    );
  }

  if (stage === "expired") {
    return (
      <BlindDateResultMessage
        tone="muted"
        title="응답 시간이 지나 초대장이 만료되었어요."
        body="만료된 초대장은 추천탭 알림에서 제외돼요."
      />
    );
  }

  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
        waiting
      </p>
      <h1 className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black">
        상대방의 응답을
        <br />
        기다리는 중이에요.
      </h1>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-black/48">
        {blindDateStageCopy(
          offer,
          "waiting",
          "상대방도 참여 의사를 남기고 가능한 날짜가 겹치면 블라인드 데이트 일정이 확정돼요.",
        )}
      </p>

      <div className="mt-6">
        <TicketDrawingFrame
          motionKey={`${offer.id}-waiting`}
          title={offer.template.title}
          imageUrl={offer.template.imageUrl}
          time={offer.timeLabel}
          location={`서울\n${offer.region}`}
          tags={["블라인드", "대기"]}
          drawn
          imageVisible
          className="!mt-0"
        />
      </div>

      <BlindDateDetailList
        items={[
          ["선택한 날짜", offer.ownAvailableDates.map(blindDateDateLabel).join(", ") || "-"],
          ["시간", offer.timeLabel],
          ["지역", offer.region],
          ["마감", remainingText ?? "응답 마감 시간이 곧 도착해요."],
          ["상대", "현장에서 공개"],
        ]}
      />
    </section>
  );
}

type BlindDateStageKey =
  | "invite"
  | "waiting"
  | "scheduled"
  | "guidance"
  | "completed";

function koreaTodayDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  return `${partMap.get("year")}-${partMap.get("month")}-${partMap.get("day")}`;
}

function blindDateDisplayStage(offer: BlindDateUserOffer) {
  if (offer.isExpired || offer.status === "expired") return "expired";
  if (offer.status === "declined" || offer.ownResponse === "no") return "declined";
  if (offer.status === "needs_reschedule") return "needs_reschedule";
  if (offer.status === "completed") return "completed";
  if (offer.scheduledDate) {
    const today = koreaTodayDateKey();
    if (offer.scheduledDate < today) return "completed";
    if (offer.scheduledDate === today) return "guidance";
    return "scheduled";
  }
  return "waiting";
}

function blindDateStageCopy(
  offer: BlindDateUserOffer,
  key: BlindDateStageKey,
  fallback: string,
) {
  return offer.template.stageCopy?.[key]?.trim() || fallback;
}

function BlindDateDetailList({
  items,
}: {
  items: Array<[label: string, value: string]>;
}) {
  return (
    <div className="mt-5 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-4 text-xs font-bold text-black/58">
      {items.map(([label, value]) => (
        <p key={label} className="grid grid-cols-[74px_minmax(0,1fr)] gap-2">
          <span className="text-black/35">{label}</span>
          <span className="min-w-0 whitespace-pre-line break-words text-black/62">
            {value}
          </span>
        </p>
      ))}
    </div>
  );
}

function BlindDateResultMessage({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "default" | "success" | "muted";
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border px-5 py-7 text-center",
        tone === "success"
          ? "border-emerald-100 bg-emerald-50 text-emerald-950"
          : tone === "muted"
            ? "border-black/10 bg-black/[0.03] text-black"
            : "border-accent/20 bg-accent/[0.08] text-black",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white",
          tone === "success" ? "text-emerald-600" : "text-accent",
        )}
      >
        <Check size={20} aria-hidden />
      </div>
      <h1 className="mt-5 whitespace-pre-line text-xl font-black leading-7">
        {title}
      </h1>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-black/58">
        {body}
      </p>
    </section>
  );
}
