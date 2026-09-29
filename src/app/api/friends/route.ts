import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeFriendApplications, canInviteToFriendEvent, friendBoardSlots, friendCandidates, friendPerson } from "@/lib/friendBoard";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function user() { return (await (await createClient()).auth.getUser()).data.user; }

export async function GET() {
  const current = await user();
  if (!current) return reply({ error: "로그인 후 확인해 주세요." }, 401);
  try {
    const admin = createAdminClient();
    const [recent, all, saved, profile, applications, invitations] = await Promise.all([
      friendCandidates(admin, current.id), friendCandidates(admin, current.id, false), friendBoardSlots(admin, current.id),
      admin.from("profiles").select("name,phone_normalized").eq("user_id", current.id).is("archived_at", null).single(),
      admin.from("meeting_date_applications").select("id,event_id").eq("user_id", current.id).in("status", activeFriendApplications).gte("meeting_date", new Date().toISOString().slice(0,10)),
      admin.from("friend_sms_invitations").select("event_id,status").eq("inviter_id", current.id),
    ]);
    if (profile.error || applications.error || invitations.error) throw new Error("read-failed");
    const eventIds = [...new Set((applications.data ?? []).map(a => a.event_id).filter(Boolean))];
    const events = eventIds.length ? await admin.from("meeting_events").select("id,title,event_date,starts_at,region,visibility").in("id", eventIds) : { data: [], error: null };
    if (events.error) throw events.error;
    const meetings = (events.data ?? []).filter(e => canInviteToFriendEvent(e)).map(e => ({
      id: e.id, applicationId: String(applications.data!.find(a => a.event_id === e.id)!.id),
      label: `${e.event_date} · ${e.starts_at.slice(0,5)}`, place: `${e.region} · ${e.title}`,
      eventDate: e.event_date, eventTime: e.starts_at, title: e.title,
      status: invitations.data?.find(i => i.event_id === e.id)?.status ?? "not_sent",
    }));
    const slots = saved.map(slot => { const person = slot && all.find(p => p.user_id === slot.id); return slot && person ? { ...friendPerson(person), x: slot.x, y: slot.y } : null; });
    const incoming = profile.data.phone_normalized ? await admin.from("friend_sms_invitations").select("id,inviter_id,application_id,event_id,status").eq("friend_phone", profile.data.phone_normalized).in("status", ["submitted", "sent"]) : { data: [], error: null };
    if (incoming.error) throw incoming.error;
    const incomingEventIds = [...new Set((incoming.data ?? []).map(i => i.event_id))];
    const inboxEvents = incomingEventIds.length ? await admin.from("meeting_events").select("id,title,event_date,starts_at,visibility").in("id", incomingEventIds) : { data: [], error: null };
    const inviterIds = [...new Set((incoming.data ?? []).map(i => i.inviter_id))];
    const inviterProfiles = inviterIds.length ? await admin.from("profiles").select("user_id,name").in("user_id", inviterIds).is("archived_at", null) : { data: [], error: null };
    const incomingApplicationIds = (incoming.data ?? []).map(i => i.application_id);
    const activeInviters = incomingApplicationIds.length ? await admin.from("meeting_date_applications").select("id").in("id", incomingApplicationIds).in("status", activeFriendApplications) : { data: [], error: null };
    if (inboxEvents.error || inviterProfiles.error || activeInviters.error) throw new Error("inbox-failed");
    const inbox = (incoming.data ?? []).flatMap(i => {
      const event = inboxEvents.data?.find(e => e.id === i.event_id);
      const inviter = inviterProfiles.data?.find(p => p.user_id === i.inviter_id);
      if (!event || !inviter || !canInviteToFriendEvent(event) || !activeInviters.data?.some(a => a.id === i.application_id)) return [];
      return [{ id: i.id, name: inviter.name, label: `${event.event_date} · ${event.starts_at.slice(0,5)}`, title: event.title }];
    });
    return reply({ ownerName: profile.data.name, slots, candidates: recent.map(friendPerson), meetings, inbox });
  } catch { return reply({ error: "친구 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, 503); }
}

export async function PUT(request: NextRequest) {
  const current = await user();
  if (!current) return reply({ error: "로그인 후 저장해 주세요." }, 401);
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.slots) || body.slots.length !== 9 || body.slots.some((s: unknown) => s !== null && (typeof s !== "object" || !s || !("id" in s) || !("x" in s) || !("y" in s)))) return reply({ error: "사진틀을 확인해 주세요." }, 400);
  const slots = body.slots.map((s: { id: unknown; x: unknown; y: unknown } | null) => s && ({ id: s.id, x: s.x, y: s.y }));
  const { error } = await createAdminClient().rpc("save_friend_board", { p_user_id: current.id, p_slots: slots });
  if (error) return reply({ error: "저장하지 못했어요. 최근 2개월 안에 함께한 친구인지 확인해 주세요." }, 409);
  return reply({ ok: true });
}
