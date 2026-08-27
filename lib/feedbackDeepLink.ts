const postgresBigintMax = "9223372036854775807";

export function normalizeFeedbackParticipationId(
  value: string | string[] | null | undefined,
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d+$/.test(candidate)) return null;

  const normalized = candidate.replace(/^0+/, "");
  if (!normalized) return null;
  if (
    normalized.length > postgresBigintMax.length ||
    (normalized.length === postgresBigintMax.length &&
      normalized > postgresBigintMax)
  ) {
    return null;
  }

  return normalized;
}

export function feedbackDeepLinkPath(participationId: string) {
  return `/feedback/${participationId}`;
}
