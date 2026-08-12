"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Gift,
  Landmark,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { formatTicketTimeLabel } from "@/components/IntersectionTicketCard";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import {
  SelectionColumn,
  activityIcons,
  activityLabels,
  interestIcons,
  interestLabels,
} from "@/features/app/PreferenceProfileTab";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import { trackEvent } from "@/lib/analytics";
import { membershipStoreUrls } from "@/lib/membershipStore";
import {
  MEETING_DATE_DEPOSIT_AMOUNT,
  MEETING_DATE_REGION,
  isMeetingDateClosed,
  meetingDateApplicationDates,
  meetingDateLabel,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { todayInKst } from "@/lib/ticketDate";
import { ticketBackgroundImageUrls } from "@/lib/ticketImages";
import { saveGuestTicketInteraction } from "@/lib/ticketInteractions";
import type {
  GatheringTicket,
  TicketInteraction,
  TicketInteractionStatus,
} from "@/types/ticket";
import type { BlindDateUserOffer } from "@/types/blindDate";

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

function upcomingSaturdayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));
  const daysUntilSaturday = (6 - current.getUTCDay() + 7) % 7;
  current.setUTCDate(current.getUTCDate() + daysUntilSaturday);
  return current.toISOString().slice(0, 10);
}

const kstOffsetMs = 9 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

function nextFridayOpeningAt(nowMs: number) {
  const kstNow = new Date(nowMs + kstOffsetMs);
  const daysUntilFriday = (5 - kstNow.getUTCDay() + 7) % 7;
  let openingAt =
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate() + daysUntilFriday,
    ) - kstOffsetMs;

  if (openingAt <= nowMs) openingAt += 7 * dayMs;
  return openingAt;
}

function RollingCountdownValue({
  value,
  reduceMotion,
}: {
  value: number;
  reduceMotion: boolean;
}) {
  return (
    <span className="inline-flex" aria-hidden>
      {String(value)
        .padStart(2, "0")
        .split("")
        .map((digit, index) => (
          <span
            key={index}
            className="relative inline-flex h-8 w-[15px] overflow-hidden"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={digit}
                initial={reduceMotion ? false : { opacity: 0, y: -26 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 26 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {digit}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
    </span>
  );
}

function CompactParticipationRecord({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  const level = Number.isFinite(count)
    ? Math.min(5, Math.max(0, Math.floor(count)))
    : 0;
  const currentStep = level < 5 ? level + 1 : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-grid h-12 grid-cols-5 place-items-center gap-1.5 rounded-full border border-black/10 bg-[#faf8f2] px-4 shadow-[0_8px_24px_rgba(24,24,20,0.035)]"
      title="참여할수록 추천이 더 정교해져요."
      aria-label={`참여 기록 ${level}/5단계`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const step = index + 1;
        const reached = step <= level;
        const current = step === currentStep;
        const fill = reached ? "#121212" : "#F1EEE6";
        const stroke =
          reached || current ? "#121212" : "rgba(0,0,0,0.16)";

        return (
          <span
            key={step}
            className="relative inline-flex h-6 w-[18px] items-center justify-center"
          >
            <svg
              viewBox="0 0 32 42"
              className={cn(
                "h-6 w-[18px] overflow-visible",
                current && "drop-shadow-[0_3px_6px_rgba(18,18,18,0.16)]",
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
            </svg>
            {step === 5 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-black/25 bg-[#faf8f2] text-black/65 shadow-[0_2px_6px_rgba(18,18,18,0.14)]">
                <Gift size={9} strokeWidth={2.5} aria-hidden />
              </span>
            )}
          </span>
        );
      })}
    </button>
  );
}

const noShowDepositBankName = "카카오뱅크";
const noShowDepositAccountNumber = "7942-26-95406";
const noShowDepositAccountText = `${noShowDepositBankName} ${noShowDepositAccountNumber}`;
const meetingApplicationPaymentUrl = "https://www.groble.im/payment/PeXqpV";
const kakaoDepositMessageChatUrl = "http://pf.kakao.com/_xnweQn/chat";
const depositMessageSummaryStorageKey =
  "intersection:deposit-message-summary";
const fallbackDepositMessageBaseCount = 66;
const fallbackDepositMessageLimitCount = 100;
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
function isLocalTestHost() {
  if (typeof window === "undefined") return false;

  return ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  );
}

const localDateApplicationsStoragePrefix =
  "intersection:local-date-applications";
const guestDeclinedTicketStorageKey =
  "intersection:guest-declined-ticket-ids";
const initialTicketRecommendationEnabled = false;
const initialRecommendedTicketDate = "2026-08-08";
const initialRecommendedTicketTitle = "향수 공방";
const initialRecommendedTicketHeading = "당신을 위한 티켓이 도착했어요.";

function personalizedTicketHeading(name: string | null | undefined) {
  const displayName = profileGivenName(name);
  if (!displayName) return initialRecommendedTicketHeading;

  return `${displayName}${displayName.endsWith("님") ? "" : "님"}을 위한 티켓을 추천해드릴게요.`;
}

function profileGivenName(name: string | null | undefined) {
  const fullName = name?.trim();
  if (!fullName) return "";

  const compactName = fullName.replace(/\s+/g, "");
  return /^[가-힣]{2,}$/.test(compactName)
    ? Array.from(compactName).slice(1).join("")
    : fullName.split(/\s+/).at(-1) ?? fullName;
}

function ProfileCurationOrbit({
  name,
  mbti,
  preferredActivities,
  recentInterests,
  reducedMotion,
}: {
  name: string | null | undefined;
  mbti: string | null | undefined;
  preferredActivities: string[];
  recentInterests: string[];
  reducedMotion: boolean;
}) {
  const displayName = profileGivenName(name) || "나";
  const orbitTransition = reducedMotion
    ? { duration: 0 }
    : {
        duration: 2.7,
        ease: [0.45, 0, 0.2, 1] as const,
        times: [0, 0.22, 0.9, 1],
      };

  return (
    <motion.div
      key="profile-curation-orbit"
      initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={
        reducedMotion
          ? undefined
          : { opacity: 0, scale: 0.9, filter: "blur(5px)" }
      }
      transition={{ duration: reducedMotion ? 0 : 0.38, ease: "easeOut" }}
      className="relative mx-auto h-[410px] w-full max-w-[360px] overflow-visible"
      data-curation-stage
      aria-label={`${displayName}님의 프로필을 바탕으로 티켓을 고르는 중`}
    >
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[292px] w-[292px] -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: [0, 0.22, 0.14], scale: [0.82, 1.04, 1] }}
          transition={{ duration: reducedMotion ? 0 : 1.1, ease: "easeOut" }}
          className="h-full w-full rounded-full border border-black/20"
        />
      </div>

      <motion.div
        className="absolute inset-x-2 bottom-6 top-[18px]"
        initial={reducedMotion ? false : { rotate: 0 }}
        animate={{ rotate: reducedMotion ? 0 : [0, 0, 360, 360] }}
        transition={orbitTransition}
      >
        <div className="absolute left-1/2 top-1 -translate-x-1/2">
          <motion.div
            initial={reducedMotion ? false : { rotate: 0, scale: 1 }}
            animate={{
              rotate: reducedMotion ? 0 : [0, 0, -360, -360],
              scale: reducedMotion ? 1 : [1, 1, 0.84, 1],
            }}
            transition={orbitTransition}
            className="rounded-full border border-black/12 bg-[#faf8f2] px-5 py-3 text-center shadow-[0_10px_28px_rgba(24,24,20,0.09)]"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-black/34">
              MBTI
            </p>
            <p className="mt-0.5 text-[14px] font-black tracking-[-0.025em] text-black">
              {mbti?.trim().toUpperCase() || "—"}
            </p>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 w-[138px]">
          <motion.div
            initial={reducedMotion ? false : { rotate: 0, scale: 1 }}
            animate={{
              rotate: reducedMotion ? 0 : [0, 0, -360, -360],
              scale: reducedMotion ? 1 : [1, 1, 0.78, 1],
            }}
            transition={orbitTransition}
          >
            <SelectionColumn
              label="선호 활동"
              values={preferredActivities}
              labels={activityLabels}
              icons={activityIcons}
            />
          </motion.div>
        </div>

        <div className="absolute bottom-0 right-0 w-[138px]">
          <motion.div
            initial={reducedMotion ? false : { rotate: 0, scale: 1 }}
            animate={{
              rotate: reducedMotion ? 0 : [0, 0, -360, -360],
              scale: reducedMotion ? 1 : [1, 1, 0.78, 1],
            }}
            transition={orbitTransition}
          >
            <SelectionColumn
              label="최근 관심사"
              values={recentInterests}
              labels={interestLabels}
              icons={interestIcons}
            />
          </motion.div>
        </div>
      </motion.div>

      <div className="absolute left-1/2 top-1/2 h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, scale: 0.72 }}
          animate={{ opacity: 1, scale: [0.72, 1.06, 1] }}
          transition={{
            delay: reducedMotion ? 0 : 0.35,
            duration: reducedMotion ? 0 : 0.68,
            ease: [0.16, 1, 0.3, 1],
          }}
          data-curation-name
          className="flex h-full w-full items-center justify-center rounded-full border border-black/12 bg-[#171714] text-center text-[18px] font-black tracking-[-0.04em] text-[#f7f4ed] shadow-[0_18px_44px_rgba(24,24,20,0.18)]"
        >
          {displayName}
        </motion.div>
      </div>
    </motion.div>
  );
}

function initialRecommendedTicketStorageKey(userId: string) {
  return `intersection:initial-recommended-ticket:v4:${userId || "guest"}`;
}

function loadGuestDeclinedTicketIds() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(guestDeclinedTicketStorageKey) ?? "[]",
    ) as unknown;
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function rememberGuestDeclinedTicket(ticketId: string) {
  try {
    const declinedIds = loadGuestDeclinedTicketIds();
    declinedIds.add(ticketId);
    window.localStorage.setItem(
      guestDeclinedTicketStorageKey,
      JSON.stringify(Array.from(declinedIds)),
    );
  } catch {
    // Guest ticket history is best-effort until sign-in.
  }
}

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

type MeetingRecommendationProps = {
  userId: string;
  profileCompleted?: boolean;
  profileName?: string | null;
  profileMbti?: string | null;
  guestMode?: boolean;
  participationPrecisionCount?: number;
  onOpenParticipationRecord?: () => void;
  onFocusModeChange?: (focused: boolean) => void;
  onAvailableTicketsChange?: (tickets: GatheringTicket[]) => void;
  onTicketInteractionChange?: (interaction: TicketInteraction) => void;
  onOpenDeclinedTicket?: (ticket: GatheringTicket) => void;
  embedded?: boolean;
  active?: boolean;
  membershipStatus: MembershipStatus | null;
  blindDateOffers?: BlindDateUserOffer[];
  onBlindDateOffersChange?: (offers: BlindDateUserOffer[]) => void;
  blindDateOpenRequestId?: number;
  blindDateOpenRequestPending?: boolean;
  onBlindDateOpenRequestHandled?: () => void;
  ticketAcceptRequestId?: number;
  ticketAcceptRequestTicketId?: string | null;
  onTicketAcceptRequestHandled?: () => void;
  onDateApplicationsChange?: (applications: MeetingDateApplication[]) => void;
  forceInitialRecommendationPreview?: boolean;
};

type DateApplicationScreen =
  | "dates"
  | "ticketPreview"
  | "ticket"
  | "purchase"
  | "submitted"
  | "blindDate";
type DateApplicationPurchaseOption = "single" | "membership";

type DateApplicationsResponse = {
  applications?: MeetingDateApplication[];
  totalDepositAmount?: number;
  paymentIntentCreated?: boolean;
  error?: string;
};

type AvailableTicketsResponse = {
  tickets?: GatheringTicket[];
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

async function fetchAvailableTickets() {
  const response = await fetch("/api/meetings/available-tickets", {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | AvailableTicketsResponse
    | null;

  if (!response.ok || !data) {
    throw new Error(data?.error ?? "available-tickets-load-failed");
  }

  return data.tickets ?? [];
}

function DateApplicationOption({
  ticket,
  rejected,
  selected,
  application,
  closed,
  waitlistAvailable,
  disabled,
  onToggle,
  onWaitlist,
}: {
  ticket: GatheringTicket;
  rejected: boolean;
  selected: boolean;
  application: MeetingDateApplication | null;
  closed: boolean;
  waitlistAvailable: boolean;
  disabled: boolean;
  onToggle: () => void;
  onWaitlist: () => void;
}) {
  const schedule = meetingDateSchedule(ticket.date);
  const canResumePayment =
    application?.status === "payment_pending" &&
    application.depositStatus === "payment_pending";
  const canJoinWaitlist = waitlistAvailable && !application;
  const isWaitingForSeat = application?.status === "waitlisted";

  return (
    <motion.button
      type="button"
      data-testid={`meeting-ticket-${ticket.id}`}
      aria-pressed={selected}
      disabled={
        disabled ||
        (closed && !canJoinWaitlist && !canResumePayment && !isWaitingForSeat)
      }
      whileTap={
        !disabled &&
        (!closed || canJoinWaitlist || canResumePayment || isWaitingForSeat)
          ? { scale: 0.98 }
          : undefined
      }
      onClick={canJoinWaitlist ? onWaitlist : onToggle}
      className={cn(
        "relative flex min-h-[96px] w-full min-w-0 items-center gap-3 border-b border-black/[0.07] px-3 py-3 text-left outline-none transition last:border-b-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/20",
        rejected
          ? "bg-black/[0.025] text-black"
          : closed
          ? "bg-black/[0.02] text-black/32"
          : selected
              ? "bg-black/[0.045] text-black"
            : canResumePayment
              ? "bg-amber-50/50 text-black"
            : application
              ? "bg-transparent text-black"
              : "bg-transparent text-black hover:bg-black/[0.025]",
        disabled && "cursor-default",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[17px] border border-black/[0.06] bg-[#f1eee6] shadow-[0_5px_16px_rgba(24,24,20,0.05)]",
        )}
      >
        {ticket.imageUrl && (
          <span
            className={cn(
              "absolute inset-0 bg-cover",
              closed && "grayscale opacity-55",
            )}
            style={{
              backgroundImage: `url(${ticket.imageUrl})`,
              backgroundPosition: "center",
            }}
          />
        )}
        {closed && (
          <span className="relative z-10 rounded-full bg-black/82 px-2.5 py-1.5 text-[10px] font-black tracking-[-0.02em] text-white shadow-sm">
            마감
          </span>
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1",
          canJoinWaitlist ? "pr-[108px]" : "pr-20",
        )}
      >
        <span className="block text-[12px] font-extrabold leading-5 tracking-[-0.025em] text-black/72">
          {schedule
            ? `${schedule.month}월 ${schedule.day}일 ${schedule.weekdayLabel}`
            : ticket.date}
        </span>
        <span className="mt-0.5 block truncate text-[15px] font-black leading-5 tracking-[-0.035em] text-black">
          {ticket.title}
        </span>
        <span
          className={cn(
            "block font-bold tracking-[-0.035em] text-black",
            "mt-1 text-[13px] leading-5 text-black/58",
          )}
        >
          {schedule?.timeLabel ?? ticket.time} · {application?.region || ticket.area}
        </span>
      </span>
      {rejected ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-black/12 bg-black/[0.04] px-2.5 py-1.5 text-[11px] font-black text-black/48">
          거절함
        </span>
      ) : closed || application ? (
        canJoinWaitlist ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-black/15 bg-[#faf8f2] px-2.5 py-2 text-[11px] font-black text-black/68 shadow-sm">
            빈 자리 대기하기
          </span>
        ) : (
          <span
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium",
              closed
                ? "text-black/28"
                : canResumePayment
                  ? "text-amber-700"
                  : "text-black/44",
            )}
          >
            {application
              ? isWaitingForSeat
                ? "빈 자리 대기 중"
                : canResumePayment
                  ? "결제 대기"
                  : "신청 완료"
              : "마감"}
          </span>
        )
      ) : (
        <span
          className={cn(
            "absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center",
            selected
              ? "text-black"
              : "text-black/48",
          )}
        >
          {selected ? (
            <Check size={16} strokeWidth={2.4} aria-hidden />
          ) : (
            <ChevronRight size={20} strokeWidth={1.8} aria-hidden />
          )}
        </span>
      )}
    </motion.button>
  );
}

export function MeetingRecommendation(props: MeetingRecommendationProps) {
  return <MeetingDateApplicationFlow {...props} />;
}

function MeetingDateApplicationFlow({
  userId,
  profileCompleted = true,
  profileName = null,
  profileMbti = null,
  guestMode = false,
  participationPrecisionCount = 0,
  onOpenParticipationRecord = () => undefined,
  onFocusModeChange,
  onAvailableTicketsChange,
  onTicketInteractionChange,
  onOpenDeclinedTicket,
  embedded = false,
  active = true,
  membershipStatus,
  blindDateOffers = [],
  onBlindDateOffersChange,
  blindDateOpenRequestId = 0,
  blindDateOpenRequestPending = false,
  onBlindDateOpenRequestHandled,
  ticketAcceptRequestId = 0,
  ticketAcceptRequestTicketId = null,
  onTicketAcceptRequestHandled,
  onDateApplicationsChange,
  forceInitialRecommendationPreview = false,
}: MeetingRecommendationProps) {
  const searchParams = useSearchParams();
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [screen, setScreen] = useState<DateApplicationScreen>("dates");
  const [applications, setApplications] = useState<MeetingDateApplication[]>([]);
  const [availableTickets, setAvailableTickets] = useState<GatheringTicket[]>([]);
  const [availableTicketsLoading, setAvailableTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<GatheringTicket | null>(
    null,
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [purchaseOption, setPurchaseOption] =
    useState<DateApplicationPurchaseOption>("single");
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
  const [ticketPreviewMotionKey, setTicketPreviewMotionKey] = useState(0);
  const [ticketPreviewImageVisible, setTicketPreviewImageVisible] =
    useState(false);
  const [ticketPreviewHeadingText, setTicketPreviewHeadingText] = useState("");
  const [ticketPreviewHeadingComplete, setTicketPreviewHeadingComplete] =
    useState(false);
  const [ticketPreviewCurationComplete, setTicketPreviewCurationComplete] =
    useState(false);
  const [waitlistDialog, setWaitlistDialog] = useState<"success" | null>(null);
  const [localPreviewControlsVisible, setLocalPreviewControlsVisible] =
    useState(false);
  const [invitationClockMs, setInvitationClockMs] = useState(() => Date.now());
  const [invitationDrawKey, setInvitationDrawKey] = useState(0);
  const initialRecommendationHandledRef = useRef(false);
  const invitationWasActiveRef = useRef(active);

  const recordTicketInteraction = async (
    ticket: GatheringTicket,
    status: TicketInteractionStatus,
  ) => {
    if (guestMode) {
      const interaction = saveGuestTicketInteraction(ticket, status);
      onTicketInteractionChange?.(interaction);
      return interaction;
    }

    return fetch("/api/meetings/ticket-interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketInstanceId: ticket.id, status }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as {
          interactions?: TicketInteraction[];
        } | null;
      })
      .then((data) => {
        const interaction = data?.interactions?.find(
          (row) => row.ticket.id === ticket.id,
        );
        if (interaction) onTicketInteractionChange?.(interaction);
        return interaction ?? null;
      })
      .catch(() => null);
  };

  const today = todayInKst();
  const saturdayDate = upcomingSaturdayDate(today);
  const saturdayTicket =
    availableTickets.find(
      (ticket) => ticket.date === saturdayDate && !ticket.rejected,
    ) ?? null;
  const saturdayTicketWasDeclined = availableTickets.some(
    (ticket) => ticket.date === saturdayDate && ticket.rejected,
  );
  const forceInvitationCountdownPreview =
    forceInitialRecommendationPreview &&
    searchParams.get("countdownPreview") === "1";
  const declinedInvitationTicket =
    availableTickets.find(
      (ticket) => ticket.date === saturdayDate && ticket.rejected,
    ) ?? (forceInvitationCountdownPreview ? saturdayTicket : null);
  const weeklyInvitationTicket = forceInvitationCountdownPreview
    ? null
    : saturdayTicket;
  const showInvitationCountdown =
    forceInvitationCountdownPreview || saturdayTicketWasDeclined;
  const nextInvitationOpeningAt = nextFridayOpeningAt(invitationClockMs);
  const invitationCountdownMs = Math.max(
    0,
    nextInvitationOpeningAt - invitationClockMs,
  );
  const invitationCountdownDays = Math.floor(invitationCountdownMs / dayMs);
  const invitationCountdownHours = Math.floor(
    (invitationCountdownMs % dayMs) / (60 * 60 * 1000),
  );
  const invitationCountdownMinutes = Math.floor(
    (invitationCountdownMs % (60 * 60 * 1000)) / (60 * 1000),
  );
  const invitationCountdownSeconds = Math.floor(
    (invitationCountdownMs % (60 * 1000)) / 1000,
  );
  const nextInvitationOpeningLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(nextInvitationOpeningAt));
  const applicationByDate = new Map(
    applications.map((application) => [application.meetingDate, application]),
  );
  const resumeDate = searchParams.get("resumeDate");
  const ticketPreviewHeading = profileCompleted
    ? personalizedTicketHeading(profileName)
    : initialRecommendedTicketHeading;
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

  const focusMode = screen === "ticket" || screen === "purchase";

  useEffect(() => {
    onFocusModeChange?.(focusMode);
    return () => onFocusModeChange?.(false);
  }, [focusMode, onFocusModeChange]);

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
    if (guestMode) return;
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
  }, [active, guestMode, userId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (alive) setAvailableTicketsLoading(true);
      try {
        const fetchedTickets = await fetchAvailableTickets();
        if (!alive) return;
        const guestDeclinedIds = guestMode
          ? loadGuestDeclinedTicketIds()
          : new Set<string>();
        const tickets = fetchedTickets.map((ticket) =>
          guestDeclinedIds.has(ticket.id)
            ? { ...ticket, rejected: true }
            : ticket,
        );
        setAvailableTickets(tickets);
        onAvailableTicketsChange?.(tickets);
      } catch (loadError) {
        if (!alive) return;
        setError(
          loadError instanceof Error &&
            loadError.message !== "available-tickets-load-failed"
            ? loadError.message
            : "티켓을 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
        );
      } finally {
        if (alive) setAvailableTicketsLoading(false);
      }
    };

    void load();
    if (active) window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, [active, guestMode, onAvailableTicketsChange]);

  useEffect(() => {
    if (
      !profileCompleted ||
      !resumeDate ||
      isMeetingDateClosed(resumeDate) ||
      !meetingDateApplicationDates(today).includes(resumeDate)
    ) {
      return;
    }

    const resumeTicket = availableTickets.find(
      (ticket) => ticket.date === resumeDate,
    );
    if (!resumeTicket) return;

    setSelectedDates([resumeDate]);
    setSelectedTicket(resumeTicket);
    setPurchaseOption("single");
    setError(null);
    setScreen("purchase");
  }, [availableTickets, profileCompleted, resumeDate, today]);

  useEffect(() => {
    onDateApplicationsChange?.(applications);
  }, [applications, onDateApplicationsChange]);

  useEffect(() => {
    setLocalPreviewControlsVisible(isLocalTestHost());
  }, []);

  useEffect(() => {
    if (active && !invitationWasActiveRef.current) {
      setInvitationDrawKey((current) => current + 1);
    }
    invitationWasActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setInvitationClockMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== "ticketPreview" || !selectedTicket) return;

    if (shouldReduceMotion) {
      setTicketPreviewHeadingText(ticketPreviewHeading);
      setTicketPreviewHeadingComplete(true);
      return;
    }

    const characters = Array.from(ticketPreviewHeading);
    let index = 0;
    setTicketPreviewHeadingText("");
    setTicketPreviewHeadingComplete(false);

    const timer = window.setInterval(() => {
      index += 1;
      setTicketPreviewHeadingText(characters.slice(0, index).join(""));

      if (index >= characters.length) {
        window.clearInterval(timer);
        setTicketPreviewHeadingComplete(true);
      }
    }, 58);

    return () => window.clearInterval(timer);
  }, [
    screen,
    selectedTicket?.id,
    shouldReduceMotion,
    ticketPreviewMotionKey,
    ticketPreviewHeading,
  ]);

  useEffect(() => {
    if (
      screen !== "ticketPreview" ||
      !selectedTicket ||
      !ticketPreviewHeadingComplete
    ) {
      setTicketPreviewCurationComplete(false);
      return;
    }

    if (!profileCompleted || shouldReduceMotion) {
      setTicketPreviewCurationComplete(true);
      return;
    }

    setTicketPreviewCurationComplete(false);
    const timer = window.setTimeout(() => {
      setTicketPreviewCurationComplete(true);
    }, 3300);

    return () => window.clearTimeout(timer);
  }, [
    profileCompleted,
    screen,
    selectedTicket,
    shouldReduceMotion,
    ticketPreviewHeadingComplete,
    ticketPreviewMotionKey,
  ]);

  useEffect(() => {
    if (
      screen !== "ticketPreview" ||
      !selectedTicket ||
      !ticketPreviewHeadingComplete ||
      !ticketPreviewCurationComplete
    ) {
      setTicketPreviewImageVisible(false);
      return;
    }

    setTicketPreviewImageVisible(shouldReduceMotion);
    if (shouldReduceMotion) return;

    const timer = window.setTimeout(() => {
      setTicketPreviewImageVisible(true);
    }, 720);

    return () => window.clearTimeout(timer);
  }, [
    screen,
    selectedTicket,
    shouldReduceMotion,
    ticketPreviewCurationComplete,
    ticketPreviewHeadingComplete,
    ticketPreviewMotionKey,
  ]);

  useEffect(() => {
    if (
      (!initialTicketRecommendationEnabled &&
        !forceInitialRecommendationPreview) ||
      !active ||
      availableTicketsLoading ||
      screen !== "dates" ||
      resumeDate ||
      ticketAcceptRequestId ||
      initialRecommendationHandledRef.current
    ) {
      return;
    }

    const perfumeWorkshopTicket = availableTickets.find(
      (ticket) =>
        ticket.date === initialRecommendedTicketDate &&
        ticket.title.includes(initialRecommendedTicketTitle),
    );
    const recommendedTicket = perfumeWorkshopTicket;
    if (!recommendedTicket) return;

    initialRecommendationHandledRef.current = true;
    const storageKey = initialRecommendedTicketStorageKey(userId);

    if (!forceInitialRecommendationPreview) {
      try {
        if (window.localStorage.getItem(storageKey) === "shown") return;
      } catch {
        // The recommendation still opens when browser storage is unavailable.
      }
    }

    setPurchaseOption("single");
    setSelectedTicket(recommendedTicket);
    setError(null);
    setScreen("ticketPreview");
    trackEvent("meeting_ticket_initial_recommendation_open", {
      ticket_instance_id: recommendedTicket.id,
      meeting_date: recommendedTicket.date,
    });
  }, [
    active,
    availableTickets,
    availableTicketsLoading,
    resumeDate,
    screen,
    ticketAcceptRequestId,
    userId,
    forceInitialRecommendationPreview,
    profileCompleted,
  ]);

  const completeInitialTicketRecommendation = () => {
    try {
      window.localStorage.setItem(
        initialRecommendedTicketStorageKey(userId),
        "shown",
      );
    } catch {
      // First recommendation history is best-effort when storage is unavailable.
    }
  };

  const openInitialTicketDetail = (ticket: GatheringTicket) => {
    completeInitialTicketRecommendation();
    recordTicketInteraction(ticket, "open");
    setScreen("ticket");
    trackEvent("meeting_ticket_initial_recommendation_select", {
      ticket_instance_id: ticket.id,
      meeting_date: ticket.date,
    });
  };

  const toggleDate = (date: string) => {
    const application = applicationByDate.get(date);
    const canResumePayment =
      application?.status === "payment_pending" &&
      application.depositStatus === "payment_pending";
    if (date < today || (application && !canResumePayment) || saving) return;
    setSelectedDates((current) => {
      if (current.includes(date)) return [];
      trackEvent("application_date_selected", {
        application_type: "meeting_date",
        meeting_date: date,
      });
      return [date];
    });
    setError(null);
  };

  const openTicket = (ticket: GatheringTicket) => {
    if (saving) return;
    recordTicketInteraction(ticket, "open");
    setPurchaseOption("single");
    setSelectedTicket(ticket);
    setError(null);
    setScreen("ticket");
    trackEvent("meeting_ticket_detail_open", {
      ticket_instance_id: ticket.id,
      meeting_date: ticket.date,
    });
  };

  const acceptTicket = (ticket: GatheringTicket) => {
    if (saving) return;

    recordTicketInteraction(ticket, "yes");
    setPurchaseOption("single");
    setError(null);

    setScreen("purchase");
  };

  useEffect(() => {
    if (!ticketAcceptRequestId || !ticketAcceptRequestTicketId) return;
    const ticket = availableTickets.find(
      (item) => item.id === ticketAcceptRequestTicketId,
    );
    if (!ticket) return;

    setSelectedTicket(ticket);
    setPurchaseOption("single");
    setError(null);
    recordTicketInteraction(ticket, "yes");

    setScreen("purchase");

    onTicketAcceptRequestHandled?.();
  }, [
    availableTickets,
    onTicketAcceptRequestHandled,
    ticketAcceptRequestId,
    ticketAcceptRequestTicketId,
  ]);

  const declineTicket = async (ticket: GatheringTicket) => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      if (guestMode) {
        recordTicketInteraction(ticket, "no");
        rememberGuestDeclinedTicket(ticket.id);
        setAvailableTickets((current) => {
          const next = current.map((item) =>
            item.id === ticket.id ? { ...item, rejected: true } : item,
          );
          onAvailableTicketsChange?.(next);
          return next;
        });
        setSelectedTicket(null);
        setScreen("dates");
        trackEvent("meeting_ticket_response", {
          ticket_instance_id: ticket.id,
          meeting_date: ticket.date,
          response: "no",
          guest_mode: true,
        });
        return;
      }

      const response = await fetch("/api/meetings/available-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "no",
          ticketInstanceId: ticket.id,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { rejected?: boolean; error?: string }
        | null;
      if (!response.ok || !data?.rejected) {
        throw new Error(data?.error ?? "ticket-rejection-save-failed");
      }

      recordTicketInteraction(ticket, "no");

      setAvailableTickets((current) => {
        const next = current.map((item) =>
          item.id === ticket.id ? { ...item, rejected: true } : item,
        );
        onAvailableTicketsChange?.(next);
        return next;
      });
      setSelectedTicket(null);
      setScreen("dates");
      trackEvent("meeting_ticket_response", {
        ticket_instance_id: ticket.id,
        meeting_date: ticket.date,
        response: "no",
      });
    } catch (declineError) {
      setError(
        declineError instanceof Error &&
          declineError.message !== "ticket-rejection-save-failed"
          ? declineError.message
          : "선택을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSaving(false);
    }
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

  const selectedApplication =
    selectedDates.length === 1
      ? applicationByDate.get(selectedDates[0]) ?? null
      : null;
  const isResumingPayment =
    selectedApplication?.status === "payment_pending" &&
    selectedApplication.depositStatus === "payment_pending";

  const submitDateApplications = async (
    openStoreAfterSave = false,
    ticket: GatheringTicket | null = null,
  ) => {
    const targetDates = ticket ? [ticket.date] : [...selectedDates];
    if (targetDates.length !== 1 || saving) return;

    setSaving(true);
    setError(null);
    setDepositCopyError(null);
    trackEvent("application_submit_click", {
      application_type: "meeting_date",
      date_count: targetDates.length,
      deposit_amount: targetDates.length * MEETING_DATE_DEPOSIT_AMOUNT,
      membership_status: membershipStatus,
    });

    if (purchaseOption === "membership") {
      try {
        if (!isLocalTestHost()) {
          const applicationResponse = await fetch(
            "/api/meeting-date-applications",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dates: targetDates,
                openPayment: false,
                ticketInstanceId: ticket?.id,
              }),
            },
          );
          const applicationData = (await applicationResponse
            .json()
            .catch(() => null)) as DateApplicationsResponse | null;
          if (!applicationResponse.ok || !applicationData?.applications) {
            throw new Error(
              applicationData?.error ?? "date-applications-save-failed",
            );
          }

          const membershipResponse = await fetch(
            "/api/membership/purchase-click",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: "one_month" }),
            },
          );
          const membershipData = (await membershipResponse
            .json()
            .catch(() => null)) as { error?: string } | null;
          if (!membershipResponse.ok) {
            throw new Error(
              membershipData?.error ?? "membership-purchase-save-failed",
            );
          }

          setApplications((current) => {
            const next = new Map(
              [...current, ...applicationData.applications!].map(
                (application) => [application.meetingDate, application],
              ),
            );
            return Array.from(next.values()).sort((left, right) =>
              left.meetingDate.localeCompare(right.meetingDate),
            );
          });
        }

        trackEvent("application_created", {
          application_type: "meeting_date",
          date_count: targetDates.length,
          deposit_amount: 0,
          payment_option: "one_month_membership",
        });
        trackEvent("invitation_yes", {
          ticket_instance_id: ticket?.id,
          meeting_date: ticket?.date ?? targetDates[0],
          payment_option: "one_month_membership",
        });
        trackEvent("membership_purchase_click", {
          plan: "one_month",
          months: 1,
          application_type: "meeting_date",
          meeting_date: targetDates[0],
        });
        window.location.assign(membershipStoreUrls.one_month);
      } catch (membershipPurchaseError) {
        const message =
          membershipPurchaseError instanceof Error &&
          ![
            "date-applications-save-failed",
            "membership-purchase-save-failed",
          ].includes(membershipPurchaseError.message)
            ? membershipPurchaseError.message
            : "멤버십 결제를 준비하지 못했어요. 잠시 후 다시 시도해주세요.";
        setError(message);
        setDepositCopyError(message);
        setSaving(false);
      }
      return;
    }

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
          ...(ticket ? { assignedTicketInstanceId: ticket.id } : {}),
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
        trackEvent("payment_page_open", {
          application_type: "meeting_date",
          payment_provider: "groble",
          date_count: targetDates.length,
        });
        if (ticket) {
          await recordTicketInteraction(ticket, "payment_pending");
          trackEvent("meeting_ticket_response", {
            ticket_instance_id: ticket.id,
            meeting_date: ticket.date,
            response: "yes",
          });
        }
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
        body: JSON.stringify({
          dates: targetDates,
          openPayment: openStoreAfterSave,
          ticketInstanceId: ticket?.id,
        }),
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
      trackEvent("invitation_yes", {
        ticket_instance_id: ticket?.id,
        meeting_date: ticket?.date ?? targetDates[0],
        payment_option: openStoreAfterSave ? "payment" : "deposit_message",
      });
      if (openStoreAfterSave) {
        if (!data.paymentIntentCreated) {
          throw new Error("date-applications-save-failed");
        }
        trackEvent("payment_page_open", {
          application_type: "meeting_date",
          payment_provider: "groble",
          date_count: targetDates.length,
        });
        if (ticket) {
          await recordTicketInteraction(ticket, "payment_pending");
          trackEvent("meeting_ticket_response", {
            ticket_instance_id: ticket.id,
            meeting_date: ticket.date,
            response: "yes",
          });
        }
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

  const joinClosedDateWaitlist = async (date: string) => {
    const existingApplication = applicationByDate.get(date);
    if (existingApplication) {
      return existingApplication.status === "waitlisted";
    }
    if (saving || !isMeetingDateClosed(date)) {
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      let waitlistApplications: MeetingDateApplication[];

      if (isLocalTestHost()) {
        const now = new Date().toISOString();
        waitlistApplications = [
          {
            id: `local-waitlist:${date}`,
            meetingDate: date,
            meetingTime: meetingDateSchedule(date)?.time ?? "",
            region: MEETING_DATE_REGION,
            status: "waitlisted",
            depositAmount: 0,
            depositStatus: "payment_pending",
            assignedTicketInstanceId: null,
            createdAt: now,
          },
        ];
      } else {
        const response = await fetch("/api/meeting-date-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: [date], waitlist: true }),
        });
        const data = (await response.json().catch(() => null)) as
          | DateApplicationsResponse
          | null;
        if (!response.ok || !data?.applications) {
          throw new Error(data?.error ?? "waitlist-save-failed");
        }
        waitlistApplications = data.applications;
      }

      setApplications((current) => {
        const nextApplications = mergeDateApplications(
          current,
          waitlistApplications,
        );
        saveLocalDateApplications(userId, nextApplications);
        return nextApplications;
      });
      trackEvent("application_created", {
        application_type: "closed_date_waitlist",
        meeting_date: date,
        deposit_amount: 0,
      });
      return true;
    } catch (waitlistError) {
      setError(
        waitlistError instanceof Error &&
          waitlistError.message !== "waitlist-save-failed"
          ? waitlistError.message
          : "빈 자리 대기를 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (screen === "ticketPreview" && selectedTicket) {
    return (
      <motion.section
        key={`meeting-ticket-preview-${selectedTicket.id}`}
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className={cn(
          "flex min-h-full flex-col bg-[#f7f4ed] px-5 pb-[calc(94px+env(safe-area-inset-bottom))] pt-7 text-black",
          embedded ? "min-h-[calc(100dvh-16px)]" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
        )}
      >
        <header className="relative shrink-0 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/38">
            first invitation
          </p>
          <h1
            aria-label={ticketPreviewHeading}
            className="mt-2 min-h-7 text-[22px] font-black tracking-[-0.045em] text-black"
          >
            <span aria-hidden>{ticketPreviewHeadingText}</span>
            {!ticketPreviewHeadingComplete && (
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.72, repeat: Infinity, ease: "linear" }}
                className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[1px] bg-black"
              />
            )}
          </h1>
          {localPreviewControlsVisible && (
            <motion.button
              type="button"
              title="애니메이션 다시 보기"
              aria-label="애니메이션 다시 보기"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
              onClick={() => {
                setTicketPreviewImageVisible(false);
                setTicketPreviewHeadingText("");
                setTicketPreviewHeadingComplete(false);
                setTicketPreviewMotionKey((current) => current + 1);
              }}
              className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-[#faf8f2] text-black/55 shadow-sm transition hover:text-black"
            >
              <RefreshCw size={17} strokeWidth={1.8} aria-hidden />
            </motion.button>
          )}
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-5">
          <AnimatePresence mode="wait">
            {ticketPreviewHeadingComplete && !ticketPreviewCurationComplete ? (
              <ProfileCurationOrbit
                name={profileName}
                mbti={profileMbti}
                preferredActivities={[]}
                recentInterests={[]}
                reducedMotion={shouldReduceMotion}
              />
            ) : ticketPreviewHeadingComplete ? (
              <motion.div
                key={`initial-ticket-stage-${selectedTicket.id}-${ticketPreviewMotionKey}`}
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="w-full"
              >
                <motion.button
                  type="button"
                  aria-label={`${selectedTicket.title} 추천 이유 확인하기`}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  onClick={() => openInitialTicketDetail(selectedTicket)}
                  className="relative w-full rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-4"
                >
                  <TicketDrawingFrame
                    motionKey={`initial-recommendation-${selectedTicket.id}-${ticketPreviewMotionKey}`}
                    title={selectedTicket.title}
                    imageUrl={selectedTicket.imageUrl}
                    imageUrls={ticketBackgroundImageUrls(selectedTicket)}
                    date={selectedTicket.date}
                    time={selectedTicket.time}
                    location={`서울\n${selectedTicket.area}`}
                    tags={selectedTicket.moodTags}
                    remainingSeatCount={selectedTicket.remainingSeatCount}
                    drawn
                    imageVisible={ticketPreviewImageVisible}
                    contentVisible={ticketPreviewImageVisible}
                    reducedMotion={shouldReduceMotion}
                    className="!w-full"
                    cardClassName="!bg-transparent"
                  />
                  {ticketPreviewImageVisible && (
                    <span className="absolute left-1/2 top-7 z-20 h-12 w-[calc(100%-40px)] max-w-[290px] -translate-x-1/2">
                      <motion.span
                        initial={
                          shouldReduceMotion
                            ? false
                            : { opacity: 0, y: -10, scale: 0.97 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          delay: shouldReduceMotion ? 0 : 0.72,
                          duration: shouldReduceMotion ? 0 : 0.38,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="flex h-full w-full items-center justify-center rounded-[18px] bg-black text-[13px] font-black tracking-[-0.025em] text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                      >
                        추천 이유 확인하기&nbsp;&nbsp;→
                      </motion.span>
                    </span>
                  )}
                </motion.button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.section>
    );
  }

  if (screen === "ticket" && selectedTicket) {
    const selectedTicketClosed =
      selectedTicket.date < today || isMeetingDateClosed(selectedTicket.date);

    return (
      <motion.section
        key={`meeting-ticket-detail-${selectedTicket.id}`}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={ticketFadeTransition}
        className={cn(
          "min-h-full bg-[#f7f4ed] px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-7",
          embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (saving) return;
            setSelectedTicket(null);
            setScreen("dates");
            setError(null);
          }}
          disabled={saving}
          className="mb-4 flex h-10 items-center gap-1.5 rounded-full border border-black/10 bg-[#faf8f2] px-3 text-xs font-black text-black/60 shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          <ChevronLeft size={17} aria-hidden />
          이전으로
        </button>

        <div className="relative overflow-hidden border border-black/[0.11] bg-[#f8f4eb] shadow-[0_24px_70px_rgba(39,34,24,0.12)] before:pointer-events-none before:absolute before:inset-2 before:z-30 before:border before:border-black/[0.055]">
          <TicketDetailHero
            ticket={selectedTicket}
            backgroundImageUrls={selectedTicket.imageUrl ? undefined : []}
          />
          <TicketDetailContent
            ticket={selectedTicket}
            sections={[
              "summary",
              "recommendation",
              "course",
            ]}
            className="px-5 pb-5"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
            {error}
          </p>
        )}

        {selectedTicketClosed ? (
          <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] h-[68px] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
            <motion.button
              type="button"
              whileTap={!saving ? { scale: 0.98 } : undefined}
              disabled={saving}
              onClick={() => {
                void (async () => {
                  const joined = await joinClosedDateWaitlist(selectedTicket.date);
                  if (joined) setWaitlistDialog("success");
                })();
              }}
              className="flex h-[56px] w-full items-center justify-center rounded-full bg-black text-[15px] font-black tracking-[-0.02em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] disabled:bg-black/20"
            >
              {saving ? "알림 신청 중..." : "알림 받기"}
            </motion.button>
          </div>
        ) : (
          <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] grid h-[68px] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 grid-cols-[0.72fr_2.1fr] items-center gap-2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
            <motion.button
              type="button"
              whileTap={!saving ? { scale: 0.98 } : undefined}
              disabled={saving}
              onClick={() => void declineTicket(selectedTicket)}
              className="flex h-[56px] items-center justify-center rounded-full bg-transparent text-[15px] font-black tracking-[0.04em] text-black/42 disabled:opacity-40"
            >
              NO
            </motion.button>
            <motion.button
              type="button"
              whileTap={!saving ? { scale: 0.98 } : undefined}
              disabled={saving}
              onClick={() => acceptTicket(selectedTicket)}
              className="font-ticket-latin flex h-[56px] items-center justify-center rounded-full bg-black text-[18px] font-bold italic tracking-[0.08em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] disabled:bg-black/20"
            >
              YES
            </motion.button>
          </div>
        )}

        <AnimatePresence>
          {waitlistDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-5 backdrop-blur-[3px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="waitlist-dialog-title"
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[350px] rounded-[28px] border border-black/10 bg-[#f7f4ed] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.2)]"
              >
                <h2
                  id="waitlist-dialog-title"
                  className="text-[20px] font-black tracking-[-0.04em] text-black"
                >
                  알림 신청이 완료됐어요.
                </h2>
                <p className="mt-3 break-keep text-[13px] font-semibold leading-6 text-black/50">
                  빈자리가 생기면 알림을 보내드릴게요.
                </p>

                <button
                  type="button"
                  onClick={() => setWaitlistDialog(null)}
                  className="mt-6 h-12 w-full rounded-full bg-black text-[13px] font-black text-white"
                >
                  확인
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    );
  }

  if (screen === "purchase" && selectedTicket) {
    const singleSelected = purchaseOption === "single";

    return (
      <motion.section
        key={`meeting-ticket-purchase-${selectedTicket.id}`}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={ticketFadeTransition}
        className={cn(
          "min-h-full bg-[#f7f4ed] px-5 pb-32 pt-7",
          embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (saving) return;
            setError(null);
            setScreen("ticket");
          }}
          disabled={saving}
          className="flex h-10 items-center gap-1.5 rounded-full border border-black/10 bg-[#faf8f2] px-3 text-xs font-black text-black/60 shadow-sm disabled:opacity-40"
        >
          <ChevronLeft size={17} aria-hidden />
          경험으로
        </button>

        <header className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/34">
            READY TO APPLY
          </p>
          <h1 className="mt-2 text-[28px] font-black leading-[1.18] tracking-[-0.055em] text-black">
            참여 방식을
            <br />
            선택해주세요.
          </h1>
          <p className="mt-3 text-[13px] font-medium leading-5 text-black/48">
            결제 방식을 선택한 다음 신청을 완료할 수 있어요.
          </p>
        </header>

        <div className="mt-6 rounded-[22px] border border-black/[0.08] bg-[#faf8f2] px-4 py-4">
          <p className="text-[11px] font-bold text-black/42">
            {meetingDateLabel(selectedTicket.date)}
          </p>
          <h2 className="mt-1 text-[18px] font-black tracking-[-0.04em] text-black">
            {selectedTicket.title}
          </h2>
          <p className="mt-1 text-[12px] font-semibold text-black/48">
            {meetingDateSchedule(selectedTicket.date)?.timeLabel ??
              selectedTicket.time} · {selectedTicket.area}
          </p>
        </div>

        <div className="mt-7 space-y-2.5">
          <button
            type="button"
            aria-pressed={singleSelected}
            onClick={() => setPurchaseOption("single")}
            className={cn(
              "relative flex min-h-[88px] w-full items-center justify-between gap-4 rounded-[20px] border px-4 py-4 text-left transition",
              singleSelected
                ? "border-black bg-black/[0.035] shadow-[inset_0_0_0_1px_#111]"
                : "border-black/10 bg-[#faf8f2] hover:border-black/25",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  singleSelected
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-[#f1eee6] text-transparent",
                )}
              >
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-black text-black">
                  1회권 결제
                </span>
                <span className="mt-1 block text-[11px] font-medium text-black/46">
                  이번 경험에 한 번 참여해요
                </span>
              </span>
            </span>
            <strong className="whitespace-nowrap text-[20px] font-black tracking-[-0.045em] text-black">
              10,000원
            </strong>
          </button>

          <button
            type="button"
            aria-pressed={!singleSelected}
            onClick={() => setPurchaseOption("membership")}
            className={cn(
              "relative flex min-h-[112px] w-full items-start justify-between gap-3 rounded-[20px] border px-4 py-4 text-left transition",
              !singleSelected
                ? "border-black bg-black/[0.035] shadow-[inset_0_0_0_1px_#111]"
                : "border-black/10 bg-[#faf8f2] hover:border-black/25",
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  !singleSelected
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-[#f1eee6] text-transparent",
                )}
              >
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-black text-black">
                    1개월 멤버십
                  </span>
                  <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-bold text-white">
                    추천
                  </span>
                </span>
                <span className="mt-2 block text-[11px] font-medium leading-[1.55] text-black/46">
                  30일 동안 참여 횟수와 관계없이
                  <br />
                  모임 참가비가 면제돼요
                </span>
              </span>
            </span>
            <strong className="whitespace-nowrap pt-0.5 text-[20px] font-black tracking-[-0.045em] text-black">
              20,000원
            </strong>
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
            {error}
          </p>
        )}

        <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
          <motion.button
            type="button"
            whileTap={!saving ? { scale: 0.985 } : undefined}
            disabled={saving}
            onClick={() => void submitDateApplications(true, selectedTicket)}
            className="flex h-[56px] w-full items-center justify-center rounded-full bg-black px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)] disabled:bg-black/20"
          >
            {saving
              ? "결제창을 준비하는 중..."
              : singleSelected
                ? "10,000원 결제하기"
                : "20,000원 결제하고 멤버십 시작하기"}
          </motion.button>
        </div>
      </motion.section>
    );
  }

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
        "flex min-h-full flex-col bg-[#f7f4ed] px-5 pb-8 pt-7",
        embedded ? "h-full min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {screen === "submitted" ? (
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
              onClick={() => setScreen("ticket")}
              className="mt-7 h-[52px] w-full bg-black text-sm font-black text-white"
            >
              이번 주 티켓 확인하기
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="date-options"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="hidden">
            <div className="rounded-[26px] border border-black/10 bg-[#f1eee6] p-2.5 shadow-[0_18px_42px_rgba(39,33,24,0.04)]">
              <div className="flex h-14 items-center gap-3 px-3">
                <h1 className="flex-1 text-[18px] font-bold tracking-[-0.035em] text-black">
                  경험을 선택하세요.
                </h1>
                <CompactParticipationRecord
                  count={participationPrecisionCount}
                  onOpen={onOpenParticipationRecord}
                />
              </div>

              <div className="overflow-hidden rounded-[21px] border border-black/[0.07] bg-[#faf8f2]">
                {availableTickets.map((ticket) => (
                  <DateApplicationOption
                    key={ticket.id}
                    ticket={ticket}
                    rejected={Boolean(ticket.rejected)}
                    selected={false}
                    application={applicationByDate.get(ticket.date) ?? null}
                    closed={
                      ticket.date < today || isMeetingDateClosed(ticket.date)
                    }
                    waitlistAvailable={isMeetingDateClosed(ticket.date)}
                    disabled={saving}
                    onToggle={() => openTicket(ticket)}
                    onWaitlist={() => openTicket(ticket)}
                  />
                ))}
                {availableTicketsLoading && (
                  <div className="flex min-h-28 items-center justify-center gap-2 text-xs font-bold text-black/38">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-black/55" />
                    티켓을 불러오는 중...
                  </div>
                )}
                {!availableTicketsLoading && availableTickets.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm font-semibold leading-6 text-black/42">
                    지금 확인할 수 있는 티켓이 없어요.
                  </p>
                )}
              </div>
            </div>

            <div className="hidden">
            <header className="pr-12">
              <h1 className="whitespace-nowrap text-[28px] font-extrabold leading-9 tracking-[-0.05em] text-black">
                가능한 날짜를 골라주세요.
              </h1>
              <p className="mt-3 text-[13px] font-medium leading-5 text-black/48">
                문답을 바탕으로 잘 맞는 사람과 활동을 준비해드려요.
              </p>
            </header>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="min-h-[104px] rounded-[18px] border border-black/[0.06] bg-black/[0.035] p-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-black shadow-[0_3px_8px_rgba(0,0,0,0.05)]">
                  <span className="text-[15px] leading-none" aria-hidden>
                    👥
                  </span>
                </span>
                <p className="mt-3 text-[12px] font-bold leading-[1.45] text-black">
                  대화가 잘 맞는
                  <br />
                  사람들로 구성해요
                </p>
              </div>
              <div className="min-h-[104px] rounded-[18px] border border-black/[0.06] bg-black/[0.035] p-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-black shadow-[0_3px_8px_rgba(0,0,0,0.05)]">
                  <span className="text-[15px] leading-none" aria-hidden>
                    📍
                  </span>
                </span>
                <p className="mt-3 text-[12px] font-bold leading-[1.45] text-black">
                  장소와 활동은
                  <br />
                  24시간 전에 공개해요
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-3">
              <h2 className="text-[18px] font-bold tracking-[-0.04em] text-black">
                참여 가능한 날짜
              </h2>
              <span className="pb-0.5 text-[10px] font-medium text-black/38">
                1개를 선택해주세요
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 overflow-hidden">
              {availableTickets.map((ticket) => (
                <DateApplicationOption
                  key={ticket.id}
                  ticket={ticket}
                  rejected={Boolean(ticket.rejected)}
                  selected={false}
                  application={applicationByDate.get(ticket.date) ?? null}
                  closed={
                    ticket.date < today || isMeetingDateClosed(ticket.date)
                  }
                  waitlistAvailable={isMeetingDateClosed(ticket.date)}
                  disabled={saving}
                  onToggle={() => openTicket(ticket)}
                  onWaitlist={() => openTicket(ticket)}
                />
              ))}
            </div>

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
                className="mt-6 border-t border-black/10 pb-[96px] pt-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[15px] font-bold tracking-[-0.03em] text-black">
                    참여 방식을 선택해주세요
                  </h3>
                  <span className="text-[10px] font-medium text-black/38">
                    1개 선택
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  <button
                    type="button"
                    aria-pressed={purchaseOption === "single"}
                    onClick={() => setPurchaseOption("single")}
                    className={cn(
                      "relative flex min-h-[82px] w-full items-center justify-between gap-4 rounded-[18px] border px-4 py-3.5 text-left transition",
                      purchaseOption === "single"
                        ? "border-black bg-black/[0.035] shadow-[inset_0_0_0_1px_#111]"
                        : "border-black/10 bg-[#faf8f2] hover:border-black/25 hover:bg-[#f1eee6]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                          purchaseOption === "single"
                            ? "border-black bg-black text-white"
                            : "border-black/15 bg-[#f1eee6] text-transparent",
                        )}
                      >
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                      <span className="text-[14px] font-bold text-black">
                        1회 참가비
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[20px] font-extrabold tracking-[-0.04em] text-black">
                      10,000원
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={purchaseOption === "membership"}
                    onClick={() => setPurchaseOption("membership")}
                    className={cn(
                      "relative w-full rounded-[18px] border px-4 py-4 text-left transition",
                      purchaseOption === "membership"
                        ? "border-black bg-black/[0.035] shadow-[inset_0_0_0_1px_#111]"
                        : "border-black/10 bg-[#faf8f2] hover:border-black/25 hover:bg-[#f1eee6]",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                          purchaseOption === "membership"
                            ? "border-black bg-black text-white"
                            : "border-black/15 bg-[#f1eee6] text-transparent",
                        )}
                      >
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-black">
                            1개월 멤버십
                          </span>
                          <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-bold text-white">
                            추천
                          </span>
                        </span>
                        <span className="mt-2 block text-[12px] font-medium leading-[1.55] text-black/52">
                          30일 동안 참여 횟수와 관계 없이
                          <br />
                          모임 참가비가 면제됩니다.
                        </span>
                      </span>
                      <span className="whitespace-nowrap pt-0.5 text-[20px] font-extrabold tracking-[-0.04em] text-black">
                        20,000원
                      </span>
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDateApplications(true)}
                  className="mt-3 h-[56px] w-full rounded-[18px] bg-black text-sm font-bold text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition active:scale-[0.985] disabled:bg-black/15 disabled:text-black/35 disabled:shadow-none"
                >
                  {saving
                    ? isResumingPayment
                      ? "결제창을 여는 중..."
                      : "신청 정보를 저장하는 중..."
                    : purchaseOption === "membership"
                      ? "20,000원 결제하고 멤버십 시작하기"
                    : isResumingPayment
                      ? `${meetingDateLabel(selectedDates[0])} 결제 계속하기`
                      : "10,000원 결제하고 신청하기"}
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
            </div>

            <div className="flex flex-1 items-center justify-center px-5 text-center">
              {availableTicketsLoading ? (
                <div className="flex items-center gap-2 text-sm font-bold text-black/42">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-black/55" />
                  이번 주 초대를 확인하는 중...
                </div>
              ) : weeklyInvitationTicket ? (
                <div className="w-full max-w-[340px]">
                  <motion.div
                    key={`weekly-invitation-card-${weeklyInvitationTicket.id}-${invitationDrawKey}`}
                    className="relative flex aspect-[1/1.618] flex-col justify-center bg-[#f8f4eb] px-7 py-10 shadow-[0_24px_60px_rgba(39,34,24,0.11)]"
                  >
                    <svg
                      viewBox="0 0 100 161.8"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                      aria-hidden
                    >
                      <motion.rect
                        x="0.4"
                        y="0.4"
                        width="99.2"
                        height="161"
                        fill="none"
                        stroke="rgba(0,0,0,0.18)"
                        strokeWidth="0.45"
                        vectorEffect="non-scaling-stroke"
                        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.25 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 1.05,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.rect
                        x="2.8"
                        y="2.8"
                        width="94.4"
                        height="156.2"
                        fill="none"
                        stroke="rgba(0,0,0,0.09)"
                        strokeWidth="0.35"
                        vectorEffect="non-scaling-stroke"
                        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.95,
                          delay: shouldReduceMotion ? 0 : 0.18,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.rect
                        x="0.4"
                        y="0.4"
                        width="99.2"
                        height="161"
                        fill="none"
                        stroke="rgba(0,0,0,0.18)"
                        strokeWidth="0.45"
                        vectorEffect="non-scaling-stroke"
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.16,
                          delay: shouldReduceMotion ? 0 : 1.02,
                        }}
                      />
                      <motion.rect
                        x="2.8"
                        y="2.8"
                        width="94.4"
                        height="156.2"
                        fill="none"
                        stroke="rgba(0,0,0,0.09)"
                        strokeWidth="0.35"
                        vectorEffect="non-scaling-stroke"
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.16,
                          delay: shouldReduceMotion ? 0 : 1.12,
                        }}
                      />
                    </svg>

                    <motion.div
                      className="relative flex h-full flex-col justify-center"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.48,
                        delay: shouldReduceMotion ? 0 : 0.68,
                        ease: "easeOut",
                      }}
                    >
                      <p className="font-ticket-latin absolute inset-x-0 top-0 text-[11px] italic tracking-[0.2em] text-black/38">
                        WEEKLY INVITATION
                      </p>
                      <p className="text-[11px] font-black tracking-[-0.02em] text-black/38">
                        {meetingDateLabel(weeklyInvitationTicket.date)} · {formatTicketTimeLabel(weeklyInvitationTicket.time)}
                      </p>
                      <h1 className="mt-5 text-[27px] font-black leading-[1.25] tracking-[-0.055em] text-black">
                        이번 주 토요일
                        <br />
                        나에게 온 초대가 있어요.
                      </h1>
                      <p className="mt-4 text-[13px] font-semibold leading-6 text-black/48">
                        문답을 바탕으로 잘 어울리는 자리와
                        <br />
                        사람들을 준비했어요.
                      </p>
                      <motion.button
                        type="button"
                        whileTap={!saving ? { scale: 0.99 } : undefined}
                        disabled={saving}
                        onClick={() => openTicket(weeklyInvitationTicket)}
                        className="relative mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-black/[0.88] px-5 text-[13px] font-bold text-white transition hover:bg-black disabled:bg-black/20"
                      >
                        나에게 온 초대장 보기
                        <ChevronRight size={16} aria-hidden />
                      </motion.button>
                    </motion.div>
                  </motion.div>
                </div>
              ) : showInvitationCountdown ? (
                <div className="w-full max-w-[340px]">
                  <p className="font-ticket-latin text-[11px] italic tracking-[0.2em] text-black/32">
                    WEEKLY INVITATION
                  </p>
                  <h1 className="mt-5 text-[24px] font-black tracking-[-0.05em] text-black">
                    다음 초대장을 준비하고 있어요.
                  </h1>
                  <p className="mt-3 text-[11px] font-black tracking-[-0.02em] text-black/42">
                    {nextInvitationOpeningLabel} 00:00 OPEN
                  </p>
                  <div
                    className="mt-8 grid grid-cols-[1.15fr_1fr_1fr_1fr] gap-2"
                    aria-label={`다음 초대까지 ${invitationCountdownDays}일 ${invitationCountdownHours}시간 ${invitationCountdownMinutes}분 ${invitationCountdownSeconds}초`}
                  >
                    {[
                      { value: invitationCountdownDays, unit: "일" },
                      { value: invitationCountdownHours, unit: "시간" },
                      { value: invitationCountdownMinutes, unit: "분" },
                      { value: invitationCountdownSeconds, unit: "초" },
                    ].map(({ value, unit }) => (
                      <div
                        key={unit}
                        className="border border-black/[0.09] bg-[#f8f4eb] px-2 py-4 shadow-[0_10px_26px_rgba(39,34,24,0.06)]"
                      >
                        <strong className="block text-[24px] font-black tabular-nums tracking-[-0.05em] text-black">
                          <RollingCountdownValue
                            value={value}
                            reduceMotion={shouldReduceMotion}
                          />
                        </strong>
                        <span className="mt-1 block text-[9px] font-black text-black/34">
                          {unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  {declinedInvitationTicket && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        onOpenDeclinedTicket
                          ? onOpenDeclinedTicket(declinedInvitationTicket)
                          : openTicket(declinedInvitationTicket)
                      }
                      className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-black/[0.88] px-5 text-[13px] font-bold text-white transition hover:bg-black active:scale-[0.99] disabled:bg-black/20"
                    >
                      이번 주 초대장 다시보기
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-ticket-latin text-[12px] font-bold italic uppercase tracking-[0.18em] text-black/35">
                    WEEKLY INVITATION
                  </p>
                  <h1 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-black">
                    이번 주 토요일 티켓을 준비 중이에요.
                  </h1>
                  <p className="mt-3 text-sm font-semibold leading-6 text-black/42">
                    티켓이 열리면 이곳에서 바로 보여드릴게요.
                  </p>
                  {error && (
                    <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                      {error}
                    </p>
                  )}
                </div>
              )}
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
