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
  useState,
} from "react";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import { trackEvent } from "@/lib/analytics";
import { membershipStoreUrls } from "@/lib/membershipStore";
import {
  MEETING_DATE_DEPOSIT_AMOUNT,
  MEETING_DATE_REGION,
  meetingDateApplicationDates,
  meetingDateLabel,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { todayInKst } from "@/lib/ticketDate";
import type { AvailableDate } from "@/types/ticket";
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
  embedded?: boolean;
  active?: boolean;
  membershipStatus: MembershipStatus | null;
  blindDateOffers?: BlindDateUserOffer[];
  onBlindDateOffersChange?: (offers: BlindDateUserOffer[]) => void;
  blindDateOpenRequestId?: number;
  blindDateOpenRequestPending?: boolean;
  onBlindDateOpenRequestHandled?: () => void;
  onDateApplicationsChange?: (applications: MeetingDateApplication[]) => void;
};

type DateApplicationScreen = "dates" | "submitted" | "blindDate";
type DateApplicationPurchaseOption = "single" | "membership";

type DateApplicationsResponse = {
  applications?: MeetingDateApplication[];
  totalDepositAmount?: number;
  paymentIntentCreated?: boolean;
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
  closed,
  disabled,
  onToggle,
}: {
  date: AvailableDate;
  selected: boolean;
  application: MeetingDateApplication | null;
  closed: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const schedule = meetingDateSchedule(date.date)!;
  const canResumePayment =
    application?.status === "payment_pending" &&
    application.depositStatus === "payment_pending";
  const hasLockedApplication = Boolean(application) && !canResumePayment;

  return (
    <motion.button
      type="button"
      data-testid={`meeting-date-${date.date}`}
      aria-pressed={selected}
      disabled={disabled || closed || hasLockedApplication}
      whileTap={
        !disabled && !closed && !hasLockedApplication
          ? { scale: 0.98 }
          : undefined
      }
      onClick={onToggle}
      className={cn(
        "relative flex min-h-[64px] min-w-0 items-center rounded-[17px] border px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-black/20",
        closed
          ? "border-black/5 bg-black/[0.035] text-black/32"
          : selected
              ? "border-black bg-black/[0.035] text-black shadow-[inset_0_0_0_1px_#111]"
            : canResumePayment
              ? "border-amber-200 bg-amber-50/60 text-black hover:border-amber-300"
            : application
              ? "border-black/10 bg-white text-black"
              : "border-black/10 bg-white text-black hover:border-black/25",
        (disabled || closed || hasLockedApplication) && "cursor-default",
      )}
    >
      <span className="min-w-0 pr-7">
        <span className="block text-[13px] font-bold leading-5">
          {schedule.month}월 {schedule.day}일 {schedule.weekdayLabel}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium text-black/42">
          {schedule.timeLabel} · {MEETING_DATE_REGION}
        </span>
      </span>
      {closed || application ? (
        <span
          className={cn(
            "absolute right-2.5 top-2.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
            closed
              ? "border-red-200 bg-red-50 text-red-600"
              : canResumePayment
                ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          {closed ? "마감" : canResumePayment ? "결제 대기" : "신청 완료"}
        </span>
      ) : (
        <span
          className={cn(
            "absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border",
            selected
              ? "border-black bg-black text-white"
              : "border-black/15 bg-white text-transparent",
          )}
        >
          <Check size={12} strokeWidth={3} aria-hidden />
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
  const [screen, setScreen] = useState<DateApplicationScreen>("dates");
  const [applications, setApplications] = useState<MeetingDateApplication[]>([]);
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
      if (openStoreAfterSave) {
        if (!data.paymentIntentCreated) {
          throw new Error("date-applications-save-failed");
        }
        trackEvent("payment_page_open", {
          application_type: "meeting_date",
          payment_provider: "groble",
          date_count: targetDates.length,
        });
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
              {availableDates.map((date) => (
                <DateApplicationOption
                  key={date.date}
                  date={date}
                  selected={selectedDates.includes(date.date)}
                  application={applicationByDate.get(date.date) ?? null}
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
                        : "border-black/10 bg-white hover:border-black/25",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                          purchaseOption === "single"
                            ? "border-black bg-black text-white"
                            : "border-black/15 bg-white text-transparent",
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
                        : "border-black/10 bg-white hover:border-black/25",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                          purchaseOption === "membership"
                            ? "border-black bg-black text-white"
                            : "border-black/15 bg-white text-transparent",
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
