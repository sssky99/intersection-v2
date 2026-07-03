"use client";

import { AnimatePresence, motion } from "framer-motion";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import { TicketDrawingBorder } from "@/components/TicketDrawingBorder";

type TicketDrawingFrameProps = {
  title: string;
  imageUrl?: string | null;
  imageUrls?: ReadonlyArray<string | null | undefined> | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  tags?: string[] | null;
  remainingSeatCount?: number | null;
  drawn?: boolean;
  imageVisible?: boolean;
  reducedMotion?: boolean;
  motionKey?: string;
  className?: string;
  cardClassName?: string;
  showSweep?: boolean;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function TicketDrawingFrame({
  title,
  imageUrl,
  imageUrls,
  date,
  time,
  location,
  tags,
  remainingSeatCount,
  drawn = true,
  imageVisible = true,
  reducedMotion = false,
  motionKey,
  className,
  cardClassName,
  showSweep = true,
}: TicketDrawingFrameProps) {
  return (
    <div
      data-testid="ticket-drawing-frame"
      className={cn(
        "relative mx-auto aspect-[1/1.62] w-[88%] max-w-[330px]",
        className,
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={motionKey ?? title}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={reducedMotion ? undefined : { opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <div className="absolute inset-2 overflow-hidden rounded-[24px]">
            <IntersectionTicketCard
              title={title}
              imageUrl={imageUrl}
              imageUrls={imageUrls}
              date={date}
              time={time}
              location={location}
              tags={tags}
              remainingSeatCount={remainingSeatCount}
              contentVisible={drawn}
              imageVisible={imageVisible}
              className={cn(
                "h-full !aspect-auto !rounded-[24px] shadow-none",
                cardClassName,
              )}
            />
          </div>

          {showSweep && (
            <motion.div
              initial={false}
              animate={
                drawn && !reducedMotion
                  ? { x: "135%", opacity: 0 }
                  : { x: "-120%", opacity: 0.22 }
              }
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="pointer-events-none absolute inset-y-0 -left-1/3 z-10 w-1/2 rotate-12 bg-black/25 blur-xl"
            />
          )}

          <TicketDrawingBorder reducedMotion={reducedMotion} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
