export type WaitlistFriendInvitation = {
  application_id: number | string;
  inviter_id: string;
  event_id: string;
  friend_phone: string;
  status: string;
};

// Match the event as well as the person: a friend's other applications stay solo.
export function friendApplicationIds(
  applications: Array<{ id: number | string; user_id: string; event_id: string | null }>,
  profiles: Array<{ user_id: string; phone: string | null }>,
  invitations: WaitlistFriendInvitation[],
) {
  const phoneByUser = new Map(profiles.map((profile) => [profile.user_id, profile.phone?.replace(/\D/g, "") ?? ""]));
  const senders = new Set(invitations.map((invitation) => `${invitation.event_id}:${invitation.inviter_id}:${invitation.application_id}`));
  const recipients = new Set(invitations.filter((invitation) => invitation.status === "sent")
    .map((invitation) => `${invitation.event_id}:${invitation.friend_phone}`));
  return new Set(applications.filter((application) => application.event_id && (
    senders.has(`${application.event_id}:${application.user_id}:${application.id}`) ||
    recipients.has(`${application.event_id}:${phoneByUser.get(application.user_id)}`)
  )).map((application) => String(application.id)));
}
