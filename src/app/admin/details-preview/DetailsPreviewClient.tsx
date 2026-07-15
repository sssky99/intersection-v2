"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
  type WheelEvent,
} from "react";
import { IntersectionTicketCard } from "@/components/IntersectionTicketCard";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { todayInKst } from "@/lib/ticketDate";
import { ticketBackgroundImageUrls } from "@/lib/ticketImages";
import type { AvailableDate, GatheringTicket } from "@/types/ticket";

const steps = [
  "성향테스트를 진행해요.",
  "날짜를 선택하세요.",
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
    title: "날짜를 선택하세요.",
    description:
      "원하는 날짜를 고르시면, 결이 맞는 사람들과 식사부터 간단한 활동까지 즐길 수 있는 주말 약속을 만들어 드립니다.",
  },
  {
    label: "3단계",
    title: "추천 받은 사람들과 함께하세요.",
    description:
      "저희는 4~6명 사이 가장 잘 맞을 것 같은 분들을 모아드립니다. 최적의 조합을 위해 나이 차이는 4살 이내로, 성비도 최대한 맞춰드립니다.",
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
type TicketPreviewStatus = "loading" | "ready" | "empty" | "error";

const faqItems = [
  {
    id: "relationship",
    question: "이건 친구를 사귀는 모임인가요, 연인을 사귀는 모임인가요?",
    answer: [
      "그건 여러분에게 달려 있어요.",
      "저희는 여러분이 실제로 만나고 싶어 할 사람들을 오프라인에서 마주칠 수 있게 도와줍니다.",
      "그다음에 어떤 일이 일어날지는 여러분의 선택이에요.",
    ],
  },
  {
    id: "age",
    question: "제 나이대의 사람들이 있을까요?",
    answer: [
      "여러분이 만나는 사람들은 모두 4살 차이 이내이며, 어색하지 않게끔 남녀 비율도 최대한 맞춰드립니다.",
    ],
  },
  {
    id: "members",
    question: "멤버는 어떻게 구성되나요?",
    answer: [
      "로그인하면, 여러분은 성향 테스트를 진행합니다.",
      "저희는 그 결과를 바탕으로, 가장 잘 맞을 것 같은 분들을 모아드립니다.",
      "모임이 끝나고 나면, 피드백을 통해 다시 만나고 싶은 분이 누구인지 여쭤봅니다. 서로 마음이 통했다면 저희가 다음 1:1 블라인드 데이트 자리를 준비해드립니다.",
    ],
  },
  {
    id: "count",
    question: "모임은 몇 명으로 구성되나요?",
    answer: [
      "4~6명으로 구성됩니다. 활동 별로 조금씩 달라질 수는 있지만 기본적으로는 한 모임당 6명의 멤버를 지향합니다.",
    ],
  },
  {
    id: "deposit",
    question: "참가비는 얼마인가요?",
    answer: [
      "참가비는 10,000원이며, 입금 확인 후 배정 대기로 등록됩니다.",
    ],
  },
  {
    id: "confirmation",
    question: "참가비를 입금하면 바로 확정되나요?",
    answer: [
      "참가비를 입금하더라도 바로 확정되지는 않습니다. 입금 후에는 배정 대기 상태가 되며, 확정은 모임 시작 24시간 전에 이뤄집니다.",
    ],
  },
] as const;

async function fetchPublicTicketDates() {
  const response = await fetch("/api/meetings/tickets?mode=dates&publicOnly=1", {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | { dates?: AvailableDate[]; error?: string }
    | null;

  if (!response.ok || !data) {
    throw new Error(data?.error ?? "tickets-load-failed");
  }

  return data.dates ?? [];
}

async function fetchPublicTicketsForDate(date: string) {
  const response = await fetch(
    `/api/meetings/tickets?date=${encodeURIComponent(date)}&publicOnly=1`,
    { cache: "no-store" },
  );
  const data = (await response.json().catch(() => null)) as
    | { dates?: AvailableDate[]; error?: string }
    | null;

  if (!response.ok || !data) {
    throw new Error(data?.error ?? "tickets-load-failed");
  }

  return data.dates?.find((item) => item.date === date) ?? null;
}

function nearestPublicDate(dates: AvailableDate[]) {
  const sortedDates = [...dates].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const today = todayInKst();

  return (
    sortedDates.find((date) => date.date >= today) ?? sortedDates[0] ?? null
  );
}

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
    if (
      process.env.NODE_ENV === "development" &&
      new URLSearchParams(window.location.search).get("preview") === "loading"
    ) {
      return;
    }

    let mounted = true;
    let finished = false;
    const supabase = createClient();
    const revealLanding = () => {
      if (!mounted || finished) return;
      finished = true;
      window.clearTimeout(fallbackTimer);
      trackEvent("landing_view");
      setLandingAuthState("anonymous");
    };
    const fallbackTimer = window.setTimeout(revealLanding, 2000);

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted || finished) return;

        if (data.user) {
          finished = true;
          window.clearTimeout(fallbackTimer);
          window.location.replace("/meetings?tab=recommend");
          return;
        }

        revealLanding();
      })
      .catch(revealLanding);

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
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
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    let shouldPlay = false;

    const tryPlay = () => {
      if (!shouldPlay || document.visibilityState !== "visible") return;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      void video.play().catch(() => undefined);
    };

    const syncVisibility = () => {
      const rect = video.getBoundingClientRect();
      const visibleHeight =
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      const visibleRatio =
        rect.height > 0 ? Math.max(0, visibleHeight) / rect.height : 0;
      shouldPlay = visibleRatio >= 0.35;

      if (shouldPlay) {
        tryPlay();
        return;
      }

      video.pause();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        shouldPlay = entry.isIntersecting && entry.intersectionRatio >= 0.35;

        if (shouldPlay) {
          tryPlay();
          return;
        }

        video.pause();
      },
      {
        threshold: [0, 0.35, 0.7],
      },
    );

    observer.observe(video);
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("pageshow", syncVisibility);
    window.addEventListener("scroll", syncVisibility, { passive: true });
    window.addEventListener("resize", syncVisibility);
    window.requestAnimationFrame(syncVisibility);

    return () => {
      observer.disconnect();
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("pageshow", syncVisibility);
      window.removeEventListener("scroll", syncVisibility);
      window.removeEventListener("resize", syncVisibility);
    };
  }, []);

  const scrollToDetails = () => {
    document.getElementById("details-flow")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <>
      <AnimatePresence>
        {asLandingPage && landingAuthState === "checking" && (
          <motion.div
            key="landing-auth-loading"
            role="status"
            aria-live="polite"
            aria-label="교집합을 준비하고 있어요."
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-[100] flex justify-center bg-[#e9e9e5] text-[#121212] md:px-4"
          >
            <div className="flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center bg-[#f7f7f5] px-8 md:my-4 md:min-h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame">
              <div className="relative h-12 w-20 overflow-hidden" aria-hidden="true">
                <Image
                  src="/images/intersection-mark.png"
                  alt=""
                  width={1024}
                  height={1024}
                  priority
                  sizes="116px"
                  className="absolute left-1/2 top-1/2 w-[116px] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-multiply"
                />
              </div>
              <p className="mt-3 break-keep text-center text-[22px] font-black tracking-[-0.045em] text-black/85">
                교집합을 준비하고 있어요.
              </p>
              <div className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-black/10">
                <motion.div
                  className="h-full w-1/2 rounded-full bg-black/65"
                  animate={reduceMotion ? { opacity: [0.4, 0.8, 0.4] } : { x: ["-110%", "210%"] }}
                  transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }}
                />
              </div>
              <p className="mt-4 text-[13px] font-semibold text-black/40">
                잠시만 기다려주세요.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        aria-hidden={asLandingPage && landingAuthState === "checking"}
        className="flex min-h-dvh justify-center bg-[#e9e9e5] text-[#121212] md:px-4"
      >
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
                src="/images/details/safety-friends-booth.webp"
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
                src="/images/details/section-2-1.webp"
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
                loop
                muted
                playsInline
                poster="/videos/details-preview-poster.webp"
                preload="none"
                className="aspect-[9/16] w-full bg-black object-cover"
              >
                브라우저가 영상을 지원하지 않습니다.
              </video>
            </div>
          </motion.div>

          <LandingFaqSection reduceMotion={reduceMotion} />

          <footer className="mt-10 text-center">
            <a
              href="/privacy"
              className="text-[11px] font-semibold text-black/45 underline underline-offset-2 transition hover:text-black/70"
            >
              개인정보 처리방침
            </a>
          </footer>
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
            <a
              href="/onboarding/start"
              className="flex h-14 w-full items-center justify-center rounded-full bg-black px-5 text-[16px] font-extrabold text-white shadow-[0_16px_42px_rgba(18,18,18,0.16)] transition active:scale-[0.98]"
            >
              내 교집합 찾기
            </a>
          )}
          {landingAuthState === "anonymous" && (
            <p className="mt-2.5 text-center text-[14px] font-semibold leading-5 text-black/50">
              이미 교집합을 이용 중인가요?{" "}
              <KakaoLoginButton variant="text" className="font-extrabold text-black/75">
                {(loading) => (loading ? "카카오로 이동 중..." : "카카오로 로그인")}
              </KakaoLoginButton>
            </p>
          )}
        </div>
      </section>
      </main>
    </>
  );
}

function PublicTicketPreviewSection({
  initialDateEntry,
  reduceMotion,
}: {
  initialDateEntry: AvailableDate | null;
  reduceMotion: boolean | null;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startLeft: 0,
  });
  const [status, setStatus] = useState<TicketPreviewStatus>(() =>
    initialDateEntry?.tickets.length ? "ready" : "loading",
  );
  const [dateEntry, setDateEntry] = useState<AvailableDate | null>(
    initialDateEntry,
  );
  const [shouldLoad, setShouldLoad] = useState(
    Boolean(initialDateEntry?.tickets.length),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const tickets = dateEntry?.tickets ?? [];

  useEffect(() => {
    if (shouldLoad || initialDateEntry?.tickets.length) return;

    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "700px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [initialDateEntry, shouldLoad]);

  useEffect(() => {
    if (initialDateEntry?.tickets.length || !shouldLoad) return;

    let mounted = true;

    setStatus("loading");
    void fetchPublicTicketDates()
      .then(async (dates) => {
        if (!mounted) return;

        const nearestDate = nearestPublicDate(dates);
        if (!nearestDate) {
          setDateEntry(null);
          setStatus("empty");
          return;
        }

        const dateWithTickets = await fetchPublicTicketsForDate(nearestDate.date);
        if (!mounted) return;

        if (!dateWithTickets || dateWithTickets.tickets.length === 0) {
          setDateEntry(null);
          setStatus("empty");
          return;
        }

        setDateEntry(dateWithTickets);
        setActiveIndex(0);
        carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });
        setStatus("ready");
      })
      .catch(() => {
        if (!mounted) return;
        setDateEntry(null);
        setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [initialDateEntry, shouldLoad]);

  const closestSlideIndex = (viewport: HTMLDivElement) => {
    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-public-ticket-slide]"),
    );
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    let nextIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        nextIndex = index;
      }
    });

    return nextIndex;
  };

  const syncActiveSlide = (viewport: HTMLDivElement | null) => {
    if (!viewport || tickets.length === 0) return;
    setActiveIndex(closestSlideIndex(viewport));
  };

  const updateActiveSlide = (event: UIEvent<HTMLDivElement>) => {
    syncActiveSlide(event.currentTarget);
  };

  const startCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    dragState.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state.active || state.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.currentTarget.scrollLeft = state.startLeft - (event.clientX - state.startX);
    syncActiveSlide(event.currentTarget);
  };

  const stopCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state.active || state.pointerId !== event.pointerId) return;

    dragState.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    syncActiveSlide(event.currentTarget);
  };

  const handleCarouselWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

    const viewport = event.currentTarget;
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const nextScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, viewport.scrollLeft + event.deltaY),
    );

    if (nextScrollLeft === viewport.scrollLeft) return;
    event.preventDefault();
    viewport.scrollLeft = nextScrollLeft;
    syncActiveSlide(viewport);
  };

  return (
    <motion.section
      ref={sectionRef}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{
        duration: reduceMotion ? 0.16 : 0.56,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="-mx-6 mt-12 border-t border-black/[0.06] bg-[#f1f0eb] pb-14 pt-12 text-[#121212]"
    >
      <div className="px-6">
        <p className="break-keep text-[15px] font-bold leading-6 text-black/48">
          다양한 경험 중 일부를 미리 확인해보세요.
        </p>
        <h2 className="mt-3 break-keep text-[29px] font-black leading-[1.2] tracking-[-0.055em] text-black/86">
          알고리즘을 바탕으로
          <br />
          당신에게 딱 맞는 경험을 추천드립니다.
        </h2>
      </div>

      {status === "loading" ? (
        <TicketPreviewSkeleton />
      ) : status === "ready" ? (
        <>
          <div
            ref={carouselRef}
            onScroll={updateActiveSlide}
            onPointerDown={startCarouselDrag}
            onPointerMove={moveCarouselDrag}
            onPointerUp={stopCarouselDrag}
            onPointerCancel={stopCarouselDrag}
            onWheel={handleCarouselWheel}
            aria-label="공개 티켓 예시"
            className="scrollbar-none mt-8 flex cursor-grab snap-x snap-mandatory select-none gap-4 overflow-x-auto px-6 pb-2 overscroll-x-contain active:cursor-grabbing"
          >
            {tickets.map((ticket, index) => (
              <div
                key={ticket.id}
                data-public-ticket-slide
                className="w-[min(76vw,316px)] shrink-0 snap-center snap-always"
              >
                <PreviewTicketCard ticket={ticket} priority={index === 0} />
              </div>
            ))}
          </div>

          {tickets.length > 1 && (
            <div
              className="mt-4 flex justify-center gap-1.5"
              aria-label={`티켓 ${activeIndex + 1}/${tickets.length}`}
            >
              {tickets.map((ticket, index) => (
                <span
                  key={ticket.id}
                  className={[
                    "h-1.5 rounded-full transition-all",
                    activeIndex === index
                      ? "w-5 bg-black/70"
                      : "w-1.5 bg-black/15",
                  ].join(" ")}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mx-6 mt-8 rounded-[24px] border border-black/[0.06] bg-white/58 px-5 py-6">
          <p className="break-keep text-sm font-bold leading-6 text-black/50">
            {status === "error"
              ? "티켓을 불러오지 못했어요. 잠시 후 다시 확인해주세요."
              : "곧 공개될 경험을 준비하고 있어요."}
          </p>
        </div>
      )}
    </motion.section>
  );
}

function PreviewTicketCard({
  ticket,
  priority,
}: {
  ticket: GatheringTicket;
  priority: boolean;
}) {
  return (
    <IntersectionTicketCard
      title={ticket.title}
      imageUrl={ticket.imageUrl}
      imageUrls={ticketBackgroundImageUrls(ticket)}
      date={ticket.date}
      time={ticket.time}
      location={`서울\n${ticket.area}`}
      tags={ticket.moodTags}
      priority={priority}
      className="rounded-[26px] shadow-[0_24px_50px_rgba(0,0,0,0.24)]"
    />
  );
}

function TicketPreviewSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="scrollbar-none mt-8 flex gap-4 overflow-hidden px-6 pb-2"
    >
      {[0, 1].map((item) => (
        <div
          key={item}
          className="aspect-[1/1.62] w-[min(76vw,316px)] shrink-0 animate-pulse rounded-[26px] bg-black/[0.06]"
        />
      ))}
    </div>
  );
}

function LandingFaqSection({
  reduceMotion,
}: {
  reduceMotion: boolean | null;
}) {
  const [openItemId, setOpenItemId] = useState<string>(faqItems[0].id);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: reduceMotion ? 0.16 : 0.56,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="-mx-6 border-t border-black/[0.06] bg-[#f7f7f5] px-6 pb-20 pt-14 text-[#121212]"
    >
      <h2 className="text-[34px] font-black leading-none tracking-[-0.055em] text-black/86">
        자주 묻는 질문
      </h2>

      <div className="mt-8 divide-y divide-black/[0.08] border-y border-black/[0.08]">
        {faqItems.map((item) => {
          const open = openItemId === item.id;
          const answerId = `landing-faq-${item.id}`;

          return (
            <section key={item.id}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={answerId}
                onClick={() =>
                  setOpenItemId((current) =>
                    current === item.id ? "" : item.id,
                  )
                }
                className="flex w-full items-start justify-between gap-4 py-6 text-left"
              >
                <span className="break-keep text-[18px] font-black leading-6 tracking-[-0.035em] text-black/82">
                  {item.question}
                </span>
                <ChevronDown
                  size={19}
                  aria-hidden
                  className={[
                    "mt-0.5 shrink-0 text-black/38 transition-transform duration-200",
                    open ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={answerId}
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={
                      reduceMotion
                        ? undefined
                        : { height: "auto", opacity: 1 }
                    }
                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pb-6 pr-7">
                      {item.answer.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="break-keep text-[15px] font-semibold leading-7 tracking-[-0.025em] text-black/52"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </motion.section>
  );
}
