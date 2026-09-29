import type { createAdminClient } from "./supabase/admin";
import { friendInvitationDeadline } from "./friendInvitationMessage";

type Admin = ReturnType<typeof createAdminClient>;
export type BoardSlot = { id: string; x: number; y: number } | null;
export type FriendCandidate = { user_id: string; name: string; photo_url: string | null; last_met_date: string };
export const activeFriendApplications = ["payment_pending", "waitlisted", "on_hold", "approved"];

export async function friendCandidates(admin: Admin, userId: string, recent = true): Promise<FriendCandidate[]> {
  const { data, error } = await admin.rpc("friend_candidates", { p_user_id: userId, p_recent: recent });
  if (error) throw error;
  return data ?? [];
}
export async function friendBoardSlots(admin: Admin, userId: string): Promise<BoardSlot[]> {
  const { data, error } = await admin.from("friend_boards").select("slots").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.slots ?? Array(9).fill(null);
}
export async function eligibleBoardFriend(admin: Admin, userId: string, friendId: string) {
  const recent = await friendCandidates(admin, userId);
  const candidate = recent.find(p => p.user_id === friendId);
  if (candidate) return candidate;
  const slots = await friendBoardSlots(admin, userId);
  if (!slots.some(slot => slot?.id === friendId)) return null;
  return (await friendCandidates(admin, userId, false)).find(p => p.user_id === friendId) ?? null;
}
export function canInviteToFriendEvent(event: { event_date: string; starts_at: string; visibility: string }, now = Date.now()) {
  try { return event.visibility === "public" && now < friendInvitationDeadline(event.event_date, event.starts_at).getTime(); }
  catch { return false; }
}
export function friendPerson(p: FriendCandidate) {
  const date = new Date(`${p.last_met_date}T12:00:00+09:00`);
  const label = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" }).format(date);
  return { id: p.user_id, name: p.name, image: p.photo_url || "/images/profile-placeholder.svg", met: `${label}에 함께했어요` };
}
