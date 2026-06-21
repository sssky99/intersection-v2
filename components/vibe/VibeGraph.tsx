"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
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

export type VibeScoreScale = "legacy" | "internal";

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

export function VibeAxisBar<TAxis extends VibeAxis>({
  axis,
  score,
  scoreScale = "legacy",
  axisLabelOverrides,
  showAxisHeader = true,
  animationKey = 0,
  animateBar = true,
  transitionDelay = 0,
  valueLabel,
  input,
}: {
  axis: TAxis;
  score: number | null | undefined;
  scoreScale?: VibeScoreScale;
  axisLabelOverrides?: VibeAxisLabelOverride;
  showAxisHeader?: boolean;
  animationKey?: string | number;
  animateBar?: boolean;
  transitionDelay?: number;
  valueLabel?: string;
  input?: {
    value: number;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
    onChange: (value: number) => void;
  };
}) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = animateBar && !shouldReduceMotion;
  const config = {
    ...vibeAxisConfig[axis],
    ...axisLabelOverrides,
  };
  const normalizedScore = normalizeScore(score, scoreScale) ?? 0;
  const targetPercent = positionPercent(normalizedScore);
  const fillLeft = Math.min(50, targetPercent);
  const fillWidth = Math.abs(targetPercent - 50);
  const transition = {
    duration: shouldAnimate ? 0.72 : 0,
    ease: "easeOut" as const,
    delay: shouldAnimate ? transitionDelay : 0,
  };

  return (
    <div>
      {showAxisHeader && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-black text-black/72">
            {config.label}
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold text-black/35",
              valueLabel && "text-black/60",
            )}
          >
            {valueLabel ?? `${config.leftLabel} · ${config.rightLabel}`}
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
          {input && (
            <input
              type="range"
              min={input.min}
              max={input.max}
              step={input.step}
              value={input.value}
              disabled={input.disabled}
              aria-label={config.label}
              aria-valuetext={`${config.leftLabel}에서 ${config.rightLabel} 사이`}
              onChange={(event) => input.onChange(Number(event.target.value))}
              className="absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function VibeGraph({
  title,
  titleInlineAccessory,
  titleAccessory,
  footer,
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
  titleInlineAccessory?: ReactNode;
  titleAccessory?: ReactNode;
  footer?: ReactNode;
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
  const axes = visibleAxes.filter(
    (axis) => normalizeScore(scores?.[axis], scoreScale) !== null,
  );
  const hasTitleAccessory = Boolean(titleAccessory);

  if (axes.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-[22px] border border-black/8 bg-white px-5 shadow-[0_10px_28px_rgba(0,0,0,0.025)]",
        hasTitleAccessory ? "py-4" : "py-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[15px] font-black text-black">{title}</h2>
            {titleInlineAccessory}
          </div>
          {description && (
            <p className="mt-1.5 text-xs font-semibold leading-5 text-black/40">
              {description}
            </p>
          )}
        </div>
        {titleAccessory && <div className="shrink-0">{titleAccessory}</div>}
      </div>

      <div
        className={cn(
          hasTitleAccessory ? "mt-5 space-y-4" : "mt-6 space-y-5",
        )}
      >
        {axes.map((axis, index) => (
          <VibeAxisBar
            key={axis}
            axis={axis}
            score={scores?.[axis]}
            scoreScale={scoreScale}
            axisLabelOverrides={axisLabelOverrides?.[axis]}
            showAxisHeader={showAxisHeader}
            animationKey={animationKey}
            animateBar={animateBars}
            transitionDelay={index * 0.05}
          />
        ))}
      </div>

      {footer && (
        <div className="mt-5 border-t border-black/8 pt-5">{footer}</div>
      )}
    </section>
  );
}
