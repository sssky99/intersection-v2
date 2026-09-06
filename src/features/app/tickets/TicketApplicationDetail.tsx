"use client";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import type { GatheringTicket } from "@/types/ticket";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DeclinedTicketCard } from "./TicketCards";
import { DetailApplicationCancellationControl } from "./TicketProgress";

export function DeclinedTicketReview({
  tickets,
  loading,
  error,
  onBack,
  onOpen,
}: {
  tickets: GatheringTicket[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onOpen: (ticket: GatheringTicket) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const dragState = useRef({
    active: false,
    interacting: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    startIndex: 0,
  });

  const closestSlide = (viewport: HTMLDivElement) => {
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-declined-ticket-slide]"),
    );
    if (slides.length === 0) return null;

    return slides.reduce(
      (closest, slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        return distance < closest.distance
          ? { index, slide, distance }
          : closest;
      },
      {
        index: 0,
        slide: slides[0],
        distance: Number.POSITIVE_INFINITY,
      },
    );
  };

  const snapToSlideIndex = (
    index: number,
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport || tickets.length === 0) return;
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-declined-ticket-slide]"),
    );
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[nextIndex];
    if (!slide) return;

    setActiveIndex(nextIndex);
    viewport.scrollTo({
      left: slide.offsetLeft + slide.offsetWidth / 2 - viewport.clientWidth / 2,
      behavior,
    });
  };

  const snapToClosestSlide = (
    viewport = carouselRef.current,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!viewport) return;
    const closest = closestSlide(viewport);
    if (!closest) return;
    snapToSlideIndex(closest.index, viewport, behavior);
  };

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(tickets.length - 1, 0)),
    );
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });

    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, [tickets.length]);

  const updateActiveSlide = (event: React.UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const closest = closestSlide(viewport);
    if (closest) setActiveIndex(closest.index);

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    snapTimerRef.current = window.setTimeout(() => {
      if (!dragState.current.interacting) snapToClosestSlide(viewport);
    }, 120);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    const closest = closestSlide(event.currentTarget);
    dragState.current = {
      active: true,
      interacting: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: closest?.index ?? activeIndex,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const distance = event.clientX - dragState.current.startX;
    if (Math.abs(distance) > 7) dragState.current.moved = true;
    event.currentTarget.scrollLeft = dragState.current.scrollLeft - distance;
    event.preventDefault();
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dragDistance = event.clientX - dragState.current.startX;
    const moved = dragState.current.moved;
    const tappedSlide = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-declined-ticket-slide-index]");
    const tappedIndex = Number(tappedSlide?.dataset.declinedTicketSlideIndex);

    dragState.current.active = false;
    dragState.current.interacting = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      !moved &&
      Math.abs(dragDistance) <= 8 &&
      Number.isInteger(tappedIndex)
    ) {
      const ticket = tickets[tappedIndex];
      if (ticket) onOpen(ticket);
      return;
    }

    if (Math.abs(dragDistance) > 22) {
      snapToSlideIndex(
        dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
        event.currentTarget,
      );
    } else {
      snapToSlideIndex(dragState.current.startIndex, event.currentTarget);
    }

    window.setTimeout(() => {
      dragState.current.moved = false;
    }, 0);
  };

  const startTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }
    const closest = closestSlide(event.currentTarget);
    dragState.current = {
      active: false,
      interacting: true,
      moved: false,
      startX: touch.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      startIndex: closest?.index ?? activeIndex,
    };
  };

  const moveTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !dragState.current.interacting) return;
    if (Math.abs(touch.clientX - dragState.current.startX) > 8) {
      dragState.current.moved = true;
    }
  };

  const finishTouchScroll = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current.interacting) return;
    const touch = event.changedTouches[0];
    const dragDistance = touch ? touch.clientX - dragState.current.startX : 0;
    const moved = dragState.current.moved;
    dragState.current.interacting = false;

    if (moved && Math.abs(dragDistance) > 54) {
      snapToSlideIndex(
        dragState.current.startIndex + (dragDistance < 0 ? 1 : -1),
        event.currentTarget,
      );
    } else {
      snapToClosestSlide(event.currentTarget);
    }

    window.setTimeout(() => {
      dragState.current.moved = false;
    }, 180);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={ticketFadeTransition}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f4ed] pb-2 pt-[calc(12px+env(safe-area-inset-top))] text-black"
    >
      <header className="shrink-0 px-5 pr-28">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-black/48 transition hover:bg-black/[0.04] hover:text-black"
          aria-label="티켓함으로 돌아가기"
        >
          <ChevronLeft size={21} aria-hidden />
        </button>
        <p className="mt-2 text-[20px] font-extrabold tracking-[-0.04em] text-black">
          거절한 티켓{" "}
          <span className="ml-1 text-[15px] font-bold text-black/38">
            {tickets.length}
          </span>
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs font-bold text-black/38">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          거절한 티켓을 불러오는 중...
        </div>
      ) : error ? (
        <div className="mx-5 mt-10 rounded-[24px] border border-red-100 bg-red-50 px-5 py-6 text-center">
          <p className="text-xs font-semibold leading-5 text-red-600">
            {error}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 text-xs font-black text-black/55"
          >
            티켓함으로 돌아가기
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-20 text-center">
          <h2 className="text-lg font-bold">거절한 티켓이 없어요.</h2>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 -translate-y-3 flex-col justify-center pb-3 pt-4">
          <div
            ref={carouselRef}
            onScroll={updateActiveSlide}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onTouchStart={startTouchScroll}
            onTouchMove={moveTouchScroll}
            onTouchEnd={finishTouchScroll}
            onTouchCancel={finishTouchScroll}
            style={{
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
            className="-my-10 flex shrink-0 cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-[11%] py-10 scrollbar-none overscroll-x-contain touch-pan-x active:cursor-grabbing"
          >
            {tickets.map((ticket, index) => (
              <div
                key={ticket.id}
                data-declined-ticket-slide
                data-declined-ticket-slide-index={index}
                className="w-[min(78vw,340px)] shrink-0 snap-center snap-always"
              >
                <DeclinedTicketCard
                  ticket={ticket}
                  onOpen={() => {
                    if (!dragState.current.moved) onOpen(ticket);
                  }}
                />
              </div>
            ))}
          </div>
          {tickets.length > 1 && (
            <div className="mt-1.5 flex shrink-0 justify-center gap-1.5">
              {tickets.map((ticket, index) => (
                <span
                  key={`declined-page-${ticket.id}`}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition",
                    activeIndex === index ? "bg-black/70" : "bg-black/15",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

export function AssignedApplicationTicketDetailView({
  ticket,
  onClose,
  onCancelApplication,
  onReapply,
  onAccept,
  onDecline,
  participantPhotoUrl = null,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
}: {
  ticket: GatheringTicket;
  onClose: () => void;
  onCancelApplication?: () => Promise<boolean>;
  onReapply?: () => void;
  onAccept?: () => void;
  onDecline?: () => Promise<boolean>;
  participantPhotoUrl?: string | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
}) {
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const decline = async () => {
    if (!onDecline || responding) return;
    setResponding(true);
    setResponseError(null);
    const declined = await onDecline().catch(() => false);
    if (!declined) {
      setResponseError("선택을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setResponding(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative min-h-full overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f7f4ee_48%,#f2eee6_100%)] px-5 pb-28 pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]"
    >
      <button
        type="button"
        onClick={onClose}
        disabled={responding}
        aria-label="티켓 상세 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center text-[#24211d]/58 transition hover:text-[#24211d]"
      >
        <X size={18} aria-hidden />
      </button>

      <motion.header
        initial={{ y: "32vh" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        className="px-10 text-center"
      >
        <h1 className="font-ticket-latin whitespace-pre-line text-[30px] font-medium leading-[1.12] tracking-[-0.025em] text-[#24211d]">
          {ticket.title}
        </h1>
        <p className="font-ticket-latin mt-4 text-[13px] font-medium text-[#24211d]/58">
          {[
            formatTicketDateLabel(ticket.date),
            formatTicketTimeLabel(ticket.time),
          ]
            .filter(Boolean)
            .join(" · ")}
          {ticket.area ? ` · 서울 ${ticket.area}` : ""}
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 text-[#24211d]"
      >
        <TicketDetailContent
          ticket={ticket}
          participantPhotoUrl={participantPhotoUrl}
          previewMatchPhotoUrls={previewMatchPhotoUrls}
          previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
          sections={["summary", "course"]}
          className="pb-5"
        />
      </motion.div>
      {responseError && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {responseError}
        </p>
      )}
      {onCancelApplication && (
        <DetailApplicationCancellationControl onCancel={onCancelApplication} />
      )}
      {typeof document !== "undefined" &&
        createPortal(
          onAccept && onDecline ? (
            <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] grid h-[68px] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 grid-cols-[0.72fr_2.1fr] items-center gap-2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
              <motion.button
                type="button"
                whileTap={!responding ? { scale: 0.98 } : undefined}
                disabled={responding}
                onClick={() => void decline()}
                className="flex h-[56px] items-center justify-center rounded-full bg-transparent text-[15px] font-black tracking-[0.04em] text-black/42 disabled:opacity-40"
              >
                NO
              </motion.button>
              <motion.button
                type="button"
                whileTap={!responding ? { scale: 0.98 } : undefined}
                disabled={responding}
                onClick={onAccept}
                className="font-ticket-latin flex h-[56px] items-center justify-center rounded-full bg-black text-[18px] font-bold italic tracking-[0.08em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] disabled:bg-black/20"
              >
                YES
              </motion.button>
            </div>
          ) : onReapply ? (
            <div className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)] backdrop-blur-xl">
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={onReapply}
                className="font-ticket-latin flex h-[56px] w-full items-center justify-center rounded-full bg-black text-[18px] font-bold italic tracking-[0.08em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)]"
              >
                YES
              </motion.button>
            </div>
          ) : null,
          document.body,
        )}
    </motion.section>
  );
}

import { cn } from "@/lib/cn";
