"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import type { MembershipStatus } from "@/features/membership/membershipTypes";
import type { AvailableDate, GatheringTicket } from "@/types/ticket";

type Screen = "calendar" | "drawing" | "waitlisted";
type RecommendationWaitlistStatus = "waitlisted" | "payment_pending";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ticketImage(ticketId: string) {
  if (ticketId.includes("walk") || ticketId.includes("riverside")) {
    return "/images/landing-people.jpg";
  }
  if (ticketId.includes("dinner") || ticketId.includes("calm")) {
    return "/images/landing-gathering.png";
  }
  return "/images/landing-cinematic.png";
}

export function MeetingRecommendation({
  userId,
  embedded = false,
  membershipStatus,
  onWaitlisted,
  onMembershipRequired,
  onOpenList,
}: {
  userId: string;
  embedded?: boolean;
  membershipStatus: MembershipStatus | null;
  onWaitlisted?: (ticket: GatheringTicket) => void;
  onMembershipRequired?: () => void;
  onOpenList?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("calendar");
  const [selectedDate, setSelectedDate] = useState<AvailableDate | null>(null);
  const [ticketIndex, setTicketIndex] = useState(0);
  const [waitlistedTicket, setWaitlistedTicket] =
    useState<GatheringTicket | null>(null);
  const [waitlistStatus, setWaitlistStatus] =
    useState<RecommendationWaitlistStatus>("waitlisted");
  const [ticketDates, setTicketDates] = useState<AvailableDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = selectedDate?.tickets[ticketIndex] ?? null;

  useEffect(() => {
    let alive = true;

    fetch("/api/meetings/tickets", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { dates?: AvailableDate[]; error?: string }
          | null;
        if (!response.ok || !data) {
          throw new Error(data?.error ?? "tickets-load-failed");
        }
        if (alive) {
          setTicketDates(data.dates ?? []);
          setNotice(null);
        }
      })
      .catch(() => {
        if (alive) {
          setError("초대장 날짜를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        }
      })
      .finally(() => {
        if (alive) setLoadingDates(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectDate = (date: AvailableDate) => {
    setNotice(null);
    setError(null);
    if (date.tickets.length === 0) {
      setNotice("이 날짜에는 아직 추천 가능한 모임이 없어요.");
      return;
    }

    setSelectedDate(date);
    setTicketIndex(0);
    setScreen("drawing");
  };

  const rejectTicket = () => {
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

  const joinWaitlist = async () => {
    if (!ticket || saving) return;

    if (membershipStatus !== "active" && membershipStatus !== "pending") {
      setError(null);
      onMembershipRequired?.();
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
    } | null;

    if (response.status === 402 || data?.code === "membership_required") {
      onMembershipRequired?.();
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
    onWaitlisted?.(ticket);
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
      <AnimatePresence mode="wait">
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

            <CalendarSelector
              dates={ticketDates}
              loading={loadingDates}
              onSelect={selectDate}
            />

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
                {waitlistedTicket.date} · {waitlistedTicket.time} ·{" "}
                {waitlistedTicket.area}
              </p>
              <div className="mt-5 border-t border-black/8 pt-4">
                {[
                  waitlistStatus === "payment_pending"
                    ? "결제 확인 필요"
                    : "대기열 등록 완료",
                  "운영자 확인",
                  "참여 승인 및 안내",
                ].map((step, index) => (
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
      </AnimatePresence>
    </section>
  );
}

function TicketDrawingCard({
  ticket,
  saving,
  error,
  onYes,
  onNo,
  onChangeDate,
}: {
  ticket: GatheringTicket;
  saving: boolean;
  error: string | null;
  onYes: () => void;
  onNo: () => void;
  onChangeDate: () => void;
}) {
  const [isDrawn, setIsDrawn] = useState(false);
  const [isImageVisible, setIsImageVisible] = useState(false);

  useEffect(() => {
    setIsDrawn(false);
    setIsImageVisible(false);
    const revealTimer = window.setTimeout(() => {
      setIsImageVisible(true);
      setIsDrawn(true);
    }, 650);
    return () => {
      window.clearTimeout(revealTimer);
    };
  }, [ticket.id]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-4"
    >
      <div className="pr-16">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          invitation
        </p>
        <motion.h1
          key={isDrawn ? "drawn-title" : "drawing-title"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-[24px] font-bold leading-8 tracking-tight text-black"
        >
          {isDrawn ? "이 초대장이 마음에 드나요?" : "초대장을 그리고 있어요"}
        </motion.h1>
      </div>

      <TicketDrawingFrame
        motionKey={ticket.id}
        title={ticket.title}
        imageUrl={ticket.imageUrl ?? ticketImage(ticket.id)}
        date={ticket.date}
        time={ticket.time}
        location={`서울\n${ticket.area}`}
        tags={ticket.moodTags}
        remainingSeatCount={ticket.remainingSeatCount}
        drawn={isDrawn}
        imageVisible={isImageVisible}
        className="mt-6"
      />
      {/*
        <div className="absolute inset-2 overflow-hidden rounded-[24px]">
          <IntersectionTicketCard
            title={ticket.title}
            imageUrl={ticket.imageUrl ?? ticketImage(ticket.id)}
            date={ticket.date}
            time={ticket.time}
            location={`서울\n${ticket.area}`}
            tags={ticket.moodTags}
            remainingSeatCount={ticket.remainingSeatCount}
            contentVisible={isDrawn}
            imageVisible={isImageVisible}
            className="h-full !aspect-auto !rounded-[24px] shadow-none"
          />
        </div>
        <TicketDrawingBorder />

      */}

      <AnimatePresence mode="wait">
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
                onClick={onYes}
                className="flex h-[58px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm disabled:bg-black/20"
              >
                <span className="text-sm font-bold">Yes</span>
                <span className="mt-0.5 text-[10px] font-medium text-white/60">
                  {saving ? "등록 중..." : "자세히 보고 신청"}
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
      </AnimatePresence>
    </motion.section>
  );
}

function CalendarSelector({
  dates,
  loading,
  onSelect,
}: {
  dates: AvailableDate[];
  loading: boolean;
  onSelect: (date: AvailableDate) => void;
}) {
  const months = dates.length
    ? Array.from(new Set(dates.map((date) => date.date.slice(0, 7)))).sort()
    : [new Date().toISOString().slice(0, 7)];
  const [month, setMonth] = useState(months[0]);
  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

  useEffect(() => {
    if (!months.includes(month)) setMonth(months[0]);
  }, [month, months]);

  const [yearNumber, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(yearNumber, monthNumber, 0).getDate();
  const firstWeekday = new Date(Date.UTC(yearNumber, monthNumber - 1, 1)).getUTCDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  const dateMap = new Map(dates.map((date) => [date.date, date]));

  const dateForDay = (day: number) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return dateMap.get(date);
  };

  return (
    <section className="mt-7 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-black">
          {yearNumber}년 {monthNumber}월
        </h2>
        <div className="flex rounded-full bg-black/[0.04] p-1 text-[10px] font-bold">
          {months.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMonth(value)}
              className={cn(
                "rounded-full px-3 py-1 transition-all",
                month === value ? "bg-white text-black shadow-sm" : "text-black/40",
              )}
            >
              {Number(value.slice(5, 7))}월
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-black/35">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2 text-center">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const dateEntry = dateForDay(day);
          const selectable = Boolean(dateEntry);

          return (
            <motion.button
              key={day}
              type="button"
              whileTap={selectable ? { scale: 0.92 } : undefined}
              onClick={() => {
                if (dateEntry) onSelect(dateEntry);
              }}
              disabled={!selectable}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-full border text-xs font-semibold transition-all",
                selectable
                  ? "border-black/10 bg-white text-black hover:border-black/25"
                  : "border-transparent text-black/15",
              )}
            >
              {day}
              {selectable && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#7eb3c7] shadow-sm" />
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[10px] font-medium leading-relaxed text-black/35">
        {loading
          ? "초대장 날짜를 불러오고 있어요."
          : dates.length
            ? "* 파란 점이 있는 날짜를 택하면 교집합이 초대장을 준비해드려요."
            : "현재 공개된 초대장 날짜가 없어요."}
      </p>
    </section>
  );
}
