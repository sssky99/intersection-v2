"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";

export type CoachmarkStep = {
  id: string;
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  placement?: "top" | "bottom";
  activation?: "visible" | "scroll-end";
};

type TargetMetrics = {
  top: number;
  left: number;
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
  scrollerScrollTop: number | null;
  scrollerScrollHeight: number | null;
  scrollerClientHeight: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function targetSelector(target: string) {
  return `[data-coachmark-target="${target}"]`;
}

function scrollParent(element: HTMLElement, boundary: HTMLElement) {
  let current: HTMLElement | null = element.parentElement;

  while (current && current !== boundary) {
    if (current.scrollHeight > current.clientHeight + 1) {
      return current;
    }
    current = current.parentElement;
  }

  return boundary;
}

export function CoachmarkLayer({
  containerRef,
  step,
  onActiveChange,
  onDismiss,
}: {
  containerRef: RefObject<HTMLElement | null>;
  step: CoachmarkStep | null;
  onActiveChange?: (active: boolean) => void;
  onDismiss: () => void;
}) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [metrics, setMetrics] = useState<TargetMetrics | null>(null);

  useEffect(() => {
    if (!step) {
      setMetrics(null);
      return;
    }

    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const measure = () => {
      const container = containerRef.current;
      const target = container?.querySelector<HTMLElement>(
        targetSelector(step.target),
      );

      if (!container || !target) {
        setMetrics(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const scroller = scrollParent(target, container);
      const hidden =
        targetRect.width <= 0 ||
        targetRect.height <= 0 ||
        targetRect.bottom <= containerRect.top ||
        targetRect.top >= containerRect.bottom;

      if (hidden) {
        setMetrics(null);
        return;
      }

      setMetrics({
        top: targetRect.top - containerRect.top,
        left: targetRect.left - containerRect.left,
        width: targetRect.width,
        height: targetRect.height,
        containerWidth: containerRect.width,
        containerHeight: containerRect.height,
        scrollerScrollTop: scroller.scrollTop,
        scrollerScrollHeight: scroller.scrollHeight,
        scrollerClientHeight: scroller.clientHeight,
      });
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    const container = containerRef.current;
    if (container) {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(container);

      mutationObserver = new MutationObserver(scheduleMeasure);
      mutationObserver.observe(container, {
        attributeFilter: ["data-coachmark-target"],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [containerRef, step]);

  const layout = useMemo(() => {
    if (!metrics || !step) return null;

    const requiresScrollEnd = step.activation === "scroll-end";
    if (requiresScrollEnd) {
      const { scrollerScrollTop, scrollerScrollHeight, scrollerClientHeight } =
        metrics;
      if (
        scrollerScrollTop === null ||
        scrollerScrollHeight === null ||
        scrollerClientHeight === null ||
        scrollerScrollHeight - scrollerScrollTop - scrollerClientHeight > 12
      ) {
        return null;
      }
    }

    const spotlightPadding = 8;
    const spotlight = {
      top: Math.max(12, metrics.top - spotlightPadding),
      left: Math.max(12, metrics.left - spotlightPadding),
      width: Math.min(
        metrics.containerWidth - 24,
        metrics.width + spotlightPadding * 2,
      ),
      height: Math.min(
        metrics.containerHeight - 24,
        metrics.height + spotlightPadding * 2,
      ),
    };
    const safeMargin = 16;
    const bubbleWidth = Math.min(286, metrics.containerWidth - safeMargin * 2);
    const center = spotlight.left + spotlight.width / 2;
    const bubbleLeft = clamp(
      center - bubbleWidth / 2,
      safeMargin,
      Math.max(safeMargin, metrics.containerWidth - safeMargin - bubbleWidth),
    );
    const bubbleTop =
      step.placement === "top"
        ? Math.max(16, spotlight.top - 142)
        : Math.min(
            spotlight.top + spotlight.height + 14,
            metrics.containerHeight - 152,
          );

    return {
      bubble: {
        left: bubbleLeft,
        top: bubbleTop,
        width: bubbleWidth,
      },
      blockers: [
        {
          left: 0,
          top: 0,
          width: metrics.containerWidth,
          height: spotlight.top,
        },
        {
          left: 0,
          top: spotlight.top + spotlight.height,
          width: metrics.containerWidth,
          height: Math.max(
            0,
            metrics.containerHeight - spotlight.top - spotlight.height,
          ),
        },
        {
          left: 0,
          top: spotlight.top,
          width: spotlight.left,
          height: spotlight.height,
        },
        {
          left: spotlight.left + spotlight.width,
          top: spotlight.top,
          width: Math.max(
            0,
            metrics.containerWidth - spotlight.left - spotlight.width,
          ),
          height: spotlight.height,
        },
      ],
      spotlight,
      tailLeft: clamp(center - bubbleLeft, 22, bubbleWidth - 22),
    };
  }, [metrics, step]);

  useEffect(() => {
    onActiveChange?.(Boolean(step && layout));
  }, [layout, onActiveChange, step]);

  return (
    <AnimatePresence>
      {step && layout && (
        <motion.div
          key={step.id}
          className="pointer-events-none absolute inset-0 z-[70] touch-none overscroll-none"
          onWheelCapture={(event) => event.preventDefault()}
          onTouchMoveCapture={(event) => event.preventDefault()}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {layout.blockers.map((blocker, index) => (
            <div
              key={index}
              aria-hidden
              className="pointer-events-auto absolute touch-none"
              style={blocker}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
            />
          ))}

          <motion.div
            aria-hidden
            className="pointer-events-none absolute rounded-[24px] border-2 border-white bg-white/[0.03] shadow-[0_0_0_999px_rgba(0,0,0,0.58),0_0_0_7px_rgba(126,179,199,0.22),0_18px_42px_rgba(255,255,255,0.24)]"
            style={layout.spotlight}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    scale: [1, 1.018, 1],
                  }
            }
            transition={{
              duration: 1.4,
              ease: "easeInOut",
              repeat: shouldReduceMotion ? 0 : Infinity,
              repeatDelay: 1.2,
            }}
          />

          <button
            type="button"
            aria-label="코치마크 닫기"
            onClick={onDismiss}
            className="pointer-events-auto absolute right-4 top-[calc(14px+env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black/50 shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition hover:text-black"
          >
            <X size={17} strokeWidth={2.5} aria-hidden />
          </button>

          <motion.div
            className="pointer-events-none absolute rounded-[20px] border border-white/80 bg-white px-4 py-3.5 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)]"
            style={{
              left: layout.bubble.left,
              top: layout.bubble.top,
              width: layout.bubble.width,
            }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 4, scale: 0.99 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: 0.04 }}
          >
            <span
              aria-hidden
              className={
                step.placement === "top"
                  ? "absolute -bottom-2 h-4 w-4 rotate-45 border-b border-r border-white/80 bg-white"
                  : "absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-white/80 bg-white"
              }
              style={{ left: layout.tailLeft - 8 }}
            />
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-accent">
              {step.eyebrow}
            </p>
            <p className="mt-1.5 text-[15px] font-black leading-5 text-black">
              {step.title}
            </p>
            <p className="mt-1.5 text-xs font-semibold leading-5 text-black/55">
              {step.body}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
