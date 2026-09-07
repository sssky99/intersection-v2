"use client";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { type MeetingDateApplication } from "@/lib/meetingDateApplications";
import { ticketStartAtInKst } from "@/lib/ticketDate";
import {
  ticketInteractionBadgeLabel,
  ticketInteractionShowsDeadline,
} from "@/lib/ticketInteractions";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type {
  GatheringTicket,
  TicketInteraction,
  UserTicket,
  UserTicketStatus,
} from "@/types/ticket";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const ticketPaperFrameClass =
  "relative aspect-[1/1.618] w-full rounded-[28px]";

export const ticketPaperImageClass =
  "!h-full !aspect-auto !rounded-[28px] shadow-none";

export function DeclinedTicketCard({
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
        className={cn(ticketPaperImageClass, "grayscale")}
      />
    </motion.div>
  );
}

export function StoredTicketCard({
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
        className={ticketPaperImageClass}
      />
    </motion.div>
  );
}

export function AssignedApplicationTicketCard({
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
        className={ticketPaperImageClass}
      />
    </motion.div>
  );
}

export function InteractionTicketCard({
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
        className={ticketPaperImageClass}
      />
      {showsDeadline && <UnansweredTicketCountdown ticket={ticket} />}
    </motion.div>
  );
}

export function BlindDateTicketCard({
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
            : "일정 확정"
        }
        badgeClassName="border-[#bda9b4]/70 bg-[#f8f3f5]/70 text-[#765a69] shadow-none"
        className={ticketPaperImageClass}
      />
    </motion.div>
  );
}

export function ticketResponseDeadline(ticket: GatheringTicket) {
  if (ticket.applicationClosesAt) {
    const configuredDeadline = new Date(ticket.applicationClosesAt);
    if (Number.isFinite(configuredDeadline.getTime()))
      return configuredDeadline;
  }

  const startsAt = ticketStartAtInKst(ticket.date, ticket.time);
  return startsAt ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000) : null;
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

export function UnansweredTicketCountdown({
  ticket,
}: {
  ticket: GatheringTicket;
}) {
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

export function dateApplicationBadgeClass(application: MeetingDateApplication) {
  if (application.status === "payment_pending") {
    return "border-amber-200 bg-amber-50 text-amber-700 shadow-none";
  }

  if (application.status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-none";
  }

  return "border-white/25 bg-white/[0.18] text-white";
}

export function statusBadgeClass(_status: UserTicketStatus) {
  return "border-white/25 bg-white/20 text-white shadow-[0_10px_22px_rgba(0,0,0,0.2)]";
}

import { cn } from "@/lib/cn";
