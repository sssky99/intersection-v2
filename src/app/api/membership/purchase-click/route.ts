import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMembershipPlan } from "@/features/membership/membershipTypes";
import { isPastTicketDate } from "@/lib/ticketDate";
import type { GatheringTicket } from "@/types/ticket";

type PurchaseRequest = {
  plan?: unknown;
  ticket?: Partial<GatheringTicket> | null;
};

type TicketInstanceRow = {
  id: string;
  template_id: string;
  event_date: string | null;
  visibility: string;
};

type TicketInvitationRow = {
  id: string;
  status: string;
  source_type: "service" | "admin" | "friend";
  inviter_id: string | null;
  expires_at: string | null;
};

function isTicket(value: PurchaseRequest["ticket"]): value is GatheringTicket {
  return Boolean(
    value?.id &&
      value.templateId &&
      value.title &&
      value.date &&
      value.time &&
      value.area &&
      Array.isArray(value.moodTags) &&
      value.peopleHint &&
      value.reason,
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as PurchaseRequest | null;

  if (!isMembershipPlan(body?.plan)) {
    return NextResponse.json(
      { error: "멤버십 플랜이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (body?.ticket != null && !isTicket(body.ticket)) {
    return NextResponse.json(
      { error: "Invalid ticket payload." },
      { status: 400 },
    );
  }

  if (body?.ticket && isPastTicketDate(body.ticket.date)) {
    return NextResponse.json(
      { error: "This invitation has ended.", code: "ticket_ended" },
      { status: 410 },
    );
  }

  const admin = createAdminClient();
  let ticketInstance: TicketInstanceRow | null = null;
  let ticketInvitation: TicketInvitationRow | null = null;

  if (body?.ticket && admin) {
    const { data: instance, error: instanceError } = await admin
      .from("ticket_instances")
      .select("id,template_id,event_date,visibility")
      .eq("id", body.ticket.id)
      .maybeSingle<TicketInstanceRow>();

    if (instanceError || !instance?.event_date) {
      console.error("Membership ticket lookup failed:", instanceError?.message);
      return NextResponse.json(
        { error: "Ticket information is not available." },
        { status: 400 },
      );
    }

    if (isPastTicketDate(instance.event_date)) {
      return NextResponse.json(
        { error: "This invitation has ended.", code: "ticket_ended" },
        { status: 410 },
      );
    }

    ticketInstance = instance;

    const { data: invitation, error: invitationError } = await admin
      .from("ticket_invitations")
      .select("id,status,source_type,inviter_id,expires_at")
      .eq("ticket_instance_id", instance.id)
      .eq("user_id", user.id)
      .maybeSingle<TicketInvitationRow>();
    if (invitationError) {
      return NextResponse.json(
        { error: "Ticket invitation is not available." },
        { status: 400 },
      );
    }
    ticketInvitation = invitation;

    const invitationIsActive = Boolean(
      invitation &&
        ["sent", "viewed", "accepted"].includes(invitation.status) &&
        (!invitation.expires_at ||
          new Date(invitation.expires_at).getTime() > Date.now()),
    );
    if (instance.visibility === "invite_only" && !invitationIsActive) {
      return NextResponse.json(
        { error: "An invitation is required.", code: "invitation_required" },
        { status: 403 },
      );
    }
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({
      membership_status: "pending",
      membership_plan: body.plan,
      membership_purchase_clicked_at: now,
      membership_updated_at: now,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("Membership purchase click save failed:", error.message);
    return NextResponse.json(
      { error: "멤버십 신청 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  if (body.ticket && admin && ticketInstance) {
    const instance = ticketInstance;
    const { data: existingWaitlist, error: existingWaitlistError } = await admin
      .from("ticket_participations")
      .select("id,status")
      .eq("user_id", user.id)
      .or(`ticket_instance_id.eq.${instance.id},ticket_id.eq.${instance.id}`)
      .limit(1)
      .maybeSingle<{ id: number | string; status: string }>();

    if (existingWaitlistError) {
      console.error(
        "Membership waitlist lookup failed:",
        existingWaitlistError.message,
      );
      return NextResponse.json(
        { error: "Failed to save the ticket application." },
        { status: 500 },
      );
    }

    const protectedStatuses = new Set([
      "approved",
      "feedback_done",
      "completed",
    ]);
    const { data: acceptedInvitation, error: invitationError } = await admin
      .from("ticket_invitations")
      .upsert(
        {
          ticket_instance_id: instance.id,
          user_id: user.id,
          source_type: ticketInvitation?.source_type ?? "service",
          inviter_id: ticketInvitation?.inviter_id ?? null,
          status: "accepted",
          responded_at: now,
          updated_at: now,
        },
        { onConflict: "ticket_instance_id,user_id" },
      )
      .select("id")
      .single<{ id: string }>();
    if (invitationError) {
      console.error(
        "Membership invitation accept failed:",
        invitationError.message,
      );
      return NextResponse.json(
        { error: "Failed to accept the ticket invitation." },
        { status: 500 },
      );
    }

    const waitlistResult =
      existingWaitlist?.id != null &&
      protectedStatuses.has(existingWaitlist.status)
        ? null
        : await admin.rpc("set_ticket_participation_status", {
            p_ticket_instance_id: instance.id,
            p_user_id: user.id,
            p_status: "payment_pending",
            p_ticket_snapshot: body.ticket,
            p_invitation_id: acceptedInvitation.id,
          });

    if (waitlistResult?.error) {
      console.error(
        "Membership waitlist save failed:",
        waitlistResult.error.message,
      );
      return NextResponse.json(
        { error: "Failed to save the ticket application." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
