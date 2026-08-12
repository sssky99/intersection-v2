"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { FiftyQLandingClient } from "@/app/FiftyQLandingClient";
import { trackEvent } from "@/lib/analytics";

const headline =
  "아무나 만나지 않도록,\n당신에게 딱 맞는 사람들을 찾아줄게요.";
const headlineLead = "아무나 만나지 않도록,\n";

type LandingVariantBProps = {
  preview?: boolean;
};

export function LandingVariantB({ preview = false }: LandingVariantBProps) {
  const [typedHeadline, setTypedHeadline] = useState(headlineLead);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isCtaVisible, setIsCtaVisible] = useState(false);
  const [hasReachedContentCue, setHasReachedContentCue] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  useEffect(() => {
    if (!preview) {
      trackEvent("landing_view", {
        experiment_id: "landing_ab_2026_08",
        landing_variant: "b",
      });
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduceMotion) return;

    setTypedHeadline(headline);
    setIsContentVisible(true);
    setIsCtaVisible(true);
  }, [preview]);

  useEffect(() => {
    if (!hasReachedContentCue) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let length = headlineLead.length;
    setIsContentVisible(true);
    const interval = window.setInterval(() => {
      length += 1;
      setTypedHeadline(headline.slice(0, length));
      if (length >= headline.length) {
        window.clearInterval(interval);
        setIsCtaVisible(true);
      }
    }, 1300 / (headline.length - headlineLead.length));

    return () => window.clearInterval(interval);
  }, [hasReachedContentCue]);

  if (showPhoneInput) {
    return (
      <FiftyQLandingClient
        initialHasSeenIntro
        previewPhoneOnly={preview}
        trackLandingView={false}
      />
    );
  }

  return (
    <main className="flex h-dvh min-h-[640px] justify-center overflow-hidden bg-[#e9e9e5] text-[#121212] md:px-4">
      <section
        aria-label="교집합 B 랜딩 미리보기"
        className="relative h-full w-full max-w-[430px] overflow-hidden bg-black md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[url('/videos/details-preview-poster.webp')] bg-cover bg-center motion-safe:hidden" />
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/videos/details-preview-poster.webp"
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            onLoadedData={() => setHasReachedContentCue(true)}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= 0.8) {
                setHasReachedContentCue(true);
              }
            }}
          >
            <source src="/videos/details-preview.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/70" />
        </div>

        <div className="absolute inset-0">
          <div
            className={`absolute inset-x-6 top-[56%] -translate-y-1/2 text-center transition-opacity duration-500 ${
              isContentVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <h1
              aria-label={headline.replace("\n", " ")}
              className="mx-auto min-h-[76px] whitespace-pre-line break-keep text-[22px] font-bold leading-[1.42] tracking-[-0.045em] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.95),0_6px_24px_rgba(0,0,0,0.75)]"
            >
              {typedHeadline}
              {typedHeadline.length < headline.length && (
                <span className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-white/70 align-[-0.12em]" />
              )}
            </h1>
          </div>

          <div
            className={`absolute inset-x-6 top-[72%] transition-all duration-500 ${
              isCtaVisible
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-3 opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                trackEvent("landing_cta_click", {
                  experiment_id: "landing_ab_2026_08",
                  landing_variant: "b",
                });
                setShowPhoneInput(true);
              }}
              className="relative mx-auto flex h-16 w-full max-w-[320px] items-center justify-center rounded-full bg-black px-14 text-[16px] font-bold text-white shadow-[0_16px_42px_rgba(18,18,18,0.28)] transition-transform active:scale-[0.98]"
            >
              나와 맞는 사람들 추천받기
              <ArrowRight
                size={20}
                strokeWidth={2}
                aria-hidden
                className="absolute right-6"
              />
            </button>
          </div>
        </div>

        {preview && (
          <div className="absolute left-5 top-5 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
            B · PREVIEW
          </div>
        )}
      </section>
    </main>
  );
}

export function LandingVariantBPreview() {
  return <LandingVariantB preview />;
}
