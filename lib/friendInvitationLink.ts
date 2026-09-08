export const pendingFriendInvitationCookie = "inter_pending_friend_invitation";

export function normalizeFriendInvitationId(value: string | string[] | null | undefined) {
  const id = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id.toLowerCase() : null;
}

export function receivedFriendInvitationPath(id: string) {
  return `/meetings?friendInvite=${encodeURIComponent(id)}`;
}
