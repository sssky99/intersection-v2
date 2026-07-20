"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
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

const photos = [
  {
    src: "/images/landing-50q/hero-photo-1.jpeg",
    className: "-left-[13%] -top-[10%] -rotate-[8deg]",
    priority: false,
  },
  {
    src: "/images/landing-50q/hero-photo-2.jpeg",
    className: "-right-[13%] -top-[10%] rotate-[8deg]",
    priority: false,
  },
  {
    src: "/images/landing-50q/hero-photo-3.png",
    className: "left-1/2 -top-[7%] -translate-x-1/2 -rotate-[1.5deg]",
    priority: true,
  },
] as const;

export function FiftyQLandingClient() {
  const [typedHeadline, setTypedHeadline] = useState(headlineLead);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedHeadline(headline);
      return;
    }

    let started = false;
    let startTimer: number | undefined;
    let interval: number | undefined;
    let frame: number | undefined;

    const startTyping = () => {
      if (
        started ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      started = true;
      startTimer = window.setTimeout(() => {
        let length = headlineLead.length;
        interval = window.setInterval(() => {
          length += 1;
          setTypedHeadline(headline.slice(0, length));
          if (length >= headline.length && interval) {
            window.clearInterval(interval);
          }
        }, 1300 / (headline.length - headlineLead.length));
      }, 300);
    };

    const scheduleTyping = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(startTyping);
    };

    window.addEventListener("load", scheduleTyping);
    window.addEventListener("pageshow", scheduleTyping);
    document.addEventListener("visibilitychange", scheduleTyping);
    scheduleTyping();

    return () => {
      window.removeEventListener("load", scheduleTyping);
      window.removeEventListener("pageshow", scheduleTyping);
      document.removeEventListener("visibilitychange", scheduleTyping);
      if (frame) window.cancelAnimationFrame(frame);
      if (startTimer) window.clearTimeout(startTimer);
      if (interval) window.clearInterval(interval);
    };
  }, []);

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
        <div className="absolute -right-24 top-24 h-64 w-64 rounded-full bg-accent/15 blur-[80px]" />
        <div className="absolute -left-20 bottom-28 h-52 w-52 rounded-full bg-[#e8d9c6]/55 blur-[70px]" />
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {photos.map((photo) => (
            <div
              key={photo.src}
              className={`absolute h-[73vw] max-h-[314px] w-[59vw] max-w-[254px] rounded-[8px] bg-white p-[7px] pb-[18px] shadow-[0_12px_26px_rgba(18,18,18,0.2)] ${photo.className}`}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[4px]">
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  priority={photo.priority}
                  sizes="(max-width: 460px) 59vw, 271px"
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-x-6 top-[56%] -translate-y-1/2 text-center">
          <h1
            aria-label={headline.replace("\n", " ")}
            className="mx-auto min-h-[76px] whitespace-pre-line break-keep text-[22px] font-bold leading-[1.42] tracking-[-0.045em] text-black/85"
          >
            {typedHeadline}
            {typedHeadline.length < headline.length && (
              <span className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-black/45 align-[-0.12em]" />
            )}
          </h1>
        </div>

        <div className="absolute inset-x-6 top-[72%]">
          <a
            href={isAuthenticated ? "/meetings?tab=recommend" : "/onboarding/start"}
            className="relative mx-auto flex h-16 w-full max-w-[320px] items-center justify-center rounded-full bg-black px-14 text-[16px] font-bold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition-transform active:scale-[0.98]"
          >
            {isAuthenticated ? "내 추천 보러가기" : "내 교집합 찾기"}
            <span aria-hidden="true" className="absolute right-6 text-[22px] font-bold leading-none">
              →
            </span>
          </a>
          {!isAuthenticated && (
            <p className="mt-3 text-center text-[14px] font-bold leading-5 text-black/50">
              이미 교집합을 이용 중인가요?{" "}
              <KakaoLoginButton variant="text" className="font-bold text-black/75">
                {(loading) => (loading ? "카카오로 이동 중..." : "카카오로 로그인")}
              </KakaoLoginButton>
            </p>
          )}
        </div>

      </section>
    </main>
  );
}
