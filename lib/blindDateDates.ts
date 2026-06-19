const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const blindDateFirstSelectableDayOffset = 2;
export const blindDateSelectableDayCount = 15;

function seoulDateParts(value: Date) {
  const parts = seoulDateFormatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function isoDateFromParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function blindDateSelectableDatesFrom(receivedAt: string | Date) {
  const receivedDate =
    receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
  const baseDate = Number.isFinite(receivedDate.getTime())
    ? receivedDate
    : new Date();
  const { year, month, day } = seoulDateParts(baseDate);

  return Array.from({ length: blindDateSelectableDayCount }, (_, index) =>
    isoDateFromParts(
      year,
      month,
      day + blindDateFirstSelectableDayOffset + index,
    ),
  );
}

export function blindDateSelectableDateWindowFrom(receivedAt: string | Date) {
  const dates = blindDateSelectableDatesFrom(receivedAt);
  return {
    dates,
    start: dates[0] ?? null,
    end: dates[dates.length - 1] ?? null,
  };
}
