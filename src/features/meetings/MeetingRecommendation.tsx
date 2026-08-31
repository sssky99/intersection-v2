"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Gift,
  Landmark,
  LoaderCircle,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { formatTicketTimeLabel } from "@/components/IntersectionTicketCard";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import {
  RouletteDeadlineCountdown,
  TicketCoursePanel,
  TicketDetailContent,
} from "@/features/meetings/TicketDetailContent";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import { checkoutAttributionContext, trackEvent } from "@/lib/analytics";
import { blindDateStartAtFromParts } from "@/lib/blindDateTiming";
import { membershipStoreUrls } from "@/lib/membershipStore";
import { membershipPlanAmounts } from "@/lib/membershipPlans";
import {
  MEETING_DATE_DEPOSIT_AMOUNT,
  MEETING_DATE_SINGLE_USE_AMOUNT,
  MEETING_DATE_REGION,
  isMeetingDateClosed,
  meetingDateApplicationDates,
  meetingDateLabel,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { oneTimeTicketStoreUrl } from "@/lib/paymentStore";
import { todayInKst } from "@/lib/ticketDate";
import { ticketBackgroundImageUrls } from "@/lib/ticketImages";
import { saveGuestTicketInteraction } from "@/lib/ticketInteractions";
import type {
  GatheringTicket,
  TicketInteraction,
  TicketInteractionStatus,
} from "@/types/ticket";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type { NaverPlace } from "@/types/place";

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

function seoulAreaLabel(area?: string | null) {
  const normalizedArea = area?.trim();
  if (!normalizedArea) return "장소 추후 안내";
  return normalizedArea === "서울" ? "서울" : `서울 ${normalizedArea}`;
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

function oneMonthMembershipPeriod(meetingDate: string) {
  const schedule = meetingDateSchedule(meetingDate);
  if (!schedule) return { start: meetingDate, end: meetingDate };

  const nextMonth = schedule.month === 12 ? 1 : schedule.month + 1;
  const nextYear = schedule.month === 12 ? schedule.year + 1 : schedule.year;
  const lastDayOfNextMonth = new Date(
    Date.UTC(nextYear, nextMonth, 0),
  ).getUTCDate();
  const sameDayNextMonth = new Date(
    Date.UTC(
      nextYear,
      nextMonth - 1,
      Math.min(schedule.day, lastDayOfNextMonth),
    ),
  );
  sameDayNextMonth.setUTCDate(sameDayNextMonth.getUTCDate() - 1);
  const format = (year: number, month: number, day: number) =>
    `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;

  return {
    start: format(schedule.year, schedule.month, schedule.day),
    end: format(
      sameDayNextMonth.getUTCFullYear(),
      sameDayNextMonth.getUTCMonth() + 1,
      sameDayNextMonth.getUTCDate(),
    ),
  };
}

function koreanTicketTimeLabel(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return formatTicketTimeLabel(value);

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return formatTicketTimeLabel(value);
  }

  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return minute === 0
    ? `${period} ${displayHour}시`
    : `${period} ${displayHour}시 ${minute}분`;
}

function mondayUtcStamp(date: Date) {
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysFromMonday,
  );
}

function calendarDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function paymentSelectionDeadlineLabel(
  meetingDate: string,
  meetingTime: string,
  today = todayInKst(),
) {
  const schedule = calendarDateParts(meetingDate);
  const todaySchedule = calendarDateParts(today);
  if (!schedule || !todaySchedule) {
    return `모임 시작 하루 전 ${koreanTicketTimeLabel(meetingTime)}`;
  }

  const deadline = new Date(
    Date.UTC(schedule.year, schedule.month - 1, schedule.day - 1),
  );
  const todayDate = new Date(
    Date.UTC(todaySchedule.year, todaySchedule.month - 1, todaySchedule.day),
  );
  const weekDifference = Math.round(
    (mondayUtcStamp(deadline) - mondayUtcStamp(todayDate)) /
      (7 * 24 * 60 * 60 * 1000),
  );
  const weekdays = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];
  const datePrefix =
    weekDifference === 0
      ? "이번 주"
      : weekDifference === 1
        ? "다음 주"
        : `${deadline.getUTCMonth() + 1}월 ${deadline.getUTCDate()}일`;

  return `${datePrefix} ${weekdays[deadline.getUTCDay()]} ${koreanTicketTimeLabel(meetingTime)}`;
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
  readOnly?: boolean;
  profileCompleted?: boolean;
  profileName?: string | null;
  profilePhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
  guestMode?: boolean;
  participationPrecisionCount?: number;
  onOpenParticipationRecord?: () => void;
  onFocusModeChange?: (focused: boolean) => void;
  onBottomNavHiddenChange?: (hidden: boolean) => void;
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
  blindDateOpenRequestOfferId?: string | null;
  blindDateOpenRequestSkipUnlock?: boolean;
  onBlindDateOpenRequestHandled?: () => void;
  ticketAcceptRequestId?: number;
  ticketAcceptRequestTicketId?: string | null;
  onTicketAcceptRequestHandled?: () => void;
  onDateApplicationsChange?: (applications: MeetingDateApplication[]) => void;
  onOpenTicketTab?: (ticketId?: string) => void;
};

export function MatchingLoader({
  message,
  dotCount = 0,
}: {
  message: string;
  dotCount?: number;
}) {
  return (
    <div className="flex w-full max-w-[350px] flex-col items-center text-center">
      <svg
        data-testid="matching-loader"
        viewBox="0 0 48 48"
        className="mb-6 block h-12 w-12 shrink-0"
        aria-hidden
      >
        <g data-testid="matching-loader-rotor">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 24 24"
            to="360 24 24"
            dur="1.05s"
            repeatCount="indefinite"
          />
          {Array.from({ length: 12 }, (_, index) => (
            <line
              key={index}
              x1="24"
              y1="5"
              x2="24"
              y2="14"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                color: "#24211d",
                transformOrigin: "24px 24px",
                transform: `rotate(${index * 30}deg)`,
                opacity: 0.18 + index * 0.065,
              }}
            />
          ))}
        </g>
      </svg>
      <p
        role="status"
        aria-live="polite"
        className="text-[17px] font-black tracking-[-0.045em] text-[#24211d]"
      >
        {message}
        {dotCount > 0 && (
          <span className="inline-block w-6 text-left" aria-hidden>
            {".".repeat(dotCount)}
          </span>
        )}
      </p>
    </div>
  );
}

type DateApplicationScreen =
  | "intro"
  | "dates"
  | "unlock"
  | "ticket"
  | "submitted"
  | "blindDateList"
  | "blindDateUnlock"
  | "blindDate";
type ApplicationFunnelStep =
  | "loading"
  | "recommendation_list"
  | "ticket_unlock"
  | "ticket_detail"
  | "payment_options"
  | "application_complete";

function applicationFunnelStep(
  screen: DateApplicationScreen,
  membershipSheetOpen: boolean,
): ApplicationFunnelStep | null {
  if (screen === "intro") return "loading";
  if (screen === "dates") return "recommendation_list";
  if (screen === "unlock") return "ticket_unlock";
  if (screen === "ticket") {
    return membershipSheetOpen ? "payment_options" : "ticket_detail";
  }
  if (screen === "submitted") return "application_complete";
  return null;
}

const applicationFunnelForwardTransitions = new Set([
  "loading:recommendation_list",
  "recommendation_list:ticket_unlock",
  "ticket_unlock:ticket_detail",
  "ticket_detail:payment_options",
  "payment_options:application_complete",
]);

type DateApplicationsResponse = {
  applications?: MeetingDateApplication[];
  totalDepositAmount?: number;
  membershipCovered?: boolean;
  checkoutUrl?: string;
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
    application?.status === "payment_pending";
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
  readOnly = false,
  profileCompleted = true,
  profileName = null,
  profilePhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
  guestMode = false,
  participationPrecisionCount = 0,
  onOpenParticipationRecord = () => undefined,
  onFocusModeChange,
  onBottomNavHiddenChange,
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
  blindDateOpenRequestOfferId = null,
  blindDateOpenRequestSkipUnlock = false,
  onBlindDateOpenRequestHandled,
  ticketAcceptRequestId = 0,
  ticketAcceptRequestTicketId = null,
  onTicketAcceptRequestHandled,
  onDateApplicationsChange,
  onOpenTicketTab,
}: MeetingRecommendationProps) {
  const searchParams = useSearchParams();
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [screen, setScreen] = useState<DateApplicationScreen>("intro");
  const [introDotCount, setIntroDotCount] = useState(1);
  const [introMinDurationElapsed, setIntroMinDurationElapsed] = useState(false);
  const [suppressProgramMorph, setSuppressProgramMorph] = useState(false);
  const [applications, setApplications] = useState<MeetingDateApplication[]>([]);
  const [availableTickets, setAvailableTickets] = useState<GatheringTicket[]>([]);
  const [availableTicketsLoading, setAvailableTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<GatheringTicket | null>(
    null,
  );
  const [membershipSheetOpen, setMembershipSheetOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [submittedDates, setSubmittedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlindDateOfferId, setSelectedBlindDateOfferId] =
    useState<string | null>(null);
  const [blindDateTicketClosing, setBlindDateTicketClosing] = useState(false);
  const blindDateCloseTimerRef = useRef<number | null>(null);
  const [waitlistDialog, setWaitlistDialog] = useState<"success" | null>(null);
  const funnelEntryRef = useRef<{
    step: ApplicationFunnelStep;
    enteredAt: number;
    ticketInstanceId: string | null;
    meetingDate: string | null;
  } | null>(null);
  const funnelStep = applicationFunnelStep(screen, membershipSheetOpen);

  const exitApplicationFunnel = useCallback((exitReason: string) => {
    const entry = funnelEntryRef.current;
    if (!entry) return;

    if (entry.step !== "application_complete") {
      trackEvent("application_funnel_exit", {
        step: entry.step,
        exit_reason: exitReason,
        elapsed_ms: Math.max(0, Date.now() - entry.enteredAt),
        ticket_instance_id: entry.ticketInstanceId,
        meeting_date: entry.meetingDate,
      });
    }
    funnelEntryRef.current = null;
  }, []);

  useEffect(() => {
    const previous = funnelEntryRef.current;

    if (!active || !funnelStep) {
      if (previous) {
        exitApplicationFunnel(active ? "another_flow" : "tab_switch");
      }
      return;
    }

    const ticketInstanceId = selectedTicket?.id ?? null;
    const meetingDate = selectedTicket?.date ?? null;
    if (
      previous?.step === funnelStep &&
      previous.ticketInstanceId === ticketInstanceId
    ) {
      return;
    }

    if (previous) {
      const transition = `${previous.step}:${funnelStep}`;
      if (!applicationFunnelForwardTransitions.has(transition)) {
        const reason =
          previous.step === "payment_options" && funnelStep === "ticket_detail"
            ? "payment_sheet_close"
            : funnelStep === "recommendation_list"
              ? "back_to_list"
              : "step_changed";
        exitApplicationFunnel(reason);
      }
    }

    trackEvent("application_funnel_step_view", {
      step: funnelStep,
      previous_step: previous?.step,
      ticket_instance_id: ticketInstanceId,
      meeting_date: meetingDate,
    });
    funnelEntryRef.current = {
      step: funnelStep,
      enteredAt: Date.now(),
      ticketInstanceId,
      meetingDate,
    };
  }, [
    active,
    exitApplicationFunnel,
    funnelStep,
    selectedTicket?.date,
    selectedTicket?.id,
  ]);

  useEffect(() => {
    const handlePageHide = () => exitApplicationFunnel("page_leave");
    const handlePageShow = () => {
      if (!active || !funnelStep || funnelEntryRef.current) return;
      const ticketInstanceId = selectedTicket?.id ?? null;
      const meetingDate = selectedTicket?.date ?? null;
      trackEvent("application_funnel_step_view", {
        step: funnelStep,
        entry_reason: "page_restore",
        ticket_instance_id: ticketInstanceId,
        meeting_date: meetingDate,
      });
      funnelEntryRef.current = {
        step: funnelStep,
        enteredAt: Date.now(),
        ticketInstanceId,
        meetingDate,
      };
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [
    active,
    exitApplicationFunnel,
    funnelStep,
    selectedTicket?.date,
    selectedTicket?.id,
  ]);

  useEffect(() => {
    if (screen !== "intro") return;

    setIntroDotCount(1);
    setIntroMinDurationElapsed(false);
    const dotsTimer = window.setInterval(() => {
      setIntroDotCount((current) => (current >= 3 ? 1 : current + 1));
    }, 420);
    const openListTimer = window.setTimeout(
      () => setIntroMinDurationElapsed(true),
      1500,
    );

    return () => {
      window.clearInterval(dotsTimer);
      window.clearTimeout(openListTimer);
    };
  }, [screen, shouldReduceMotion]);

  useEffect(() => {
    if (
      screen === "intro" &&
      introMinDurationElapsed &&
      !availableTicketsLoading
    ) {
      setScreen("dates");
    }
  }, [availableTicketsLoading, introMinDurationElapsed, screen]);

  useEffect(() => {
    if (screen !== "dates" || !suppressProgramMorph) return;
    const resetTimer = window.setTimeout(() => setSuppressProgramMorph(false), 320);
    return () => window.clearTimeout(resetTimer);
  }, [screen, suppressProgramMorph]);

  const recordTicketInteraction = async (
    ticket: GatheringTicket,
    status: TicketInteractionStatus,
    options?: { keepalive?: boolean },
  ) => {
    if (readOnly) return null;
    if (guestMode) {
      const interaction = saveGuestTicketInteraction(ticket, status);
      onTicketInteractionChange?.(interaction);
      return interaction;
    }

    if (status === "open" || status === "no") {
      const updatedAt = new Date().toISOString();
      onTicketInteractionChange?.({
        ticket,
        status,
        openedAt: updatedAt,
        respondedAt: status === "no" ? updatedAt : null,
        paymentStartedAt: null,
        paymentConfirmedAt: null,
        updatedAt,
      });
    }

    return fetch("/api/meetings/ticket-interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketInstanceId: ticket.id, status }),
      keepalive: options?.keepalive,
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
  const applicationByDate = new Map(
    applications.map((application) => [application.meetingDate, application]),
  );
  const resumeDate = searchParams.get("resumeDate");
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
  const listedBlindDateOffers = [...activeBlindDateOffers].sort((left, right) => {
    const leftNeedsResponse = left.ownResponse === "pending" ? 0 : 1;
    const rightNeedsResponse = right.ownResponse === "pending" ? 0 : 1;
    if (leftNeedsResponse !== rightNeedsResponse) {
      return leftNeedsResponse - rightNeedsResponse;
    }

    const leftDate = left.scheduledDate ?? left.candidateDates[0] ?? "9999-12-31";
    const rightDate = right.scheduledDate ?? right.candidateDates[0] ?? "9999-12-31";
    return leftDate.localeCompare(rightDate);
  });
  const selectedBlindDateOffer =
    blindDateOffers.find((offer) => offer.id === selectedBlindDateOfferId) ??
    activeBlindDateOffers[0] ??
    null;

  const focusMode = screen === "ticket";
  const bottomNavHidden =
    screen === "blindDateList" ||
    screen === "blindDate" ||
    screen === "blindDateUnlock";

  useEffect(() => {
    onFocusModeChange?.(active && focusMode);
    return () => onFocusModeChange?.(false);
  }, [active, focusMode, onFocusModeChange]);

  useEffect(() => {
    onBottomNavHiddenChange?.(active && bottomNavHidden);
    return () => onBottomNavHiddenChange?.(false);
  }, [active, bottomNavHidden, onBottomNavHiddenChange]);

  useEffect(() => {
    if (!blindDateOpenRequestPending || activeBlindDateOffers.length === 0) {
      return;
    }

    setBlindDateTicketClosing(false);

    const requestedOffer = blindDateOpenRequestOfferId
      ? activeBlindDateOffers.find(
          (offer) => offer.id === blindDateOpenRequestOfferId,
        ) ?? null
      : null;

    if (requestedOffer) {
      setSelectedBlindDateOfferId(requestedOffer.id);
      setScreen(
        !blindDateOpenRequestSkipUnlock && shouldPlayBlindDateUnlock(requestedOffer)
          ? "blindDateUnlock"
          : "blindDate",
      );
    } else if (activeBlindDateOffers.length > 1) {
      setSelectedBlindDateOfferId(null);
      setScreen("blindDateList");
    } else {
      const offerToOpen =
        answerableBlindDateOffers[0] ?? activeBlindDateOffers[0];
      setSelectedBlindDateOfferId(offerToOpen.id);
      setScreen(
        !blindDateOpenRequestSkipUnlock && shouldPlayBlindDateUnlock(offerToOpen)
          ? "blindDateUnlock"
          : "blindDate",
      );
    }
    onBlindDateOpenRequestHandled?.();
  }, [
    activeBlindDateOffers,
    answerableBlindDateOffers,
    blindDateOpenRequestId,
    blindDateOpenRequestOfferId,
    blindDateOpenRequestPending,
    blindDateOpenRequestSkipUnlock,
    onBlindDateOpenRequestHandled,
  ]);

  useEffect(
    () => () => {
      if (blindDateCloseTimerRef.current !== null) {
        window.clearTimeout(blindDateCloseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (guestMode || !active) return;
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
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, [active, guestMode, userId]);

  useEffect(() => {
    if (!active) return;
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
    return () => {
      alive = false;
    };
  }, [active, guestMode, onAvailableTicketsChange]);

  useEffect(() => {
    if (
      !active ||
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
    setError(null);
    setScreen("ticket");
    setMembershipSheetOpen(true);
  }, [active, availableTickets, profileCompleted, resumeDate, today]);

  useEffect(() => {
    onDateApplicationsChange?.(applications);
  }, [applications, onDateApplicationsChange]);

  const toggleDate = (date: string) => {
    const application = applicationByDate.get(date);
    const canResumePayment =
      application?.status === "payment_pending";
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
    void recordTicketInteraction(ticket, "open", { keepalive: true });
    setMembershipSheetOpen(false);
    setSelectedTicket(ticket);
    setError(null);
    setScreen("unlock");
    trackEvent("meeting_ticket_detail_open", {
      ticket_instance_id: ticket.id,
      meeting_date: ticket.date,
    });
  };

  const acceptTicket = (ticket: GatheringTicket) => {
    if (saving) return;

    recordTicketInteraction(ticket, "yes");
    setError(null);

    if (membershipStatus === "active") {
      void submitDateApplications(ticket);
      return;
    }

    setMembershipSheetOpen(true);
  };

  useEffect(() => {
    if (!active || !ticketAcceptRequestId || !ticketAcceptRequestTicketId) {
      return;
    }
    const ticket = availableTickets.find(
      (item) => item.id === ticketAcceptRequestTicketId,
    );
    if (!ticket) return;

    setSelectedTicket(ticket);
    setError(null);
    recordTicketInteraction(ticket, "yes");

    setScreen("ticket");
    if (membershipStatus === "active") {
      void submitDateApplications(ticket);
    } else {
      setMembershipSheetOpen(true);
    }

    onTicketAcceptRequestHandled?.();
  }, [
    active,
    availableTickets,
    onTicketAcceptRequestHandled,
    ticketAcceptRequestId,
    ticketAcceptRequestTicketId,
    membershipStatus,
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
        exitApplicationFunnel("ticket_declined");
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
      exitApplicationFunnel("ticket_declined");
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

  const submitDateApplications = async (
    ticket: GatheringTicket | null = null,
  ) => {
    const targetDates = ticket ? [ticket.date] : [...selectedDates];
    if (targetDates.length !== 1 || saving) return;

    setSaving(true);
    setError(null);
    let membershipCheckoutUrl = membershipStoreUrls.one_month;
    trackEvent("application_submit_click", {
      application_type: "meeting_date",
      date_count: targetDates.length,
      deposit_amount: 0,
      membership_status: membershipStatus,
    });

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
              prepareCheckout: true,
              eventId: ticket?.id,
              attribution: checkoutAttributionContext(),
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

        if (applicationData.membershipCovered) {
          if (ticket) {
            await recordTicketInteraction(ticket, "payment_confirmed");
          }
          setSubmittedDates(targetDates);
          setMembershipSheetOpen(false);
          setScreen("submitted");
          trackEvent("application_created", {
            application_type: "meeting_date",
            date_count: targetDates.length,
            deposit_amount: 0,
            payment_option: "existing_membership",
          });
          trackEvent("invitation_yes", {
            ticket_instance_id: ticket?.id,
            meeting_date: ticket?.date ?? targetDates[0],
            payment_option: "existing_membership",
          });
          setSaving(false);
          return;
        }

        membershipCheckoutUrl =
          applicationData.checkoutUrl ?? membershipStoreUrls.one_month;

        if (ticket) {
          void recordTicketInteraction(ticket, "payment_pending", {
            keepalive: true,
          });
        }
      } else {
        const now = new Date().toISOString();
        const localApplication: MeetingDateApplication = {
          id: `local:${ticket?.id ?? targetDates[0]}`,
          meetingDate: targetDates[0],
          meetingTime: ticket?.time ?? "19:00",
          region: ticket?.area ?? MEETING_DATE_REGION,
          status: membershipStatus === "active" ? "approved" : "payment_pending",
          depositAmount: 0,
          depositStatus: membershipStatus === "active" ? "confirmed" : "payment_pending",
          assignedTicketInstanceId: ticket?.id ?? null,
          ticketRevealsAt: null,
          createdAt: now,
          updatedAt: now,
        };

        setApplications((current) => {
          const next = mergeDateApplications(current, [localApplication]);
          saveLocalDateApplications(userId, next);
          onDateApplicationsChange?.(next);
          return next;
        });

        if (ticket) {
          await recordTicketInteraction(
            ticket,
            membershipStatus === "active" ? "payment_confirmed" : "payment_pending",
          );
        }

        if (membershipStatus === "active") {
          setSubmittedDates(targetDates);
          setMembershipSheetOpen(false);
          setScreen("submitted");
          setSaving(false);
          return;
        }
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
        value: membershipPlanAmounts.one_month,
        currency: "KRW",
        application_type: "meeting_date",
        meeting_date: targetDates[0],
      });
      funnelEntryRef.current = null;
      window.location.assign(membershipCheckoutUrl);
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
      setSaving(false);
    }
  };

  const submitSingleUseApplication = async (ticket: GatheringTicket) => {
    if (saving) return;

    setSaving(true);
    setError(null);
    trackEvent("application_submit_click", {
      application_type: "meeting_date",
      date_count: 1,
      deposit_amount: MEETING_DATE_SINGLE_USE_AMOUNT,
      membership_status: membershipStatus,
      payment_option: "one_time",
    });

    try {
      let checkoutUrl = oneTimeTicketStoreUrl;

      if (!isLocalTestHost()) {
        const response = await fetch("/api/meeting-date-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dates: [ticket.date],
            openPayment: true,
            eventId: ticket.id,
            attribution: checkoutAttributionContext(),
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | DateApplicationsResponse
          | null;
        if (!response.ok || !data?.applications) {
          throw new Error(data?.error ?? "date-applications-save-failed");
        }

        setApplications((current) => {
          const next = mergeDateApplications(current, data.applications ?? []);
          onDateApplicationsChange?.(next);
          return next;
        });
        checkoutUrl = data.checkoutUrl ?? oneTimeTicketStoreUrl;
      } else {
        const now = new Date().toISOString();
        const localApplication: MeetingDateApplication = {
          id: `local:single:${ticket.id}`,
          meetingDate: ticket.date,
          meetingTime: ticket.time,
          region: ticket.area,
          status: "payment_pending",
          depositAmount: MEETING_DATE_SINGLE_USE_AMOUNT,
          depositStatus: "payment_pending",
          assignedTicketInstanceId: ticket.id,
          ticketRevealsAt: null,
          createdAt: now,
          updatedAt: now,
        };
        setApplications((current) => {
          const next = mergeDateApplications(current, [localApplication]);
          saveLocalDateApplications(userId, next);
          onDateApplicationsChange?.(next);
          return next;
        });
      }

      await recordTicketInteraction(ticket, "payment_pending", {
        keepalive: true,
      });
      trackEvent("application_created", {
        application_type: "meeting_date",
        date_count: 1,
        deposit_amount: MEETING_DATE_SINGLE_USE_AMOUNT,
        payment_option: "one_time",
      });
      trackEvent("invitation_yes", {
        ticket_instance_id: ticket.id,
        meeting_date: ticket.date,
        payment_option: "one_time",
      });
      trackEvent("payment_page_open", {
        application_type: "meeting_date",
        payment_provider: "groble",
        meeting_date: ticket.date,
        payment_option: "one_time",
        value: MEETING_DATE_SINGLE_USE_AMOUNT,
        currency: "KRW",
      });
      funnelEntryRef.current = null;
      window.location.assign(checkoutUrl);
    } catch (singleUseError) {
      setError(
        singleUseError instanceof Error &&
          singleUseError.message !== "date-applications-save-failed"
          ? singleUseError.message
          : "1회 이용권 결제를 준비하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
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
            depositAmount: null,
            depositStatus: null,
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

  if (screen === "unlock" && selectedTicket) {
    return (
      <TicketUnlockSequence
        motionKey={selectedTicket.id}
        title={selectedTicket.title}
        dateText={programDateLabel(selectedTicket.date)}
        timeText={formatTicketTimeLabel(selectedTicket.time)}
        placeText={seoulAreaLabel(selectedTicket.area)}
        reducedMotion={shouldReduceMotion}
        onBack={() => {
          exitApplicationFunnel("ticket_unlock_back");
          setSuppressProgramMorph(true);
          setSelectedTicket(null);
          setScreen("dates");
          setError(null);
        }}
        onComplete={() => setScreen("ticket")}
      />
    );
  }

  if (screen === "blindDateList") {
    return (
      <BlindDateOfferList
        offers={listedBlindDateOffers}
        embedded={embedded}
        onClose={() => {
          setSelectedBlindDateOfferId(null);
          setScreen("dates");
        }}
        onSelect={(offer) => {
          setSelectedBlindDateOfferId(offer.id);
          setScreen(
            shouldPlayBlindDateUnlock(offer)
              ? "blindDateUnlock"
              : "blindDate",
          );
        }}
      />
    );
  }

  if (screen === "blindDateUnlock" && selectedBlindDateOffer) {
    return (
      <TicketUnlockSequence
        motionKey={`blind-date-${selectedBlindDateOffer.id}`}
        title={selectedBlindDateOffer.template.title}
        dateText={
          selectedBlindDateOffer.scheduledDate
            ? blindDateDateLabel(selectedBlindDateOffer.scheduledDate)
            : blindDateCandidateDateLabel(selectedBlindDateOffer.candidateDates)
        }
        timeText={selectedBlindDateOffer.timeLabel}
        placeText={selectedBlindDateOffer.region}
        reducedMotion={shouldReduceMotion}
        onBack={() => {
          setSelectedBlindDateOfferId(null);
          setScreen(
            activeBlindDateOffers.length > 1 ? "blindDateList" : "dates",
          );
        }}
        onComplete={() => setScreen("blindDate")}
      />
    );
  }

  if (screen === "ticket" && selectedTicket) {
    const selectedEventClosed = selectedTicket.applicationClosed === true;
    const selectedTicketClosed =
      selectedEventClosed ||
      selectedTicket.date < today ||
      isMeetingDateClosed(selectedTicket.date);

    return (
      <motion.section
        key={`meeting-ticket-detail-${selectedTicket.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "relative min-h-full overflow-hidden bg-transparent px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]",
          embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (saving) return;
            exitApplicationFunnel("ticket_detail_close");
            setMembershipSheetOpen(false);
            setSelectedTicket(null);
            setScreen("dates");
            setError(null);
          }}
          disabled={saving}
          aria-label="이전으로"
          className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center text-[#24211d]/58 transition hover:text-[#24211d] disabled:opacity-40"
        >
          <X size={18} aria-hidden />
        </button>

        <TicketDetailRevealHeader
          title={selectedTicket.title}
          meta={`${meetingDateLabel(selectedTicket.date)} · ${formatTicketTimeLabel(selectedTicket.time)} · ${seoulAreaLabel(selectedTicket.area)}`}
        />

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 text-[#24211d]"
        >
          <TicketDetailContent
            ticket={selectedTicket}
            participantPhotoUrl={profilePhotoUrl}
            previewMatchPhotoUrls={previewMatchPhotoUrls}
            previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
            sections={[
              "summary",
              "recommendation",
              "course",
            ]}
            className="pb-5"
          />
        </motion.div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
            {error}
          </p>
        )}

        {active &&
          !readOnly &&
          typeof document !== "undefined" &&
          createPortal(selectedEventClosed ? (
          <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] h-[68px] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
            <div className="flex h-[56px] w-full items-center justify-center rounded-full bg-black/12 text-[15px] font-black tracking-[-0.02em] text-black/42">
              마감
            </div>
          </div>
        ) : selectedTicketClosed ? (
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
          ), document.body)}

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

        {active && typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {membershipSheetOpen && (
                <MembershipPurchaseBottomSheet
                  ticket={selectedTicket}
                  saving={saving}
                  error={error}
                  onSubmit={() => void submitDateApplications(selectedTicket)}
                  onSingleUseSubmit={() =>
                    void submitSingleUseApplication(selectedTicket)
                  }
                  onClose={() => {
                    if (saving) return;
                    setMembershipSheetOpen(false);
                    setError(null);
                  }}
                />
              )}
            </AnimatePresence>,
            document.body,
          )}
      </motion.section>
    );
  }

  if (screen === "blindDate" && selectedBlindDateOffer) {
    return (
      <motion.section
        initial={{ opacity: blindDateOpenRequestSkipUnlock ? 0 : 1 }}
        animate={{ opacity: blindDateTicketClosing ? 0 : 1 }}
        transition={ticketFadeTransition}
        className={cn(
          "bg-[linear-gradient(180deg,#faf8f3_0%,#f7f4ee_48%,#f2eee6_100%)] px-5 pb-6 pt-7",
          embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
        )}
      >
        <BlindDateInvitationFlow
          offer={selectedBlindDateOffer}
          bundledOffers={answerableBlindDateOffers}
          userName={profileName}
          profilePhotoUrl={profilePhotoUrl}
          ticketDetailMode={blindDateOpenRequestSkipUnlock}
          onClose={() => {
            if (blindDateOpenRequestSkipUnlock) {
              if (blindDateTicketClosing) return;
              setBlindDateTicketClosing(true);
              blindDateCloseTimerRef.current = window.setTimeout(() => {
                blindDateCloseTimerRef.current = null;
                setSelectedBlindDateOfferId(null);
                setScreen("dates");
                setBlindDateTicketClosing(false);
                onOpenTicketTab?.();
              }, 200);
              return;
            }
            setSelectedBlindDateOfferId(null);
            setScreen(activeBlindDateOffers.length > 1 ? "blindDateList" : "dates");
          }}
          onOffersChange={onBlindDateOffersChange}
        />
      </motion.section>
    );
  }

  return (
    <section
      className={cn(
        "flex min-h-full flex-col bg-transparent px-5 pb-8 pt-7 text-[#24211d]",
        embedded ? "h-full min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {screen === "intro" ? (
          <motion.div
            key="meeting-intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 items-center justify-center pb-24"
          >
            <MatchingLoader
              message="나와 잘 어울리는 사람들을 찾는 중"
              dotCount={introDotCount}
            />
          </motion.div>
        ) : screen === "submitted" ? (
          <motion.div
            key="date-submitted"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pt-[calc(48px+env(safe-area-inset-top))]"
          >
            <h1 className="text-[28px] font-bold leading-9 text-black">
              신청이 완료되었습니다.
            </h1>
            <p className="mt-3 text-[13px] font-semibold leading-6 text-black/50">
              이용 중인 멤버십이 적용되어 별도 결제 없이 신청됐어요.
            </p>
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
                    <p className="text-sm font-black text-black">신청 완료</p>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTicket(null);
                setSelectedDates([]);
                setSubmittedDates([]);
                setError(null);
                setScreen("dates");
              }}
              className="mt-7 h-[52px] w-full bg-black text-sm font-black text-white transition active:scale-[0.99]"
            >
              다른 초대장 받기
            </button>
            <button
              type="button"
              onClick={() => onOpenTicketTab?.(selectedTicket?.id)}
              className="mt-3 h-[52px] w-full border border-[#d0cbbc]/80 bg-[#f8f4ea] text-sm font-black text-black transition active:scale-[0.99]"
            >
              초대 확인하기
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
                      ticket.applicationClosed === true ||
                      ticket.date < today ||
                      isMeetingDateClosed(ticket.date)
                    }
                    waitlistAvailable={
                      ticket.applicationClosed !== true &&
                      isMeetingDateClosed(ticket.date)
                    }
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
                    ticket.applicationClosed === true ||
                    ticket.date < today ||
                    isMeetingDateClosed(ticket.date)
                  }
                  waitlistAvailable={
                    ticket.applicationClosed !== true &&
                    isMeetingDateClosed(ticket.date)
                  }
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
                    멤버십으로 참여해요
                  </h3>
                  <span className="text-[10px] font-medium text-black/38">
                    구독권 전용
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  <div className="relative w-full rounded-[18px] border border-black bg-black/[0.035] px-4 py-4 text-left shadow-[inset_0_0_0_1px_#111]">
                    <span className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black bg-black text-white">
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[14px] font-bold text-black">
                            1개월 멤버십
                          </span>
                          <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-bold text-white">
                            구독권
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
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDateApplications()}
                  className="mt-3 h-[56px] w-full rounded-[18px] bg-black text-sm font-bold text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] transition active:scale-[0.985] disabled:bg-black/15 disabled:text-black/35 disabled:shadow-none"
                >
                  {saving
                    ? "결제창을 준비하는 중..."
                    : "20,000원 결제하고 멤버십 시작하기"}
                </button>
              </motion.div>
            )}

            {activeBlindDateOffers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (activeBlindDateOffers.length > 1) {
                    setSelectedBlindDateOfferId(null);
                    setScreen("blindDateList");
                  } else {
                    const offerToOpen =
                      answerableBlindDateOffers[0] ?? activeBlindDateOffers[0];
                    setSelectedBlindDateOfferId(offerToOpen.id);
                    setScreen(
                      shouldPlayBlindDateUnlock(offerToOpen)
                        ? "blindDateUnlock"
                        : "blindDate",
                    );
                  }
                }}
                className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 border border-black/10 bg-white px-4 py-3 text-left text-sm font-bold text-black"
              >
                <span>
                  {answerableBlindDateOffers.length > 0
                    ? "나에게 온 블라인드 데이트 초대장 보기"
                    : activeBlindDateOffers.length > 1
                      ? `블라인드 데이트 일정 ${activeBlindDateOffers.length}개 확인하기`
                    : "블라인드 데이트 상태 확인하기"}
                </span>
                {(answerableBlindDateOffers.length > 0 ||
                  activeBlindDateOffers.length > 1) && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-[11px] font-black text-white">
                    {answerableBlindDateOffers.length > 0
                      ? answerableBlindDateOffers.length
                      : activeBlindDateOffers.length}
                  </span>
                )}
              </button>
            )}
            </div>

            <div className="flex flex-1 flex-col justify-center px-1">
              {availableTicketsLoading ? (
                <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm font-bold text-black/42">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-black/55" />
                  참여 가능한 모임을 확인하는 중...
                </div>
              ) : availableTickets.length > 0 ? (
                <motion.div
                  layoutId={suppressProgramMorph ? undefined : "program-selection-panel"}
                  className="w-full overflow-hidden rounded-[25px] border border-[#d0cbbc]/70 bg-[linear-gradient(145deg,#fbf9f4_0%,#f5f1e9_100%)] shadow-[0_14px_32px_rgba(66,57,44,0.08)]"
                >
                  <header className="flex h-[72px] items-center border-b border-black/[0.075] px-5">
                    <div className="min-w-0">
                      <h1 className="truncate whitespace-nowrap text-[18px] font-black tracking-[-0.045em] text-black">
                        가능한 시간을 선택해주세요.
                      </h1>
                    </div>
                  </header>
                  <div>
                    {availableTickets.map((ticket, index) => (
                      <motion.div
                        key={ticket.id}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.32,
                          delay: shouldReduceMotion ? 0 : Math.min(index * 0.05, 0.2),
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <ProgramListOption
                          ticket={ticket}
                          application={applicationByDate.get(ticket.date) ?? null}
                          disabled={saving}
                          onOpen={() => openTicket(ticket)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <p className="font-ticket-latin text-[12px] font-bold italic uppercase tracking-[0.18em] text-black/35">
                    UPCOMING PROGRAMS
                  </p>
                  <h1 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-black">
                    새로운 모임을 준비 중이에요.
                  </h1>
                  <p className="mt-3 text-sm font-semibold leading-6 text-black/42">
                    공개되면 이곳에서 바로 보여드릴게요.
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

    </section>
  );
}

const meetingWeekdayLabels = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;

function programDateLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = meetingWeekdayLabels[date.getUTCDay()] ?? "";
  return `${month}월 ${day}일 ${weekday}`;
}

function ProgramListOption({
  ticket,
  application,
  disabled,
  onOpen,
}: {
  ticket: GatheringTicket;
  application: MeetingDateApplication | null;
  disabled: boolean;
  onOpen: () => void;
}) {
  const singleLineTitle = ticket.title.replace(/\s+/g, " ").trim();
  const applicationClosed = ticket.applicationClosed === true;

  return (
    <motion.button
      type="button"
      data-testid={`meeting-program-${ticket.id}`}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.985 } : undefined}
      onClick={onOpen}
      className="group relative w-full overflow-hidden border-b border-black/[0.075] px-5 py-[18px] text-left transition last:border-b-0 hover:bg-black/[0.018] disabled:cursor-default disabled:opacity-55"
    >
      <span className="flex items-center justify-between gap-4">
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-bold tracking-[-0.02em] text-black/90">
            <span>{programDateLabel(ticket.date)}</span>
            <span aria-hidden>·</span>
            <span>{formatTicketTimeLabel(ticket.time)}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{application?.region || ticket.area}</span>
          </span>
          <span
            title={singleLineTitle}
            className="mt-1.5 block truncate whitespace-nowrap text-[17px] font-black leading-6 tracking-[-0.04em] text-black"
          >
            {singleLineTitle}
          </span>
          {(applicationClosed || application) && (
            <span className="mt-2 inline-flex rounded-full bg-black/[0.055] px-2 py-0.5 text-[9px] font-black text-black/48">
              {applicationClosed
                ? "마감"
                : application?.status === "payment_pending"
                  ? "결제 대기"
                  : "신청 완료"}
            </span>
          )}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-black/42 transition group-hover:translate-x-0.5 group-hover:text-black">
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden />
        </span>
      </span>
    </motion.button>
  );
}

function TicketDetailRevealHeader({
  title,
  meta,
}: {
  title: string;
  meta: string;
}) {
  return (
    <motion.header
      initial={{ y: "32vh" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      className="px-10 text-center"
    >
      <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
        {title.replace(/\s+/g, " ").trim()}
      </h1>
      <p className="font-ticket-latin mt-4 text-[13px] font-medium text-[#24211d]/75">
        {meta}
      </p>
    </motion.header>
  );
}

function TicketUnlockSequence({
  motionKey,
  title,
  dateText,
  timeText,
  placeText,
  reducedMotion,
  onBack,
  onComplete,
}: {
  motionKey: string;
  title: string;
  dateText: string;
  timeText: string;
  placeText: string;
  reducedMotion: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const cleanTitle = title.replace(/\s+/g, " ").trim();
  const meta = `${dateText} · ${timeText} · ${placeText}`;
  const [phase, setPhase] = useState<"locked" | "typing">("locked");
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [typedParts, setTypedParts] = useState<[string, string, string, string]>([
    "",
    "",
    "",
    "",
  ]);
  const [activeTypingPart, setActiveTypingPart] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const unlockTrackRef = useRef<HTMLDivElement>(null);
  const draggingPointerRef = useRef<number | null>(null);
  const unlockProgressRef = useRef(0);
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const unlock = () => {
    if (phase !== "locked" || hasUnlockedRef.current) return;
    hasUnlockedRef.current = true;
    unlockProgressRef.current = 100;
    setUnlockProgress(100);
    window.setTimeout(() => setPhase("typing"), reducedMotion ? 0 : 260);
  };

  const setProgress = (value: number) => {
    const nextValue = Math.min(100, Math.max(0, value));
    unlockProgressRef.current = nextValue;
    setUnlockProgress(nextValue);
  };

  const updateProgressFromPointer = (clientX: number) => {
    const track = unlockTrackRef.current;
    if (!track) return unlockProgressRef.current;

    const bounds = track.getBoundingClientRect();
    const thumbCenterInset = 28;
    const dragWidth = Math.max(1, bounds.width - thumbCenterInset * 2);
    const nextProgress =
      ((clientX - bounds.left - thumbCenterInset) / dragWidth) * 100;
    setProgress(nextProgress);
    return Math.min(100, Math.max(0, nextProgress));
  };

  useEffect(() => {
    if (phase !== "typing") return;
    if (reducedMotion) {
      setTypedParts([cleanTitle, dateText, timeText, placeText]);
      setActiveTypingPart(-1);
      const finishTimer = window.setTimeout(() => onCompleteRef.current(), 120);
      return () => window.clearTimeout(finishTimer);
    }

    const parts = [cleanTitle, dateText, timeText, placeText];
    let partIndex = 0;
    let characterIndex = 0;
    let typingTimer = 0;

    const typeNextCharacter = () => {
      const targetPartIndex = partIndex;
      const currentPart = parts[partIndex] ?? "";
      characterIndex += 1;
      const visibleCharacterCount = characterIndex;
      setTypedParts((previous) => {
        const next = [...previous] as [string, string, string, string];
        next[targetPartIndex] = currentPart.slice(0, visibleCharacterCount);
        return next;
      });

      if (characterIndex < currentPart.length) {
        typingTimer = window.setTimeout(typeNextCharacter, partIndex === 0 ? 92 : 54);
        return;
      }

      if (partIndex < parts.length - 1) {
        partIndex += 1;
        characterIndex = 0;
        setActiveTypingPart(partIndex);
        typingTimer = window.setTimeout(typeNextCharacter, 190);
        return;
      }

      setActiveTypingPart(-1);
      typingTimer = window.setTimeout(() => onCompleteRef.current(), 720);
    };

    setTypedParts(["", "", "", ""]);
    setActiveTypingPart(0);
    typingTimer = window.setTimeout(typeNextCharacter, 260);

    return () => window.clearTimeout(typingTimer);
  }, [cleanTitle, dateText, phase, placeText, reducedMotion, timeText]);

  const typingCursor = (partIndex: number, tall = false) =>
    activeTypingPart === partIndex ? (
      <span
        className={`ml-1 inline-block w-px animate-pulse bg-black/60 align-middle ${
          tall ? "h-7" : "h-3.5"
        }`}
      />
    ) : null;

  return (
    <motion.section
      key={`ticket-unlock-${motionKey}`}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.24, ease: "easeOut" }}
      className="relative flex min-h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#fbf9f4_0%,#f6f2ea_56%,#f0ece3_100%)] px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]"
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "locked" ? (
          <motion.div
            key="locked"
            layoutId="program-selection-panel"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.52,
              ease: [0.22, 1, 0.36, 1],
              layout: { duration: reducedMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] },
            }}
            className="flex flex-1 flex-col items-center justify-center"
          >
            <div className="w-full max-w-[342px] overflow-hidden rounded-[22px] border border-[#d0cbbc]/80 bg-[#f8f5ee]/92 shadow-[0_18px_44px_rgba(66,57,44,0.1)] backdrop-blur-xl">
              <div className="relative min-h-[88px] px-5 py-4 pr-12 text-left">
                <p className="truncate text-[11px] font-bold tracking-[-0.02em] text-black/46">
                  {meta}
                </p>
                <h1 className="mt-1.5 break-keep text-[18px] font-black leading-[1.35] tracking-[-0.045em] text-black">
                  {cleanTitle}
                </h1>
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="선택 취소"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-black/38"
                >
                  <X size={16} strokeWidth={1.7} aria-hidden />
                </button>
              </div>

              <div
                ref={unlockTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="밀어서 티켓 열기"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(unlockProgress)}
                onPointerDown={(event) => {
                  if (!event.isPrimary || hasUnlockedRef.current) return;
                  event.preventDefault();
                  draggingPointerRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateProgressFromPointer(event.clientX);
                }}
                onPointerMove={(event) => {
                  if (draggingPointerRef.current !== event.pointerId) return;
                  event.preventDefault();
                  updateProgressFromPointer(event.clientX);
                }}
                onPointerUp={(event) => {
                  if (draggingPointerRef.current !== event.pointerId) return;
                  event.preventDefault();
                  const progress = updateProgressFromPointer(event.clientX);
                  draggingPointerRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  if (progress >= 82) unlock();
                  else setProgress(0);
                }}
                onPointerCancel={(event) => {
                  if (draggingPointerRef.current !== event.pointerId) return;
                  draggingPointerRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  setProgress(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setProgress(unlockProgressRef.current + 5);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault();
                    setProgress(unlockProgressRef.current - 5);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setProgress(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    unlock();
                  }
                }}
                className="relative h-[56px] touch-none select-none overflow-hidden border-t border-black/[0.075] bg-[#ede8de] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/35"
              >
                <motion.div
                  className="absolute inset-y-0 left-0 bg-black/[0.045]"
                  animate={{ width: `${unlockProgress}%` }}
                  transition={{ duration: 0.05, ease: "linear" }}
                />
                <motion.p
                  className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-[12px] font-bold tracking-[-0.02em]"
                  style={{
                    backgroundImage:
                      "linear-gradient(100deg, rgba(36,33,29,0.28) 20%, rgba(36,33,29,0.88) 48%, rgba(255,255,255,0.92) 53%, rgba(36,33,29,0.88) 58%, rgba(36,33,29,0.28) 80%)",
                    backgroundSize: "240% 100%",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    WebkitTextFillColor: "transparent",
                  }}
                  animate={{ backgroundPosition: ["190% 0%", "-90% 0%"] }}
                  transition={{ duration: 1.8, ease: "linear", repeat: Infinity, repeatDelay: 0.15 }}
                >
                  밀어서 티켓 열기
                </motion.p>
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute -top-4 h-20 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/75 to-transparent blur-[3px]"
                  animate={{ left: ["-25%", "115%"] }}
                  transition={{ duration: 1.75, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.25 }}
                />
                <motion.span
                  className="pointer-events-none absolute left-1 top-1 z-10 flex h-12 w-12 items-center justify-center rounded-[15px] border border-black/[0.065] bg-[#f3efe6] text-black/70 shadow-[6px_0_16px_rgba(66,57,44,0.09)]"
                  animate={{ left: `calc(4px + ${unlockProgress}% - ${unlockProgress * 0.56}px)` }}
                  transition={{ duration: 0.045, ease: "linear" }}
                >
                  <ChevronRight size={20} strokeWidth={1.8} aria-hidden />
                </motion.span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="typing"
            initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{
              opacity: 1,
              y: -54,
              scale: 1,
            }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 items-center justify-center"
          >
            <motion.div
              className="w-full px-10 text-center"
            >
              <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
                {typedParts[0]}
                {typingCursor(0, true)}
              </h1>
              <div className="font-ticket-latin mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] font-medium text-[#24211d]/75">
                <span className="min-w-1">
                  {typedParts[1]}
                  {typingCursor(1)}
                </span>
                {typedParts[2] && <span aria-hidden>·</span>}
                <span className="min-w-1">
                  {typedParts[2]}
                  {typingCursor(2)}
                </span>
                {typedParts[3] && <span aria-hidden>·</span>}
                <span className="min-w-1">
                  {typedParts[3]}
                  {typingCursor(3)}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function MembershipPurchaseBottomSheet({
  ticket,
  standalone = false,
  saving,
  error,
  onSubmit,
  onSingleUseSubmit,
  onClose,
}: {
  ticket: GatheringTicket | null;
  standalone?: boolean;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
  onSingleUseSubmit?: () => void;
  onClose: () => void;
}) {
  const membershipReferenceDate = ticket?.date ?? todayInKst();
  const period = oneMonthMembershipPeriod(membershipReferenceDate);
  const [purchaseType, setPurchaseType] = useState<"membership" | "single">(
    "membership",
  );
  const [sheetStep, setSheetStep] = useState<
    "purchase" | "payment_terms" | "cancellation_policy"
  >("purchase");
  const membershipSelected = purchaseType === "membership";
  const totalPrice = membershipSelected
    ? 20_000
    : MEETING_DATE_SINGLE_USE_AMOUNT;
  const singleUseUnavailable = !membershipSelected && !onSingleUseSubmit;
  const selectionDeadline = ticket
    ? paymentSelectionDeadlineLabel(ticket.date, ticket.time)
    : "";
  const finalSubmit = membershipSelected ? onSubmit : onSingleUseSubmit;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const checkoutOrigin = new URL(membershipStoreUrls.one_month).origin;
    const existingPreconnect = document.head.querySelector(
      `link[data-membership-checkout-preconnect="${checkoutOrigin}"]`,
    );
    if (!existingPreconnect) {
      const preconnect = document.createElement("link");
      preconnect.rel = "preconnect";
      preconnect.href = checkoutOrigin;
      preconnect.crossOrigin = "anonymous";
      preconnect.dataset.membershipCheckoutPreconnect = checkoutOrigin;
      document.head.appendChild(preconnect);
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <motion.div
      key={`membership-purchase-sheet-${ticket?.id ?? "account"}`}
      className="fixed inset-0 z-[120] isolate flex items-end justify-center bg-black/[0.3] backdrop-blur-[5px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-purchase-title"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 34 }}
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 max-h-[calc(100dvh-18px)] w-full max-w-[430px] overflow-y-auto rounded-t-[32px] border border-b-0 border-black/10 bg-[#f7f4ed] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 opacity-100 shadow-[0_-24px_80px_rgba(0,0,0,0.28)] scrollbar-none"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-black/14" />

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-ticket-latin text-[11px] font-bold italic uppercase tracking-[0.2em] text-black/34">
              {sheetStep === "purchase" ? "PAYMENT" : "BEFORE PAYMENT"}
            </p>
            <h2
              id="membership-purchase-title"
              className="font-ticket-display mt-2 text-[27px] font-bold leading-[1.25] tracking-[-0.045em] text-black"
            >
              {sheetStep === "purchase"
                ? standalone
                  ? "멤버십을 시작해주세요."
                  : "참여 방식을 선택해주세요."
                : sheetStep === "payment_terms"
                  ? "결제 조건"
                  : "취소 정책"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sheetStep !== "purchase" && (
              <button
                type="button"
                onClick={() =>
                  setSheetStep((current) =>
                    current === "cancellation_policy"
                      ? "payment_terms"
                      : "purchase",
                  )
                }
                disabled={saving}
                aria-label="이전 단계"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/55 text-black/48 disabled:opacity-35"
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="멤버십 신청 닫기"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/55 text-black/48 disabled:opacity-35"
            >
              <X size={17} aria-hidden />
            </button>
          </div>
        </div>

        {sheetStep === "purchase" ? (
          <>
        {!standalone && (
        <div className="mt-6 grid grid-cols-2 rounded-full border border-black/10 bg-black/[0.035] p-1.5">
          <button
            type="button"
            onClick={() => setPurchaseType("membership")}
            className={cn(
              "min-h-[58px] rounded-full px-3 py-2 text-left transition",
              membershipSelected
                ? "bg-[#24211d] text-white shadow-[0_6px_18px_rgba(0,0,0,0.16)]"
                : "text-black/42",
            )}
            aria-pressed={membershipSelected}
          >
            <span className="block text-center text-[13px] font-black">1개월 멤버십</span>
          </button>
          <button
            type="button"
            onClick={() => setPurchaseType("single")}
            className={cn(
              "min-h-[58px] rounded-full px-3 py-2 text-left transition",
              !membershipSelected
                ? "bg-[#24211d] text-white shadow-[0_6px_18px_rgba(0,0,0,0.16)]"
                : "text-black/42",
            )}
            aria-pressed={!membershipSelected}
          >
            <span className="block text-center text-[13px] font-black">1회 이용권</span>
          </button>
        </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={purchaseType}
            initial={{ opacity: 0, x: membershipSelected ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: membershipSelected ? 8 : -8 }}
            transition={{ duration: 0.18 }}
            className="mt-5 overflow-hidden rounded-[24px] border border-black/10 bg-white/34"
          >
            <div className="px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-bold text-black/42">
                    {membershipSelected ? "1개월 멤버십" : "1회 이용권"}
                  </p>
                  <p className="mt-2 break-keep text-[15px] font-black leading-6 text-black">
                  {membershipSelected
                    ? "한 달 동안 횟수 제한 없이 참여해요."
                    : "선택한 이번 모임에 한 번 참여해요."}
                  </p>
                  {membershipSelected && (
                    <p className="mt-1.5 break-keep text-[12px] font-semibold leading-5 text-black/48">
                      매칭된 1:1 데이트도 추가 비용 없이 참여할 수 있어요.
                    </p>
                  )}
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-white">
                  <Check size={14} strokeWidth={3} aria-hidden />
                </span>
              </div>

              <div className="mt-5 border-t border-black/[0.08] pt-4">
                <p className="text-[11px] font-bold text-black/38">
                  {membershipSelected ? "이용 기간" : "이용 일정"}
                </p>
                <p className="mt-1.5 tabular-nums text-[15px] font-bold tracking-[-0.015em] text-black">
                  {membershipSelected
                    ? standalone
                      ? "첫 모임 시작일부터 1개월"
                      : `${period.start} – ${period.end}`
                    : ticket
                      ? `${meetingDateLabel(ticket.date)} · ${formatTicketTimeLabel(ticket.time)}`
                      : ""}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-black/38">
                  {membershipSelected
                    ? standalone
                      ? "자동 결제 없이 한 번만 결제돼요."
                      : `${meetingDateLabel(ticket!.date)} 모임 시작 기준`
                    : ticket?.title}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-black/[0.08] px-5 py-4">
              <span className="text-[12px] font-bold text-black/42">총 결제금액</span>
              <strong className="tabular-nums text-[22px] font-black tracking-[-0.035em] text-black">
                {totalPrice.toLocaleString("ko-KR")}원
              </strong>
            </div>
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
            {error}
          </p>
        )}

        <motion.button
          type="button"
          whileTap={!saving && !singleUseUnavailable ? { scale: 0.985 } : undefined}
          disabled={saving || singleUseUnavailable}
          onClick={() => {
            if (standalone) {
              onSubmit();
              return;
            }
            setSheetStep("payment_terms");
          }}
          className="font-ticket-display mt-6 flex h-[58px] w-full items-center justify-center rounded-full bg-black px-5 text-[16px] font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)] disabled:bg-black/20"
        >
          {saving ? (
            <span className="inline-flex items-center justify-center gap-2.5">
              <LoaderCircle
                size={18}
                strokeWidth={2.2}
                className="animate-spin"
                aria-hidden
              />
              <span>결제창을 준비하는 중...</span>
            </span>
          ) : (
            singleUseUnavailable
              ? "1회 이용권 결제 준비 중"
              : `${totalPrice.toLocaleString("ko-KR")}원 결제하기`
          )}
        </motion.button>

          </>
        ) : sheetStep === "payment_terms" ? (
          <PaymentTermsStep
            deadlineLabel={selectionDeadline}
            onNext={() => setSheetStep("cancellation_policy")}
          />
        ) : (
          <CancellationPolicyStep
            deadlineLabel={selectionDeadline}
            totalPrice={totalPrice}
            saving={saving}
            error={error}
            onSubmit={() => finalSubmit?.()}
          />
        )}

      </motion.section>
    </motion.div>
  );
}

function PaymentTermsStep({
  deadlineLabel,
  onNext,
}: {
  deadlineLabel: string;
  onNext: () => void;
}) {
  return (
    <motion.div
      key="payment-terms-step"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="mt-3 text-right text-[11px] font-bold tabular-nums text-black/32">
        1 / 2
      </p>
      <div className="mt-4 rounded-[26px] border border-black/10 bg-white/34 px-5 py-6">
        <div className="space-y-6 break-keep text-[15px] font-semibold leading-[1.75] tracking-[-0.025em] text-black/58">
          <p className="text-black/78">
            계속 진행하면 교집합이 당신에게 맞는 사람들을 찾아드립니다.
          </p>
          <p>
            어울리는 조합이 준비된 경우, <strong className="font-black text-black/82">{deadlineLabel}</strong>까지
            최종 선정 여부를 안내받게 됩니다.
          </p>
          <p>
            선정되지 않을 경우 결제 금액은 자동으로 환불됩니다.
          </p>
        </div>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        onClick={onNext}
        className="font-ticket-display mt-6 flex h-[58px] w-full items-center justify-center rounded-full bg-black px-5 text-[16px] font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
      >
        다음
      </motion.button>
    </motion.div>
  );
}

function CancellationPolicyStep({
  deadlineLabel,
  totalPrice,
  saving,
  error,
  onSubmit,
}: {
  deadlineLabel: string;
  totalPrice: number;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      key="cancellation-policy-step"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="mt-3 text-right text-[11px] font-bold tabular-nums text-black/32">
        2 / 2
      </p>
      <div className="mt-4 rounded-[26px] border border-black/10 bg-white/34 px-5 py-6">
        <div className="space-y-5 break-keep text-[14px] font-semibold leading-[1.7] tracking-[-0.02em] text-black/58">
          <p className="text-black/78">
            교집합은 확정 후 취소를 허용하지 않습니다. 갑작스러운 취소는
            당신이 오기를 기대했던 함께할 멤버들의 경험을 망칠 수 있습니다.
          </p>
          <p>
            <strong className="font-black text-black/82">{deadlineLabel}</strong>까지 확정 여부가 안내됩니다.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[20px] border border-black/[0.09] bg-[#f7f4ed]/70">
          <div className="px-4 py-4">
            <p className="text-[13px] font-black leading-5 text-black/78">
              {deadlineLabel} 이전 취소
            </p>
            <p className="mt-1.5 text-[12px] font-semibold leading-5 text-black/45">
              결제 금액 전액 자동 환불, 추가 수수료 없음
            </p>
          </div>
          <div className="border-t border-black/[0.08] px-4 py-4">
            <p className="text-[13px] font-black leading-5 text-black/78">
              {deadlineLabel} 이후 취소
            </p>
            <p className="mt-1.5 text-[12px] font-semibold leading-5 text-black/45">
              환불 불가
            </p>
          </div>
          <div className="border-t border-black/[0.08] px-4 py-4">
            <p className="text-[13px] font-black leading-5 text-black/78">
              사전 연락 없이 불참
            </p>
            <p className="mt-1.5 text-[12px] font-semibold leading-5 text-black/45">
              환불 불가, 교집합 모든 서비스 이용이 제한될 수 있음
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <motion.button
        type="button"
        whileTap={!saving ? { scale: 0.985 } : undefined}
        disabled={saving}
        onClick={onSubmit}
        className="font-ticket-display mt-6 flex h-[58px] w-full items-center justify-center rounded-full bg-black px-5 text-[16px] font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)] disabled:bg-black/20"
      >
        {saving ? (
          <span className="inline-flex items-center justify-center gap-2.5">
            <LoaderCircle
              size={18}
              strokeWidth={2.2}
              className="animate-spin"
              aria-hidden
            />
            <span>결제창을 준비하는 중...</span>
          </span>
        ) : (
          `${totalPrice.toLocaleString("ko-KR")}원 결제하기`
        )}
      </motion.button>
    </motion.div>
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

function blindDateCandidateDateLabel(dates: string[]) {
  if (dates.length === 0) return "날짜 선택 전";
  const sortedDates = [...dates].sort();
  if (sortedDates.length === 1) return blindDateDateLabel(sortedDates[0]);
  return `${blindDateDateLabel(sortedDates[0])} – ${blindDateDateLabel(sortedDates[sortedDates.length - 1])}`;
}

function blindDateListStatusLabel(offer: BlindDateUserOffer) {
  if (offer.ownResponse === "pending") return "응답 필요";
  if (offer.status === "scheduled") return "일정 확정";
  if (offer.status === "needs_reschedule") return "일정 조율 중";
  return "응답 대기";
}

function BlindDateOfferList({
  offers,
  embedded,
  onClose,
  onSelect,
}: {
  offers: BlindDateUserOffer[];
  embedded: boolean;
  onClose: () => void;
  onSelect: (offer: BlindDateUserOffer) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative bg-transparent px-5 pb-10 pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]",
        embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="블라인드 데이트 일정 목록 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/55 shadow-sm backdrop-blur-md"
      >
        <X size={18} strokeWidth={1.9} aria-hidden />
      </button>

      <div className="mx-auto w-full max-w-[390px]">
        <p className="font-ticket-latin text-[11px] font-bold uppercase tracking-[0.14em] text-black/35">
          Blind Date
        </p>
        <h1 className="font-ticket-display mt-2 text-[28px] font-bold tracking-[-0.045em] text-black">
          예정된 일정을 선택해주세요.
        </h1>
        <p className="mt-3 break-keep text-[13px] font-semibold leading-6 text-black/46">
          일정을 선택하면 해당 블라인드 데이트 티켓을 열 수 있어요.
        </p>

        <div className="mt-8 space-y-3">
          {offers.map((offer, index) => {
            const dateLabel = offer.scheduledDate
              ? blindDateDateLabel(offer.scheduledDate)
              : blindDateCandidateDateLabel(offer.candidateDates);
            const statusLabel = blindDateListStatusLabel(offer);

            return (
              <motion.button
                key={offer.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index * 0.06, 0.24),
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelect(offer)}
                aria-label={`${dateLabel} ${offer.timeLabel} ${offer.region} 블라인드 데이트 티켓 열기`}
                className="group w-full rounded-[24px] border border-black/10 bg-white/72 px-5 py-5 text-left shadow-[0_12px_34px_rgba(35,31,24,0.06)] backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black tracking-[0.04em] text-white">
                        {statusLabel}
                      </span>
                      <span className="text-[11px] font-bold text-black/38">
                        {dateLabel}
                      </span>
                    </div>

                    <p className="font-ticket-display mt-4 text-[21px] font-bold tracking-[-0.04em] text-black">
                      {offer.template.title}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-black/48">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} strokeWidth={1.8} aria-hidden />
                        {offer.timeLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} strokeWidth={1.8} aria-hidden />
                        {offer.region}
                      </span>
                    </div>

                    {offer.actualPlaceName && (
                      <p className="mt-3 truncate text-[12px] font-bold text-black/62">
                        {offer.actualPlaceName}
                      </p>
                    )}
                  </div>

                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#f7f4ed] text-black/42 transition group-hover:text-black/65">
                    <ChevronRight size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

function shouldPlayBlindDateUnlock(offer: BlindDateUserOffer) {
  return offer.ownResponse === "pending" || offer.status === "scheduled";
}

function blindDateStartAt(offer: BlindDateUserOffer) {
  return blindDateStartAtFromParts(offer.scheduledDate, offer.timeLabel);
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

function remainingTimeText(expiresAt: string, nowMs = Date.now()) {
  const target = new Date(expiresAt);
  const remainingMs = target.getTime() - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const timeText = days > 0
    ? `${days}일 ${hours}시간 ${minutes}분`
    : hours > 0
      ? `${hours}시간 ${minutes}분`
      : `${minutes}분`;

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
  bundledOffers,
  userName,
  profilePhotoUrl,
  ticketDetailMode = false,
  onClose,
  onOffersChange,
}: {
  offer: BlindDateUserOffer;
  bundledOffers: BlindDateUserOffer[];
  userName?: string | null;
  profilePhotoUrl?: string | null;
  ticketDetailMode?: boolean;
  onClose: () => void;
  onOffersChange?: (offers: BlindDateUserOffer[]) => void;
}) {
  const [currentOffer, setCurrentOffer] = useState(offer);
  const [step, setStep] = useState<"invite" | "result">(
    offer.ownResponse === "pending" && !offer.isExpired ? "invite" : "result",
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [desiredMeetingCount, setDesiredMeetingCount] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayUserName = Array.from(userName?.trim() || "회원")
    .slice(-2)
    .join("");
  const remainingText = useBlindDateRemainingText(currentOffer.expiresAt);
  const responseWindowClosed =
    currentOffer.isExpired ||
    (!remainingText &&
      ["offered", "waiting_response"].includes(currentOffer.status));

  useEffect(() => {
    setCurrentOffer(offer);
    setStep(offer.ownResponse === "pending" && !offer.isExpired ? "invite" : "result");
    setSelectedDates([]);
    setDesiredMeetingCount(null);
    setError(null);
  }, [offer]);

  const respond = async (action: "yes" | "no", availableDates: string[] = []) => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const offersToRespond = bundledOffers.length
        ? bundledOffers
        : [currentOffer];
      let updatedCurrentOffer: BlindDateUserOffer | null = null;
      let updatedOffers: BlindDateUserOffer[] | null = null;

      for (const targetOffer of offersToRespond) {
        const response = await fetch("/api/meetings/blind-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: targetOffer.id,
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

        if (targetOffer.id === currentOffer.id) updatedCurrentOffer = data.offer;
        updatedOffers = data.offers ?? updatedOffers;
      }

      const resultOffer =
        updatedCurrentOffer ??
        updatedOffers?.find((item) => item.id === currentOffer.id) ??
        currentOffer;
      setCurrentOffer(resultOffer);
      if (updatedOffers) onOffersChange?.(updatedOffers);
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
        aria-label={ticketDetailMode ? "티켓 상세 닫기" : "블라인드 데이트 초대장 닫기"}
        className={cn(
          "absolute z-30 flex h-10 w-10 shrink-0 items-center justify-center text-black/55 transition hover:text-black disabled:opacity-40",
          ticketDetailMode
            ? "-left-1 top-[calc(-14px+env(safe-area-inset-top))]"
            : "left-0 top-[calc(6px+env(safe-area-inset-top))] rounded-full border border-black/10 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md",
        )}
      >
        <X size={18} aria-hidden />
      </button>

      {step !== "result" && responseWindowClosed ? (
        <BlindDateResultMessage
          tone="muted"
          title="응답 시간이 지나 초대장이 만료되었어요."
          body="만료된 초대장은 추천탭 알림에서 제외돼요."
        />
      ) : step === "result" ? (
        <BlindDateResponseResult
          offer={currentOffer}
          remainingText={remainingText}
          profilePhotoUrl={profilePhotoUrl}
          onOfferChange={setCurrentOffer}
        />
      ) : (
        <section>
          <TicketDetailRevealHeader
            title={currentOffer.template.title}
            meta={`${blindDateCandidateDateLabel(currentOffer.candidateDates)} · ${currentOffer.timeLabel} · ${currentOffer.region}`}
          />

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
            className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] pt-5 text-[#24211d]"
          >
            <p className="break-keep px-1 text-[13px] font-semibold leading-6 text-black/52">
              <span>
                지난 모임에서 {displayUserName}님이 단 둘이 만나고 싶다고 선택한 사람도, {displayUserName}님을 선택했어요.
              </span>
              <span className="mt-2 block">
                교집합이 블라인드 데이트 자리를 마련해드립니다.
              </span>
            </p>

            <BlindDateDateCalendar
              dates={currentOffer.candidateDates}
              selectedDates={selectedDates}
              saving={saving}
              onToggle={toggleDate}
            />

            <section className="mt-5 rounded-[22px] border border-[#d0cbbc]/70 bg-[#f8f5ee]/80 p-4">
              <h2 className="text-sm font-black text-black">
                참여 여부
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "YES", value: 1 },
                  { label: "NO", value: 0 },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={desiredMeetingCount === value}
                    onClick={() => setDesiredMeetingCount(value)}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-[14px] border text-sm font-black transition",
                      desiredMeetingCount === value
                        ? "border-black bg-black text-white shadow-sm"
                        : "border-black/10 bg-[#f7f4ed] text-black/45 hover:border-black/25 hover:text-black",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 min-h-[18px]">
                <p className="text-[11px] font-semibold leading-[18px] text-black/42">
                  서로 YES를 누른 경우에만 블라인드 데이트가 진행돼요.
                </p>
              </div>
            </section>

            <RouletteDeadlineCountdown
              deadlineAt={new Date(currentOffer.expiresAt)}
              activeLabel="응답 마감까지 남은 시간"
              closedLabel="응답이 마감됐어요"
            />

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                {error}
              </p>
            )}

            <motion.button
              whileTap={
                !saving &&
                desiredMeetingCount !== null &&
                (desiredMeetingCount === 0 || selectedDates.length > 0)
                  ? { scale: 0.985 }
                  : undefined
              }
              type="button"
              disabled={
                saving ||
                desiredMeetingCount === null ||
                (desiredMeetingCount > 0 && selectedDates.length === 0)
              }
              onClick={() =>
                void respond(
                  desiredMeetingCount === 0 ? "no" : "yes",
                  desiredMeetingCount === 0 ? [] : selectedDates,
                )
              }
              className="mt-5 h-[56px] w-full rounded-full bg-black text-sm font-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)] transition disabled:bg-black/15 disabled:text-white/35 disabled:shadow-none"
            >
              {saving ? "저장 중..." : "응답 제출하기"}
            </motion.button>
          </motion.div>
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
  const sortedDates = [...dates].sort();
  const firstDate = sortedDates[0];
  const firstDateParts = firstDate ? isoDateParts(firstDate) : null;

  if (!firstDateParts) {
    return (
      <p className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold text-black/45">
        선택 가능한 날짜가 아직 열리지 않았어요.
      </p>
    );
  }

  const visibleDates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(
      Date.UTC(
        firstDateParts.year,
        firstDateParts.month - 1,
        firstDateParts.day + index,
      ),
    );
    return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  });
  const lastDate = visibleDates[visibleDates.length - 1];
  const weekdayHeaders = visibleDates.slice(0, 7).map((date) => {
    const parts = isoDateParts(date);
    if (!parts) return "";
    return blindDateCalendarWeekdays[
      new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    ];
  });

  return (
    <section className="mt-5 rounded-[24px] border border-[#d0cbbc]/70 bg-[#f8f5ee]/80 p-4">
      <div>
        <h2 className="text-sm font-black text-black">가능한 날짜를 모두 선택해주세요.</h2>
        <p className="mt-1 text-[11px] font-semibold text-black/42">
          {blindDateDateLabel(firstDate)} – {blindDateDateLabel(lastDate)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-black/32">
        {weekdayHeaders.map((weekday, index) => (
          <span key={`${weekday}-${index}`} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {visibleDates.map((date) => {
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
                    ? "border-black/10 bg-[#f7f4ed] text-black hover:border-black/25"
                    : "border-transparent text-black/15",
                saving && enabled && "opacity-45",
              )}
            >
              <span>{parts?.day ?? ""}</span>
              {enabled && !selected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-black/35" />
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
  profilePhotoUrl,
  onOfferChange,
}: {
  offer: BlindDateUserOffer;
  remainingText: string | null;
  profilePhotoUrl?: string | null;
  onOfferChange: (offer: BlindDateUserOffer) => void;
}) {
  const stage = blindDateDisplayStage(offer);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const startAt = blindDateStartAt(offer);
  const feedbackAt = offer.feedbackOpensAt
    ? new Date(offer.feedbackOpensAt)
    : startAt
      ? new Date(startAt.getTime() + 3 * 60 * 60 * 1000)
      : null;
  const arrivalAt = offer.arrivalOpensAt
    ? new Date(offer.arrivalOpensAt)
    : startAt
      ? new Date(startAt.getTime() - 3 * 60 * 60 * 1000)
      : null;
  const progressStage: BlindDateProgressStage = offer.feedbackCompleted
    ? "done"
    : offer.canSubmitFeedback ||
        (feedbackAt && nowMs >= feedbackAt.getTime())
      ? "feedback"
      : offer.canSetArrival || (arrivalAt && nowMs >= arrivalAt.getTime())
        ? "arrival"
        : "confirmed";
  const activeProgressStage = progressStage === "done" ? "feedback" : progressStage;
  const [selectedProgressStage, setSelectedProgressStage] =
    useState<BlindDateSelectableProgressStage>("confirmed");

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedProgressStage(activeProgressStage);
  }, [activeProgressStage, offer.id]);

  if (stage === "scheduled" || stage === "guidance" || stage === "completed") {
    const isCompleted = stage === "completed";
    const placeName = offer.actualPlaceName || "장소 확인 중";
    const address = offer.actualPlaceAddress || "주소 확인 중";

    return (
      <section>
        <TicketDetailRevealHeader
          title={offer.template.title}
          meta={`${offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : "날짜 확인 중"} · ${offer.timeLabel} · ${offer.region}`}
        />

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 pt-1 text-[#24211d]"
        >
          <BlindDateTicketStatusOverview
            offer={offer}
            progressStage={progressStage}
            selectedStage={selectedProgressStage}
            onSelectStage={setSelectedProgressStage}
            nowMs={nowMs}
            startAt={startAt}
            arrivalAt={arrivalAt}
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedProgressStage}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {selectedProgressStage === "confirmed" && (
                <BlindDateJourneySections
                  offer={offer}
                  placeName={placeName}
                  address={address}
                  profilePhotoUrl={profilePhotoUrl}
                />
              )}

              {selectedProgressStage === "arrival" && (
                <>
                  <BlindDateArrivalPanel
                    offer={offer}
                    enabled={progressStage === "arrival"}
                    onOfferChange={onOfferChange}
                  />
                  <BlindDateJourneySections
                    offer={offer}
                    placeName={placeName}
                    address={address}
                    profilePhotoUrl={profilePhotoUrl}
                  />
                </>
              )}

              {selectedProgressStage === "feedback" && (
                <BlindDateFeedbackForm offer={offer} onOfferChange={onOfferChange} />
              )}
            </motion.div>
          </AnimatePresence>

          {isCompleted && progressStage === "confirmed" && (
            <p className="mt-4 text-xs font-semibold text-black/40">
              만남 시간이 확인되면 다음 안내가 자동으로 열려요.
            </p>
          )}
        </motion.div>
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
      <h1 className="text-[24px] font-bold leading-8 tracking-tight text-black">
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

type BlindDateProgressStage = "confirmed" | "arrival" | "feedback" | "done";
type BlindDateSelectableProgressStage = Exclude<BlindDateProgressStage, "done">;

const blindDateProgressSteps: Array<{
  key: BlindDateSelectableProgressStage;
  label: string;
}> = [
    { key: "confirmed", label: "참여 확정" },
    { key: "arrival", label: "도착 안내" },
    { key: "feedback", label: "피드백" },
];

function blindDateProgressIndex(stage: BlindDateProgressStage) {
  const key = stage === "done" ? "feedback" : stage;
  return Math.max(
    blindDateProgressSteps.findIndex((step) => step.key === key),
    0,
  );
}

function blindDateProgressStatusLabel(stage: BlindDateProgressStage) {
  if (stage === "done") return "피드백을 완료했어요";
  if (stage === "feedback") return "피드백을 남겨주세요";
  if (stage === "arrival") return "도착 예정 시간을 알려주세요";
  return "참여가 확정됐어요";
}

function blindDateCountdownLabel({
  progressStage,
  nowMs,
  startAt,
  arrivalAt,
}: {
  progressStage: BlindDateProgressStage;
  nowMs: number;
  startAt: Date | null;
  arrivalAt: Date | null;
}) {
  const target = progressStage === "confirmed" ? arrivalAt : startAt;
  if (!target || target.getTime() <= nowMs) return null;
  const totalMinutes = Math.ceil((target.getTime() - nowMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const remaining = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  return progressStage === "confirmed"
    ? `도착 안내까지 ${remaining}`
    : `만남 시작까지 ${remaining}`;
}

function BlindDateTicketStatusOverview({
  offer,
  progressStage,
  selectedStage,
  onSelectStage,
  nowMs,
  startAt,
  arrivalAt,
}: {
  offer: BlindDateUserOffer;
  progressStage: BlindDateProgressStage;
  selectedStage: BlindDateSelectableProgressStage;
  onSelectStage: (stage: BlindDateSelectableProgressStage) => void;
  nowMs: number;
  startAt: Date | null;
  arrivalAt: Date | null;
}) {
  const activeIndex = blindDateProgressIndex(progressStage);
  const countdown = blindDateCountdownLabel({
    progressStage,
    nowMs,
    startAt,
    arrivalAt,
  });

  return (
    <section className="border-b border-black/8 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-black/42">
            current status
          </p>
          <h2 className="mt-1 text-[17px] font-black text-black">
            {blindDateProgressStatusLabel(progressStage)}
          </h2>
        </div>
        {countdown && (
          <p className="mt-1 shrink-0 rounded-full border border-[#d0cbbc] bg-[#f7f4ed] px-3 py-1.5 text-right text-[11px] font-black leading-4 text-black/62 shadow-[0_8px_18px_rgba(66,57,44,0.08)]">
            {countdown}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-black text-black">
          <CalendarDays size={14} className="text-black/35" aria-hidden />
          {offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : "날짜 확인 중"}{" "}
          {offer.timeLabel}
        </p>
        <p className="flex items-center gap-2 text-sm font-black text-black">
          <MapPin size={14} className="text-black/35" aria-hidden />
          {offer.region}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {blindDateProgressSteps.map((step, index) => {
          const reached = index <= activeIndex;
          const selected = step.key === selectedStage;
          const disabled = index > activeIndex;
          return (
            <div key={step.key} className="text-center">
              <div
                className={cn(
                  "h-1.5 rounded-full transition",
                  reached ? "bg-[#8f877a]" : "bg-black/8",
                )}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectStage(step.key)}
                aria-pressed={selected}
                className={cn(
                  "mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black transition",
                  selected
                    ? "bg-[#24211d] text-white ring-2 ring-[#d0cbbc] ring-offset-2 ring-offset-[#f7f4ed]"
                    : reached
                      ? "bg-black text-white"
                      : "bg-black/[0.05] text-black/30",
                )}
              >
                {reached ? <Check size={13} aria-hidden /> : index + 1}
              </button>
              <span
                className={cn(
                  "mt-2 block text-[10px] font-black",
                  selected ? "text-black" : reached ? "text-black/52" : "text-black/25",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const blindDateArrivalOptions = [
  { value: "on_time", label: "정상 도착 예정이에요" },
  { value: "late_10", label: "10분 정도 늦어요" },
  { value: "late_20", label: "20분 정도 늦어요" },
  { value: "late_30_plus", label: "30분 이상 늦어요" },
] as const;

function BlindDateArrivalPanel({
  offer,
  enabled,
  onOfferChange,
}: {
  offer: BlindDateUserOffer;
  enabled: boolean;
  onOfferChange: (offer: BlindDateUserOffer) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reservationName = offer.reservationName || "이소윤";
  const selectedArrivalLabel = blindDateArrivalOptions.find(
    (option) => option.value === offer.arrivalStatus,
  )?.label;

  const saveArrival = async (
    arrivalStatus: (typeof blindDateArrivalOptions)[number]["value"],
  ) => {
    if (!enabled || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/meetings/blind-dates/${encodeURIComponent(offer.id)}/arrival`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arrivalStatus }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { arrivalStatus?: BlindDateUserOffer["arrivalStatus"]; reservationName?: string | null }
        | null;
      if (!response.ok || !result?.arrivalStatus) throw new Error("arrival-save-failed");
      onOfferChange({
        ...offer,
        arrivalStatus: result.arrivalStatus,
        reservationName: result.reservationName ?? null,
      });
    } catch {
      setError("도착 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">
        도착 안내
      </h2>

      <div className="mt-4 rounded-2xl border border-[#d8d1c3]/80 bg-[#eee9df] px-4 py-3.5">
        <div className="flex min-h-7 items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm font-bold text-black/52">
            <UserRound size={15} className="text-black/38" aria-hidden />
            예약자명
          </span>
          <strong
            aria-label={offer.arrivalStatus ? reservationName : "도착 상태 선택 후 공개"}
            className={cn(
              "text-[15px] font-black tracking-[-0.02em] text-black transition-[filter,opacity] duration-300",
              offer.arrivalStatus
                ? "blur-0 opacity-100"
                : "select-none blur-[5px] opacity-55",
            )}
          >
            {reservationName}
          </strong>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-black/42">
          하단 도착상태를 표시하고, 예약자명을 확인하세요.
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        {blindDateArrivalOptions.map((option) => {
          const active = offer.arrivalStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving || !enabled}
              onClick={() => void saveArrival(option.value)}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-default",
                active
                  ? "border-black bg-black text-white"
                  : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/58",
                !enabled && !active && "opacity-55",
              )}
            >
              <span>{option.label}</span>
              {active && <Check size={16} aria-hidden />}
            </button>
          );
        })}
      </div>
      {!enabled && (
        <p className="mt-3 text-xs font-semibold leading-5 text-black/40">
          {selectedArrivalLabel
            ? "선택한 도착 상태예요."
            : "도착 상태 입력 시간이 종료됐어요."}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

function BlindDateRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (rating: number) => void;
}) {
  return (
    <div>
      <h3 className="text-[15px] font-black text-black">{label}</h3>
      <div className="mt-3 grid grid-cols-5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;
          return (
            <motion.button
              key={rating}
              type="button"
              whileTap={{ scale: 0.96 }}
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${rating}점`}
              onClick={() => onChange(rating)}
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
                  layoutId={`blind-date-rating-${label}`}
                  className="absolute bottom-0 h-0.5 w-5 rounded-full bg-black"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold text-black/35">
        <span>나쁨</span>
        <span>좋음</span>
      </div>
    </div>
  );
}

function BlindDateFeedbackForm({
  offer,
  onOfferChange,
}: {
  offer: BlindDateUserOffer;
  onOfferChange: (offer: BlindDateUserOffer) => void;
}) {
  const [counterpartRating, setCounterpartRating] = useState<number | null>(null);
  const [placeRating, setPlaceRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (offer.feedbackCompleted) {
    return (
      <section className="border-t border-black/8 py-5">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600">
            <Check size={20} aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-black text-emerald-950">
            피드백 작성을 완료했어요.
          </h2>
          <p className="mt-2 text-sm font-semibold text-emerald-800/70">
            다음 블라인드 데이트를 더 잘 준비하는 데 반영할게요.
          </p>
        </div>
      </section>
    );
  }

  const submit = async () => {
    if (!counterpartRating || !placeRating || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/meetings/blind-dates/${encodeURIComponent(offer.id)}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            counterpartRating,
            placeRating,
            comment: feedbackComment,
          }),
        },
      );
      if (!response.ok) throw new Error("feedback-save-failed");
      onOfferChange({ ...offer, feedbackCompleted: true, canSubmitFeedback: false });
    } catch {
      setError("피드백을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="font-ticket-display text-[19px] font-bold tracking-[-0.04em] text-black">
        블라인드 데이트는 어떠셨나요?
      </h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-black/45">
        상대방과 식당에 대한 피드백만 간단히 남겨주세요.
      </p>
      <div className="mt-6 grid gap-7">
        <BlindDateRating
          label="상대방과의 만남"
          value={counterpartRating}
          onChange={setCounterpartRating}
        />
        <BlindDateRating
          label={`식당 피드백${offer.actualPlaceName ? ` · ${offer.actualPlaceName}` : ""}`}
          value={placeRating}
          onChange={setPlaceRating}
        />
        <textarea
          value={feedbackComment}
          maxLength={500}
          rows={5}
          placeholder="교집합에 남기고 싶은 말을 적어주세요."
          aria-label="교집합에 남기고 싶은 말"
          onChange={(event) => setFeedbackComment(event.target.value)}
          className="w-full resize-none rounded-2xl border border-[#d8d1c3]/90 bg-[#eee9df] px-4 py-3 text-sm font-semibold leading-6 outline-none placeholder:text-black/28"
        />
      </div>
      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!counterpartRating || !placeRating || saving}
        onClick={() => void submit()}
        className="mt-6 h-14 w-full rounded-full bg-black text-sm font-black text-white disabled:bg-black/15 disabled:text-white/40"
      >
        {saving ? "저장 중..." : "피드백 제출하기"}
      </button>
    </section>
  );
}

function BlindDateJourneySections({
  offer,
  placeName,
  address,
  profilePhotoUrl,
}: {
  offer: BlindDateUserOffer;
  placeName: string;
  address: string;
  profilePhotoUrl?: string | null;
}) {
  const dateTimeLabel = [
    offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : null,
    offer.timeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const counterpartPhotoUrl = `/api/meetings/blind-dates/${encodeURIComponent(offer.id)}/counterpart-photo`;
  const startAt = blindDateStartAt(offer);
  const journeyTime = startAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(startAt)
    : offer.timeLabel;
  const journeyPlace = {
    name: offer.actualPlaceName,
    address: offer.actualPlaceAddress,
  };
  const journeySteps: NonNullable<GatheringTicket["courseSteps"]> = [
    {
      id: `blind-date-${offer.id}`,
      order: 1,
      title: "블라인드 데이트",
      activityType: "만남",
      placeName,
      address,
      place: journeyPlace,
      openOffsetMinutes: 0,
      isMainActivity: true,
    },
  ];
  const journeyTicket: GatheringTicket = {
    id: `blind-date-${offer.id}`,
    templateId: offer.template.id,
    title: offer.template.title,
    subtitle: "",
    date: offer.scheduledDate ?? "",
    time: journeyTime,
    area: offer.region,
    moodTags: [],
    peopleHint: "",
    reason: "",
    courseSteps: journeySteps,
    place: journeyPlace,
  };

  return (
    <div className="mt-5">
      <section className="py-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">
            여정
          </h2>
          <p className="font-ticket-latin text-[10px] italic tracking-[0.12em] text-black/36">
            {dateTimeLabel}
          </p>
        </div>

        <div className="mt-4">
          <TicketCoursePanel
            ticket={journeyTicket}
            steps={journeySteps}
            participantPhotoUrl={profilePhotoUrl}
            participantArrivalStatus={offer.arrivalStatus}
            counterpartArrivalStatus={offer.counterpartArrivalStatus}
            previewMatchPhotoUrls={[counterpartPhotoUrl]}
            previewOtherMemberPhotoUrls={[]}
            matchMemberCount={1}
            variant="blind-date"
            showFeedbackTime={false}
            showJoinCountdown={false}
          />
        </div>
      </section>

      <section className="border-t border-black/8 py-5">
        <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">
          장소
        </h2>
        <div className="mt-4 rounded-3xl border border-black/8 bg-white px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/48">
              <MapPin size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-base font-black leading-6 text-black">{placeName}</p>
              <p className="mt-1 text-[11px] font-bold text-black/40">{offer.region}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-black/62">
                {address}
              </p>
            </div>
          </div>
          {offer.actualPlaceName && (
            <BlindDateNaverMap
              placeName={offer.actualPlaceName}
              region={offer.region}
              address={offer.actualPlaceAddress}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function normalizeBlindDatePlaceText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]/gu, "");
}

function selectBlindDateNaverPlace(
  places: NaverPlace[],
  placeName: string,
  region: string,
) {
  const targetName = normalizeBlindDatePlaceText(placeName);
  const targetRegion = normalizeBlindDatePlaceText(region.replace(/^서울\s*/, ""));

  return (
    [...places].sort((left, right) => {
      const score = (place: NaverPlace) => {
        const resultName = normalizeBlindDatePlaceText(place.name);
        const address = normalizeBlindDatePlaceText(
          `${place.roadAddress ?? ""} ${place.jibunAddress ?? ""}`,
        );
        let value = 0;
        if (resultName === targetName) value += 100;
        else if (
          resultName.includes(targetName) ||
          targetName.includes(resultName)
        ) {
          value += 60;
        }
        if (targetRegion && address.includes(targetRegion)) value += 10;
        return value;
      };

      return score(right) - score(left);
    })[0] ?? null
  );
}

function BlindDateNaverMap({
  placeName,
  region,
  address,
}: {
  placeName: string;
  region: string;
  address?: string | null;
}) {
  const [place, setPlace] = useState<NaverPlace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = placeName;

    setPlace(null);
    setFailed(false);
    setIsLoading(true);

    fetch(`/api/places/search?query=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("blind-date-place-search-failed");
        return (await response.json()) as { places?: NaverPlace[] };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const nextPlace = selectBlindDateNaverPlace(
          data.places ?? [],
          placeName,
          region,
        );
        setPlace(nextPlace);
        setFailed(!nextPlace);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [placeName, region]);

  if (isLoading) {
    return (
      <div
        className="mt-3 h-[190px] animate-pulse rounded-2xl border border-black/8 bg-black/[0.035]"
        aria-label="네이버 지도 불러오는 중"
      />
    );
  }

  if (failed || !place) {
    if (address) {
      return (
        <NaverMapPreview
          place={{ name: placeName, address }}
          className="mt-3"
          heightClassName="h-[190px]"
        />
      );
    }

    return (
      <div className="mt-3 flex h-[96px] items-center justify-center rounded-2xl border border-black/8 bg-black/[0.025] px-5 text-center text-xs font-bold text-black/42">
        네이버 지도를 불러오지 못했어요.
      </div>
    );
  }

  return (
    <NaverMapPreview
      place={place}
      className="mt-3"
      heightClassName="h-[190px]"
    />
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
