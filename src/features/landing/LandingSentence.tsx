"use client";

import { Heart } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./LandingSentence.module.css";

// Based on published meeting_events, checked 2026-09-24.
// Short labels describe the event catalogue, not live availability.
const experiences = [
  "디너 & 칵테일",       // 디너 & 칵테일 아지트, 2026-08-29
  "디너 & 보드게임",     // 디너 & 보드게임 나이트, 2026-09-23
  "향수 공방 체험",      // 디너 & 향수 공방 체험, 2026-09-21
  "덕수궁 야간 산책",    // 디너 & 덕수궁 야간 산책, 2026-09-22
  "화덕 피자 & 맥주",    // 화덕 피자에 간단한 맥주 어때요?, 2026-07-18
  "전시와 저녁 식사",    // 가벼운 전시와 식사 함께하기, 2026-07-25
];
// Existing ticket-detail preview assets; these are illustrative, not live matches.
const companions = [
  { label: "서로 마음이 통한 사람", particle: "과", photos: [], blurred: false },
  { label: "잘 맞는 5명", particle: "과", photos: [
    "/images/meeting-matches/dinner-cocktail/match-1.jpg",
    "/images/meeting-matches/dinner-cocktail/match-2.jpg",
    "/images/meeting-matches/dinner-cocktail/match-3.jpg",
  ], blurred: true },
  { label: "친구 4명", particle: "과", photos: [
    "/images/meeting-matches/dinner-boardgame/other-members/member-1.jpg",
    "/images/meeting-matches/dinner-boardgame/other-members/member-2.jpg",
    "/images/meeting-matches/dinner-boardgame/other-members/member-3.jpg",
  ], blurred: false },
];

function useRotatingWord(count: number, firstChangeMs: number) {
  const [index, setIndex] = useState(0);


  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    let interval: number | undefined;
    const advance = () => {
      if (document.visibilityState === "visible") {
        setIndex((value) => (value + 1) % count);
      }
    };
    const start = window.setTimeout(() => {
      advance();
      interval = window.setInterval(advance, 2400);
    }, firstChangeMs);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [count, firstChangeMs]);

  return index;
}

// Measure the incoming content so the capsule resizes without stretching its text.
function RotatingPill({ itemKey, children }: { itemKey: string; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const content = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [itemKey]);

  return (
    <span className={styles.pill}>
      <motion.span
        className={styles.window}
        animate={{ width }}
        transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.65, 0, 0.35, 1] }}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={itemKey}
            ref={content}
            className={styles.word}
            initial={{ y: reducedMotion ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: reducedMotion ? 0 : "-100%", position: "absolute" }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.65, 0, 0.35, 1] }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </span>
  );
}

export function LandingSentence({ compact = false }: { compact?: boolean }) {
  const experience = useRotatingWord(experiences.length, 2400);
  const companion = useRotatingWord(companions.length, 3000);
  const currentCompanion = companions[companion];
  return (
    <div className={`${styles.sentence} ${compact ? styles.compact : ""}`}>
      <h1 className={styles.heading}>
        <span className={styles.row}>
          <span className={styles.connector}>우리가 준비할게요</span>
          <RotatingPill itemKey={`experience-${experience}`}>
            {experiences[experience]}
          </RotatingPill>
        </span>
        <span className={styles.row}>
          <span className={styles.connector}>당신의</span>
          <RotatingPill itemKey={`people-${companion}`}>
            <span className={styles.companion}>
              {currentCompanion.photos.length === 0 ? (
                <Heart className={styles.icon} size={14} aria-hidden />
              ) : (
                <span className={styles.avatars} aria-hidden="true">
                  {currentCompanion.photos.map((photo) => (
                    <span key={photo} className={styles.avatar}>
                      <SafeImage src={photo} alt="" draggable={false} className={`${styles.face} ${currentCompanion.blurred ? styles.blurred : ""}`} />
                    </span>
                  ))}
                </span>
              )}
              <span>{currentCompanion.label}</span>
            </span>
          </RotatingPill>
          <span className={styles.connector}>{currentCompanion.particle} 함께.</span>
        </span>
      </h1>
    </div>
  );
}
