"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Hand, MoveHorizontal, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import { TicketDrawingFrame } from "@/components/TicketDrawingFrame";
import { TypingSummary } from "@/features/meetings/TicketDetailContent";
import { createClient } from "@/lib/supabase/client";
import type { TicketQuestionTemplate } from "@/types/question";

type DetailsCtaState = "guest" | "onboarding" | "complete";

type DetailsClientProps = {
  userId: string | null;
  nextPath: string;
  alreadySeen: boolean;
  ctaState: DetailsCtaState;
  ticketQuestionTemplates: TicketQuestionTemplate[];
};

type ExampleCard = {
  title: string;
  tags: string[];
  image: string;
  time: string;
  location: string;
  proposerLabel: string;
  interestText: string | null;
};

type ProfileCard = {
  name: string;
  emoji: string;
  paragraphs: string[];
};

type FlowItem = {
  title: string;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const detailsTitleClass =
  "text-[32px] font-bold leading-[1.3] tracking-tight text-black";
const detailsBodyClass = "text-[18px] font-medium leading-7 text-black/64";
const detailsAuxClass =
  "text-[11px] font-bold uppercase tracking-[0.16em] text-accent";
const detailsTextPanelClass = "bg-black/[0.035]";

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

const flowItems: FlowItem[] = [
  {
    title: "성향을 알려주세요",
  },
  {
    title: "자리를 제안받아요",
  },
  {
    title: "참여할수록 다음 추천이 더 좋아져요",
  },
  {
    title: "만남 후, 1:1로 이어질 수 있어요",
  },
];

const flowCaptureImages = [
  "/images/details/participation-step-1.png",
  "/images/details/participation-step-2.png",
  "/images/details/participation-step-3.png",
  "/images/details/participation-step-4.png",
] as const;

const safetyItems = [
  "비슷한 나이대 중심으로 조합해요.",
  "과한 술자리나 노골적인 이성 목적은 막아요.",
  "E 와 I 성향을 상황에 맞게 조절해요.",
  "모임 후 피드백을 받아 다음 추천에 반영해요.",
  "불편한 피드백, 노쇼는 강력하게 제재해요.",
];
const exampleInterestCounts = [3, 2, 4, 5, 4];

export function DetailsClient({
  userId,
  nextPath,
  alreadySeen,
  ctaState,
  ticketQuestionTemplates,
}: DetailsClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctaLabel =
    ctaState === "guest"
      ? "카카오로 로그인하고 시작하기"
      : ctaState === "onboarding"
        ? "질문 이어가기"
        : "내게 맞는 자리 보러가기";

  const continueNext = async () => {
    if (saving || !userId) return;

    setSaving(true);
    setError(null);

    if (!alreadySeen) {
      const { error: updateError } = await createClient()
        .from("profiles")
        .update({ details_seen_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (updateError) {
        setError(
          "상세페이지 완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
        );
        setSaving(false);
        return;
      }
    }

    router.replace(nextPath);
    router.refresh();
  };

  return (
    <section className="flex min-h-dvh justify-center bg-[#111715] text-black md:px-4">
      <div
        data-testid="details-mobile-frame"
        className="relative min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#f7f7f5] pb-[calc(64px+env(safe-area-inset-bottom))] md:my-6 md:min-h-[calc(100dvh-48px)] md:rounded-[32px] md:border md:border-white/10 md:shadow-[0_24px_90px_rgba(0,0,0,0.34)]"
      >
        <main className="w-full px-5 pb-9 pt-5">
          <HeroSection />

          <article className="mt-8 space-y-14">
            <section>
              <TicketExampleHeading />
              <RotatingTicketExamples templates={ticketQuestionTemplates} />
            </section>

            <DocumentSection label="교집합 철학" hideLabel>
              <RecommendationGuideBox />
            </DocumentSection>

            <DocumentSection label={"이런 사람들과\n함께할 수 있어요."} prominentLabel>
              <ParticipationCountBanner />
              <ProfileCarousel />
            </DocumentSection>

            <DocumentSection label="이렇게 참여할 수 있어요." prominentLabel>
              <StepCaptureCarousel items={flowItems} />
            </DocumentSection>

            <DocumentSection label="왜 안전하고 덜 어색할까요?" prominentLabel>
              <ImageSlot tone="warm" image="/images/details/safety-friends-booth.png" />
              <Checklist items={safetyItems} icon="red-check" boxed />
            </DocumentSection>
          </article>

          {error && (
            <p className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
              {error}
            </p>
          )}
        </main>

        <DetailPageStickyCTA
          saving={saving}
          state={ctaState}
          label={ctaLabel}
          loginNextPath="/onboarding/questions?start=1"
          onClick={() => void continueNext()}
        />
      </div>
    </section>
  );
}

function HeroSection() {
  const reducedMotion = useReducedMotion();
  const revealProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: "easeOut" },
      };

  return (
    <motion.header
      {...revealProps}
      className="pt-2"
    >
      <p className={detailsAuxClass}>
        INTERSECTION
      </p>
      <div className="mt-4">
        <ImageSlot hero tone="green" image="/images/details/lasting-meeting.png" priority />
      </div>
      <TypingSummary
        text={"당신에게 딱 맞는 사람들과\n자리를 추천해드립니다."}
        className={cn(
          "mb-0 mt-7 rounded-none !border-black/8 !bg-black/[0.035] !bg-none !shadow-none",
        )}
        paragraphClassName="min-h-[70px] !border-l-0 !pl-0 !text-[18px] !font-medium !leading-7 !text-black/64"
      />
    </motion.header>
  );
}

function DocumentSection({
  hideLabel = false,
  label,
  prominentLabel = false,
  children,
}: {
  hideLabel?: boolean;
  label: string;
  prominentLabel?: boolean;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const revealProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.58, ease: "easeOut" },
      };

  return (
    <motion.section {...revealProps}>
      {!hideLabel && (
        <h2
          className={cn(
            "whitespace-pre-line",
            prominentLabel
              ? detailsTitleClass
              : "text-[18px] font-bold leading-7 text-black",
          )}
        >
          {label}
        </h2>
      )}
      <div className={cn("space-y-8", !hideLabel && "mt-7")}>{children}</div>
    </motion.section>
  );
}

function ImageSlot({
  compact = false,
  hero = false,
  image,
  images,
  priority = false,
  tone = "paper",
}: {
  compact?: boolean;
  hero?: boolean;
  image?: string;
  images?: string[];
  priority?: boolean;
  tone?: "paper" | "warm" | "green" | "dark";
}) {
  const hasImages = Boolean(image || images?.length);

  return (
    <div
      aria-label="문구가 포함된 이미지가 들어갈 영역"
      className={cn(
        "relative overflow-hidden shadow-[0_16px_46px_rgba(0,0,0,0.045)]",
        !hasImages && (hero ? "h-[310px]" : compact ? "h-[178px]" : "h-[232px]"),
        tone === "paper" && "bg-[#ece9df]",
        tone === "warm" && "bg-[#eadfd1]",
        tone === "green" && "bg-[#dfe9e5]",
        tone === "dark" && "bg-[#151a17]",
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="block h-auto w-full"
          style={{ display: "block", height: "auto", width: "100%" }}
        />
      ) : images?.length ? (
        <div className="grid grid-cols-3 gap-1.5 bg-black/5 p-1.5">
          {images.map((src) => (
            <div
              key={src}
              className="overflow-hidden bg-black/5"
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                className="block h-auto w-full"
                style={{ display: "block", height: "auto", width: "100%" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.72),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.42),transparent_42%)]" />
          <div className="absolute inset-x-5 top-5 h-px bg-black/10" />
          <div className="absolute inset-x-5 bottom-5 h-px bg-black/10" />
          <div className="absolute left-5 top-5 h-[calc(100%-40px)] w-px bg-black/10" />
          <div className="absolute right-5 top-5 h-[calc(100%-40px)] w-px bg-black/10" />
          <div className="absolute inset-5 border border-white/35" />
        </>
      )}
      {hero && image && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-black via-black/88 via-55% to-transparent" />
          <p className="pointer-events-none absolute bottom-6 left-5 right-5 whitespace-pre-line text-[32px] font-bold leading-[1.3] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.9)]">
            {"나와 결이 맞는\n사람들을 만나보세요."}
          </p>
        </>
      )}
    </div>
  );
}

function RecommendationGuideBox() {
  return (
    <div className={cn(detailsTextPanelClass, "px-4 py-4", detailsBodyClass)}>
      <p>📌 내 답변을 분석해 최적의 자리를 제안합니다.</p>
      <p className="mt-3">📌 마음에 드는 제안에 YES를 눌러주세요.</p>
    </div>
  );
}

function TicketExampleHeading() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mb-5"
    >
      <h3 className={detailsTitleClass}>
        이런 자리를
        <br />
        제안받을 수 있어요.
      </h3>
    </motion.div>
  );
}

function Checklist({
  boxed = false,
  items,
  icon = "check",
}: {
  boxed?: boolean;
  items: string[];
  icon?: "check" | "shield" | "none" | "red-check";
}) {
  const reducedMotion = useReducedMotion();

  return (
    <ul
      className={cn(
        "space-y-3",
        boxed && `${detailsTextPanelClass} px-4 py-4`,
        icon === "shield" && `${detailsTextPanelClass} px-4 py-4`,
      )}
    >
      {items.map((item, index) => (
        <motion.li
          key={item}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{
            delay: reducedMotion ? 0 : index * 0.08,
            duration: 0.34,
            ease: "easeOut",
          }}
          className={cn("flex gap-3", detailsBodyClass)}
        >
          {icon === "none" ? null : icon === "red-check" ? (
            <span
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[18px] font-black leading-7 text-red-500"
            >
              ✓
            </span>
          ) : icon === "shield" ? (
            <ShieldCheck
              size={16}
              className="mt-1.5 shrink-0 text-accent"
              aria-hidden
            />
          ) : (
            <Check
              size={16}
              className="mt-1.5 shrink-0 text-accent"
              aria-hidden
            />
          )}
          <span className={cn(icon === "shield" && "text-black/70")}>{item}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function ParticipationCountBanner() {
  return (
    <p className={cn(detailsTextPanelClass, "px-4 py-3", detailsBodyClass)}>
      <span aria-hidden="true" className="mr-2">
        🙌
      </span>
      2주만에 461명의 멤버가 참여를 신청했어요!
    </p>
  );
}

function ProfileCarousel() {
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
    <div data-testid="profile-carousel" className="space-y-3">
      <div
        className="h-1 overflow-hidden bg-black/8"
        aria-hidden="true"
      >
        <motion.div
          key={activeProfile.name}
          initial={{ width: "0%" }}
          animate={{ width: shouldReduceMotion ? "100%" : "100%" }}
          transition={{
            duration: shouldReduceMotion ? 0 : profileRotationMs / 1000,
            ease: "linear",
          }}
          className="h-full bg-black"
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.article
          key={activeProfile.name}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={cn(
            "h-[520px] overflow-hidden rounded-lg px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.045)]",
            detailsTextPanelClass,
          )}
        >
          <div>
            <p className={detailsAuxClass}>
              프로필
            </p>
            <h3 className={cn("mt-2 flex items-center gap-2", detailsTitleClass)}>
              <span>{activeProfile.name}</span>
              <span aria-hidden="true" className="text-[24px] leading-none">
                {activeProfile.emoji}
              </span>
            </h3>
          </div>
          <div className="mt-5 space-y-4">
            {activeProfile.paragraphs.map((paragraph) => (
              <p key={paragraph} className={detailsBodyClass}>
                {paragraph}
              </p>
            ))}
          </div>
        </motion.article>
      </AnimatePresence>
    </div>
  );
}

function templateToExampleCard(template: TicketQuestionTemplate): ExampleCard {
  const interestCount =
    exampleInterestCounts[template.questionOrder - 1] ??
    exampleInterestCounts[0];

  return {
    title: template.title,
    tags: template.moodTags,
    image: template.imageUrl ?? "",
    time: "",
    location: "",
    proposerLabel: template.proposerLabel,
    interestText: `${interestCount}명이 관심을 보였어요.`,
  };
}

function RotatingTicketExamples({
  templates,
}: {
  templates: TicketQuestionTemplate[];
}) {
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(reducedMotion);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ticketDrawn, setTicketDrawn] = useState(false);
  const [ticketImageVisible, setTicketImageVisible] = useState(false);
  const cards = templates.map(templateToExampleCard);
  const cardCount = cards.length;

  useEffect(() => {
    if (cardCount === 0) return;

    setTicketDrawn(shouldReduceMotion ? true : false);
    setTicketImageVisible(shouldReduceMotion ? true : false);

    const revealTimer = shouldReduceMotion
      ? undefined
      : window.setTimeout(() => {
          setTicketImageVisible(true);
          setTicketDrawn(true);
        }, 650);
    const nextTimer = window.setTimeout(() => {
      if (!shouldReduceMotion) {
        setTicketDrawn(false);
        setTicketImageVisible(false);
      }
      setActiveIndex((current) => (current + 1) % cardCount);
    }, shouldReduceMotion ? 3600 : 4300);

    return () => {
      if (revealTimer) {
        window.clearTimeout(revealTimer);
      }
      window.clearTimeout(nextTimer);
    };
  }, [activeIndex, cardCount, shouldReduceMotion]);

  if (cardCount === 0) return null;

  const card = cards[activeIndex % cardCount];

  return (
    <div data-testid="ticket-example-carousel" className="mt-5">
      <DetailPageExampleCard
        card={card}
        index={activeIndex}
        drawn={ticketDrawn}
        imageVisible={ticketImageVisible}
        reducedMotion={shouldReduceMotion}
      />

      <div className="mt-3 min-h-[142px]">
        <AnimatePresence mode="wait">
          {ticketDrawn ? (
            <motion.div
              key={`ticket-actions-${card.title}`}
              data-testid="ticket-example-actions"
              aria-hidden="true"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="mx-auto w-full max-w-[330px]"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <span className="flex h-[54px] flex-col items-center justify-center rounded-[16px] border border-black/12 bg-white text-black">
                  <span className="text-sm font-bold">No</span>
                  <span className="mt-0.5 text-[10px] font-medium text-black/40">
                    다음 티켓 보기
                  </span>
                </span>
                <span className="flex h-[54px] flex-col items-center justify-center rounded-[16px] bg-black text-white shadow-sm">
                  <span className="text-sm font-bold">Yes</span>
                  <span className="mt-0.5 text-[10px] font-medium text-white/60">
                    참가하기
                  </span>
                </span>
              </div>
              {card.interestText && (
                <p className={cn("mt-4 px-4 py-3", detailsTextPanelClass, detailsBodyClass)}>
                  <span aria-hidden="true" className="mr-2">
                    🔔
                  </span>
                  {card.interestText}
                </p>
              )}
            </motion.div>
          ) : (
            <span key={`ticket-drawing-${card.title}`} className="block h-[142px]" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DetailPageExampleCard({
  card,
  drawn,
  imageVisible,
  reducedMotion,
}: {
  card: ExampleCard;
  index: number;
  drawn: boolean;
  imageVisible: boolean;
  reducedMotion: boolean;
}) {
  return (
    <article
      data-testid="ticket-example-card"
      className="rounded-[28px] border border-black/[0.06] bg-black/[0.018] px-3 py-4"
    >
      <TicketDrawingFrame
        motionKey={card.title}
        title={card.title}
        imageUrl={card.image}
        date=""
        time={card.time}
        location={card.location}
        tags={card.tags}
        proposerLabel={card.proposerLabel}
        drawn={drawn}
        imageVisible={imageVisible}
        reducedMotion={reducedMotion}
        className="!w-full"
      />
    </article>
  );
}

function StepCaptureCarousel({ items }: { items: FlowItem[] }) {
  const reducedMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ dragging: false, scrollLeft: 0, startX: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const syncActiveIndex = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-step-slide]"),
    );
    if (!slides.length) return;

    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const nextIndex = slides.reduce((closestIndex, slide, index) => {
      const closestSlide = slides[closestIndex];
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const closestCenter =
        closestSlide.offsetLeft + closestSlide.offsetWidth / 2;

      return Math.abs(slideCenter - viewportCenter) <
        Math.abs(closestCenter - viewportCenter)
        ? index
        : closestIndex;
    }, 0);

    setActiveIndex(nextIndex);
  };

  const startMouseDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || event.pointerType !== "mouse" || event.button !== 0) return;

    dragStateRef.current = {
      dragging: true,
      scrollLeft: viewport.scrollLeft,
      startX: event.clientX,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const moveMouseDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !dragState.dragging) return;

    event.preventDefault();
    viewport.scrollLeft = dragState.scrollLeft - (event.clientX - dragState.startX);
  };

  const endMouseDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !dragStateRef.current.dragging) return;

    dragStateRef.current.dragging = false;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    syncActiveIndex();
  };

  return (
    <div
      data-testid="step-capture-carousel"
      className="space-y-3"
      aria-label={`참여 방식 ${activeIndex + 1}단계`}
    >
      <div className="flex justify-center" aria-hidden="true">
        <div className="flex h-14 w-28 flex-col items-center justify-center gap-0.5">
          <MoveHorizontal
            size={34}
            strokeWidth={2}
            className="text-black/22"
          />
          <motion.div
            animate={
              reducedMotion
                ? undefined
                : { x: [-22, 22, -22], rotate: [-8, 8, -8] }
            }
            transition={{
              duration: 1.55,
              ease: "easeInOut",
              repeat: Infinity,
            }}
            className="text-black/78"
          >
            <Hand size={24} strokeWidth={2.4} />
          </motion.div>
        </div>
      </div>

      <div
        ref={viewportRef}
        onScroll={syncActiveIndex}
        onPointerDown={startMouseDrag}
        onPointerMove={moveMouseDrag}
        onPointerUp={endMouseDrag}
        onPointerCancel={endMouseDrag}
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto px-[13%] pb-1 scrollbar-none overscroll-x-contain scroll-smooth select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, index) => (
          <article
          key={item.title}
          data-step-slide
          className="w-full shrink-0 snap-center"
        >
            <div className="relative aspect-[9/14] w-full overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-[0_16px_46px_rgba(0,0,0,0.045)]">
              <Image
                src={flowCaptureImages[index]}
                alt={`${index + 1}단계 참여 화면`}
                fill
                sizes="(max-width: 430px) 74vw, 300px"
                className="object-contain"
              />
            </div>
            <div className="mt-5 px-4 py-2 text-center">
              <p className={detailsAuxClass}>
                {index + 1}단계
              </p>
              <p className="mt-2 text-[16px] font-bold leading-6 text-black">
                {item.title}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DetailPageStickyCTA({
  saving,
  state,
  label,
  loginNextPath,
  onClick,
}: {
  saving: boolean;
  state: DetailsCtaState;
  label: string;
  loginNextPath: string;
  onClick: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isLogin = state === "guest";

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center"
    >
      <div
        data-testid="details-sticky-cta"
        className="pointer-events-auto w-full max-w-[430px] bg-gradient-to-t from-[#f7f7f5] via-[#f7f7f5]/95 to-[#f7f7f5]/0 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-8"
      >
        {isLogin ? (
          <KakaoLoginButton
            nextPath={loginNextPath}
            loadingLabel="카카오로 이동 중..."
            className="h-14 rounded-full bg-[#FEE500] px-5 text-sm font-bold text-[#191919] shadow-[0_18px_50px_rgba(0,0,0,0.12)] active:scale-[0.99] disabled:opacity-60"
          >
            {(loading) => (
              <>
                <KakaoBubbleIcon />
                {loading ? "카카오로 이동 중..." : label}
              </>
            )}
          </KakaoLoginButton>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={onClick}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition active:scale-[0.99] disabled:bg-black/20"
          >
            <Sparkles size={16} aria-hidden />
            {saving ? "준비 중..." : label}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function KakaoBubbleIcon() {
  return (
    <span
      aria-hidden
      className="relative h-[18px] w-[20px] rounded-[48%] bg-[#191919] after:absolute after:bottom-[-2px] after:left-[4px] after:h-[7px] after:w-[7px] after:rotate-45 after:bg-[#191919]"
    />
  );
}
