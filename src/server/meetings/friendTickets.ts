import { createAdminClient } from "@/lib/supabase/admin";
import { friendSmsDelivered, readFriendSms } from "@/lib/solapi";
import type { UserTicket } from "@/types/ticket";

type Application = { id: string | number; event_id: string | null; assigned_ticket_instance_id: string | null; ticket_participation_id: string | number | null };

export function ticketApplication(ticket: UserTicket, applications: Application[]) {
  return applications.find((application) =>
    ticket.waitlistId === `application:${application.id}` ||
    (application.ticket_participation_id != null && ticket.waitlistId === String(application.ticket_participation_id)) ||
    (application.assigned_ticket_instance_id != null && ticket.ticket.id === application.assigned_ticket_instance_id));
}

export async function attachFriendTickets(tickets: UserTicket[], applications: Application[], userId: string) {
  const eventIds = [...new Set(tickets.map((ticket) => ticketApplication(ticket, applications)?.event_id).filter((id): id is string => Boolean(id)))];
  if (!eventIds.length) return tickets;
  const admin = createAdminClient({ timeoutMs: 5000 });
  const { data: self, error: selfError } = await admin.from("profiles").select("phone_normalized").eq("user_id", userId).maybeSingle();
  if (selfError) throw selfError;
  const { data, error } = await admin.from("friend_sms_invitations")
    .select("id,inviter_id,application_id,event_id,friend_phone,status,message_id")
    .in("event_id", eventIds);
  if (error) throw error;
  const relevant = (data ?? []).filter((invitation) => invitation.inviter_id === userId || (self?.phone_normalized && invitation.friend_phone === self.phone_normalized));
  const infoByEvent = new Map<string, NonNullable<UserTicket["friendInvitation"]>>();
  for (const invitation of relevant) {
    const isSender = invitation.inviter_id === userId;
    if (isSender && !applications.some((application) => String(application.id) === String(invitation.application_id) && application.event_id === invitation.event_id)) continue;
    let delivered = invitation.status === "sent";
    if (!delivered && invitation.status === "submitted" && invitation.message_id) {
      try {
        const message = await readFriendSms(invitation.message_id);
        if (message && friendSmsDelivered(message, invitation.friend_phone, process.env.SOLAPI_SENDER_NUMBER ?? "")) {
          const saved = await admin.from("friend_sms_invitations").update({ status: "sent", provider_status: "4000", sent_at: new Date().toISOString() }).eq("id", invitation.id);
          delivered = !saved.error;
        }
      } catch { /* Preserve the friend layout, but never reveal a photo before delivery. */ }
    }
    if (!isSender && !delivered) continue;
    let photoUrl: string | null = null;
    if (delivered) {
      let query = admin.from("profiles").select("photo_url").is("archived_at", null);
      query = isSender ? query.eq("phone_normalized", invitation.friend_phone) : query.eq("user_id", invitation.inviter_id);
      const { data: profiles, error: photoError } = await query.limit(2);
      if (!photoError && profiles?.length === 1) photoUrl = profiles[0].photo_url ?? null;
    }
    // A person's own outgoing invitation takes priority over another incoming one.
    if (isSender || !infoByEvent.has(invitation.event_id)) infoByEvent.set(invitation.event_id, { photoUrl });
  }
  return tickets.map((ticket) => ({ ...ticket, friendInvitation: infoByEvent.get(ticketApplication(ticket, applications)?.event_id ?? "") }));
}
