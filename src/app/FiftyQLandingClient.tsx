"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const headline = "아무나 만나지 않도록,\n당신에게 딱 맞는 사람들을 찾아줄게요.";
const headlineLead = "아무나 만나지 않도록,\n";

const KakaoLoginButton = dynamic(
  () => import("@/components/KakaoLoginButton"),
  {
    ssr: false,
    loading: () => <span className="font-bold text-black/75">카카오로 로그인</span>,
  },
);

export function FiftyQLandingClient() {
  const [typedHeadline, setTypedHeadline] = useState(headlineLead);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isCtaVisible, setIsCtaVisible] = useState(false);
  const [hasReachedContentCue, setHasReachedContentCue] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) return;

    const cueTimer = window.setTimeout(() => setHasReachedContentCue(true), 1000);
    return () => window.clearTimeout(cueTimer);
  }, []);

  useEffect(() => {
    if (!hasReachedContentCue) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedHeadline(headline);
      setIsContentVisible(true);
      setIsCtaVisible(true);
      return;
    }

    let interval: number | undefined;
    let length = headlineLead.length;
    setIsContentVisible(true);
    interval = window.setInterval(() => {
      length += 1;
      setTypedHeadline(headline.slice(0, length));
      if (length >= headline.length && interval) {
        window.clearInterval(interval);
        setIsCtaVisible(true);
      }
    }, 1300 / (headline.length - headlineLead.length));

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [hasReachedContentCue]);

  useEffect(() => {
    let mounted = true;
    let finished = false;
    const revealAnonymous = () => {
      if (!mounted || finished) return;
      finished = true;
      window.clearTimeout(fallbackTimer);
      void import("@/lib/analytics").then(({ trackEvent }) => {
        trackEvent("landing_view");
      });
    };
    const fallbackTimer = window.setTimeout(revealAnonymous, 4000);
    const authTimer = window.setTimeout(() => {
      void import("@/lib/supabase/client")
        .then(({ createClient }) => createClient().auth.getUser())
        .then(({ data }) => {
          if (!mounted || finished) return;
          if (data.user) {
            finished = true;
            window.clearTimeout(fallbackTimer);
            setIsAuthenticated(true);
            window.location.replace("/meetings?tab=recommend");
            return;
          }
          revealAnonymous();
        })
        .catch(revealAnonymous);
    }, 1800);

    return () => {
      mounted = false;
      window.clearTimeout(authTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <main className="flex h-dvh min-h-[640px] justify-center overflow-hidden bg-[#e9e9e5] text-[#121212] md:px-4">
      <section
        aria-label="교집합 시작"
        className="relative h-full w-full max-w-[430px] overflow-hidden bg-[#f7f7f5] md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[url('/videos/details-preview-poster.webp')] bg-cover bg-center motion-safe:hidden" />
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/videos/details-preview-poster.webp"
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= 1) {
                setHasReachedContentCue(true);
              }
            }}
          >
            <source src="/videos/details-preview.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/60" />
        </div>

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
            isCtaVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <a
            href={isAuthenticated ? "/meetings?tab=recommend" : "/onboarding/start"}
            className="relative mx-auto flex h-16 w-full max-w-[320px] items-center justify-center rounded-full bg-black px-14 text-[16px] font-bold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition-transform active:scale-[0.98]"
          >
            {isAuthenticated ? "내 추천 보러가기" : "나와 맞는 사람들 추천받기"}
            <span aria-hidden="true" className="absolute right-6 text-[22px] font-bold leading-none">
              →
            </span>
          </a>
          {!isAuthenticated && (
            <p className="mt-3 text-center text-[14px] font-bold leading-5 text-white/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]">
              이미 교집합을 이용 중인가요?{" "}
              <KakaoLoginButton variant="text" className="font-bold text-white">
                {(loading) => (loading ? "카카오로 이동 중..." : "카카오로 로그인")}
              </KakaoLoginButton>
            </p>
          )}
        </div>

      </section>
    </main>
  );
}
