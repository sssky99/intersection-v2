import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendSmsDelivered, readFriendSms, sendFriendSms, solapiConfigured } from "@/lib/solapi";
import { buildFriendInvitationMessage, friendInvitationDeadline } from "@/lib/friendInvitationMessage";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function currentUser() {
  const auth = await createClient();
  return (await auth.auth.getUser()).data.user;
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return reply({ error: "로그인 후 초대해 주세요." }, 401);
  if (!solapiConfigured()) return reply({ error: "문자 발송 설정을 확인 중이에요." }, 503);
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  if (!/^010\d{8}$/.test(phone) || !/^\d+$/.test(String(body?.applicationId ?? "")) || body?.consent !== true) {
    return reply({ error: "초대 번호와 동의를 확인해 주세요." }, 400);
  }
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("name,phone_normalized").eq("user_id", user.id).is("archived_at", null).single();
  if (profileError || !profile?.phone_normalized || profile.phone_normalized === phone) return reply({ error: "본인 인증과 초대할 친구의 번호를 확인해 주세요." }, 400);
  // Resolve trusted event copy before reserving; recipient/text cannot be supplied by the client.
  const { data: application } = await admin.from("meeting_date_applications").select("event_id,meeting_date,meeting_time").eq("id", body.applicationId).eq("user_id", user.id).single();
  if (!application?.event_id) return reply({ error: "신청을 먼저 완료해 주세요." }, 400);
  const { data: event } = await admin.from("meeting_events").select("title,event_date,starts_at").eq("id", application.event_id).single();
  if (!event) return reply({ error: "모임을 확인할 수 없어요." }, 400);
  const { data: recipients, error: recipientError } = await admin.from("profiles").select("name").eq("phone_normalized", phone).is("archived_at", null).limit(2);
  if (recipientError) return reply({ error: "초대 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, 503);
  const base = process.env.FRIEND_INVITE_SITE_URL || "https://interv2.netlify.app";
  const link = new URL(`/meetings?event=${encodeURIComponent(application.event_id)}`, base).toString();
  let text: string;
  try {
    if (Date.now() >= friendInvitationDeadline(event.event_date, event.starts_at).getTime()) {
      return reply({ error: "친구 초대는 모임 시작 24시간 전에 마감돼요." }, 409);
    }
    text = buildFriendInvitationMessage({
      recipientName: recipients?.length === 1 ? recipients[0].name : null,
      inviterName: profile.name,
      eventDate: event.event_date,
      eventTime: event.starts_at,
      eventTitle: event.title,
      invitationUrl: link,
    });
  } catch {
    return reply({ error: "모임 일정과 초대 정보를 확인해 주세요." }, 400);
  }
  const { data: reserved, error } = await admin.rpc("reserve_friend_sms_invitation", { p_user_id: user.id, p_application_id: body.applicationId, p_phone: phone });
  if (error || !reserved?.invitation) return reply({ error: "이미 다른 친구를 초대했거나 초대 가능한 횟수를 넘었어요. 신청 상태도 확인해 주세요." }, 409);
  const invitation = reserved.invitation;
  if (!reserved.created) return reply({ id: invitation.id, status: invitation.status });
  text = text.replace(link, new URL(`/invite/${invitation.id}`, base).toString());
  try {
    const sent = await sendFriendSms(phone, text, invitation.id);
    const { error: saveError } = await admin.from("friend_sms_invitations").update({ status: "submitted", message_id: sent.messageId, group_id: sent.groupId }).eq("id", invitation.id);
    if (saveError) throw new Error("send-record-unconfirmed");
    return reply({ id: invitation.id, status: "submitted" });
  } catch {
    // Do not retry uncertain sends: the provider may already have accepted it.
    await admin.from("friend_sms_invitations").update({ status: "unknown" }).eq("id", invitation.id);
    return reply({ id: invitation.id, status: "unknown", error: "발송 결과를 확인 중이에요. 중복 발송되지 않도록 다시 보내지 않았어요." }, 202);
  }
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return reply({ error: "Unauthorized" }, 401);
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) return reply({ error: "Invalid event" }, 400);
  const admin = createAdminClient();
  const { data: invitation, error } = await admin.from("friend_sms_invitations").select("id,application_id,friend_phone,status,message_id").eq("inviter_id", user.id).eq("event_id", eventId).maybeSingle();
  if (error) return reply({ error: "조회하지 못했어요." }, 503);
  if (!invitation) return reply({ status: "not_sent", photoUrl: null });
  const { data: application } = await admin.from("meeting_date_applications").select("status").eq("id", invitation.application_id).eq("user_id", user.id).single();
  if (!application || !["payment_pending", "waitlisted", "on_hold", "approved"].includes(application.status)) return reply({ status: "inactive", photoUrl: null });
  let status = invitation.status;
  if (status === "submitted" && invitation.message_id) {
    try {
      const message = await readFriendSms(invitation.message_id);
      if (message && friendSmsDelivered(message, invitation.friend_phone, process.env.SOLAPI_SENDER_NUMBER!)) {
        const { error: updateError } = await admin.from("friend_sms_invitations").update({ status: "sent", provider_status: "4000", sent_at: new Date().toISOString() }).eq("id", invitation.id);
        if (updateError) return reply({ status: "submitted", photoUrl: null });
        status = "sent";
      } else if (message?.statusCode && /^5\d{3}$/.test(message.statusCode)) {
        await admin.from("friend_sms_invitations").update({ status: "failed", provider_status: message.statusCode }).eq("id", invitation.id);
        status = "failed";
      }
    } catch { return reply({ status: "submitted", photoUrl: null }); }
  }
  if (status !== "sent") return reply({ status, photoUrl: null });
  const { data: profiles } = await admin.from("profiles").select("photo_url").eq("phone_normalized", invitation.friend_phone).is("archived_at", null).limit(2);
  return reply({ status: "sent", photoUrl: profiles?.length === 1 ? profiles[0].photo_url ?? null : null });
}
