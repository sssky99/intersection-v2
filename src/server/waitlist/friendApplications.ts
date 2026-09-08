export type WaitlistFriendInvitation = {
  application_id: number | string;
  inviter_id: string;
  event_id: string;
  friend_phone: string;
  status: string;
};

// Match the event as well as the person: a friend's other applications stay solo.
export function friendApplicationNames(
  applications: Array<{ id: number | string; user_id: string; event_id: string | null }>,
  profiles: Array<{ user_id: string; phone: string | null; name?: string | null }>,
  invitations: WaitlistFriendInvitation[],
) {
  const phoneByUser = new Map(profiles.map((profile) => [profile.user_id, profile.phone?.replace(/\D/g, "") ?? ""]));
  const profileByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const namesByPhone = new Map<string, Set<string>>();
  for (const profile of profiles) {
    const phone = phoneByUser.get(profile.user_id);
    const name = profile.name?.trim();
    if (!phone || !name) continue;
    const names = namesByPhone.get(phone) ?? new Set<string>();
    names.add(name);
    namesByPhone.set(phone, names);
  }
  const result = new Map<string, string>();
  for (const application of applications) {
    if (!application.event_id) continue;
    const names = new Set<string>();
    for (const invitation of invitations) {
      if (invitation.event_id !== application.event_id) continue;
      if (invitation.inviter_id === application.user_id && String(invitation.application_id) === String(application.id)) {
        const matches = namesByPhone.get(invitation.friend_phone);
        names.add(matches?.size === 1 ? [...matches][0] : "이름 미확인");
      } else if (invitation.status === "sent" && invitation.friend_phone === phoneByUser.get(application.user_id)) {
        names.add(profileByUser.get(invitation.inviter_id)?.name?.trim() || "이름 미확인");
      }
    }
    if (names.size) result.set(String(application.id), [...names].join(", "));
  }
  return result;
}

export function friendApplicationIds(...args: Parameters<typeof friendApplicationNames>) {
  return new Set(friendApplicationNames(...args).keys());
}
