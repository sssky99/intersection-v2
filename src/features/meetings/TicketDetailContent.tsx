"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { VibeGraph } from "@/components/vibe/VibeGraph";
import type { GatheringTicket } from "@/types/ticket";

export type TicketDetailSectionKey =
  | "summary"
  | "activities"
  | "vibe"
  | "proposer"
  | "notice";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const defaultSections: TicketDetailSectionKey[] = [
  "summary",
  "vibe",
  "proposer",
  "activities",
  "notice",
];

const commonNotices = [
  "상세 장소는 참여 확정 후 안내돼요.",
  "결제 확인 후 대기열 등록이 완료 돼요.",
];

function cleanList(items: string[] | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

export function TicketDetailContent({
  ticket,
  className,
  sections = defaultSections,
  startWithBorder = false,
}: {
  ticket: GatheringTicket;
  className?: string;
  sections?: TicketDetailSectionKey[];
  startWithBorder?: boolean;
}) {
  const activities = cleanList(ticket.detailActivities);
  const customNotices = cleanList(ticket.detailNotice?.split(/\r?\n/)).filter(
    (notice) => !commonNotices.includes(notice),
  );
  const noticeItems = [...commonNotices, ...customNotices];
  const visibleSections = new Set(sections);
  const detailSummary = ticket.detailSummary?.trim();
  const hasSummary = Boolean(visibleSections.has("summary") && detailSummary);
  const proposerIntroParagraphs = ticket.proposerProfile?.publicIntro
    ?.split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean) ?? [];
  const [proposerExpanded, setProposerExpanded] = useState(false);
  const firstSectionAfterSummary =
    hasSummary && visibleSections.has("vibe")
        ? "vibe"
        : hasSummary &&
            visibleSections.has("proposer") &&
            ticket.proposerProfile
          ? "proposer"
          : hasSummary && visibleSections.has("activities") && activities.length > 0
            ? "activities"
            : hasSummary && visibleSections.has("notice")
              ? "notice"
              : null;

  useEffect(() => {
    setProposerExpanded(false);
  }, [ticket.id, ticket.proposerProfile?.userId]);

  return (
    <div className={cn("mt-5", className)}>
      {hasSummary && <TypingSummary text={detailSummary!} />}

      {visibleSections.has("vibe") && (
        <VibeGraph
          title="자리 분위기"
          description="이 초대장의 분위기를 가볍게 참고해보세요."
          scores={ticket.vibeScores}
          visibleAxes={[
            "temperature",
            "texture",
            "tone",
            "rhythm",
            "alcohol",
            "romance",
          ]}
          showAxisHeader={false}
          axisLabelOverrides={{
            alcohol: {
              leftLabel: "술이 없는",
              rightLabel: "술이 있는",
            },
            romance: {
              leftLabel: "편한",
              rightLabel: "설레는",
            },
          }}
          className={cn(
            "rounded-none border-x-0 border-b-0 border-t border-black/8 bg-transparent px-0 py-5 shadow-none",
            firstSectionAfterSummary === "vibe" && "border-t-0",
          )}
        />
      )}

      {visibleSections.has("proposer") && ticket.proposerProfile && (
        <TicketDetailSection
          title="이 자리를 제안한 멤버"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "proposer"}
        >
          <div className="rounded-3xl border border-black/8 bg-black/[0.025] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                {ticket.proposerProfile.publicEmoji?.trim() || "💎"}
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-black">
                    {ticket.proposerProfile.displayName}
                  </p>
                  {ticket.proposerLabel && (
                    <p className="mt-1 text-[11px] font-bold text-accent">
                      {ticket.proposerLabel}
                    </p>
                  )}
                </div>
                {proposerIntroParagraphs.length > 1 && (
                  <button
                    type="button"
                    aria-expanded={proposerExpanded}
                    onClick={() => setProposerExpanded((expanded) => !expanded)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-[11px] font-black text-black/62 transition hover:border-black/20 hover:text-black"
                  >
                    {proposerExpanded ? "접기" : "자세히 보기"}
                    <ChevronDown
                      size={13}
                      aria-hidden
                      className={proposerExpanded ? "rotate-180 transition-transform" : "transition-transform"}
                    />
                  </button>
                )}
              </div>
            </div>
            {proposerIntroParagraphs.length > 0 && (
              <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-6 text-black/60">
                {proposerIntroParagraphs[0]}
              </p>
            )}
            {proposerIntroParagraphs.length > 1 && (
              <div
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,margin] duration-200 ease-out",
                  proposerExpanded ? "mt-4 grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <p className="min-h-0 whitespace-pre-line text-sm font-semibold leading-6 text-black/60">
                  {proposerIntroParagraphs.slice(1).join("\n\n")}
                </p>
              </div>
            )}
          </div>
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
        </TicketDetailSection>
      )}
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
