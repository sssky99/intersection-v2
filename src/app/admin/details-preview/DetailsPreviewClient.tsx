"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

const steps = [
  "성향테스트를 진행해요.",
  "경험을 선택하세요",
  "추천 받은 사람들과 함께하세요.",
  "더 나은 추천을 받아보세요.",
] as const;

const detailSteps = [
  {
    label: "1단계",
    title: "성향테스트를 진행해요.",
    description:
      "성향 테스트를 진행하시면, 저희가 가장 잘 맞을 것 같을 분들을 찾아드려요.",
  },
  {
    label: "2단계",
    title: "경험을 선택하세요",
    description:
      "저녁 식사부터, LP바, 동묘 구경, 독서모임, 볼링, 보드게임, 서울 숲 컬러헌팅까지. 원하는 경험을 고르시면, 저희가 주말 약속을 만들어드립니다.",
  },
  {
    label: "3단계",
    title: "추천 받은 사람들과 함께하세요.",
    description:
      "저희는 4~6명 사이 가장 잘 맞을 것 같은 분들을 모아드립니다. 최적의 조합을 위해 나이 차이는 5살 이내로, 성비도 최대한 맞춰드립니다.",
  },
  {
    label: "4단계",
    title: "더 나은 추천을 받아보세요.",
    description:
      "경험이 끝난 뒤, 함께한 사람들에 대한 간단한 피드백을 남겨주세요. 서로의 마음이 통했다면, 1:1로 만날 수 있는 기회도 준비해드려요.",
  },
] as const;

const stepIntervalMs = 2600;

type LandingAuthState = "checking" | "authenticated" | "anonymous";

export function DetailsPreviewClient({
  asLandingPage = false,
}: {
  asLandingPage?: boolean;
} = {}) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [landingAuthState, setLandingAuthState] = useState<LandingAuthState>(
    asLandingPage ? "checking" : "anonymous",
  );

  useEffect(() => {
    if (!asLandingPage) return;

    let mounted = true;
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;

        if (data.user) {
          setLandingAuthState("authenticated");
          return;
        }

        trackEvent("landing_view");
        setLandingAuthState("anonymous");
      })
      .catch(() => {
        if (!mounted) return;

        trackEvent("landing_view");
        setLandingAuthState("anonymous");
      });

    return () => {
      mounted = false;
    };
  }, [asLandingPage]);

  useEffect(() => {
    if (reduceMotion) return;

    const timer = window.setTimeout(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, stepIntervalMs);

    return () => window.clearTimeout(timer);
  }, [activeStep, reduceMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
          void video.play().catch(() => undefined);
          return;
        }

        video.pause();
      },
      {
        threshold: [0, 0.45, 0.7],
      },
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToDetails = () => {
    document.getElementById("details-flow")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main className="flex min-h-dvh justify-center bg-[#e9e9e5] text-[#121212] md:px-4">
      <section
        data-testid="details-preview"
        className="relative min-h-[100svh] w-full max-w-[430px] overflow-hidden bg-[#f7f7f5] md:my-4 md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame"
      >
        <div className="absolute -right-24 top-24 h-64 w-64 rounded-full bg-accent/15 blur-[80px]" />
        <div className="absolute -left-20 bottom-28 h-52 w-52 rounded-full bg-[#e8d9c6]/55 blur-[70px]" />

        <div className="relative z-20 flex min-h-[100svh] flex-col px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[22svh] md:min-h-[calc(100svh-32px)]">
          <div>
            <p className="text-[16px] font-semibold leading-6 tracking-[-0.025em] text-black/48">
              당신과 잘 맞는 사람들이 함께하는
            </p>
            <h1 className="mt-2 max-w-[340px] break-keep text-[40px] font-black leading-[1.12] tracking-[-0.065em] text-black sm:text-[42px]">
              주말 약속
              <br />
              만들어드릴게요
            </h1>

            <div className="mt-8 flex min-h-12 items-center gap-3">
              <span
                aria-label={`${activeStep + 1}단계`}
                className="flex w-[48px] shrink-0 items-center text-[14px] font-bold text-black/34"
              >
                <span
                  aria-hidden="true"
                  className="relative inline-block h-[18px] w-[10px] overflow-hidden"
                >
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={activeStep}
                      initial={
                        reduceMotion ? { opacity: 0 } : { opacity: 0, y: "100%" }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reduceMotion ? { opacity: 0 } : { opacity: 0, y: "-100%" }
                      }
                      transition={{
                        duration: reduceMotion ? 0.16 : 0.38,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {activeStep + 1}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span aria-hidden="true">단계</span>
              </span>

              <div className="min-w-0 flex-1 overflow-hidden rounded-full border border-black/[0.07] bg-white/65 px-4 py-3 shadow-[0_12px_35px_rgba(18,18,18,0.045)] backdrop-blur-md">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={steps[activeStep]}
                    aria-live="polite"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                    className="truncate text-[16px] font-bold tracking-[-0.025em] text-black/72"
                  >
                    {steps[activeStep]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <button
              type="button"
              onClick={scrollToDetails}
              className="mt-8 inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.025em] text-black/42 transition hover:text-black/66"
              aria-label="상세 진행 방식으로 이동"
            >
              어떻게 진행되나요?
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
              >
                <path
                  d="M4.5 6.25 8 9.75l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="relative mt-auto h-[310px]">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 38, rotate: 10 }}
              animate={{ opacity: 1, x: 0, rotate: 7 }}
              transition={{ delay: 0.22, duration: 0.72, ease: "easeOut" }}
              className="absolute -right-10 top-2 h-[222px] w-[166px] overflow-hidden rounded-[3px] border-[9px] border-white bg-white shadow-[0_22px_46px_rgba(18,18,18,0.18)]"
            >
              <Image
                src="/images/details/safety-friends-booth.png"
                alt=""
                fill
                priority
                sizes="166px"
                className="object-cover object-[48%_28%]"
              />
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 46, y: 28, rotate: -8 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: -5 }}
              transition={{ delay: 0.4, duration: 0.76, ease: "easeOut" }}
              className="absolute -bottom-12 right-1 h-[230px] w-[174px] overflow-hidden rounded-[3px] border-[9px] border-white bg-white shadow-[0_22px_52px_rgba(18,18,18,0.2)]"
            >
              <Image
                src="/images/details/section-2-1.png"
                alt=""
                fill
                priority
                sizes="174px"
                className="object-cover object-center"
              />
            </motion.div>
          </div>
        </div>

        <section
          id="details-flow"
          className="relative z-20 border-t border-black/[0.06] bg-[#f1f0eb] px-6 pb-36 pt-16"
        >
          <div className="space-y-8">
            {detailSteps.map((step, index) => (
              <motion.article
                key={step.label}
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.48 }}
                transition={{
                  duration: reduceMotion ? 0.16 : 0.56,
                  delay: reduceMotion ? 0 : index * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex min-h-[34svh] flex-col justify-center rounded-[28px] border border-black/[0.06] bg-white/58 px-5 py-8 shadow-[0_18px_50px_rgba(18,18,18,0.055)] backdrop-blur"
              >
                <p className="text-[15px] font-bold tracking-[-0.02em] text-black/38">
                  {step.label}
                </p>
                <h3 className="mt-3 break-keep text-[25px] font-black leading-[1.18] tracking-[-0.055em] text-black/86">
                  {step.title}
                </h3>
                <p className="mt-4 break-keep text-[15px] font-semibold leading-7 tracking-[-0.025em] text-black/54">
                  {step.description}
                </p>
              </motion.article>
            ))}
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.32 }}
            transition={{
              duration: reduceMotion ? 0.16 : 0.56,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-10"
          >
            <div className="overflow-hidden rounded-[28px] border border-black/[0.07] bg-black shadow-[0_20px_54px_rgba(18,18,18,0.14)]">
              <video
                ref={videoRef}
                src="/videos/details-preview.mp4"
                controls
                muted
                playsInline
                preload="metadata"
                className="aspect-[9/16] w-full bg-black object-cover"
              >
                브라우저가 영상을 지원하지 않습니다.
              </video>
            </div>
          </motion.div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] bg-gradient-to-t from-[#f7f7f5] via-[#f7f7f5]/96 to-transparent px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-5 md:bottom-4">
          {landingAuthState === "checking" ? (
            <div
              aria-hidden="true"
              className="h-14 w-full animate-pulse rounded-full bg-black/10 shadow-[0_16px_42px_rgba(18,18,18,0.08)]"
            />
          ) : landingAuthState === "authenticated" ? (
            <a
              href="/meetings?tab=recommend"
              className="flex h-14 w-full items-center justify-center rounded-full bg-black px-5 text-[16px] font-extrabold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition active:scale-[0.98]"
            >
              내 추천 보러가기
            </a>
          ) : (
            <KakaoLoginButton className="h-14 shadow-[0_16px_42px_rgba(18,18,18,0.16)]">
              {(loading) => (loading ? "카카오로 이동 중..." : "카카오로 시작하기")}
            </KakaoLoginButton>
          )}
        </div>
      </section>
    </main>
  );
}
