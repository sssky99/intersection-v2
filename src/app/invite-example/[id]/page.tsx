import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableMeetingTickets } from "@/lib/publicTicketPreview";
import { friendSmsDelivered, readFriendSms } from "@/lib/solapi";
import { MobileFrame } from "@/components/MobileFrame";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { TicketDetailRevealHeader } from "@/features/meetings/TicketDetailRevealHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "교집합 초대장 미리보기", robots: { index: false, follow: false } };

export default async function InvitationExample({ params }: { params: Promise<{ id: string }> }) {
  // This capability link exists only on an explicitly requested preview deploy.
  if (process.env.CONTEXT === "production") notFound();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const { data: example } = await admin.from("friend_invitation_examples").select("*").eq("id", id).maybeSingle();
  if (!example || Date.parse(example.expires_at) <= Date.now()) notFound();
  let delivered = Boolean(example.delivered_at);
  if (!delivered && example.message_id) {
    try {
      const message = await readFriendSms(example.message_id);
      if (message && friendSmsDelivered(message, example.recipient_phone, process.env.SOLAPI_SENDER_NUMBER ?? "")) {
        delivered = true;
        await admin.from("friend_invitation_examples").update({ delivered_at: new Date().toISOString() }).eq("id", id);
      }
    } catch { /* Keep the photo hidden until delivery can be verified. */ }
  }
  const tickets = await getAvailableMeetingTickets({ userId: null, includeTestOnly: false });
  const ticket = tickets.find((item) => item.id === example.event_id);
  if (!ticket) notFound();
  const inviter = delivered
    ? (await admin.from("profiles").select("photo_url").eq("user_id", example.inviter_id).is("archived_at", null).maybeSingle()).data
    : null;
  return (
    <MobileFrame>
      <main className="min-h-dvh bg-[#f8f6f0] px-5 pb-12 pt-10 text-[#24211d]">
        <p className="mb-8 text-center text-xs text-black/50">테스트 초대장 · 실제 신청은 진행되지 않아요</p>
        <TicketDetailRevealHeader title={ticket.title} meta={`${ticket.date} · 오후 7:00 · 서울 을지로`} />
        <div className="mt-8 border-t border-[#d3cdbf] pt-8">
          <TicketDetailContent ticket={ticket} withFriend matchMemberCount={4} friendPhotoUrl={inviter?.photo_url} sections={["course"]} />
        </div>
        {!delivered && <p className="mt-5 text-center text-sm text-black/50">문자 발송 확인 후 친구 사진이 표시돼요.</p>}
      </main>
    </MobileFrame>
  );
}
