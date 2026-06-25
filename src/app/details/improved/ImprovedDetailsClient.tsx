"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { TicketQuestionTemplate } from "@/types/question";

type ImprovedDetailsClientProps = {
  ticketQuestionTemplates: TicketQuestionTemplate[];
  nextPath?: string;
  replayMode?: boolean;
};

type SnapRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

type ImagePanelProps = {
  src: string;
  alt: string;
  priority?: boolean;
};

type TicketPreview = {
  title: string;
  imageUrl: string;
  tags: string[];
  proposerLabel: string;
  time: string;
  location: string;
};

type ProfileCard = {
  name: string;
  emoji: string;
  paragraphs: string[];
};

const fallbackTickets: TicketPreview[] = [
  {
    title: "전시보고 카페에서 감상 나누기",
    imageUrl: "/images/details/ticket-exhibition.jpg",
    tags: ["전시관람", "카페대화", "감상공유"],
    proposerLabel: "서현님의 제안",
    time: "토요일 오후",
    location: "서울 을지로",
  },
  {
    title: "LP바에서 좋아하는 음악 이야기",
    imageUrl: "/images/details/ticket-lpbar.jpg",
    tags: ["음악", "LP바", "차분한"],
    proposerLabel: "지우님의 제안",
    time: "금요일 저녁",
    location: "서울 합정",
  },
  {
    title: "피자 먹으며 가볍게 수다 나누기",
    imageUrl: "/images/details/ticket-pizza.jpg",
    tags: ["맛집", "편한대화", "캐주얼"],
    proposerLabel: "민재님의 제안",
    time: "일요일 낮",
    location: "서울 성수",
  },
];

const profileCards: ProfileCard[] = [
  {
    name: "혜진",
    emoji: "🎨",
    paragraphs: [
      "콘텐츠 디자인 쪽에서 일하면서 이미지와 분위기가 사람에게 주는 인상을 자주 생각하고 있어요. 예쁜 것보다 오래 보고 싶은 것을 만드는 데 더 관심이 많은 편이에요.",
      "처음부터 너무 무겁기보다 편하게 웃으며 시작하는 걸 좋아해요. 상대를 천천히 알아가는 과정과 취향이 겹치는 순간을 좋아해요.",
      "요즘은 사진, 빈티지 소품, 분위기 좋은 술집에 관심이 많아요. 낯선 동네에서 마음에 드는 공간을 발견하는 시간을 좋아해요.",
    ],
  },
  {
    name: "성민",
    emoji: "🧑‍🏫",
    paragraphs: [
      "교육 쪽에서 일하면서 사람마다 배우고 이해하는 방식이 다르다는 점을 흥미롭게 느끼고 있어요. 누군가의 변화를 가까이에서 보는 일에 보람을 느껴요.",
      "상대가 편하게 말할 수 있도록 질문을 던지는 편이에요. 가볍게 시작한 이야기가 자연스럽게 가치관이나 생각으로 이어지는 걸 좋아해요.",
      "요즘은 책과 산책, 꾸준히 할 수 있는 운동에 관심이 많아요. 쉬는 날에는 몸과 마음을 천천히 정리하는 시간을 보내고 있어요.",
    ],
  },
  {
    name: "태현",
    emoji: "📋",
    paragraphs: [
      "기획 업무를 하면서 흩어진 아이디어를 정리하고 방향을 잡는 일을 하고 있어요. 사람들의 니즈를 읽고 복잡한 상황을 구조화하는 데 흥미를 느껴요.",
      "처음엔 가볍게 분위기를 풀다가도 이야기가 잘 맞으면 꽤 깊은 주제까지 편하게 나눠요. 농담과 진지한 이야기를 오가는 균형을 좋아해요.",
      "요즘은 맛집, 경제 콘텐츠, 새로운 서비스 구경에 관심이 많아요. 좋은 사람들과 맛있는 음식을 먹으며 이런저런 이야기를 나누는 시간을 좋아해요.",
    ],
  },
  {
    name: "은지",
    emoji: "👗",
    paragraphs: [
      "패션 MD 쪽에서 일하면서 사람들이 무엇을 고르고 왜 끌리는지 관찰하는 일을 하고 있어요. 유행보다 자신에게 잘 맞는 취향을 찾는 데 관심이 많아요.",
      "처음 만난 자리에서는 자연스럽게 리액션을 하며 분위기를 부드럽게 만드는 편이에요. 상대가 좋아하는 것에 대해 이야기할 때 편하게 가까워져요.",
      "요즘은 쇼핑, 카페, 가볍게 떠나는 여행에 관심이 많아요. 예쁜 공간을 발견하거나 좋은 옷을 찾았을 때 기분이 오래 좋아지는 편이에요.",
    ],
  },
  {
    name: "유리",
    emoji: "🎞️",
    paragraphs: [
      "영상 편집 쪽에서 일하면서 장면의 흐름과 감정을 이어붙이는 일을 하고 있어요. 작은 리듬 차이로 분위기가 달라지는 걸 흥미롭게 느껴요.",
      "상대의 이야기를 이미지처럼 떠올리며 듣는 편이에요. 가벼운 농담도 좋아하지만 서로의 기억이나 취향이 담긴 이야기를 나눌 때 더 편안함을 느껴요.",
      "요즘은 영화, 음악, 밤 산책에 관심이 많아요. 혼자 시간도 좋아하지만 좋은 사람과 조용히 같은 장면을 공유하는 시간도 좋아해요.",
    ],
  },
];

const profileRotationMs = 5200;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ImprovedDetailsClient({
  ticketQuestionTemplates,
  nextPath = "/onboarding/questions?start=1",
  replayMode = false,
}: ImprovedDetailsClientProps) {
  const { scrollYProgress } = useScroll();
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useEffect(() => {
    trackEvent("landing_view", {
      page: replayMode ? "details_replay" : "details",
      replay_mode: replayMode,
    });
  }, [replayMode]);

  useEffect(() => {
    if (replayMode) return;

    let active = true;

    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active && data.session) {
          window.location.replace("/meetings?tab=recommend");
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [replayMode]);

  return (
    <section className="flex min-h-dvh justify-center bg-[#111715] text-black md:px-4">
      <div className="relative min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-[#f5f6f1] md:my-6 md:min-h-[calc(100dvh-48px)] md:rounded-[32px] md:border md:border-white/10 md:shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
        <div className="pointer-events-none fixed left-1/2 top-0 z-50 h-[3px] w-full max-w-[430px] -translate-x-1/2 bg-white/20">
          <motion.div
            style={{ scaleX: progressScale }}
            className="h-full w-full origin-left bg-accent"
          />
        </div>

        <HeroSection />

        <main>
          <StorySection title={"내가 원하는 날짜를\n고르기만 하세요."}>
            <ImagePanel
              src="/images/details/improved-date-picker.png"
              alt="원하는 날짜를 선택하는 화면"
            />
          </StorySection>

          <StorySection title={"내 취향과 대화 성향을\n바탕으로"}>
            <ImagePanel
              src="/images/details/improved-vibe-graph.png"
              alt="대화 성향과 참여 기록을 보여주는 화면"
            />
          </StorySection>

          <StorySection title={"결이 맞는 사람들을\n추천해드립니다."}>
            <TicketRecommendationShowcase
              templates={ticketQuestionTemplates}
            />
          </StorySection>

          <StorySection title={"검증된 괜찮은 사람들을\n만나보세요."} last>
            <MemberProfileCarousel />
            <ImprovedDetailsCTAButton
              nextPath={nextPath}
              replayMode={replayMode}
            />
          </StorySection>
        </main>
      </div>
    </section>
  );
}

function HeroSection() {
  return (
    <section className="relative px-5 pb-8 pt-[calc(18px+env(safe-area-inset-top))]">
      <div className="relative z-20 flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/85 text-black/70 shadow-sm backdrop-blur transition hover:bg-white"
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        <span className="rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
          preview
        </span>
      </div>

      <MediaReveal className="mt-4 w-full">
        <div
          aria-label="문구가 포함된 이미지가 들어갈 영역"
          className="relative overflow-hidden bg-[#dfe9e5] shadow-[0_16px_46px_rgba(0,0,0,0.045)]"
        >
          <img
            src="/images/details/lasting-meeting.png"
            alt="가까이 모여 손으로 하트 모양을 만든 사람들"
            loading="eager"
            className="block h-auto w-full"
            style={{ display: "block", height: "auto", width: "100%" }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-black via-black/88 via-55% to-transparent" />
          <div className="pointer-events-none absolute bottom-6 left-5 right-5">
            <TextReveal delay={0.08}>
              <h1 className="whitespace-pre-line text-[48px] font-black leading-[1.08] tracking-normal text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.9)]">
                {"아무나\n만나지 마세요."}
              </h1>
            </TextReveal>
          </div>
        </div>
      </MediaReveal>
    </section>
  );
}

function StorySection({
  title,
  children,
  last = false,
}: {
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn("px-5 pt-8", last ? "pb-0" : "pb-8")}>
      <TextReveal>
        <h2 className="whitespace-pre-line text-[38px] font-black leading-[1.12] tracking-normal text-[#111715]">
          {title}
        </h2>
      </TextReveal>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ImagePanel({
  src,
  alt,
  priority = false,
}: ImagePanelProps) {
  return (
    <MediaReveal delay={0.06}>
      <div
        aria-label="문구가 포함된 이미지가 들어갈 영역"
        className="relative overflow-hidden bg-white shadow-[0_16px_46px_rgba(0,0,0,0.045)]"
      >
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className="block h-auto w-full"
          style={{ display: "block", height: "auto", width: "100%" }}
        />
      </div>
    </MediaReveal>
  );
}

function TextReveal({
  children,
  className,
  delay = 0,
}: SnapRevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 54,
      }}
      whileInView={{
        opacity: [0, 1, 1],
        x: [54, -5, 0],
      }}
      viewport={{ amount: 0.42, once: false, margin: "0px 0px -12% 0px" }}
      transition={{
        delay,
        duration: 0.34,
        times: [0, 0.72, 1],
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function MediaReveal({
  children,
  className,
  delay = 0,
}: SnapRevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.28, once: false, margin: "0px 0px -10% 0px" }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function TicketRecommendationShowcase({
  templates,
}: {
  templates: TicketQuestionTemplate[];
}) {
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(reducedMotion);
  const cards = useMemo(() => {
    const mapped = templates
      .map((template): TicketPreview | null => {
        if (!template.imageUrl) return null;

        return {
          title: template.title,
          imageUrl: template.imageUrl,
          tags: template.moodTags,
          proposerLabel: template.proposerLabel,
          time: template.defaultTime ?? "원하는 날짜",
          location: template.defaultRegion ?? "서울",
        };
      })
      .filter((template): template is TicketPreview => Boolean(template));

    return mapped.length > 0 ? mapped : fallbackTickets;
  }, [templates]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (cards.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % cards.length);
    }, shouldReduceMotion ? 4200 : 3200);

    return () => window.clearInterval(timer);
  }, [cards.length, shouldReduceMotion]);

  const card = cards[activeIndex % cards.length];

  return (
    <MediaReveal delay={0.06}>
      <div className="rounded-[30px] border border-black/[0.06] bg-white px-3 py-4 shadow-[0_20px_52px_rgba(17,23,21,0.12)]">
        <TicketDrawingFrame
          motionKey={card.title}
          title={card.title}
          imageUrl={card.imageUrl}
          date=""
          time={card.time}
          location={card.location}
          tags={card.tags}
          proposerLabel={card.proposerLabel}
          drawn
          imageVisible
          reducedMotion={shouldReduceMotion}
          showSweep={!shouldReduceMotion}
          className="!w-full"
        />
        <div className="mx-auto mt-3 grid w-full max-w-[330px] grid-cols-2 gap-2.5">
          <span className="flex h-[54px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black">
            <span className="text-sm font-bold">No</span>
            <span className="mt-0.5 text-[10px] font-medium text-black/40">
              다음 티켓 보기
            </span>
          </span>
          <span className="flex h-[54px] flex-col items-center justify-center rounded-[16px] bg-[#111715] text-white shadow-sm">
            <span className="text-sm font-bold">Yes</span>
            <span className="mt-0.5 text-[10px] font-medium text-white/60">
              자세히 보기
            </span>
          </span>
        </div>
      </div>
    </MediaReveal>
  );
}

function MemberProfileCarousel() {
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(reducedMotion);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeProfile = profileCards[activeIndex];

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % profileCards.length);
    }, profileRotationMs);

    return () => window.clearTimeout(timer);
  }, [activeIndex, shouldReduceMotion]);

  return (
    <MediaReveal delay={0.06}>
      <div data-testid="profile-carousel" className="space-y-3">
        <div className="h-1 overflow-hidden rounded-full bg-black/8" aria-hidden="true">
          <motion.div
            key={activeProfile.name}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: shouldReduceMotion ? 0 : profileRotationMs / 1000,
              ease: "linear",
            }}
            className="h-full bg-accent"
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.article
            key={activeProfile.name}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="h-[488px] overflow-hidden rounded-lg bg-black/[0.035] px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.045)]"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                프로필
              </p>
              <h3 className="mt-2 flex items-center gap-2 text-[32px] font-bold leading-[1.3] tracking-normal text-black">
                <span>{activeProfile.name}</span>
                <span aria-hidden="true" className="text-[24px] leading-none">
                  {activeProfile.emoji}
                </span>
              </h3>
            </div>
            <div className="mt-5 space-y-4">
              {activeProfile.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-[18px] font-medium leading-7 text-black/64"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </MediaReveal>
  );
}

function ImprovedDetailsCTAButton({
  nextPath,
  replayMode,
}: {
  nextPath: string;
  replayMode: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const ctaViewedRef = useRef(false);

  const trackCtaView = () => {
    if (ctaViewedRef.current) return;
    ctaViewedRef.current = true;
    trackEvent("landing_cta_view", {
      cta_location: "details_inline",
      replay_mode: replayMode,
    });
  };

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ amount: 0.4, once: true }}
      onViewportEnter={trackCtaView}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mt-5 pb-[calc(32px+env(safe-area-inset-bottom))]"
      data-testid="details-inline-cta"
    >
      {replayMode ? (
        <a
          href={nextPath}
          className="flex h-14 w-full items-center justify-center rounded-full bg-[#111715] px-5 text-sm font-bold text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition active:scale-[0.99]"
        >
          나에게 맞는 자리 보러가기
        </a>
      ) : (
        <KakaoLoginButton
          nextPath={nextPath}
          loadingLabel="카카오로 이동 중..."
          className="h-14 rounded-full px-5 text-sm font-bold text-[#191919] shadow-[0_18px_50px_rgba(0,0,0,0.18)] active:scale-[0.99] disabled:opacity-60"
        >
          {(loading) => <>{loading ? "카카오로 이동 중..." : "카카오로 시작하기"}</>}
        </KakaoLoginButton>
      )}
    </motion.div>
  );
}
