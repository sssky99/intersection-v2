const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeMeetingEventId(
  value: string | string[] | null | undefined,
) {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return uuidPattern.test(candidate) ? candidate.toLowerCase() : null;
}

export function meetingEventDeepLinkPath(eventId: string) {
  return `/meetings?event=${encodeURIComponent(eventId)}`;
}
