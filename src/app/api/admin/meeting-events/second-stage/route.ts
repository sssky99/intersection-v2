import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const authorized = (request: NextRequest) => isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
export async function GET(request: NextRequest) {
  if (!authorized(request)) return reply({ error: "Unauthorized" }, 401);
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!uuid(eventId)) return reply({ error: "Invalid event" }, 400);
  try {
    const admin = createAdminClient();
    const groups = await admin.from("meeting_groups").select("legacy_ticket_instance_id").eq("event_id", eventId);
    if (groups.error) throw groups.error;
    const ids = groups.data.map(g => g.legacy_ticket_instance_id).filter(Boolean);
    const participants = ids.length ? await admin.from("ticket_participations").select("user_id").in("ticket_instance_id", ids).in("status", ["approved", "completed", "feedback_done"]).or("arrival_status.is.null,arrival_status.neq.no_show") : { data: [], error: null };
    if (participants.error) throw participants.error;
    const users = [...new Set((participants.data ?? []).map(p => p.user_id))];
    const profiles = users.length ? await admin.from("profiles").select("user_id,name,phone_normalized").in("user_id", users) : { data: [], error: null };
    const saved = await admin.from("meeting_friend_encounters").select("user_id,group_key").eq("event_id", eventId).eq("stage_sequence", 2);
    if (profiles.error || saved.error) throw new Error("read-failed");
    return reply({ members: (profiles.data ?? []).map(p => ({ userId: p.user_id, name: p.name, last4: p.phone_normalized?.slice(-4) ?? "", group: saved.data?.find(s => s.user_id === p.user_id)?.group_key ?? "" })) });
  } catch { return reply({ error: "2차 조 기록을 불러오지 못했습니다." }, 503); }
}
export async function PUT(request: NextRequest) {
  if (!authorized(request)) return reply({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  if (!uuid(body?.eventId) || !Array.isArray(body?.members)) return reply({ error: "행사와 명단을 확인해 주세요." }, 400);
  const { error } = await createAdminClient().rpc("save_second_stage_groups", { p_event_id: body.eventId, p_members: body.members });
  return error ? reply({ error: "중복·취소·노쇼 멤버 또는 조 이름을 확인해 주세요." }, 409) : reply({ ok: true });
}
