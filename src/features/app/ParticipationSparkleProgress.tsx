"use client";

import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { SafeImage } from "@/components/SafeImage";

type ParticipationSparkleProps = {
  reached: boolean;
  current?: boolean;
  className?: string;
};

export function participationPrecisionLevel(count: number) {
  if (!Number.isFinite(count)) return 0;
  return Math.min(5, Math.max(0, Math.floor(count)));
}

export function ParticipationSparkle({
  reached,
  current = false,
  className = "",
}: ParticipationSparkleProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d="M20 2.5C21.8 11.1 25.1 16.1 37.5 20C25.1 23.9 21.8 28.9 20 37.5C18.2 28.9 14.9 23.9 2.5 20C14.9 16.1 18.2 11.1 20 2.5Z"
        fill={reached ? "#24211d" : current ? "#d2ccbf" : "#dfdad0"}
        stroke={current && !reached ? "#8f887b" : "transparent"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ParticipationSparkleStrip({
  count,
  compact = false,
}: {
  count: number;
  compact?: boolean;
}) {
  const level = participationPrecisionLevel(count);
  const currentStep = level < 5 ? level + 1 : null;

  return (
    <span
      className={
        compact
          ? "grid grid-cols-5 place-items-center gap-0"
          : "grid w-full grid-cols-5 place-items-center gap-3"
      }
      aria-hidden
    >
      {Array.from({ length: 5 }, (_, index) => {
        const step = index + 1;
        const reached = step <= level;
        const current = step === currentStep;

        return (
          <span
            key={step}
            className={
              compact
                ? "flex h-7 w-5 items-center justify-center"
                : "flex h-10 w-10 items-center justify-center"
            }
          >
            <ParticipationSparkle
              reached={reached}
              current={current}
              className={
                compact
                  ? reached
                    ? "h-6 w-6 drop-shadow-[0_3px_5px_rgba(36,33,29,0.18)]"
                    : current
                      ? "h-[18px] w-[18px]"
                      : "h-[15px] w-[15px]"
                  : reached
                    ? "h-9 w-9 drop-shadow-[0_4px_8px_rgba(36,33,29,0.16)]"
                    : current
                      ? "h-8 w-8"
                      : "h-7 w-7"
              }
            />
          </span>
        );
      })}
    </span>
  );
}

export function CompactParticipationSparkleProgress({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  const level = participationPrecisionLevel(count);

  return (
    <button
      type="button"
      onClick={onOpen}
      title="참여 기록 보기"
      aria-label={`참여 기록 ${level}/5단계. 자세히 보기`}
      className="rounded-full border border-black/[0.09] bg-[#f7f4ed]/90 p-[5px] shadow-[0_8px_24px_rgba(36,33,29,0.1)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_11px_28px_rgba(36,33,29,0.14)] active:scale-[0.98]"
    >
      <span className="flex h-10 items-center rounded-full border border-black/[0.07] bg-[#f3efe6]/88 px-3.5 shadow-inner">
        <ParticipationSparkleStrip count={count} compact />
      </span>
    </button>
  );
}

const participationPhotoUrls = [
  "/images/landing-50q/hero-photo-3.png",
  "/images/landing-50q/hero-photo-2.jpeg",
  "/videos/details-preview-poster.webp",
] as const;

export function participationProgressHeadline(count: number) {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return safeCount === 0
    ? "아직 교집합에 참여하지 않았어요."
    : `교집합에 ${safeCount}번 참여했어요.`;
}

export function ParticipationProgressOverlay({
  open,
  count,
  onClose,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-labelledby="participation-progress-title"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-[120] overflow-hidden bg-[#f7f4ed] text-[#24211d]"
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="참여 기록 닫기"
        className="absolute left-6 top-[calc(22px+env(safe-area-inset-top))] z-20 flex h-11 w-11 items-center justify-center rounded-full text-[#24211d]/55 transition hover:bg-black/[0.05] hover:text-[#24211d]"
      >
        <X size={28} strokeWidth={1.35} aria-hidden />
      </button>

      <div className="pointer-events-none absolute -right-2 -top-8 h-[300px] w-[290px] sm:right-0 sm:h-[340px] sm:w-[330px]">
        {participationPhotoUrls.map((photoUrl, index) => (
          <motion.div
            key={photoUrl}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, x: 34 + index * 10, y: -18 }
            }
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              rotate: index === 0 ? -12 : index === 1 ? 9 : -8,
            }}
            transition={{
              delay: 0.06 + index * 0.07,
              duration: 0.48,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={
              index === 0
                ? "absolute left-[66px] -top-2 h-[184px] w-[150px] rounded-[20px] bg-[#fffdf5] p-1.5 pb-4 shadow-[0_16px_35px_rgba(36,33,29,0.14)] sm:left-[80px]"
                : index === 1
                  ? "absolute -right-1 top-3 h-[172px] w-[142px] rounded-[19px] bg-[#fffdf5] p-1.5 pb-4 shadow-[0_16px_35px_rgba(36,33,29,0.15)]"
                  : "absolute bottom-10 right-1 h-[166px] w-[150px] rounded-[19px] bg-[#fffdf5] p-1.5 pb-4 shadow-[0_16px_35px_rgba(36,33,29,0.14)]"
            }
            aria-hidden
          >
            <SafeImage
              src={photoUrl}
              alt=""
              draggable={false}
              className="block h-full w-full rounded-[15px] bg-[#eee9df] object-cover"
            />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 flex h-full flex-col items-center px-7 pb-[calc(52px+env(safe-area-inset-bottom))] pt-[min(33vh,300px)] text-center">
        <div className="w-full max-w-[290px] text-[#24211d]">
          <ParticipationSparkleStrip count={count} />
        </div>

        <h2
          id="participation-progress-title"
          aria-label={participationProgressHeadline(count)}
          className="mt-10 max-w-[360px] break-keep font-serif text-[31px] font-medium leading-[1.22] tracking-[-0.045em]"
        >
          {participationPrecisionLevel(count) === 0 ? (
            <>
              <span className="block">아직 교집합에</span>
              <span className="block">참여하지 않았어요.</span>
            </>
          ) : (
            participationProgressHeadline(count)
          )}
        </h2>

        <div className="mt-8 max-w-[355px] space-y-6 break-keep text-[15px] font-semibold leading-[1.75] tracking-[-0.025em] text-[#726d63]">
          <p>
            <span className="block">
              교집합이 나에게 잘 맞는 사람들을 추천하려면
            </span>
            <span className="block">평균 5번의 참여가 필요해요.</span>
          </p>
          <p>
            모임에 참여하고 피드백을 남길수록 나를 더 잘 이해하고, 추천은
            더욱 정교해져요.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
