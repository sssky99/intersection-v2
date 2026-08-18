"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Clock3,
  Copy,
  Info,
  LockKeyhole,
  MapPin,
  Navigation,
  UserRound,
  X,
} from "lucide-react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import {
  courseStepOpenOffsetMinutes,
  courseStepPlaceRevealOffsetMinutes,
} from "@/lib/ticketCourse";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type GatheringTicket,
  type TicketArrivalStatus,
} from "@/types/ticket";
import type { NaverPlace } from "@/types/place";

export type TicketDetailSectionKey =
  | "summary"
  | "recommendation"
  | "course"
  | "place";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy-failed");
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
  "place",
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

const dinnerBoardgameMatchPhotoUrls = [
  "/images/meeting-matches/dinner-boardgame/match-1.jpg",
  "/images/meeting-matches/dinner-boardgame/match-2.jpg",
  "/images/meeting-matches/dinner-boardgame/match-3.jpg",
  "/images/meeting-matches/dinner-boardgame/match-4.jpg",
  "/images/meeting-matches/dinner-boardgame/match-5.jpg",
] as const;

const dinnerBoardgameOtherMemberPhotoUrls = [
  "/images/meeting-matches/dinner-boardgame/other-members/member-1.jpg",
  "/images/meeting-matches/dinner-boardgame/other-members/member-2.jpg",
  "/images/meeting-matches/dinner-boardgame/other-members/member-3.jpg",
  "/images/meeting-matches/dinner-boardgame/other-members/member-4.jpg",
  "/images/meeting-matches/dinner-boardgame/other-members/member-5.jpg",
  "/images/meeting-matches/dinner-boardgame/other-members/member-6.jpg",
] as const;

const dinnerBeerMatchPhotoUrls = [
  "/images/meeting-matches/dinner-beer/match-1.jpg",
  "/images/meeting-matches/dinner-beer/match-2.jpg",
  "/images/meeting-matches/dinner-beer/match-3.jpg",
  "/images/meeting-matches/dinner-beer/match-4.jpg",
  "/images/meeting-matches/dinner-beer/match-5.jpg",
] as const;

const dinnerBeerOtherMemberPhotoUrls = [
  "/images/meeting-matches/dinner-beer/other-members/member-1.jpg",
  "/images/meeting-matches/dinner-beer/other-members/member-2.jpg",
  "/images/meeting-matches/dinner-beer/other-members/member-3.jpg",
  "/images/meeting-matches/dinner-beer/other-members/member-4.jpg",
  "/images/meeting-matches/dinner-beer/other-members/member-5.jpg",
  "/images/meeting-matches/dinner-beer/other-members/member-6.jpg",
] as const;

const dinnerCocktailMatchPhotoUrls = [
  "/images/meeting-matches/dinner-cocktail/match-1.jpg",
  "/images/meeting-matches/dinner-cocktail/match-2.jpg",
  "/images/meeting-matches/dinner-cocktail/match-3.jpg",
  "/images/meeting-matches/dinner-cocktail/match-4.jpg",
  "/images/meeting-matches/dinner-cocktail/match-5.jpg",
] as const;

const dinnerCocktailOtherMemberPhotoUrls = [
  "/images/meeting-matches/dinner-cocktail/other-members/member-1.jpg",
  "/images/meeting-matches/dinner-cocktail/other-members/member-2.jpg",
  "/images/meeting-matches/dinner-cocktail/other-members/member-3.jpg",
  "/images/meeting-matches/dinner-cocktail/other-members/member-4.jpg",
  "/images/meeting-matches/dinner-cocktail/other-members/member-5.jpg",
  "/images/meeting-matches/dinner-cocktail/other-members/member-6.jpg",
] as const;

const providedMemberPhotoPool = [
  ...dinnerBoardgameMatchPhotoUrls,
  ...dinnerBoardgameOtherMemberPhotoUrls,
  ...dinnerBeerMatchPhotoUrls,
  ...dinnerBeerOtherMemberPhotoUrls,
  ...dinnerCocktailMatchPhotoUrls,
  ...dinnerCocktailOtherMemberPhotoUrls,
] as const;

function stablePhotoOrderKey(seed: string, photoUrl: string) {
  const value = `${seed}:${photoUrl}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomMemberPhotoUrls(ticket: GatheringTicket) {
  return [...providedMemberPhotoPool]
    .sort(
      (left, right) =>
        stablePhotoOrderKey(ticket.id, left) -
        stablePhotoOrderKey(ticket.id, right),
    )
    .slice(0, 11);
}

export function TicketDetailContent({
  ticket,
  participantPhotoUrl,
  participantArrivalStatus,
  previewMatchPhotoUrls = [],
  previewOtherMemberPhotoUrls = [],
  matchMemberCount,
  className,
  sections = defaultSections,
  startWithBorder = false,
  afterActivities,
  afterNotice,
  footer,
}: {
  ticket: GatheringTicket;
  participantPhotoUrl?: string | null;
  participantArrivalStatus?: TicketArrivalStatus | null;
  previewMatchPhotoUrls?: string[];
  previewOtherMemberPhotoUrls?: string[];
  matchMemberCount?: number;
  className?: string;
  sections?: TicketDetailSectionKey[];
  startWithBorder?: boolean;
  afterActivities?: ReactNode;
  afterNotice?: ReactNode;
  footer?: ReactNode;
}) {
  const randomPreviewPhotoUrls = randomMemberPhotoUrls(ticket);
  const resolvedMatchPhotoUrls = matchMemberCount === undefined
    ? randomPreviewPhotoUrls.slice(0, 5)
    : previewMatchPhotoUrls;
  const resolvedOtherMemberPhotoUrls = matchMemberCount === undefined
    ? randomPreviewPhotoUrls.slice(5, 11)
    : previewOtherMemberPhotoUrls;
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
    showSummary && visibleSections.has("place") && hasPlace ? "place" : null;

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
        >
          <TicketCoursePanel
            ticket={ticket}
            steps={courseSteps}
            participantPhotoUrl={participantPhotoUrl}
            participantArrivalStatus={participantArrivalStatus}
            previewMatchPhotoUrls={resolvedMatchPhotoUrls}
            previewOtherMemberPhotoUrls={resolvedOtherMemberPhotoUrls}
            matchMemberCount={matchMemberCount}
          />
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

      {afterActivities}

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

const kstOffsetMs = 9 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const joinCountdownWindowMs = 72 * hourMs;

function ticketStartAt(ticket: GatheringTicket) {
  const rawTime = ticket.time.trim();
  const twentyFourHourMatch = rawTime.match(/^(\d{1,2}):(\d{2})/);
  const koreanTimeMatch = rawTime.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})/);
  let hours: number;
  let minutes: number;

  if (twentyFourHourMatch) {
    hours = Number(twentyFourHourMatch[1]);
    minutes = Number(twentyFourHourMatch[2]);
  } else if (koreanTimeMatch) {
    const period = koreanTimeMatch[1];
    const rawHours = Number(koreanTimeMatch[2]) % 12;
    hours = rawHours + (period === "오후" ? 12 : 0);
    minutes = Number(koreanTimeMatch[3]);
  } else {
    return null;
  }

  if (hours > 23 || minutes > 59) return null;
  const startAt = new Date(
    `${ticket.date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+09:00`,
  );
  return Number.isFinite(startAt.getTime()) ? startAt : null;
}

function formatKstDateLabel(value: Date) {
  const kstDate = new Date(value.getTime() + kstOffsetMs);
  const dateValue = [
    kstDate.getUTCFullYear(),
    String(kstDate.getUTCMonth() + 1).padStart(2, "0"),
    String(kstDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return formatTicketDateLabel(dateValue);
}

function formatKstTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

export function TicketCoursePanel({
  ticket,
  steps,
  participantPhotoUrl,
  participantArrivalStatus,
  previewMatchPhotoUrls,
  previewOtherMemberPhotoUrls,
  matchMemberCount,
  variant = "default",
  showFeedbackTime = true,
  showJoinCountdown = true,
}: {
  ticket: GatheringTicket;
  steps: NonNullable<GatheringTicket["courseSteps"]>;
  participantPhotoUrl?: string | null;
  participantArrivalStatus?: TicketArrivalStatus | null;
  previewMatchPhotoUrls: string[];
  previewOtherMemberPhotoUrls: string[];
  matchMemberCount?: number;
  variant?: "default" | "blind-date";
  showFeedbackTime?: boolean;
  showJoinCountdown?: boolean;
}) {
  const [mapStepIndex, setMapStepIndex] = useState<number | null>(null);
  const [matchSheetOpen, setMatchSheetOpen] = useState(false);
  const [blindDateMapPlace, setBlindDateMapPlace] =
    useState<NaverPlace | null>(null);
  const blindDatePlaceName =
    variant === "blind-date" ? steps[0]?.place?.name?.trim() : null;

  useEffect(() => {
    if (!blindDatePlaceName) {
      setBlindDateMapPlace(null);
      return;
    }

    const controller = new AbortController();
    const normalizedTarget = blindDatePlaceName.replace(/[^\p{L}\p{N}]/gu, "");

    fetch(
      `/api/places/search?query=${encodeURIComponent(blindDatePlaceName)}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("blind-date-map-search-failed");
        return (await response.json()) as { places?: NaverPlace[] };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const places = data.places ?? [];
        const exactPlace = places.find(
          (place) =>
            place.name.replace(/[^\p{L}\p{N}]/gu, "") === normalizedTarget,
        );
        setBlindDateMapPlace(exactPlace ?? places[0] ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBlindDateMapPlace(null);
      });

    return () => controller.abort();
  }, [blindDatePlaceName]);

  const selectedStep = mapStepIndex === null ? null : steps[mapStepIndex];
  const selectedStepAddress =
    selectedStep?.address ?? selectedStep?.place?.address ?? null;
  const selectedStoredMapPlace =
    selectedStep?.place?.name &&
    typeof selectedStep.place.mapx === "number" &&
    typeof selectedStep.place.mapy === "number"
      ? {
          name: selectedStep.place.name,
          mapx: selectedStep.place.mapx,
          mapy: selectedStep.place.mapy,
          address: selectedStepAddress,
        }
      : null;
  const selectedBlindDateMapPlace =
    variant === "blind-date" &&
    selectedStep?.place?.name === blindDatePlaceName
      ? blindDateMapPlace
      : null;
  const selectedAddressMapPlace =
    variant === "blind-date" &&
    selectedStep?.place?.name &&
    selectedStepAddress
      ? {
          name: selectedStep.place.name,
          address: selectedStepAddress,
        }
      : null;
  const selectedReleasedMapPlace =
    selectedStoredMapPlace ??
    selectedBlindDateMapPlace ??
    selectedAddressMapPlace;
  const selectedMapPlace =
    selectedReleasedMapPlace ?? journeyStationMapPlace(ticket.area);

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

                <p className="font-ticket-display mt-1.5 break-keep text-[18px] font-bold leading-6 tracking-[-0.035em] text-black">
                  {step.title || step.activityType || "활동"}
                </p>
              </div>
            </div>

            <JourneyPeoplePanel
              stepIndex={index}
              participantPhotoUrl={participantPhotoUrl}
              participantArrivalStatus={participantArrivalStatus}
              previewMatchPhotoUrls={previewMatchPhotoUrls}
              previewOtherMemberPhotoUrls={previewOtherMemberPhotoUrls}
              matchMemberCount={matchMemberCount}
              variant={variant}
              onOpenMatches={() => setMatchSheetOpen(true)}
            />
          </li>
        );
      })}
        </ol>

        {showFeedbackTime && ticketStartAt(ticket) && (
          <>
            <FeedbackTimeCard ticket={ticket} />
            <BlindDateFollowupCard
              ticket={ticket}
              participantPhotoUrl={participantPhotoUrl}
            />
          </>
        )}
      </div>

      {showJoinCountdown && <JoinDeadlineCountdown ticket={ticket} />}

      <AnimatePresence>
        {variant === "default" && matchSheetOpen && (
          <MatchMembersSheet
            ticket={ticket}
            steps={steps}
            participantPhotoUrl={participantPhotoUrl}
            matchPhotoUrls={previewMatchPhotoUrls.slice(0, 5)}
            otherMemberPhotoUrls={previewOtherMemberPhotoUrls.slice(0, 6)}
            matchMemberCount={matchMemberCount}
            onClose={() => setMatchSheetOpen(false)}
          />
        )}
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
            released={Boolean(selectedReleasedMapPlace)}
            address={selectedStepAddress}
            revealCopy={
              (mapStepIndex ?? 0) === 0
                ? "정확한 장소는 모임 시작 24시간 전에 공개돼요."
                : `${(mapStepIndex ?? 0) + 1}차 장소는 모임 당일 ${courseStepTimeLabel(
                    ticket.time,
                    courseStepPlaceRevealOffsetMinutes(
                      selectedStep.openOffsetMinutes,
                      mapStepIndex ?? 0,
                    ),
                  )}에 공개돼요.`
            }
            onClose={() => setMapStepIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedbackTimeCard({ ticket }: { ticket: GatheringTicket }) {
  const startAt = ticketStartAt(ticket);

  if (!startAt) return null;
  const feedbackAt = new Date(startAt.getTime() + 3 * hourMs);

  return (
    <div className="relative mt-8 pt-1">
      <span
        aria-hidden
        className="absolute -left-[20px] top-[10px] z-10 h-[11px] w-[11px] rounded-full border-[3px] border-[#f8f4eb] bg-[#8f8778] shadow-[0_0_0_1px_rgba(23,23,19,0.14)]"
      />
      <p className="mb-3 text-[11px] font-black tracking-[0.08em] text-black/40">
        {formatKstDateLabel(feedbackAt)}
      </p>
      <div className="relative flex items-center justify-between gap-4 rounded-[12px] border border-black/[0.07] bg-[#f1ebe0] px-4 py-4">
        <span className="text-[12px] font-bold text-black/42">
          {formatKstTimeLabel(feedbackAt)}
        </span>
        <div className="flex items-center gap-1.5">
          <JourneyInfoButton
            label="피드백 시간 안내"
            paragraphs={[
              "이번 만남에서 더 알아가보고 싶은 사람을 고를 수 있어요.",
              "친구가 되고 싶거나, 단 둘이 만나고 싶은 사람을 선택하세요.",
              "서로 선택한 경우 1:1 블라인드 데이트가 열려요.",
            ]}
          />
          <span className="font-ticket-display text-[17px] font-bold tracking-[-0.03em] text-black">
            피드백 시간
          </span>
        </div>
      </div>
    </div>
  );
}

function BlindDateFollowupCard({
  ticket,
  participantPhotoUrl,
}: {
  ticket: GatheringTicket;
  participantPhotoUrl?: string | null;
}) {
  const startAt = ticketStartAt(ticket);
  if (!startAt) return null;

  const feedbackAt = new Date(startAt.getTime() + 3 * hourMs);
  const blindDateWindowStart = new Date(feedbackAt.getTime() + dayMs);
  const blindDateWindowEnd = new Date(
    blindDateWindowStart.getTime() + 13 * dayMs,
  );
  const blindDateDateFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  });
  const blindDateWindowLabel = `${blindDateDateFormatter.format(blindDateWindowStart)}~${blindDateDateFormatter.format(blindDateWindowEnd)}`;

  return (
    <div className="relative mt-8 pt-1">
      <span
        aria-hidden
        className="absolute -left-[20px] top-[10px] z-10 h-[11px] w-[11px] rounded-full border-[3px] border-[#f8f4eb] bg-[#8f8778] shadow-[0_0_0_1px_rgba(23,23,19,0.14)]"
      />
      <p className="mb-3 text-[11px] font-black tracking-[0.08em] text-black/40">
        {blindDateWindowLabel}
      </p>
      <div className="overflow-hidden rounded-[12px] border border-black/[0.07] bg-[#f1ebe0]">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <span className="text-[12px] font-bold text-black/42">
            서로 선택한 경우
          </span>
          <div className="flex items-center gap-1.5">
            <JourneyInfoButton
              label="1:1 블라인드 데이트 안내"
              paragraphs={[
                "누가 올지는 공개되지 않아요. 현장에서 직접 확인해보세요.",
                "한 가지 확실한 건 나도 상대방을 선택했고, 상대방도 나를 선택했어요.",
                "여러 명과 서로 선택한 경우, 여러 번의 블라인드 데이트를 할 수 있어요.",
              ]}
            />
            <span className="font-ticket-display text-[17px] font-bold tracking-[-0.03em] text-black">
              1:1 블라인드 데이트
            </span>
          </div>
        </div>

        <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
          <div className="flex min-h-12 items-center gap-2.5 px-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#eee8dc] text-black/48">
              {participantPhotoUrl ? (
                <span
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${participantPhotoUrl})` }}
                  aria-hidden
                />
              ) : (
                <UserRound size={13} strokeWidth={2} aria-hidden />
              )}
            </span>
            <span className="text-[11px] font-black text-black/68">나</span>
          </div>
          <div className="flex min-h-12 items-center gap-2.5 border-t border-black/[0.06] px-3.5">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#ded8cc] text-[14px] font-black text-black/44"
            >
              ?
            </span>
            <span className="text-[11px] font-black text-black/68">
              나를 선택한 상대방
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneyInfoButton({
  label,
  paragraphs,
}: {
  label: string;
  paragraphs: string[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/20 text-black/48 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
      >
        <Info size={12} strokeWidth={2} aria-hidden />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                role="presentation"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-6 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full max-w-[340px] rounded-[24px] border border-black/10 bg-[#f8f4eb] px-6 pb-5 pt-7 text-left shadow-[0_24px_70px_rgba(0,0,0,0.24)]"
                >
                  <div className="space-y-3">
                    {paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="break-keep text-[16px] font-bold leading-7 tracking-[-0.025em] text-[#24211d]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-6 h-12 w-full rounded-full bg-[#171713] text-center text-[14px] font-black text-white transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2"
                  >
                    확인
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function RouletteDigit({ digit }: { digit: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <span className="relative flex h-12 min-w-9 overflow-hidden rounded-[11px] border border-black/[0.08] bg-[#f1ebe0] shadow-[0_5px_16px_rgba(54,46,33,0.05)]">
      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-[#e7dfd1]/90 to-transparent" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-[#e7dfd1]/90 to-transparent" />
      <span className="pointer-events-none absolute inset-x-1 top-1/2 z-10 border-t border-black/[0.045]" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={
            shouldReduceMotion
              ? false
              : { y: -38, opacity: 0.3, filter: "blur(2px)" }
          }
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={
            shouldReduceMotion
              ? undefined
              : { y: 38, opacity: 0.25, filter: "blur(2px)" }
          }
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="font-ticket-latin absolute inset-0 flex items-center justify-center px-2 text-[27px] font-medium leading-none tabular-nums text-black/82"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CountdownPair({ value }: { value: number | null }) {
  const label = value === null ? "--" : String(value).padStart(2, "0");

  return (
    <span className="inline-flex gap-1">
      {label.split("").map((digit, index) => (
        <RouletteDigit key={index} digit={digit} />
      ))}
    </span>
  );
}

export function RouletteDeadlineCountdown({
  deadlineAt,
  activeLabel,
  closedLabel,
  visibleWithinMs,
  deadlineSuffix = "마감",
}: {
  deadlineAt: Date;
  activeLabel: string;
  closedLabel: string;
  visibleWithinMs?: number;
  deadlineSuffix?: string;
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (nowMs === null) return null;
  const rawRemainingMs = deadlineAt.getTime() - nowMs;
  if (visibleWithinMs !== undefined && rawRemainingMs > visibleWithinMs) return null;

  const remainingMs = Math.max(0, rawRemainingMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const isClosed = remainingMs <= 0;

  return (
    <div className="mt-9 border-t border-black/[0.08] pt-7 text-center">
      <p className="text-[12px] font-bold tracking-[-0.01em] text-black/42">
        {isClosed ? closedLabel : activeLabel}
      </p>
      <div
        className="mt-4 flex items-center justify-center gap-2"
        aria-label={
          isClosed
            ? closedLabel
            : `${hours}시간 ${minutes}분 ${seconds}초 남음`
        }
      >
        <span aria-hidden className="contents">
          <CountdownPair value={hours} />
          <span className="font-ticket-latin text-[24px] text-black/38">:</span>
          <CountdownPair value={minutes} />
          <span className="font-ticket-latin text-[24px] text-black/38">:</span>
          <CountdownPair value={seconds} />
        </span>
      </div>
      <p className="mt-3 text-[10px] font-semibold text-black/32">
        {formatKstDateLabel(deadlineAt)} {formatKstTimeLabel(deadlineAt)} {deadlineSuffix}
      </p>
    </div>
  );
}

function JoinDeadlineCountdown({ ticket }: { ticket: GatheringTicket }) {
  const startAt = ticketStartAt(ticket);
  const deadlineAt = startAt ? new Date(startAt.getTime() - dayMs) : null;
  if (!deadlineAt) return null;

  return (
    <RouletteDeadlineCountdown
      deadlineAt={deadlineAt}
      activeLabel="참여 마감까지 남은 시간"
      closedLabel="참여 신청이 마감됐어요"
      visibleWithinMs={joinCountdownWindowMs}
    />
  );
}

function UnreleasedMapSheet({
  title,
  timeLabel,
  place,
  released,
  address,
  revealCopy,
  onClose,
}: {
  title: string;
  timeLabel: string;
  place: {
    name: string;
    mapx?: number | null;
    mapy?: number | null;
    address?: string | null;
  } | null;
  released: boolean;
  address: string | null;
  revealCopy: string;
  onClose: () => void;
}) {
  const [addressCopied, setAddressCopied] = useState(false);

  if (typeof document === "undefined") return null;

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      await copyTextToClipboard(address);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch {
      setAddressCopied(false);
    }
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[160] isolate flex min-h-0 justify-center overflow-hidden bg-black/25"
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
        className="relative flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f4ed] shadow-[0_-24px_80px_rgba(0,0,0,0.22)]"
      >
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-black/[0.08] bg-[#f7f4ed]/95 px-5 pb-4 pt-[calc(14px+env(safe-area-inset-top))] backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            aria-label="지도 닫기"
            className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/58 shadow-sm"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-black/40">{timeLabel}</p>
            <h2 className="mt-1 truncate text-[18px] font-black tracking-[-0.03em] text-black">
              {title}
            </h2>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#e7e5df]">
          {place && (
            <NaverMapPreview
              place={place}
              heightClassName="h-full"
              className={cn(
                "pointer-events-none absolute inset-[-8px] scale-[1.03] rounded-none border-0",
                released
                  ? "saturate-[0.96]"
                  : "saturate-[0.88] blur-[1.5px]",
              )}
            />
          )}

          {released ? (
            <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(18px+env(safe-area-inset-bottom))]">
              <div className="rounded-[24px] border border-white/75 bg-[#f7f4ed]/94 px-5 py-4 shadow-[0_22px_60px_rgba(36,45,38,0.2)] backdrop-blur-xl">
                <p className="text-[16px] font-black tracking-[-0.03em] text-black">
                  {place?.name}
                </p>
                {address && (
                  <p className="mt-1.5 break-keep text-[12px] font-semibold leading-5 text-black/55">
                    {address}
                  </p>
                )}
                {address && (
                  <button
                    type="button"
                    onClick={() => void handleCopyAddress()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-[11px] font-black text-white"
                  >
                    {addressCopied ? (
                      <Check size={13} strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Copy size={13} strokeWidth={2.5} aria-hidden />
                    )}
                    {addressCopied ? "주소를 복사했어요" : "주소 복사하기"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <div className="flex max-w-[280px] flex-col items-center rounded-[28px] border border-white/70 bg-[#f7f4ed]/92 px-7 py-7 text-center shadow-[0_22px_60px_rgba(36,45,38,0.18)] backdrop-blur-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg">
                  <LockKeyhole size={20} strokeWidth={2} aria-hidden />
                </span>
                <p className="mt-4 break-keep text-[14px] font-black leading-6 tracking-[-0.025em] text-black">
                  {revealCopy}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

function participantArrivalStatusLabel(
  status: TicketArrivalStatus | null | undefined,
) {
  if (status === "on_time") return "정상 도착 예정";
  if (status === "no_show") return "불참";
  if (status === "late_10") return "10분 정도 늦어요";
  if (status === "late_20") return "20분 정도 늦어요";
  if (status === "late_30_plus") return "30분 이상 늦어요";
  return "응답 대기";
}

function JourneyPeoplePanel({
  stepIndex,
  participantPhotoUrl,
  participantArrivalStatus,
  previewMatchPhotoUrls,
  previewOtherMemberPhotoUrls,
  matchMemberCount,
  variant,
  onOpenMatches,
}: {
  stepIndex: number;
  participantPhotoUrl?: string | null;
  participantArrivalStatus?: TicketArrivalStatus | null;
  previewMatchPhotoUrls: string[];
  previewOtherMemberPhotoUrls: string[];
  matchMemberCount?: number;
  variant: "default" | "blind-date";
  onOpenMatches: () => void;
}) {
  if (stepIndex === 0) {
    const matchCount = matchMemberCount ?? 5;
    const matchPhotos = previewMatchPhotoUrls.slice(0, matchCount);
    const matchRowContent = (
      <>
        <JourneyAvatarStack tone="warm" photoUrls={matchPhotos} />
        <p className="text-[10px] font-bold text-black/44">
          {variant === "blind-date" ? (
            <strong className="font-black text-black/72">블라인드 데이트 상대</strong>
          ) : (
            <>
              나와 <strong className="font-black text-black/72">잘 맞는 {matchCount}명</strong>
            </>
          )}
        </p>
      </>
    );

    return (
      <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
        <div className="flex min-h-12 items-center justify-between gap-3 px-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#eee8dc] text-black/48">
              {participantPhotoUrl ? (
                <span
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${participantPhotoUrl})` }}
                  aria-hidden
                />
              ) : (
                <UserRound size={13} strokeWidth={2} aria-hidden />
              )}
            </span>
            <span className="text-[11px] font-black text-black/68">나</span>
          </div>
          {variant !== "blind-date" && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-black/38">
              {participantArrivalStatusLabel(participantArrivalStatus)}
              <Clock3 size={12} strokeWidth={1.9} aria-hidden />
            </span>
          )}
        </div>
        {variant === "blind-date" ? (
          <div className="flex min-h-12 w-full items-center gap-2.5 border-t border-black/[0.06] px-3.5 text-left">
            {matchRowContent}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenMatches}
            className="flex min-h-12 w-full items-center gap-2.5 border-t border-black/[0.06] px-3.5 text-left transition hover:bg-black/[0.025] active:bg-black/[0.045]"
            aria-label={`나와 잘 맞는 ${matchCount}명 보기`}
          >
            {matchRowContent}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
      <div className="flex min-h-12 items-center gap-2.5 px-3.5">
        <JourneyAvatarStack
          tone="warm"
          photoUrls={[
            ...previewMatchPhotoUrls.slice(0, matchMemberCount ?? 5),
            ...(participantPhotoUrl ? [participantPhotoUrl] : []),
          ]}
          clearLastPhoto={Boolean(participantPhotoUrl)}
        />
        <p className="text-[10px] font-bold text-black/44">
          <strong className="font-black text-black/72">저녁을 함께한 멤버</strong>
        </p>
      </div>
      <div className="flex min-h-12 items-center gap-2.5 border-t border-black/[0.06] px-3.5">
        <JourneyAvatarStack
          tone="cool"
          photoUrls={previewOtherMemberPhotoUrls.slice(0, 6)}
        />
        <p className="text-[10px] font-bold text-black/44">
          다른 <strong className="font-black text-black/72">교집합 멤버들</strong>도 함께해요
        </p>
      </div>
    </div>
  );
}

function MatchMembersSheet({
  ticket,
  steps,
  participantPhotoUrl,
  matchPhotoUrls,
  otherMemberPhotoUrls,
  matchMemberCount,
  onClose,
}: {
  ticket: GatheringTicket;
  steps: NonNullable<GatheringTicket["courseSteps"]>;
  participantPhotoUrl?: string | null;
  matchPhotoUrls: string[];
  otherMemberPhotoUrls: string[];
  matchMemberCount?: number;
  onClose: () => void;
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const mapPlace = journeyStationMapPlace(ticket.area);
  const activeStep = steps[activeStepIndex];
  const activeStepPlaceRevealTime = courseStepTimeLabel(
    ticket.time,
    courseStepPlaceRevealOffsetMinutes(
      activeStep?.openOffsetMinutes,
      activeStepIndex,
    ),
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (noticeOpen) {
        setNoticeOpen(false);
        return;
      }
      onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [noticeOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[140] isolate flex justify-center bg-black/28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="나와 잘 맞는 멤버"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 34 }}
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f4ed] text-black shadow-[0_-28px_90px_rgba(0,0,0,0.28)]"
      >
        <header className="relative h-[calc(58px+env(safe-area-inset-top))] shrink-0 px-5 pt-[calc(12px+env(safe-area-inset-top))]">
          <span
            className="mx-auto block h-1.5 w-16 rounded-full bg-black/15"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="매칭 멤버 닫기"
            className="absolute right-4 top-[calc(8px+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center text-black/58 transition hover:text-black"
          >
            <X size={20} strokeWidth={1.8} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(32px+env(safe-area-inset-bottom))] scrollbar-none">
          <div className="mt-4 flex overflow-x-auto rounded-full border border-black/10 bg-black/[0.035] p-1 scrollbar-none">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepIndex(index)}
                className={cn(
                  "min-w-max flex-1 rounded-full px-5 py-2.5 text-[12px] font-black transition",
                  activeStepIndex === index
                    ? "bg-black text-white shadow-sm"
                    : "text-black/38",
                )}
              >
                {step.title || step.activityType || `코스 ${index + 1}`}
              </button>
            ))}
          </div>

          {activeStepIndex === 0 ? (
            <section className="mt-6 rounded-[26px] border border-black/10 bg-white/45 px-4 py-5 shadow-[0_18px_50px_rgba(39,34,24,0.08)]">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[17px] font-black tracking-[-0.035em]">내 테이블</h3>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6">
                <div className="flex min-w-0 flex-col items-center">
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#eee8dc] text-black/45 shadow-[0_9px_22px_rgba(0,0,0,0.1)]">
                    {participantPhotoUrl ? (
                      <span
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${participantPhotoUrl})` }}
                        aria-hidden
                      />
                    ) : (
                      <UserRound size={20} strokeWidth={1.8} aria-hidden />
                    )}
                  </span>
                  <span className="mt-2 text-[12px] font-black text-black/[0.62]">나</span>
                </div>
                {matchPhotoUrls.slice(0, matchMemberCount ?? 5).map((photoUrl, index) => (
                  <button
                    key={photoUrl}
                    type="button"
                    onClick={() => setNoticeOpen(true)}
                    aria-label={`매칭 멤버 ${index + 1} 안내 보기`}
                    className="group flex min-w-0 flex-col items-center"
                  >
                    <span className="relative h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-black/[0.04] shadow-[0_9px_22px_rgba(0,0,0,0.1)]">
                      <span
                        className="absolute -inset-2 scale-125 bg-cover bg-center blur-[8px]"
                        style={{ backgroundImage: `url(${photoUrl})` }}
                        aria-hidden
                      />
                      <span className="absolute inset-0 bg-black/[0.12]" />
                    </span>
                    <span className="mt-2 text-[12px] font-bold text-black/48">
                      매칭 {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-6 overflow-hidden rounded-[26px] border border-black/10 bg-white/45 shadow-[0_18px_50px_rgba(39,34,24,0.08)]">
              <div
                className="relative flex h-[238px] items-center justify-center overflow-hidden bg-[#d8d1c3] px-5"
              >
                {mapPlace && (
                  <NaverMapPreview
                    place={mapPlace}
                    heightClassName="h-full"
                    className="pointer-events-none absolute inset-0 rounded-none border-0 saturate-[0.78]"
                  />
                )}
                <span className="absolute inset-0 bg-[#d8d1c3]/42 backdrop-blur-[1px]" />
                <div className="relative flex items-center gap-4 rounded-full border border-black/10 bg-[#f7f4ed]/88 px-6 py-4 shadow-[0_14px_38px_rgba(39,34,24,0.14)] backdrop-blur-md">
                  <JourneyAvatarStack
                    tone="cool"
                    photoUrls={otherMemberPhotoUrls.slice(0, 6)}
                  />
                  <p className="whitespace-nowrap text-[15px] font-black tracking-[-0.025em] text-black/72">
                    여러 명의 멤버가 함께해요.
                  </p>
                </div>
              </div>

              <div className="border-t border-black/[0.07] px-6 py-6 text-center">
                <p className="break-keep text-[14px] font-semibold leading-7 tracking-[-0.025em] text-black/48">
                  내 테이블 멤버들과 함께 더 많은 교집합 멤버들을 만나요. {activeStepIndex + 1}차 장소는 모임 당일 {activeStepPlaceRevealTime}에 공개돼요.
                </p>
              </div>
            </section>
          )}
        </div>

        <AnimatePresence>
          {noticeOpen && (
            <motion.div
              className="absolute inset-0 z-20 flex items-center justify-center bg-[#24211d]/42 px-8 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="presentation"
            >
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-label="매칭 멤버 공개 안내"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className="w-full overflow-hidden rounded-[28px] border border-[#d0cbbc] bg-[#faf8f3] text-center text-[#24211d] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
              >
                <p className="break-keep px-7 py-7 text-[16px] font-bold leading-7 tracking-[-0.035em] text-black">
                  매칭 멤버는 현장에서 직접 만나보세요.
                </p>
                <button
                  type="button"
                  onClick={() => setNoticeOpen(false)}
                  className="h-14 w-full border-t border-black/10 text-[14px] font-bold text-black transition hover:bg-black/[0.035]"
                >
                  확인
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

function JourneyAvatarStack({
  tone,
  photoUrls = [],
  clearLastPhoto = false,
}: {
  tone: "warm" | "cool";
  photoUrls?: string[];
  clearLastPhoto?: boolean;
}) {
  const colors =
    tone === "warm"
      ? ["bg-[#d8b49b]", "bg-[#b9c7b0]", "bg-[#a9bbc9]"]
      : ["bg-[#d7aab7]", "bg-[#b5c8d7]", "bg-[#c6b6d4]"];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center",
        photoUrls.length === 0 && "w-[52px]",
      )}
      style={
        photoUrls.length > 0
          ? { width: `${28 + (photoUrls.length - 1) * 16}px` }
          : undefined
      }
      aria-hidden
    >
      {(photoUrls.length > 0 ? photoUrls : colors).map((value, index) => (
        <span
          key={value}
          className={cn(
            "relative h-7 w-7 overflow-hidden rounded-full border-2 border-[#f8f4eb] shadow-sm",
            photoUrls.length === 0 && value,
            index > 0 && "-ml-3",
          )}
        >
          {photoUrls.length > 0 && (
            <>
              <span
                className={cn(
                  "absolute bg-cover bg-center",
                  clearLastPhoto && index === photoUrls.length - 1
                    ? "inset-0"
                    : "-inset-1 scale-125 blur-[1px]",
                )}
                style={{ backgroundImage: `url(${value})` }}
              />
              {(!clearLastPhoto || index < photoUrls.length - 1) && (
                <span className="absolute inset-0 bg-black/[0.12]" />
              )}
            </>
          )}
        </span>
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
        <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">{title}</h2>
        {eyebrow && (
          <p className="font-ticket-latin text-[10px] italic tracking-[0.14em] text-black/36">
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
