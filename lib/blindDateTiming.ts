export function blindDateStartAtFromParts(
  scheduledDate: string | null,
  timeLabel: string,
) {
  if (!scheduledDate) return null;
  const value = timeLabel.trim();
  const clock = value.match(/^(\d{1,2}):(\d{2})/);
  const korean = value.match(
    /^(오전|오후|저녁|밤)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/,
  );
  let hours: number;
  let minutes: number;
  if (clock) {
    hours = Number(clock[1]);
    minutes = Number(clock[2]);
  } else if (korean) {
    hours = Number(korean[2]) % 12;
    if (korean[1] !== "오전") hours += 12;
    minutes = Number(korean[3] ?? 0);
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  const startAt = new Date(
    `${scheduledDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+09:00`,
  );
  return Number.isFinite(startAt.getTime()) ? startAt : null;
}

export function addBlindDateHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
