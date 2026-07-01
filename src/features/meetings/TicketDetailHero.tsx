"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import type { GatheringTicket } from "@/types/ticket";

export const ticketFadeTransition = {
  duration: 0.22,
  ease: "easeOut",
} as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeTags(tags?: string[] | null) {
  return (tags ?? [])
    .flatMap((tag) =>
      tag
        .trim()
        .split("#")
        .map((item) => item.trim()),
    )
    .filter(Boolean)
    .slice(0, 3);
}

export function TicketDetailHero({
  ticket,
  badgeLabel,
  statusExpanded,
  onToggleStatus,
  className,
}: {
  ticket: GatheringTicket;
  badgeLabel?: string;
  statusExpanded?: boolean;
  onToggleStatus?: () => void;
  className?: string;
}) {
  const dateLabel = formatTicketDateLabel(ticket.date);
  const timeLabel = formatTicketTimeLabel(ticket.time);
  const metaLabel = [dateLabel, timeLabel, ticket.area]
    .filter(Boolean)
    .join(" · ");
  const tags = normalizeTags(ticket.moodTags);

  return (
    <motion.div
      className={cn(
        "relative min-h-[210px] overflow-hidden bg-black text-white",
        className,
      )}
    >
      {ticket.imageUrl ? (
        <img
          src={ticket.imageUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-black/16 to-black/72" />
      {badgeLabel && (
        <button
          type="button"
          aria-expanded={statusExpanded}
          onClick={onToggleStatus}
          className="absolute bottom-5 right-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/18 px-3 py-1.5 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur transition hover:bg-white/24"
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
        <h2 className="whitespace-pre-line text-[29px] font-extrabold leading-[1.12] tracking-normal text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.72)]">
          {ticket.title}
        </h2>
        {metaLabel && (
          <p className="mt-3 text-[13px] font-extrabold leading-5 text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.68)]">
            {metaLabel}
          </p>
        )}
        {tags.length > 0 && (
          <div className="scrollbar-none mt-3 flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 text-[11px] font-extrabold leading-none text-white backdrop-blur-[2px]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
