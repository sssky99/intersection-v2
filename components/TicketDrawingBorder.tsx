"use client";

import { motion } from "framer-motion";

type TicketDrawingBorderProps = {
  drawn?: boolean;
  reducedMotion?: boolean;
  className?: string;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const ticketBorderPath =
  "M 10,2 L 90,2 A 8,8 0 0,1 98,10 L 98,152 A 8,8 0 0,1 90,160 L 10,160 A 8,8 0 0,1 2,152 L 2,10 A 8,8 0 0,1 10,2 Z";
const ticketBorderPathLength = 2000;

export function TicketDrawingBorder({
  drawn = true,
  reducedMotion = false,
  className,
}: TicketDrawingBorderProps) {
  return (
    <svg
      viewBox="0 0 100 162"
      className={cn(
        "pointer-events-none absolute inset-0 z-10 h-full w-full text-black",
        className,
      )}
      aria-hidden="true"
    >
      <motion.path
        d={ticketBorderPath}
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeWidth="3"
        strokeDasharray={ticketBorderPathLength}
        vectorEffect="non-scaling-stroke"
        initial={
          reducedMotion
            ? false
            : { opacity: 0, strokeDashoffset: ticketBorderPathLength }
        }
        animate={{
          opacity: drawn ? 1 : 0,
          strokeDashoffset: drawn ? 0 : ticketBorderPathLength,
        }}
        transition={{ duration: reducedMotion ? 0 : 0.58, ease: "easeInOut" }}
      />
    </svg>
  );
}
