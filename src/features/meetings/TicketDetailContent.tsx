"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import { MeetingAtmospherePanel } from "@/features/meetings/MeetingAtmospherePanel";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type GatheringTicket,
} from "@/types/ticket";

export type TicketDetailSectionKey =
  | "summary"
  | "activities"
  | "vibe"
  | "place"
  | "notice";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const defaultSections: TicketDetailSectionKey[] = [
  "summary",
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

const commonNotices = [
  "상세 장소는 참여 확정 후 안내돼요.",
  "결제 확인 후 대기열 등록이 완료돼요.",
];

function cleanList(items: string[] | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

export function TicketDetailContent({
  ticket,
  className,
  sections = defaultSections,
  startWithBorder = false,
  afterNotice,
  footer,
}: {
  ticket: GatheringTicket;
  className?: string;
  sections?: TicketDetailSectionKey[];
  startWithBorder?: boolean;
  afterNotice?: ReactNode;
  footer?: ReactNode;
}) {
  const activities = cleanList(ticket.detailActivities);
  const defaultNotices = [...participantNotice(ticket), ...commonNotices];
  const customNotices = cleanList(ticket.detailNotice?.split(/\r?\n/)).filter(
    (notice) => !defaultNotices.includes(notice),
  );
  const noticeItems = [...defaultNotices, ...customNotices];
  const visibleSections = new Set(sections);
  const detailSummary = ticket.detailSummary?.trim();
  const hasSummary = Boolean(visibleSections.has("summary") && detailSummary);
  const hasPlace = Boolean(
    ticket.place?.name?.trim() || ticket.place?.address?.trim(),
  );
  const firstSectionAfterSummary =
    hasSummary && visibleSections.has("vibe")
      ? "vibe"
      : hasSummary && visibleSections.has("place") && hasPlace
        ? "place"
        : hasSummary &&
            visibleSections.has("activities") &&
            activities.length > 0
          ? "activities"
          : hasSummary && visibleSections.has("notice")
            ? "notice"
            : null;

  return (
    <div className={cn("mt-5", className)}>
      {hasSummary && <TypingSummary text={detailSummary!} />}

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
          <BulletList items={activities} />
        </TicketDetailSection>
      )}

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
  children,
  startWithBorder = false,
  hideTopBorder = false,
}: {
  title: string;
  children: ReactNode;
  startWithBorder?: boolean;
  hideTopBorder?: boolean;
}) {
  return (
    <section
      className={cn(
        "border-t border-black/8 py-5",
        !startWithBorder && "first:border-t-0",
        hideTopBorder && "border-t-0",
      )}
    >
      <h2 className="text-[15px] font-black text-black">{title}</h2>
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
