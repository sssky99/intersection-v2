import React from "react";

type IntersectionTicketCardProps = {
  title: string;
  imageUrl?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  tags?: string[] | null;
  remainingSeatCount?: number | null;
  className?: string;
  contentVisible?: boolean;
  imageVisible?: boolean;
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

function normalizeTags(tags?: string[] | null) {
  return (tags ?? [])
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 3);
}

export function IntersectionTicketCard({
  title,
  imageUrl,
  date,
  time,
  location,
  tags,
  className,
  contentVisible = true,
  imageVisible = true,
}: IntersectionTicketCardProps) {
  const dateLabel = formatTicketDateLabel(date);
  const tagItems = normalizeTags(tags);
  const hasImage = Boolean(imageUrl);
  const imageSurfaceVisible = hasImage ? imageVisible : true;

  return (
    <article
      data-testid="intersection-ticket-card"
      className={cn(
        "font-ticket-serif relative aspect-[1/1.62] w-full overflow-hidden rounded-[28px] bg-white text-white shadow-[0_18px_45px_rgba(0,0,0,0.16)]",
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(126,179,199,0.36),transparent_34%),linear-gradient(145deg,#26372f,#101715_58%,#050606)]" />
      )}

      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-[350ms]",
          imageSurfaceVisible ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-black/28 via-black/30 to-black/88 transition-opacity duration-[350ms]",
          imageSurfaceVisible ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-[350ms]",
          contentVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
          <h3 className="whitespace-pre-line text-[30px] font-extrabold leading-[1.28] tracking-tight text-[#fff8e8] [text-shadow:0_2px_18px_rgba(0,0,0,0.72)]">
            {title}
          </h3>
          <div className="mt-7 grid grid-cols-2 gap-6 text-[13px] font-bold leading-6 text-[#fff8e8]/82 [text-shadow:0_2px_12px_rgba(0,0,0,0.68)]">
            <span className="whitespace-pre-line text-right">
              {[dateLabel, time].filter(Boolean).join("\n")}
            </span>
            <span className="whitespace-pre-line text-left">{location}</span>
          </div>
        </div>

        {tagItems.length > 0 && (
          <div className="absolute inset-x-5 bottom-6 flex flex-wrap justify-center gap-x-2 gap-y-1.5 text-[12px] font-bold leading-5 text-[#fff8e8]/78">
            {tagItems.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

    </article>
  );
}
