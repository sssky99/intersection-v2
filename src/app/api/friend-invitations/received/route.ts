import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeFriendInvitationId, pendingFriendInvitationCookie } from "@/lib/friendInvitationLink";
import { friendInvitationDeadline } from "@/lib/friendInvitationMessage";
import { friendSmsDelivered, readFriendSms } from "@/lib/solapi";

export async function GET(request: NextRequest) {
  const reply = (body: object, status = 200) => {
    const response = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
    response.cookies.delete(pendingFriendInvitationCookie);
    return response;
  };
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return reply({ error: "초대받은 번호의 계정으로 로그인해 주세요." }, 401);
  const id = normalizeFriendInvitationId(request.nextUrl.searchParams.get("id"));
  if (!id) return reply({ error: "초대 링크를 확인해 주세요." }, 404);
  const admin = createAdminClient();
  const { data: invitation } = await admin.from("friend_sms_invitations").select("id,inviter_id,application_id,event_id,friend_phone,status,message_id").eq("id", id).maybeSingle();
  const { data: recipient } = await admin.from("profiles").select("phone_normalized").eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (!invitation || !recipient?.phone_normalized || recipient.phone_normalized !== invitation.friend_phone) {
    return reply({ error: "초대 문자를 받은 번호의 계정으로 로그인해 주세요." }, 403);
  }
  const { data: application } = await admin.from("meeting_date_applications").select("status").eq("id", invitation.application_id).eq("user_id", invitation.inviter_id).maybeSingle();
  const { data: event } = await admin.from("meeting_events").select("event_date,starts_at").eq("id", invitation.event_id).maybeSingle();
  if (!application || !["payment_pending", "waitlisted", "on_hold", "approved"].includes(application.status) || !event || Date.now() >= friendInvitationDeadline(event.event_date, event.starts_at).getTime()) {
    return reply({ error: "마감되었거나 취소된 초대예요." }, 410);
  }
  let status = invitation.status;
  if (status === "submitted" && invitation.message_id) {
    try {
      const message = await readFriendSms(invitation.message_id);
      if (message && friendSmsDelivered(message, invitation.friend_phone, process.env.SOLAPI_SENDER_NUMBER!)) {
        const { error } = await admin.from("friend_sms_invitations").update({ status: "sent", provider_status: "4000", sent_at: new Date().toISOString() }).eq("id", id);
        if (!error) status = "sent";
      }
    } catch { /* Never expose the inviter's photo before confirmed delivery. */ }
  }
  if (status !== "sent") return reply({ error: "초대 문자 발송을 확인 중이에요. 잠시 후 다시 열어주세요." }, 409);
  const { data: inviter } = await admin.from("profiles").select("photo_url").eq("user_id", invitation.inviter_id).is("archived_at", null).maybeSingle();
  const response = reply({ id, eventId: invitation.event_id, status: "sent", photoUrl: inviter?.photo_url ?? null });
  response.cookies.delete(pendingFriendInvitationCookie);
  return response;
}
