"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  vibeAxes,
  vibeAxisConfig,
  type VibeAxis,
  type VibeScores,
} from "@/components/vibe/vibeGraphConfig";

type VibeAxisLabelOverride = Partial<{
  label: string;
  leftLabel: string;
  rightLabel: string;
}>;

type VibeScoreScale = "legacy" | "internal";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeScore(
  value: number | null | undefined,
  scoreScale: VibeScoreScale,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  if (scoreScale === "legacy") {
    if (value < 1 || value > 5) return null;
    return clamp((value - 3) * 50, -100, 100);
  }

  return clamp(value, -100, 100);
}

function positionPercent(score: number) {
  return ((score + 100) / 200) * 100;
}

export function VibeGraph({
  title,
  description,
  scores,
  visibleAxes = vibeAxes,
  className,
  showAxisHeader = true,
  axisLabelOverrides,
  scoreScale = "legacy",
  animationKey = 0,
  animateBars = true,
}: {
  title: string;
  description?: string;
  scores?: VibeScores | null;
  visibleAxes?: readonly VibeAxis[];
  className?: string;
  showAxisHeader?: boolean;
  axisLabelOverrides?: Partial<Record<VibeAxis, VibeAxisLabelOverride>>;
  scoreScale?: VibeScoreScale;
  animationKey?: string | number;
  animateBars?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const axes = visibleAxes.filter(
    (axis) => normalizeScore(scores?.[axis], scoreScale) !== null,
  );
  const shouldAnimate = animateBars && !shouldReduceMotion;

  if (axes.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-[22px] border border-black/8 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.025)]",
        className,
      )}
    >
      <h2 className="text-[15px] font-black text-black">{title}</h2>
      {description && (
        <p className="mt-2 text-xs font-semibold leading-5 text-black/40">
          {description}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {axes.map((axis, index) => {
          const config = {
            ...vibeAxisConfig[axis],
            ...axisLabelOverrides?.[axis],
          };
          const score = normalizeScore(scores?.[axis], scoreScale) ?? 0;
          const targetPercent = positionPercent(score);
          const fillLeft = Math.min(50, targetPercent);
          const fillWidth = Math.abs(targetPercent - 50);
          const transition = {
            duration: shouldAnimate ? 0.72 : 0,
            ease: "easeOut" as const,
            delay: shouldAnimate ? index * 0.05 : 0,
          };

          return (
            <div key={axis}>
              {showAxisHeader && (
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-black/72">
                    {config.label}
                  </span>
                  <span className="text-[11px] font-semibold text-black/35">
                    {config.leftLabel} · {config.rightLabel}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-bold leading-4 text-black/42">
                    {config.leftLabel}
                  </span>
                  <span className="text-right text-[11px] font-bold leading-4 text-black/42">
                    {config.rightLabel}
                  </span>
                </div>
                <div
                  className="relative h-4 rounded-full bg-black/[0.07] shadow-inner"
                  aria-label={`${config.label}: ${config.leftLabel}에서 ${config.rightLabel} 사이`}
                >
                  <motion.span
                    key={`fill-${axis}-${animationKey}`}
                    initial={shouldAnimate ? { left: "50%", width: "0%" } : false}
                    animate={{
                      left: `${fillLeft}%`,
                      width: `${fillWidth}%`,
                    }}
                    transition={transition}
                    className="absolute top-0 h-full rounded-full bg-accent"
                  />
                  <span className="absolute left-1/2 top-1/2 z-10 h-7 w-px -translate-y-1/2 bg-black/28" />
                  <motion.span
                    key={`thumb-${axis}-${animationKey}`}
                    initial={shouldAnimate ? { left: "50%" } : false}
                    animate={{ left: `${targetPercent}%` }}
                    transition={transition}
                    className="absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-accent shadow-[0_5px_14px_rgba(0,0,0,0.18)]"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
