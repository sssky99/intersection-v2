"use client";
import { normalizeFriendInvitationId } from "@/lib/friendInvitationLink";
import { ApplicationPathChoice, FriendApplicationFlow } from "./FriendApplicationFlow";
import { BlindDateInvitationFlow, BlindDateOfferList, blindDateCandidateDateLabel, blindDateDateLabel, shouldPlayBlindDateUnlock } from "@/features/blindDates/BlindDateInvitationFlow";
import { TicketDetailRevealHeader, meetingInvitationDisplayTitle } from "@/features/meetings/TicketDetailRevealHeader";

import { membershipApplicationLimitCount } from "@/lib/membershipApplicationCounter";

import { formatTicketTimeLabel } from "@/components/IntersectionTicketCard";
import {
  TicketDetailContent
} from "@/features/meetings/TicketDetailContent";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import { checkoutAttributionContext, trackEvent } from "@/lib/analytics";
import {
  MEETING_DATE_REGION,
  MEETING_DATE_SINGLE_USE_AMOUNT,
  isMeetingDateClosed,
  meetingDateApplicationDates,
  meetingDateLabel,
  meetingDateSchedule,
  type MeetingDateApplication
} from "@/lib/meetingDateApplications";
import { membershipPlanAmounts } from "@/lib/membershipPlans";
import { membershipStoreUrls } from "@/lib/membershipStore";
import { oneTimeTicketStoreUrl } from "@/lib/paymentStore";
import { todayInKst } from "@/lib/ticketDate";
import { saveGuestTicketInteraction } from "@/lib/ticketInteractions";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type {
  GatheringTicket,
  TicketInteraction,
  TicketInteractionStatus,
} from "@/types/ticket";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  LoaderCircle,
  X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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
  const receivedInvitationId = normalizeFriendInvitationId(searchParams.get("friendInvite"));
  const [receivedInvitation, setReceivedInvitation] = useState<{ id: string; eventId: string; photoUrl: string | null } | null>(null);
  const [receivedInvitationError, setReceivedInvitationError] = useState<string | null>(null);
  const handledReceivedInvitation = useRef<string | null>(null);
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [screen, setScreen] = useState<DateApplicationScreen>("intro");
  const [friendPhotoUrl, setFriendPhotoUrl] = useState<string | null>(null);
  const [friendPhone, setFriendPhone] = useState<string | null>(null);
  const [applicationPath, setApplicationPath] = useState<"solo" | "friend" | null>(null);
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
  const [friendInvitationRefresh, setFriendInvitationRefresh] = useState(0);
  const [hasSentFriendInvitation, setHasSentFriendInvitation] = useState(false);
  useEffect(() => {
    setFriendPhotoUrl(null);
    setHasSentFriendInvitation(false);
    if (!active || screen !== "ticket" || !selectedTicket?.id) return;
    if (receivedInvitation?.eventId === selectedTicket.id) {
      setHasSentFriendInvitation(true);
      setFriendPhotoUrl(receivedInvitation.photoUrl);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = async () => {
      try {
        const response = await fetch("/api/friend-invitations?eventId=" + encodeURIComponent(selectedTicket.id), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        setHasSentFriendInvitation(!["not_sent", "inactive"].includes(data.status));
        setFriendPhotoUrl(data.status === "sent" && typeof data.photoUrl === "string" ? data.photoUrl : null);
        if (data.status === "submitted" && ++attempts < 12) timer = setTimeout(load, 5000);
      } catch { /* Keep photos hidden until confirmed by the server. */ }
    };
    void load();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [active, screen, selectedTicket?.id, userId, friendInvitationRefresh, receivedInvitation]);

  const sendFriendInvitation = async (savedApplications: MeetingDateApplication[], eventId?: string) => {
    if (applicationPath !== "friend" || !friendPhone) return;
    const application = savedApplications.find((item) => item.eventId === eventId);
    if (!application) throw new Error("신청 기록을 확인하지 못해 친구 초대를 보내지 않았어요.");
    const response = await fetch("/api/friend-invitations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: application.id, phone: friendPhone, consent: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "친구 초대 문자를 보내지 못했어요.");
    setFriendInvitationRefresh((value) => value + 1);
  };

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [submittedDates, setSubmittedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlindDateOfferId, setSelectedBlindDateOfferId] =
    useState<string | null>(null);
  const [blindDateTicketClosing, setBlindDateTicketClosing] = useState(false);
  const blindDateCloseTimerRef = useRef<number | null>(null);
  const handledMeetingEventDeepLinkRef = useRef<string | null>(null);
  const funnelEntryRef = useRef<{
    step: ApplicationFunnelStep;
    enteredAt: number;
    ticketInstanceId: string | null;
    meetingDate: string | null;
  } | null>(null);
  const funnelStep = applicationFunnelStep(screen, membershipSheetOpen);
  useEffect(() => {
    if (!active || !profileCompleted || availableTicketsLoading || !receivedInvitationId || handledReceivedInvitation.current === receivedInvitationId) return;
    const controller = new AbortController();
    const loadInvitation = async () => {
      try {
        const response = await fetch("/api/friend-invitations/received?id=" + encodeURIComponent(receivedInvitationId), { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(data.error || "초대를 확인하지 못했어요.");
        const ticket = availableTickets.find((candidate) => candidate.id === data.eventId);
        if (!ticket) throw new Error("신청 가능한 모임을 찾지 못했어요. 초대가 마감되었을 수 있어요.");
        handledReceivedInvitation.current = receivedInvitationId;
        setReceivedInvitation({ id: receivedInvitationId, eventId: data.eventId, photoUrl: data.photoUrl });
        setApplicationPath("solo");
        setSelectedTicket(ticket);
        setMembershipSheetOpen(false);
        setReceivedInvitationError(null);
        setError(null);
        setScreen("ticket");
      } catch (error) {
        if (!controller.signal.aborted) setReceivedInvitationError(error instanceof Error ? error.message : "초대를 확인하지 못했어요.");
      }
    };
    void loadInvitation();
    return () => controller.abort();
  }, [active, profileCompleted, availableTicketsLoading, availableTickets, receivedInvitationId]);


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
  const requestedMeetingEventId = searchParams.get("event")?.trim() || null;
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

  useEffect(() => {
    if (
      !active ||
      !profileCompleted ||
      availableTicketsLoading ||
      receivedInvitationId ||
      !requestedMeetingEventId ||
      handledMeetingEventDeepLinkRef.current === requestedMeetingEventId
    ) {
      return;
    }

    const ticket = availableTickets.find(
      (candidate) => candidate.id === requestedMeetingEventId,
    );
    if (!ticket) {
      handledMeetingEventDeepLinkRef.current = requestedMeetingEventId;
      setScreen("dates");
      return;
    }

    handledMeetingEventDeepLinkRef.current = requestedMeetingEventId;
    void recordTicketInteraction(ticket, "open", { keepalive: true });
    setMembershipSheetOpen(false);
    setSelectedTicket(ticket);
    setError(null);
    setScreen("unlock");
    trackEvent("meeting_ticket_detail_open", {
      ticket_instance_id: ticket.id,
      meeting_date: ticket.date,
      entry_reason: "deep_link",
    });
  }, [
    active,
    availableTickets,
    availableTicketsLoading,
    profileCompleted,
    requestedMeetingEventId,
  ]);

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
    if (applicationPath === "friend" && userId.startsWith("local-")) {
      setError("디자인 미리보기에서는 문자를 보내지 않아요. 로그인한 계정으로 신청해 주세요.");
      return;
    }
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
      if (!isLocalTestHost() || applicationPath === "friend") {
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

        await sendFriendInvitation(applicationData.applications, ticket?.id);

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
    if (applicationPath === "friend" && userId.startsWith("local-")) {
      setError("디자인 미리보기에서는 문자를 보내지 않아요. 로그인한 계정으로 신청해 주세요.");
      return;
    }
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

      if (!isLocalTestHost() || applicationPath === "friend") {
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
        await sendFriendInvitation(data.applications, ticket.id);
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

  if (receivedInvitationError) {
    return <section className="flex min-h-full flex-col justify-center px-6 text-center"><p role="alert" className="text-sm leading-6">{receivedInvitationError}</p><a href="/meetings?tab=recommend" className="mt-6 text-sm underline">다른 모임 보기</a></section>;
  }

  if (receivedInvitationId && !receivedInvitation) {
    return <section className="flex min-h-full items-center justify-center px-6"><p role="status" className="text-sm text-black/50">친구의 초대장을 열고 있어요.</p></section>;
  }

  if (screen === "unlock" && selectedTicket) {
    return (
      <TicketUnlockSequence
        motionKey={selectedTicket.id}
        title={selectedTicket.title}
        dateText={programDateLabel(selectedTicket.date)}
        timeText={formatTicketTimeLabel(selectedTicket.time)}
        placeText={seoulAreaLabel(selectedTicket.area)}
        useApplicationBackground
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
          "relative min-h-full overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f7f4ee_48%,#f2eee6_100%)] px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]",
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
            withFriend={applicationPath === "friend" || hasSentFriendInvitation}
            friendPhotoUrl={friendPhotoUrl}
            matchMemberCount={applicationPath === "friend" || hasSentFriendInvitation ? 4 : undefined}
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
          createPortal(selectedTicketClosed ? (
          <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] h-[68px] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
            <div className="flex h-[56px] w-full items-center justify-center rounded-full bg-black/12 text-[15px] font-black tracking-[-0.02em] text-black/42">
              마감
            </div>
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
        ) : screen === "dates" && (applicationPath === null || (applicationPath === "friend" && !friendPhone)) ? (
          <motion.div key="application-path" className="flex flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {applicationPath === "friend" ? <FriendApplicationFlow
              previewTicket={availableTickets[0]}
              participantPhotoUrl={profilePhotoUrl}
              onContinue={(phone) => { setFriendPhotoUrl(null); setFriendPhone(phone); }}
              onBack={() => setApplicationPath(null)}
            /> : <ApplicationPathChoice onSolo={() => setApplicationPath("solo")} onFriend={() => setApplicationPath("friend")} />}
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
              {applicationPath !== null && <button type="button" onClick={() => setApplicationPath(null)} className="mb-5 flex min-h-11 items-center gap-2 self-start text-xs text-black/50"><ChevronLeft size={16} />참여 방식 다시 선택</button>}
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

function TicketUnlockSequence({
  motionKey,
  title,
  dateText,
  timeText,
  placeText,
  useApplicationBackground = false,
  reducedMotion,
  onBack,
  onComplete,
}: {
  motionKey: string;
  title: string;
  dateText: string;
  timeText: string;
  placeText: string;
  useApplicationBackground?: boolean;
  reducedMotion: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const cleanTitle = meetingInvitationDisplayTitle(title);
  const meta = `${dateText} · ${timeText} · ${placeText}`;
  const [phase, setPhase] = useState<"locked" | "loading" | "typing">("locked");
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [typedParts, setTypedParts] = useState<[string, string, string, string]>([
    "",
    "",
    "",
    "",
  ]);
  const [activeTypingPart, setActiveTypingPart] = useState(0);
  const isLoading = phase === "loading";
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
    window.setTimeout(() => setPhase("loading"), reducedMotion ? 0 : 220);
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
    if (phase !== "loading") return;
    const loadingTimer = window.setTimeout(() => setPhase("typing"), 1000);
    return () => window.clearTimeout(loadingTimer);
  }, [phase]);

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
      className={cn(
        "relative flex min-h-full flex-col overflow-hidden px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]",
        useApplicationBackground && phase !== "typing"
          ? "bg-transparent"
          : "bg-[radial-gradient(circle_at_50%_42%,#fbf9f4_0%,#f6f2ea_56%,#f0ece3_100%)]",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase !== "typing" ? (
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
                <h1 className="mt-1.5 whitespace-pre-line break-keep text-[18px] font-black leading-[1.35] tracking-[-0.045em] text-black">
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
                className={cn(
                  "relative h-[56px] touch-none select-none overflow-hidden border-t border-black/[0.075] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/35",
                  isLoading ? "bg-transparent" : "bg-[#ede8de]",
                )}
              >
                {isLoading && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-[#c9c1b3]"
                    />
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute -inset-[190%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_292deg,rgba(255,255,255,0.18)_314deg,rgba(255,255,255,1)_339deg,rgba(255,248,230,0.7)_351deg,transparent_360deg)]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[2px] bg-[#ede8de]"
                    />
                  </>
                )}
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
                {!isLoading && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -top-4 h-20 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/75 to-transparent blur-[3px]"
                    animate={{ left: ["-25%", "115%"] }}
                    transition={{ duration: 1.75, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.25 }}
                  />
                )}
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
            {(limitCount ?? membershipApplicationLimitCount).toLocaleString("ko-KR")}
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
