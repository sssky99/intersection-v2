"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  profileArchetypeBackgrounds,
  profileArchetypes,
  type ProfileArchetypeId,
} from "@/data/profileArchetypes";

function useTypedText(
  text: string,
  startDelay: number,
  interval: number,
  enabled = true,
) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    setVisibleText("");
    if (!enabled) return;

    let index = 0;
    let typingTimer: number | null = null;
    const startTimer = window.setTimeout(() => {
      typingTimer = window.setInterval(() => {
        index += 1;
        setVisibleText(text.slice(0, index));
        if (index >= text.length && typingTimer !== null) {
          window.clearInterval(typingTimer);
        }
      }, interval);
    }, startDelay);

    return () => {
      window.clearTimeout(startTimer);
      if (typingTimer !== null) window.clearInterval(typingTimer);
    };
  }, [enabled, interval, startDelay, text]);

  return visibleText;
}

export function ProfileArchetypeResult({
  archetypeId,
  onContinue,
}: {
  archetypeId: ProfileArchetypeId;
  onContinue?: () => void;
}) {
  const result = profileArchetypes[archetypeId];
  const heading = useTypedText("YOU ARE ...", 240, 92);
  const englishName = useTypedText(result.englishName.toUpperCase(), 1650, 105);
  const koreanName = useTypedText(result.koreanName, 2550, 130);
  const resultComplete = koreanName.length === result.koreanName.length;
  const continueLabel = "tap to continue...";
  const continueText = useTypedText(continueLabel, 360, 72, resultComplete);
  const canContinue =
    Boolean(onContinue) && continueText.length === continueLabel.length;

  const continueResult = () => {
    if (!canContinue) return;
    onContinue?.();
  };

  return (
    <section
      role={onContinue ? "button" : undefined}
      tabIndex={onContinue ? 0 : undefined}
      aria-disabled={onContinue ? !canContinue : undefined}
      aria-label={onContinue ? continueLabel : undefined}
      onClick={continueResult}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        continueResult();
      }}
      className={`relative flex min-h-dvh flex-col overflow-hidden bg-black text-white outline-none md:min-h-[calc(100dvh-32px)] ${canContinue ? "cursor-pointer" : "cursor-default"}`}
    >
      <motion.div
        key={archetypeId}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 1.15, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <Image
          src={profileArchetypeBackgrounds[archetypeId]}
          alt=""
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover"
        />
      </motion.div>

      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-black/80" />

      <div className="relative z-10 flex flex-1 flex-col px-7 pb-[calc(26px+env(safe-area-inset-bottom))] pt-[calc(26px+env(safe-area-inset-top))] text-center">
        <div className="flex flex-1 flex-col items-center justify-center pb-8">
          <p className="min-h-9 font-serif text-[25px] italic leading-[1.2] tracking-[-0.025em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.45)]">
            {heading}
            {heading.length < "YOU ARE ...".length && (
              <span className="ml-1 animate-pulse">|</span>
            )}
          </p>
          <p className="mt-7 min-h-[58px] font-serif text-[42px] italic leading-[1.08] tracking-[-0.045em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.45)]">
            {englishName}
            {englishName.length > 0 &&
              englishName.length < result.englishName.length && (
                <span className="ml-1 animate-pulse not-italic">|</span>
              )}
          </p>
          <p className="mt-3 min-h-9 text-[25px] font-black tracking-[-0.055em] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.45)]">
            {koreanName}
            {koreanName.length > 0 && !resultComplete && (
              <span className="ml-1 animate-pulse">|</span>
            )}
          </p>
        </div>

        <AnimatePresence>
          {false && resultComplete && onContinue && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.42, ease: "easeOut" }}
              onClick={onContinue}
              className="flex h-14 w-full items-center justify-center rounded-full border border-white/35 bg-white/92 text-[15px] font-black text-black shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-sm transition active:scale-[0.98]"
            >
              계속하기
            </motion.button>
          )}
        </AnimatePresence>
        <p className="min-h-6 font-serif text-[15px] italic tracking-[0.035em] text-white/82 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
          {continueText}
          {continueText.length > 0 &&
            continueText.length < continueLabel.length && (
              <span className="ml-1 animate-pulse not-italic">|</span>
            )}
        </p>
      </div>
    </section>
  );
}
