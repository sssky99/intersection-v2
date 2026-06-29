"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import {
  TicketCopyProposalSection,
  TicketDetailContent,
} from "@/features/meetings/TicketDetailContent";
import {
  TicketDetailHero,
  ticketFadeTransition,
} from "@/features/meetings/TicketDetailHero";
import { RecommendationCalendarSelector } from "@/features/meetings/RecommendationCalendarSelector";
import {
  MeetingProposalFlow,
  type ProposalMemberProfile,
} from "@/features/meetings/MeetingProposalFlow";
import { trackEvent } from "@/lib/analytics";
import { meetingProposalRequirementMessage } from "@/lib/meetingProposalAccess";
import { takePendingTicketPayment } from "@/lib/pendingTicketPayment";
import type { AvailableDate, GatheringTicket } from "@/types/ticket";
import type { BlindDateUserOffer } from "@/types/blindDate";

type Screen =
  | "calendar"
  | "drawing"
  | "waitlisted"
  | "blindDate"
  | "proposal";
type RecommendationWaitlistStatus = "waitlisted" | "payment_pending";
export type RecommendationCoachmarkStep = "date" | "invitation" | "decision";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const ticketDatesCacheTtlMs = 30_000;
let ticketDatesCache: { dates: AvailableDate[]; expiresAt: number } | null = null;
let ticketDatesRequest: Promise<AvailableDate[]> | null = null;
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

async function fetchTicketsForDate(date: string, force = false) {
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
  ticketsByDateCache.clear();
}

export function MeetingRecommendation({
  userId,
  embedded = false,
  active = true,
  membershipStatus,
  proposalParticipationCount,
  proposalRequirementBypassed = false,
  onWaitlisted,
  onProposalSubmitted,
  onMembershipRequired,
  onPaymentReturn,
  onOpenList,
  onOpenProposal,
  proposalProfile,
  blindDateOffers = [],
  onBlindDateOffersChange,
  blindDateOpenRequestId = 0,
  blindDateOpenRequestPending = false,
  onBlindDateOpenRequestHandled,
  onCoachmarkProgress,
}: {
  userId: string;
  embedded?: boolean;
  active?: boolean;
  membershipStatus: MembershipStatus | null;
  proposalParticipationCount: number | null;
  proposalRequirementBypassed?: boolean;
  onWaitlisted?: (ticket: GatheringTicket) => void;
  onProposalSubmitted?: () => void | Promise<void>;
  onMembershipRequired?: (ticket: GatheringTicket) => void;
  onPaymentReturn?: () => void;
  onOpenList?: () => void;
  onOpenProposal?: () => void;
  proposalProfile: ProposalMemberProfile;
  blindDateOffers?: BlindDateUserOffer[];
  onBlindDateOffersChange?: (offers: BlindDateUserOffer[]) => void;
  blindDateOpenRequestId?: number;
  blindDateOpenRequestPending?: boolean;
  onBlindDateOpenRequestHandled?: () => void;
  onCoachmarkProgress?: (step: RecommendationCoachmarkStep) => void;
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
  const [selectedBlindDateOfferId, setSelectedBlindDateOfferId] =
    useState<string | null>(null);
  const [copiedProposalTicket, setCopiedProposalTicket] =
    useState<GatheringTicket | null>(null);
  const viewedTicketIdsRef = useRef<Set<string>>(new Set());
  const ticket = selectedDate?.tickets[ticketIndex] ?? null;
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
  const canSubmitProposal =
    proposalRequirementBypassed ||
    (membershipStatus === "active" && (proposalParticipationCount ?? 0) >= 1);
  const proposalRestrictionMessage = canSubmitProposal
    ? null
    : meetingProposalRequirementMessage;

  useEffect(() => {
    if (screen !== "drawing" || !ticket) return;
    if (viewedTicketIdsRef.current.has(ticket.id)) return;

    viewedTicketIdsRef.current.add(ticket.id);
    trackEvent("ticket_detail_view", {
      ticket_id: ticket.id,
      template_id: ticket.templateId,
      proposal_id: ticket.proposalId,
    });
  }, [screen, ticket]);

  useEffect(() => {
    const restorePaymentPendingScreen = () => {
      const pendingTicket = takePendingTicketPayment(userId);
      if (!pendingTicket) return;

      setSelectedDate(null);
      setTicketIndex(0);
      setWaitlistedTicket(pendingTicket);
      setWaitlistStatus("payment_pending");
      setNotice(null);
      setError(null);
      clearTicketCaches();
      onWaitlisted?.(pendingTicket);
      onPaymentReturn?.();
      setScreen("waitlisted");
    };
    const restoreWhenVisible = () => {
      if (document.visibilityState === "visible") {
        restorePaymentPendingScreen();
      }
    };

    restorePaymentPendingScreen();
    window.addEventListener("pageshow", restorePaymentPendingScreen);
    window.addEventListener("focus", restorePaymentPendingScreen);
    document.addEventListener("visibilitychange", restoreWhenVisible);

    return () => {
      window.removeEventListener("pageshow", restorePaymentPendingScreen);
      window.removeEventListener("focus", restorePaymentPendingScreen);
      document.removeEventListener("visibilitychange", restoreWhenVisible);
    };
  }, [userId]);

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
    setNotice(null);
    setError(null);
    setLoadingTicketDate(date.date);

    try {
      const dateWithTickets = await fetchTicketsForDate(date.date);
      if (dateWithTickets.tickets.length === 0) {
        setNotice("이 날짜에는 아직 추천 가능한 모임이 없어요.");
        return;
      }

      setSelectedDate(dateWithTickets);
      setTicketIndex(0);
      setScreen("drawing");
      onCoachmarkProgress?.("date");
    } catch {
      setError("초대장을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoadingTicketDate(null);
    }
  };

  const rejectTicket = () => {
    onCoachmarkProgress?.("decision");

    if (!selectedDate) return;
    const nextIndex = ticketIndex + 1;
    if (nextIndex >= selectedDate.tickets.length) {
      setSelectedDate(null);
      setTicketIndex(0);
      setNotice(
        "같은 날짜의 추천을 모두 확인했어요. 다른 날짜를 골라주세요.",
      );
      setScreen("calendar");
      return;
    }

    setTicketIndex(nextIndex);
    setScreen("drawing");
  };

  const applicationEventPayload = (targetTicket: GatheringTicket) => ({
    application_id: targetTicket.id,
    ticket_id: targetTicket.id,
    template_id: targetTicket.templateId,
    proposal_id: targetTicket.proposalId,
    membership_status: membershipStatus,
  });

  const joinWaitlist = async () => {
    if (!ticket || saving) return;

    trackEvent("application_submit_click", applicationEventPayload(ticket));

    if (membershipStatus !== "active" && membershipStatus !== "pending") {
      setError(null);
      trackEvent("membership_required_shown", {
        ...applicationEventPayload(ticket),
        source: "client_membership_check",
      });
      onMembershipRequired?.(ticket);
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/meeting-waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    });

    const data = (await response.json().catch(() => null)) as {
      status?: RecommendationWaitlistStatus;
      code?: string;
      duplicate?: boolean;
    } | null;

    if (response.status === 402 || data?.code === "membership_required") {
      trackEvent("membership_required_shown", {
        ...applicationEventPayload(ticket),
        source: "waitlist_response",
      });
      onMembershipRequired?.(ticket);
      setSaving(false);
      return;
    }

    if (!response.ok) {
      setError("대기열 등록에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    setWaitlistedTicket(ticket);
    setWaitlistStatus(data?.status ?? "waitlisted");
    trackEvent("application_created", {
      ...applicationEventPayload(ticket),
      status: data?.status ?? "waitlisted",
      duplicate: Boolean(data?.duplicate),
    });
    clearTicketCaches();
    onWaitlisted?.(ticket);
    setScreen("waitlisted");
    onCoachmarkProgress?.("decision");
    setSaving(false);
  };

  const openProposal = () => {
    setNotice(null);
    setError(null);
    setSelectedDate(null);
    setTicketIndex(0);
    setWaitlistedTicket(null);
    setCopiedProposalTicket(null);

    if (onOpenProposal) {
      setScreen("calendar");
      onOpenProposal();
      return;
    }

    setScreen("proposal");
  };

  const copyTicketAsProposal = (sourceTicket: GatheringTicket) => {
    setCopiedProposalTicket(sourceTicket);
    setScreen("proposal");
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
              <p className="mt-2 text-sm leading-6 text-black/48">
                날짜를 고르면 교집합이 어울리는 자리를 하나씩 준비해드려요.
              </p>
            </header>

            <div data-coachmark-target="recommend-date-picker">
              <RecommendationCalendarSelector
                dates={ticketDates}
                loading={loadingDates || Boolean(loadingTicketDate)}
                loadingText={
                  loadingTicketDate
                    ? "선택한 날짜의 초대장을 불러오고 있어요."
                    : undefined
                }
                onSelect={(date) => void selectDate(date)}
              />
            </div>

            <button
              type="button"
              onClick={openProposal}
              className="mt-4 flex min-h-[62px] w-full items-center justify-between gap-4 rounded-[22px] border border-accent/25 bg-accent/[0.08] px-4 py-3 text-left shadow-sm transition hover:border-accent/45 hover:bg-accent/[0.12] active:scale-[0.99]"
            >
              <span>
                <span className="block text-sm font-black text-black">
                  내가 원하는 교집합 제안하기
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-black/45">
                  원하는 자리가 없다면, 직접 교집합을 제안해보세요.
                </span>
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
                <Plus size={18} aria-hidden />
              </span>
            </button>

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

        {screen === "drawing" && ticket && selectedDate && (
          <TicketDrawingCard
            key={ticket.id}
            ticket={ticket}
            saving={saving}
            error={error}
            onNo={rejectTicket}
            onYes={() => void joinWaitlist()}
            onOpenInvitation={() => onCoachmarkProgress?.("invitation")}
            onCopyProposal={() => copyTicketAsProposal(ticket)}
            onChangeDate={() => {
              setSelectedDate(null);
              setTicketIndex(0);
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
              <Check size={20} aria-hidden />
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-accent">
              {waitlistStatus === "payment_pending"
                ? "payment pending"
                : "waitlisted"}
            </p>
            <h1 className="mt-2 text-[28px] font-bold leading-9 text-black">
              {waitlistStatus === "payment_pending" ? (
                <>
                  결제 확인 요청이
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
                ? "운영자가 결제 상태를 확인한 뒤 자리 신청을 이어서 처리할게요."
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
                      "결제 확인 필요",
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
              다른 날짜 보기
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

        {screen === "proposal" && (
          <MeetingProposalFlow
            profile={proposalProfile}
            copiedTicket={copiedProposalTicket}
            canSubmit={canSubmitProposal}
            restrictionMessage={proposalRestrictionMessage}
            onBack={() =>
              setScreen(copiedProposalTicket ? "drawing" : "calendar")
            }
            onDone={async () => {
              await onProposalSubmitted?.();
              setCopiedProposalTicket(null);
              setScreen("calendar");
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function TicketDrawingCard({
  ticket,
  saving,
  error,
  onYes,
  onOpenInvitation,
  onCopyProposal,
  onNo,
  onChangeDate,
}: {
  ticket: GatheringTicket;
  saving: boolean;
  error: string | null;
  onYes: () => void;
  onOpenInvitation: () => void;
  onCopyProposal: () => void;
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
    onOpenInvitation();
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
            saving={saving}
            error={error}
            onClose={() => setDetailOpen(false)}
            onNo={onNo}
            onYes={onYes}
            onCopyProposal={onCopyProposal}
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
              data-coachmark-target={isDrawn ? "invitation-card" : undefined}
              className={cn(
                "mx-auto mt-6 block w-[88%] max-w-[330px] rounded-[28px] text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4",
                isDrawn && !saving && "cursor-pointer active:scale-[0.99]",
              )}
            >
              <TicketDrawingFrame
                motionKey={ticket.id}
                title={ticket.title}
                imageUrl={ticket.imageUrl}
                date={ticket.date}
                time={ticket.time}
                location={`서울\n${ticket.area}`}
                tags={ticket.moodTags}
                proposerLabel={ticket.proposerLabel}
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

function TicketInsideView({
  ticket,
  saving,
  error,
  onClose,
  onYes,
  onCopyProposal,
  onNo,
  onChangeDate,
}: {
  ticket: GatheringTicket;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onYes: () => void;
  onCopyProposal: () => void;
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
          <TicketDetailContent
            ticket={ticket}
            footer={<TicketCopyProposalSection onCopy={onCopyProposal} />}
          />
        </motion.div>
      </motion.article>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.2, ease: "easeOut" }}
        data-coachmark-target="invitation-decision"
        className="mt-5 grid grid-cols-2 gap-2.5"
      >
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
            상대방과 가능한 날짜가 겹치면 가장 빠른 날짜로 확정돼요.
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
