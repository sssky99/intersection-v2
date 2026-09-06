"use client";
import { ChevronDown, Clock3, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const minuteSteps = ["00", "15", "30", "45"] as const;

export const timePeriods = ["오전", "오후"] as const;

export const timeHours = Array.from({ length: 12 }, (_, hour) =>
  String(hour + 1).padStart(2, "0"),
);

export type TimePeriod = (typeof timePeriods)[number];

export function normalizeTimeValue(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return "";

  const minute = minuteSteps.includes(match[2] as (typeof minuteSteps)[number])
    ? match[2]
    : "00";

  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, "0")}:${minute}`;
}

export function parseTimeParts(value: string) {
  const match = normalizeTimeValue(value).match(/^(\d{2}):(\d{2})$/);
  const hour24 = match ? Number(match[1]) : 15;
  const minute = match ? match[2] : "00";
  const period: TimePeriod = hour24 >= 12 ? "오후" : "오전";
  const hour12 = hour24 % 12 || 12;

  return {
    period,
    hour: String(hour12).padStart(2, "0"),
    minute: minuteSteps.includes(minute as (typeof minuteSteps)[number])
      ? minute
      : "00",
  };
}

export function composeTimeValue({
  period,
  hour,
  minute,
}: {
  period: TimePeriod;
  hour: string;
  minute: string;
}) {
  const hourNumber = Number(hour);
  const hour24 =
    period === "오전"
      ? hourNumber === 12
        ? 0
        : hourNumber
      : hourNumber === 12
        ? 12
        : hourNumber + 12;

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function displayTimeValue(value: string) {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return "시간 선택";
  const parts = parseTimeParts(normalized);
  return `${parts.period} ${parts.hour}:${parts.minute}`;
}

export function IconButton({
  primary = false,
  disabled,
  onClick,
  icon: Icon,
  children,
}: {
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-40",
        primary
          ? "bg-black text-white"
          : "border border-black/10 bg-white text-black/55 hover:border-black/20 hover:text-black",
      )}
    >
      <Icon size={15} aria-hidden />
      {children}
    </button>
  );
}

export function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <label className={className}>
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "mt-1.5 w-full resize-y rounded-xl border border-black/10 px-3 py-2 text-sm leading-5 outline-none focus:border-accent",
          rows ? "min-h-0" : "min-h-24",
        )}
      />
    </label>
  );
}

export function TimeSplitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parts = parseTimeParts(value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const updatePart = (
    patch: Partial<{ period: TimePeriod; hour: string; minute: string }>,
  ) => {
    onChange(composeTimeValue({ ...parts, ...patch }));
  };

  return (
    <div ref={containerRef} className="relative block">
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#fbfbfa] px-3 text-left text-sm font-bold text-black/72 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
      >
        <span>{displayTimeValue(value)}</span>
        <Clock3 size={15} className="text-black/35" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 grid w-[196px] grid-cols-3 overflow-hidden rounded-sm border border-black/20 bg-white py-1 shadow-[0_16px_42px_rgba(0,0,0,0.16)]">
          <TimePickerColumn
            values={timePeriods}
            selected={parts.period}
            onSelect={(period) => updatePart({ period })}
          />
          <TimePickerColumn
            values={timeHours}
            selected={parts.hour}
            onSelect={(hour) => updatePart({ hour })}
          />
          <TimePickerColumn
            values={minuteSteps}
            selected={parts.minute}
            onSelect={(minute) => {
              updatePart({ minute });
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function TimePickerColumn<TValue extends string>({
  values,
  selected,
  onSelect,
}: {
  values: readonly TValue[];
  selected: string;
  onSelect: (value: TValue) => void;
}) {
  return (
    <div className="max-h-[224px] overflow-y-auto px-1 scrollbar-none">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={cn(
            "flex h-9 w-full items-center justify-center rounded-sm text-sm font-semibold transition",
            selected === value
              ? "bg-[#0b7cff] text-white"
              : "text-black/78 hover:bg-black/[0.04]",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-black/50">{label}</span>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-[#fbfbfa] px-3 pr-9 text-sm font-bold text-black/70 outline-none transition hover:border-black/20 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35"
        />
      </div>
    </label>
  );
}

export function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-black/15 px-5 text-center text-sm font-semibold text-black/40">
      {children}
    </div>
  );
}

import { cn } from "@/lib/cn";
