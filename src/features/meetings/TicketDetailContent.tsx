"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock3, LockKeyhole, MapPin, Navigation, UserRound, X } from "lucide-react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import { MeetingAtmospherePanel } from "@/features/meetings/MeetingAtmospherePanel";
import { courseStepOpenOffsetMinutes } from "@/lib/ticketCourse";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type GatheringTicket,
} from "@/types/ticket";

export type TicketDetailSectionKey =
  | "summary"
  | "recommendation"
  | "course"
  | "activities"
  | "vibe"
  | "place"
  | "notice";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type JourneyStationMapPlace = {
  name: string;
  mapx: number;
  mapy: number;
};

const journeyAreaStations: Array<{
  keywords: string[];
  place: JourneyStationMapPlace;
}> = [
  {
    keywords: ["성수"],
    place: { name: "성수역", mapx: 1270559610, mapy: 375445810 },
  },
  {
    keywords: ["건대", "광진"],
    place: { name: "건대입구역", mapx: 1270692310, mapy: 375404080 },
  },
  {
    keywords: ["강남", "서초"],
    place: { name: "강남역", mapx: 1270276210, mapy: 374979420 },
  },
  {
    keywords: ["잠실", "송파"],
    place: { name: "잠실역", mapx: 1271001590, mapy: 375132620 },
  },
  {
    keywords: ["을지로", "종로", "중구"],
    place: { name: "을지로입구역", mapx: 1269826180, mapy: 375660140 },
  },
  {
    keywords: ["홍대", "연남", "마포"],
    place: { name: "홍대입구역", mapx: 1269253810, mapy: 375571920 },
  },
  {
    keywords: ["용산"],
    place: { name: "용산역", mapx: 1269645610, mapy: 375298490 },
  },
  {
    keywords: ["이태원"],
    place: { name: "이태원역", mapx: 1269943020, mapy: 375344880 },
  },
  {
    keywords: ["여의도", "영등포"],
    place: { name: "여의도역", mapx: 1269241910, mapy: 375216240 },
  },
  {
    keywords: ["노원", "강북", "도봉", "성북"],
    place: { name: "노원역", mapx: 1270613680, mapy: 376551280 },
  },
  {
    keywords: ["강서", "양천"],
    place: { name: "발산역", mapx: 1268376680, mapy: 375585980 },
  },
  {
    keywords: ["관악", "동작"],
    place: { name: "서울대입구역", mapx: 1269527390, mapy: 374812470 },
  },
  {
    keywords: ["동대문", "중랑", "동북"],
    place: { name: "청량리역", mapx: 1270468350, mapy: 375801780 },
  },
];

function journeyStationMapPlace(area: string) {
  const normalizedArea = area.replace(/\s/g, "");
  return (
    journeyAreaStations.find(({ keywords }) =>
      keywords.some((keyword) => normalizedArea.includes(keyword)),
    )?.place ?? null
  );
}

const defaultSections: TicketDetailSectionKey[] = [
  "summary",
  "recommendation",
  "course",
  "vibe",
  "place",
  "activities",
  "notice",
];

function participantNotice(ticket: GatheringTicket) {
  const minimum =
    ticket.minimumParticipantCount ?? MEETING_DEFAULT_MIN_PARTICIPANT_COUNT;
  const maximum = ticket.maxParticipantCount ?? MEETING_MAX_PARTICIPANT_COUNT;

  return [
    `이 자리는 최소 ${minimum}명부터 최대 ${maximum}명까지 함께해요.`,
    `최소 ${minimum}명이 모이지 않으면 모임이 자동 취소돼요.`,
  ];
}

const commonNotices = ["상세 장소는 참여 확정 후 안내돼요."];

const legacyDepositNoticePattern = /(?:참여\s*보증금|참가\s*보증금|보증금|환급)/;

function cleanList(items: string[] | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

function activityParagraphs(items: string[]) {
  return items.flatMap((item) =>
    item
      .split(/\r?\n[\t ]*\r?\n/)
      .map((paragraph) =>
        paragraph.replace(/^[•·\-–—]\s*/, "").trim(),
      )
      .filter(Boolean),
  );
}

export function TicketDetailContent({
  ticket,
  className,
  sections = defaultSections,
  startWithBorder = false,
  afterActivities,
  afterNotice,
  footer,
}: {
  ticket: GatheringTicket;
  className?: string;
  sections?: TicketDetailSectionKey[];
  startWithBorder?: boolean;
  afterActivities?: ReactNode;
  afterNotice?: ReactNode;
  footer?: ReactNode;
}) {
  const activities = cleanList(ticket.detailActivities);
  const defaultNotices = [...participantNotice(ticket), ...commonNotices];
  const customNotices = cleanList(ticket.detailNotice?.split(/\r?\n/)).filter(
    (notice) =>
      !defaultNotices.includes(notice) &&
      !legacyDepositNoticePattern.test(notice),
  );
  const noticeItems = [...defaultNotices, ...customNotices];
  const visibleSections = new Set(sections);
  const courseSteps = cleanCourseSteps(ticket.courseSteps);
  const journeyDateTimeLabel = [
    formatTicketDateLabel(ticket.date),
    formatTicketTimeLabel(ticket.time),
  ]
    .filter(Boolean)
    .join(" · ");
  const detailSummary = ticket.detailSummary?.trim();
  const recommendationReasons = cleanList(ticket.recommendationReasons);
  const hasSummary = Boolean(visibleSections.has("summary") && detailSummary);
  const hasRecommendation = Boolean(
    visibleSections.has("recommendation") &&
      recommendationReasons.length > 0,
  );
  const hasCourse = Boolean(
    visibleSections.has("course") && courseSteps.length >= 2,
  );
  const showSummary = hasSummary && !hasCourse;
  const hasPlace = Boolean(
    ticket.place?.name?.trim() || ticket.place?.address?.trim(),
  );
  const firstSectionAfterSummary =
    showSummary && hasCourse
      ? "course"
      : showSummary && visibleSections.has("vibe")
      ? "vibe"
      : showSummary && visibleSections.has("place") && hasPlace
        ? "place"
        : showSummary &&
            visibleSections.has("activities") &&
            activities.length > 0
          ? "activities"
          : showSummary && visibleSections.has("notice")
            ? "notice"
            : null;

  return (
    <div className={cn("mt-5", className)}>
      {hasRecommendation && (
        <TicketDetailSection
          title="추천 이유"
          startWithBorder={startWithBorder}
          hideTopBorder
        >
          <BulletList items={recommendationReasons} />
        </TicketDetailSection>
      )}

      {showSummary && <TypingSummary text={detailSummary!} />}

      {hasCourse && (
        <TicketDetailSection
          title="여정"
          eyebrow={journeyDateTimeLabel}
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "course"}
        >
          <TicketCoursePanel ticket={ticket} steps={courseSteps} />
        </TicketDetailSection>
      )}

      {visibleSections.has("vibe") && (
        <TicketDetailSection
          title="자리 분위기"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "vibe"}
        >
          <MeetingAtmospherePanel profile={ticket.atmosphere} />
        </TicketDetailSection>
      )}

      {visibleSections.has("place") && hasPlace && (
        <TicketDetailSection
          title="장소"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "place"}
        >
          <TicketPlacePanel place={ticket.place!} />
        </TicketDetailSection>
      )}

      {visibleSections.has("activities") && activities.length > 0 && (
        <TicketDetailSection
          title="이 자리에서는 이런 걸 해요"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "activities"}
        >
          <ActivityProse items={activities} />
        </TicketDetailSection>
      )}

      {afterActivities}

      {visibleSections.has("notice") && (
        <TicketDetailSection
          title="알아두면 좋아요"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "notice"}
        >
          <BulletList items={noticeItems} />
          {afterNotice && <div className="mt-4">{afterNotice}</div>}
        </TicketDetailSection>
      )}

      {footer}
    </div>
  );
}

function cleanCourseSteps(steps: GatheringTicket["courseSteps"]) {
  return (steps ?? []).filter((step) =>
    Boolean(
      step.title?.trim() ||
        step.activityType?.trim() ||
        step.imageUrl?.trim(),
    ),
  );
}

function TicketCoursePanel({ ticket, steps }: {
  ticket: GatheringTicket;
  steps: NonNullable<GatheringTicket["courseSteps"]>;
}) {
  const [mapStepIndex, setMapStepIndex] = useState<number | null>(null);
  const selectedStep = mapStepIndex === null ? null : steps[mapStepIndex];
  const selectedMapPlace = journeyStationMapPlace(ticket.area);

  useEffect(() => {
    if (mapStepIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapStepIndex(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mapStepIndex]);

  return (
    <div className="relative">
      <div className="relative pl-5 before:absolute before:bottom-8 before:left-[5px] before:top-[6px] before:block before:w-px before:bg-black/[0.13] before:content-['']">
        <ol className="space-y-3">
      {steps.map((step, index) => {
        const openOffsetMinutes = courseStepOpenOffsetMinutes(
          step.openOffsetMinutes,
          index,
        );
        const timeLabel = courseStepTimeLabel(ticket.time, openOffsetMinutes);

        return (
          <li
            key={step.id}
            className="relative rounded-[12px] border border-black/[0.07] bg-[#f1ebe0]"
          >
            <span
              aria-hidden
              className={cn(
                "absolute -left-[20px] top-5 z-10 h-[11px] w-[11px] rounded-full border-[3px] border-[#f8f4eb] shadow-[0_0_0_1px_rgba(23,23,19,0.14)]",
                index === 0 ? "bg-[#171713]" : "bg-[#8f8778]",
              )}
            />
            <button
              type="button"
              onClick={() => setMapStepIndex(index)}
              aria-label={`${step.title || step.activityType || "활동"} 지도 보기`}
              className="absolute right-3.5 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-[#f8f4eb]/80 text-black/58 shadow-[0_5px_14px_rgba(0,0,0,0.07)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2"
            >
              <Navigation size={15} fill="currentColor" strokeWidth={1.8} aria-hidden />
            </button>

            <div className="px-4 pb-3 pt-4 pr-14">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.04em] text-black/40">
                    {timeLabel}
                  </span>
                </div>

                <p className="mt-1.5 break-keep text-[17px] font-black leading-6 tracking-[-0.04em] text-black">
                  {step.title || step.activityType || "활동"}
                </p>
              </div>
            </div>

            <JourneyPeoplePanel stepIndex={index} />
          </li>
        );
      })}
        </ol>
      </div>

      <AnimatePresence>
        {selectedStep && (
          <UnreleasedMapSheet
            title={selectedStep.title || selectedStep.activityType || "활동"}
            timeLabel={courseStepTimeLabel(
              ticket.time,
              courseStepOpenOffsetMinutes(
                selectedStep.openOffsetMinutes,
                mapStepIndex ?? 0,
              ),
            )}
            place={selectedMapPlace}
            onClose={() => setMapStepIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UnreleasedMapSheet({
  title,
  timeLabel,
  place,
  onClose,
}: {
  title: string;
  timeLabel: string;
  place: { name: string; mapx: number; mapy: number } | null;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[120] flex justify-center bg-black/25"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 지도`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f4ed] shadow-[0_-24px_80px_rgba(0,0,0,0.22)]"
      >
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-black/[0.08] bg-[#f7f4ed]/95 px-5 pb-4 pt-[calc(14px+env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-black/40">{timeLabel}</p>
            <h2 className="mt-1 truncate text-[18px] font-black tracking-[-0.03em] text-black">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="지도 닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/58 shadow-sm"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#e7e5df]">
          {place && (
            <NaverMapPreview
              place={place}
              heightClassName="h-full"
              className="pointer-events-none absolute inset-[-8px] scale-[1.03] rounded-none border-0 saturate-[0.88] blur-[1.5px]"
            />
          )}

          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div className="flex max-w-[280px] flex-col items-center rounded-[28px] border border-white/70 bg-[#f7f4ed]/92 px-7 py-7 text-center shadow-[0_22px_60px_rgba(36,45,38,0.18)] backdrop-blur-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg">
                <LockKeyhole size={20} strokeWidth={2} aria-hidden />
              </span>
              <p className="mt-4 break-keep text-[14px] font-black leading-6 tracking-[-0.025em] text-black">
                정확한 장소는 모임 시작 24시간 전에 공개돼요.
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function JourneyPeoplePanel({ stepIndex }: { stepIndex: number }) {
  if (stepIndex === 0) {
    return (
      <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
        <div className="flex min-h-12 items-center justify-between gap-3 px-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-[#eee8dc] text-black/48">
              <UserRound size={13} strokeWidth={2} aria-hidden />
            </span>
            <span className="text-[11px] font-black text-black/68">나</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-black/38">
            응답 대기
            <Clock3 size={12} strokeWidth={1.9} aria-hidden />
          </span>
        </div>
        <div className="flex min-h-12 items-center gap-2.5 border-t border-black/[0.06] px-3.5">
          <JourneyAvatarStack tone="warm" />
          <p className="text-[10px] font-bold text-black/44">
            나와 <strong className="font-black text-black/72">잘 맞는 5명</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
      <div className="flex min-h-12 items-center gap-2.5 px-3.5">
        <JourneyAvatarStack tone="warm" />
        <p className="text-[10px] font-bold text-black/44">
          <strong className="font-black text-black/72">저녁을 함께한 멤버</strong>
        </p>
      </div>
      <div className="flex min-h-12 items-center gap-2.5 border-t border-black/[0.06] px-3.5">
        <JourneyAvatarStack tone="cool" />
        <p className="text-[10px] font-bold text-black/44">
          다른 <strong className="font-black text-black/72">교집합 멤버들</strong>도 함께해요
        </p>
      </div>
    </div>
  );
}

function JourneyAvatarStack({ tone }: { tone: "warm" | "cool" }) {
  const colors =
    tone === "warm"
      ? ["bg-[#d8b49b]", "bg-[#b9c7b0]", "bg-[#a9bbc9]"]
      : ["bg-[#d7aab7]", "bg-[#b5c8d7]", "bg-[#c6b6d4]"];

  return (
    <span className="flex w-[52px] shrink-0 items-center" aria-hidden>
      {colors.map((color, index) => (
        <span
          key={color}
          className={cn(
            "h-7 w-7 rounded-full border-2 border-[#f8f4eb] shadow-sm",
            color,
            index > 0 && "-ml-3",
          )}
        />
      ))}
    </span>
  );
}

function courseStepTimeLabel(startTime: string, offsetMinutes: number) {
  const matched = startTime.match(/(\d{1,2}):(\d{2})/);
  if (!matched) return offsetMinutes === 0 ? startTime : `시작 +${offsetMinutes}분`;

  const totalMinutes =
    (Number(matched[1]) * 60 + Number(matched[2]) + offsetMinutes) % (24 * 60);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;

  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
}

export function TypingSummary({
  className,
  paragraphClassName,
  text,
}: {
  className?: string;
  paragraphClassName?: string;
  text: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState(() =>
    shouldReduceMotion ? text : "",
  );

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayText(text);
      return;
    }

    setDisplayText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 28);

    return () => window.clearInterval(timer);
  }, [shouldReduceMotion, text]);

  return (
    <div
      className={cn(
        "mb-5 rounded-3xl border border-accent/18 bg-gradient-to-br from-white via-white to-accent/[0.08] px-4 py-4 shadow-[0_10px_24px_rgba(126,179,199,0.08)]",
        className,
      )}
    >
      <p
        className={cn(
          "min-h-[56px] whitespace-pre-line border-l-2 border-accent/70 pl-4 text-[15px] font-black leading-7 text-black/80",
          paragraphClassName,
        )}
      >
        {displayText}
        {!shouldReduceMotion && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-accent"
          />
        )}
      </p>
    </div>
  );
}

function TicketPlacePanel({
  place,
}: {
  place: NonNullable<GatheringTicket["place"]>;
}) {
  const hasMap =
    place.source === "naver" &&
    typeof place.mapx === "number" &&
    typeof place.mapy === "number" &&
    Boolean(place.name);

  return (
    <div className="rounded-3xl border border-black/8 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {place.name && (
            <p className="text-base font-black leading-6 text-black">
              {place.name}
            </p>
          )}
          {place.category && (
            <p className="mt-1 text-[11px] font-bold text-accent">
              {place.category}
            </p>
          )}
          {place.address && (
            <p className="mt-2 text-sm font-semibold leading-6 text-black/62">
              {place.address}
            </p>
          )}
          {place.jibunAddress && place.jibunAddress !== place.address && (
            <p className="mt-1 text-xs font-semibold leading-5 text-black/42">
              {place.jibunAddress}
            </p>
          )}
        </div>
        {place.link && (
          <a
            href={place.link}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-black text-black/45 transition hover:text-black"
          >
            네이버
          </a>
        )}
      </div>
      {hasMap && (
        <NaverMapPreview
          place={{
            name: place.name ?? "장소",
            mapx: place.mapx!,
            mapy: place.mapy!,
          }}
          className="mt-4"
        />
      )}
    </div>
  );
}

function TicketDetailSection({
  title,
  eyebrow: eyebrowOverride,
  children,
  startWithBorder = false,
  hideTopBorder = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  startWithBorder?: boolean;
  hideTopBorder?: boolean;
}) {
  const eyebrow =
    eyebrowOverride ||
    (title === "추천 이유" ? "CURATED FOR YOU" : null);

  return (
    <section
      className={cn(
        "border-t border-black/8 py-5",
        !startWithBorder && "first:border-t-0",
        hideTopBorder && "border-t-0",
      )}
    >
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[15px] font-black tracking-[-0.04em] text-black">{title}</h2>
        {eyebrow && (
          <p className="font-serif text-[9px] italic tracking-[0.14em] text-black/36">
            {eyebrow}
          </p>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-sm font-semibold leading-6 text-black/62">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivityProse({ items }: { items: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent/15 bg-gradient-to-br from-accent/[0.09] via-white to-white px-5 py-4 shadow-[0_10px_28px_rgba(126,179,199,0.08)]">
      <span
        aria-hidden
        className="mb-3 block h-1 w-8 rounded-full bg-accent/70"
      />
      <div className="space-y-2.5">
        {activityParagraphs(items).map((paragraph, index) => (
          <p
            key={`${index}-${paragraph}`}
            className="whitespace-pre-wrap break-keep text-[15px] font-normal leading-6 tracking-normal text-black/68 [text-wrap:pretty]"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
