"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { VibeGraph } from "@/components/vibe/VibeGraph";
import type { GatheringTicket } from "@/types/ticket";

export type TicketDetailSectionKey =
  | "summary"
  | "activities"
  | "vibe"
  | "goodFor"
  | "flow"
  | "notice";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const defaultSections: TicketDetailSectionKey[] = [
  "summary",
  "activities",
  "vibe",
  "goodFor",
  "flow",
  "notice",
];

const flowSteps = [
  "가볍게 인사하고 자리에 앉아요.",
  "음식이나 음료와 함께 편한 이야기로 시작해요.",
  "중간중간 교집합 질문 카드로 대화를 이어가요.",
  "분위기에 따라 조금 더 솔직한 이야기로 넘어가요.",
  "모임 후에는 다음 큐레이션을 위한 짧은 피드백을 남겨요.",
];

const commonNotices = [
  "상세 장소는 참여 확정 후 안내돼요.",
  "모임은 6명 내외로 진행돼요.",
  "무리한 연락처 교환이나 불편한 행동은 제한돼요.",
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
}: {
  ticket: GatheringTicket;
  className?: string;
  sections?: TicketDetailSectionKey[];
  startWithBorder?: boolean;
}) {
  const activities = cleanList(ticket.detailActivities);
  const goodFor = cleanList(ticket.detailGoodFor);
  const customNotice = ticket.detailNotice?.trim();
  const visibleSections = new Set(sections);
  const detailSummary = ticket.detailSummary?.trim();
  const hasSummary = Boolean(visibleSections.has("summary") && detailSummary);
  const firstSectionAfterSummary =
    hasSummary && visibleSections.has("activities") && activities.length > 0
      ? "activities"
      : hasSummary && visibleSections.has("vibe")
        ? "vibe"
        : hasSummary && visibleSections.has("goodFor") && goodFor.length > 0
          ? "goodFor"
          : hasSummary && visibleSections.has("flow")
            ? "flow"
            : hasSummary && visibleSections.has("notice")
              ? "notice"
              : null;

  return (
    <div className={cn("mt-5", className)}>
      {hasSummary && <TypingSummary text={detailSummary!} />}

      {visibleSections.has("activities") && activities.length > 0 && (
        <TicketDetailSection
          title="이 자리에서는 이런 걸 해요"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "activities"}
        >
          <BulletList items={activities} />
        </TicketDetailSection>
      )}

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

      {visibleSections.has("goodFor") && goodFor.length > 0 && (
        <TicketDetailSection
          title="이런 분들에게 잘 맞아요"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "goodFor"}
        >
          <BulletList items={goodFor} />
        </TicketDetailSection>
      )}

      {visibleSections.has("flow") && (
        <TicketDetailSection
          title="이렇게 진행돼요"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "flow"}
        >
          <ol className="space-y-2.5">
            {flowSteps.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm font-semibold leading-6 text-black/62">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </TicketDetailSection>
      )}

      {visibleSections.has("notice") && (
        <TicketDetailSection
          title="알아두면 좋아요"
          startWithBorder={startWithBorder}
          hideTopBorder={firstSectionAfterSummary === "notice"}
        >
          {customNotice && (
            <p className="mb-3 rounded-2xl bg-accent/[0.08] px-4 py-3 text-sm font-semibold leading-6 text-black/62">
              {customNotice}
            </p>
          )}
          <BulletList items={commonNotices} />
        </TicketDetailSection>
      )}
    </div>
  );
}

function TypingSummary({ text }: { text: string }) {
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
    <div className="mb-5 rounded-3xl border border-accent/18 bg-gradient-to-br from-white via-white to-accent/[0.08] px-4 py-4 shadow-[0_10px_24px_rgba(126,179,199,0.08)]">
      <p className="min-h-[56px] border-l-2 border-accent/70 pl-4 text-[15px] font-black leading-7 text-black/80">
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
