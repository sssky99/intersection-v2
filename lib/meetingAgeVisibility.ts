export function birthYearNumber(value: string | number | null | undefined) {
  const year =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : null;

  if (!year || !Number.isFinite(year)) return null;
  return Math.trunc(year);
}
