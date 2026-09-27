export function hasColorHuntingStarted(startsAt: string | null | undefined, now: number): boolean {
  if (!startsAt) return false;
  const start = Date.parse(startsAt);
  return Number.isFinite(start) && now >= start;
}
