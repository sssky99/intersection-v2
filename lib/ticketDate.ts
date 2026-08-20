const kstOffsetMs = 9 * 60 * 60 * 1000;
const ticketDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const applicationCloseOffsetMs = 24 * 60 * 60 * 1000;

export function todayInKst(now = new Date()) {
  const kstNow = new Date(now.getTime() + kstOffsetMs);
  const year = kstNow.getUTCFullYear();
  const month = String(kstNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isPastTicketDate(
  value: string | null | undefined,
  now = new Date(),
) {
  return Boolean(value && ticketDatePattern.test(value) && value < todayInKst(now));
}

export function ticketStartAtInKst(
  date: string | null | undefined,
  time: string | null | undefined,
) {
  if (!date || !ticketDatePattern.test(date)) return null;

  const normalizedTime = time?.slice(0, 5) || "00:00";
  const startAt = new Date(`${date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(startAt.getTime()) ? startAt : null;
}

export function hasTicketStarted(
  date: string | null | undefined,
  time: string | null | undefined,
  now = new Date(),
) {
  const startAt = ticketStartAtInKst(date, time);
  return Boolean(startAt && now >= startAt);
}

export function ticketApplicationClosesAt(
  date: string | null | undefined,
  time: string | null | undefined,
  configuredClosesAt?: string | null,
) {
  if (configuredClosesAt) {
    const configured = new Date(configuredClosesAt);
    if (Number.isFinite(configured.getTime())) return configured;
  }

  const startAt = ticketStartAtInKst(date, time);
  return startAt
    ? new Date(startAt.getTime() - applicationCloseOffsetMs)
    : null;
}

export function isTicketApplicationClosed(
  date: string | null | undefined,
  time: string | null | undefined,
  configuredClosesAt?: string | null,
  now = new Date(),
) {
  const closesAt = ticketApplicationClosesAt(
    date,
    time,
    configuredClosesAt,
  );
  return Boolean(closesAt && now >= closesAt);
}
