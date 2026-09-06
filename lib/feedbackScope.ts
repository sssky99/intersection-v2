export type FeedbackScopeGroup = {
  event_id: string;
  feedback_scope_key?: string | null;
  code: string | null;
  title: string | null;
  legacy_ticket_instance_id: string | null;
};

/** Eligibility is stored separately from display names. Null retains event-wide access. */
export function feedbackVenueGroup(group: Pick<FeedbackScopeGroup, "feedback_scope_key">) {
  return group.feedback_scope_key?.trim() || null;
}

/** Both candidate display and submission validation must use this exact set. */
export function feedbackInstanceIdsForViewer(groups: FeedbackScopeGroup[], instanceId: string) {
  const ownGroup = groups.find((group) => group.legacy_ticket_instance_id === instanceId);
  if (!ownGroup) return [instanceId];
  const venue = feedbackVenueGroup(ownGroup);
  return [...new Set(groups.filter((group) => group.event_id === ownGroup.event_id &&
    (!venue || feedbackVenueGroup(group) === venue))
    .map((group) => group.legacy_ticket_instance_id).filter((id): id is string => Boolean(id)))];
}
