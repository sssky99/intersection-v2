const kstOffsetMs = 9 * 60 * 60 * 1000;
const ticketDatePattern = /^\d{4}-\d{2}-\d{2}$/;

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
