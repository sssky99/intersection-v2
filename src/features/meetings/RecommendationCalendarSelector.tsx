"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export type RecommendationCalendarDate<TTicket = unknown> = {
  date: string;
  tickets: TTicket[];
  ticketCount?: number;
};

type RecommendationCalendarSelectorProps<
  TDate extends RecommendationCalendarDate,
> = {
  dates: TDate[];
  loading: boolean;
  onSelect: (date: TDate) => void;
  marker?: "dot" | "count";
  loadingText?: string;
  helpText?: string;
  emptyText?: string;
  className?: string;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfWeekMonday(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function visibleThreeWeekDates() {
  const currentWeekMonday = startOfWeekMonday(new Date());
  const firstVisibleDate = addDays(currentWeekMonday, -7);

  return Array.from({ length: 21 }, (_, index) =>
    addDays(firstVisibleDate, index),
  );
}

function compactDateLabel(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function rangeDateLabel(start: Date, end: Date) {
  const startLabel = compactDateLabel(start);
  const endLabel = compactDateLabel(end);

  return start.getFullYear() === end.getFullYear()
    ? `${start.getFullYear()}년 ${startLabel} - ${endLabel}`
    : `${start.getFullYear()}년 ${startLabel} - ${end.getFullYear()}년 ${endLabel}`;
}

export function RecommendationCalendarSelector<
  TDate extends RecommendationCalendarDate,
>({
  dates,
  loading,
  onSelect,
  marker = "dot",
  loadingText = "초대장 날짜를 불러오고 있어요.",
  helpText = "* 파란 점이 있는 날짜를 택하면 교집합이 초대장을 준비해드려요.",
  emptyText = "현재 공개된 초대장 날짜가 없어요.",
  className,
}: RecommendationCalendarSelectorProps<TDate>) {
  const [visibleDates, setVisibleDates] = useState(visibleThreeWeekDates);
  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

  useEffect(() => {
    const syncVisibleDates = () => setVisibleDates(visibleThreeWeekDates());
    const timer = window.setInterval(syncVisibleDates, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateMap = new Map(dates.map((date) => [date.date, date]));
  const visibleDateKeys = new Set(visibleDates.map(dateKey));
  const visibleSelectableCount = dates.filter((date) =>
    visibleDateKeys.has(date.date),
  ).length;
  const activeWeekdays = new Set(
    dates
      .filter((date) => visibleDateKeys.has(date.date))
      .map((date) => {
        const parsedDate = dateFromKey(date.date);
        return parsedDate ? (parsedDate.getDay() + 6) % 7 : -1;
      }),
  );
  const firstVisibleDate = visibleDates[0];
  const lastVisibleDate = visibleDates[visibleDates.length - 1];

  return (
    <section
      className={cn(
        "mt-7 rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-black">
          {rangeDateLabel(firstVisibleDate, lastVisibleDate)}
        </h2>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-black/35">
        {weekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={cn(
              "rounded-full py-1 transition-colors",
              activeWeekdays.has(index)
                ? "bg-[#7eb3c7]/15 font-extrabold text-[#4f9bb8]"
                : "font-bold text-black/35",
            )}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2 text-center">
        {visibleDates.map((date) => {
          const key = dateKey(date);
          const dateEntry = dateMap.get(key);
          const selectable = Boolean(dateEntry);
          const ticketCount =
            dateEntry?.ticketCount ?? dateEntry?.tickets.length ?? 0;

          return (
            <motion.button
              key={key}
              type="button"
              whileTap={selectable && !loading ? { scale: 0.92 } : undefined}
              onClick={() => {
                if (dateEntry && !loading) onSelect(dateEntry);
              }}
              disabled={!selectable || loading}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-full border text-xs font-semibold transition-all",
                selectable
                  ? "border-black/10 bg-white text-black hover:border-black/25"
                  : "border-transparent text-black/15",
              )}
            >
              {date.getDate()}
              {selectable && marker === "dot" && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-[#7eb3c7] shadow-sm" />
              )}
              {selectable && marker === "count" && (
                <span className="absolute bottom-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7eb3c7] px-1 text-[9px] font-black leading-none text-white shadow-sm">
                  {ticketCount}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[10px] font-medium leading-relaxed text-black/35">
        {loading
          ? loadingText
          : visibleSelectableCount > 0
            ? helpText
            : emptyText}
      </p>
    </section>
  );
}
