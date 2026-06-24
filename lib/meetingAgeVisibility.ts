export const MEETING_PROPOSER_BIRTH_YEAR_RADIUS = 4;

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

export function canViewMeetingByProposerBirthYear({
  viewerBirthYear,
  proposerBirthYear,
  bypass = false,
}: {
  viewerBirthYear: string | number | null | undefined;
  proposerBirthYear: string | number | null | undefined;
  bypass?: boolean;
}) {
  if (bypass) return true;

  const viewerYear = birthYearNumber(viewerBirthYear);
  const proposerYear = birthYearNumber(proposerBirthYear);
  if (!viewerYear || !proposerYear) return false;

  return (
    Math.abs(viewerYear - proposerYear) <=
    MEETING_PROPOSER_BIRTH_YEAR_RADIUS
  );
}
