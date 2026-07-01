import React from "react";

type IntersectionTicketCardProps = {
  title: string;
  imageUrl?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  tags?: string[] | null;
  badgeLabel?: string | null;
  badgeClassName?: string;
  remainingSeatCount?: number | null;
  className?: string;
  contentVisible?: boolean;
  imageVisible?: boolean;
  overlayVisible?: boolean;
  priority?: boolean;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function weekdayLabel(date: Date) {
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

export function formatTicketDateLabel(value?: string | null) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  if (!Number.isFinite(date.getTime())) return value;

  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} (${weekdayLabel(date)})`;
}

export function formatTicketTimeLabel(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return "";
  if (/^(오전|오후)\s*/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;

  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return raw;

  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${match[2]}`;
}

function normalizeTags(tags?: string[] | null) {
  return (tags ?? [])
    .flatMap((tag) =>
      tag
        .trim()
        .split("#")
        .map((item) => item.trim()),
    )
    .filter(Boolean)
    .slice(0, 3);
}

function inlineLocation(value?: string | null) {
  return (
    value
      ?.replace(/\s*\n\s*/g, " ")
      .replace(/^(서울)(?:\s+\1)+(?=\s|$)/, "$1")
      .trim() ?? ""
  );
}

export function IntersectionTicketCard({
  title,
  imageUrl,
  date,
  time,
  location,
  tags,
  badgeLabel,
  badgeClassName,
  className,
  contentVisible = true,
  imageVisible = true,
  overlayVisible = true,
}: IntersectionTicketCardProps) {
  const dateLabel = formatTicketDateLabel(date);
  const timeLabel = formatTicketTimeLabel(time);
  const tagItems = normalizeTags(tags);
  const hasImage = Boolean(imageUrl);
  const imageSurfaceVisible = hasImage ? imageVisible : true;
  const dateTimeLabel = [dateLabel, timeLabel].filter(Boolean).join(" ");
  const locationLabel = inlineLocation(location);
  const metaLabel = [dateTimeLabel, locationLabel].filter(Boolean).join(" · ");

  return (
    <article
      data-testid="intersection-ticket-card"
      className={cn(
        "relative aspect-[1/1.62] w-full overflow-hidden rounded-[28px] bg-white text-white shadow-[0_18px_45px_rgba(0,0,0,0.16)]",
        className,
      )}
    >
      {hasImage ? (
        <img
          src={imageUrl ?? ""}
          alt=""
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[350ms]",
            imageVisible ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}

      {overlayVisible && (
        <>
          <div
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity duration-[350ms]",
              imageSurfaceVisible ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-b from-black/22 via-black/42 to-black/95 transition-opacity duration-[350ms]",
              imageSurfaceVisible ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/95 via-black/72 to-transparent transition-opacity duration-[350ms]",
              imageSurfaceVisible ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      )}

      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-[350ms]",
          contentVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {badgeLabel && (
          <span
            className={cn(
              "absolute left-4 top-4 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black shadow-[0_10px_22px_rgba(0,0,0,0.2)] backdrop-blur",
              badgeClassName ??
                "border-white/25 bg-white/20 text-white shadow-[0_10px_22px_rgba(0,0,0,0.2)]",
            )}
          >
            {badgeLabel}
          </span>
        )}
        <div className="absolute inset-x-5 bottom-7 text-left">
          <h3 className="whitespace-pre-line text-[32px] font-extrabold leading-[1.12] tracking-normal text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.72)]">
            {title}
          </h3>
          {metaLabel && (
            <p className="mt-3 text-[13px] font-extrabold leading-5 text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.68)]">
              {metaLabel}
            </p>
          )}
          <div className="scrollbar-none mt-3 flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5">
            {tagItems.map((tag) => (
              <span
                key={tag}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 text-[11px] font-extrabold leading-none text-white backdrop-blur-[2px]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
