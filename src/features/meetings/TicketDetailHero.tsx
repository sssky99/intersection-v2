"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import {
  ticketBackgroundImageUrls,
  uniqueTicketImageUrls,
} from "@/lib/ticketImages";
import type { GatheringTicket } from "@/types/ticket";

export const ticketFadeTransition = {
  duration: 0.22,
  ease: "easeOut",
} as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function TicketDetailHero({
  ticket,
  badgeLabel,
  statusExpanded,
  onToggleStatus,
  className,
  backgroundImageUrls,
}: {
  ticket: GatheringTicket;
  badgeLabel?: string;
  statusExpanded?: boolean;
  onToggleStatus?: () => void;
  className?: string;
  backgroundImageUrls?: ReadonlyArray<string | null | undefined>;
}) {
  const dateLabel = formatTicketDateLabel(ticket.date);
  const timeLabel = formatTicketTimeLabel(ticket.time);
  const dateTimeLabel = [dateLabel, timeLabel].filter(Boolean).join(" · ");
  const resolvedBackgroundImageUrls = uniqueTicketImageUrls(
    backgroundImageUrls ?? ticketBackgroundImageUrls(ticket),
  );
  const backgroundImageUrl = resolvedBackgroundImageUrls[0];

  return (
    <motion.div
      className={cn(
        "relative mx-4 mt-4 h-[230px] min-h-[230px] overflow-hidden border border-black/[0.08] bg-black text-white shadow-[0_8px_22px_rgba(48,39,27,0.12)]",
        className,
      )}
    >
      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75" />
      <div className="absolute inset-x-5 top-5 z-10 flex items-center justify-between gap-3">
        <span className="font-ticket-latin shrink-0 rounded-full border border-white/25 bg-black/20 px-3 py-1.5 text-[11px] italic tracking-[0.1em] text-white backdrop-blur-md">
          {dateTimeLabel}
        </span>
        <span className="truncate text-right text-[10px] font-bold tracking-[-0.02em] text-white/75">
          SEOUL · {ticket.area}
        </span>
      </div>
      {badgeLabel && (
        <button
          type="button"
          aria-expanded={statusExpanded}
          onClick={onToggleStatus}
          className="absolute bottom-5 right-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/24 px-3 py-1.5 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur transition hover:bg-black/34"
        >
          {badgeLabel}
          {onToggleStatus &&
            (statusExpanded ? (
              <ChevronUp size={13} aria-hidden />
            ) : (
              <ChevronDown size={13} aria-hidden />
            ))}
        </button>
      )}
      <div className={cn("absolute inset-x-5 bottom-5", badgeLabel && "pr-28")}>
        <h2 className="font-ticket-display whitespace-pre-line text-[24px] font-bold leading-[1.27] tracking-[-0.045em] text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.35)]">
          {ticket.title}
        </h2>
      </div>
    </motion.div>
  );
}
