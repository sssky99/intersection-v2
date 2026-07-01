import { NextResponse } from "next/server";
import { displayMembershipStatus } from "@/features/membership/membershipTypes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPastTicketDate } from "@/lib/ticketDate";
import type { GatheringTicket } from "@/types/ticket";

type WaitlistRequest = {
  ticket?: Partial<GatheringTicket>;
};

type ProfileMembership = {
  membership_status: string | null;
  membership_end_date: string | null;
  is_test_participant: boolean | null;
};

function isTicket(value: WaitlistRequest["ticket"]): value is GatheringTicket {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as WaitlistRequest;
  const ticket = body.ticket;

  if (!isTicket(ticket)) {
    return NextResponse.json(
      { error: "Invalid ticket payload." },
      { status: 400 },
    );
  }

  if (isPastTicketDate(ticket.date)) {
    return NextResponse.json(
      { error: "This invitation has ended.", code: "ticket_ended" },
      { status: 410 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("membership_status,membership_end_date,is_test_participant")
    .eq("user_id", user.id)
    .maybeSingle<ProfileMembership>();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Profile membership state is not available." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: instance, error: instanceError } = await admin
    .from("ticket_instances")
    .select("id,visibility,event_date")
    .eq("id", ticket.id)
    .maybeSingle<{
      id: string;
      visibility: string | null;
      event_date: string | null;
    }>();

  if (instanceError || !instance) {
    return NextResponse.json(
      { error: "Ticket visibility is not available." },
      { status: 400 },
    );
  }

  if (instance?.event_date && isPastTicketDate(instance.event_date)) {
    return NextResponse.json(
      { error: "This invitation has ended.", code: "ticket_ended" },
      { status: 410 },
    );
  }

  if (instance?.visibility === "test_only" && !profile.is_test_participant) {
    return NextResponse.json(
      { error: "운영자 전용 티켓 접근 권한이 없습니다." },
      { status: 403 },
    );
  }

  const { data: currentInvitation, error: invitationLookupError } = await admin
    .from("ticket_invitations")
    .select("id,status,source_type,inviter_id,expires_at")
    .eq("ticket_instance_id", ticket.id)
    .eq("user_id", user.id)
    .maybeSingle<{
      id: string;
      status: string;
      source_type: "service" | "admin" | "friend";
      inviter_id: string | null;
      expires_at: string | null;
    }>();
  if (invitationLookupError) {
    return NextResponse.json(
      { error: "Ticket invitation is not available." },
      { status: 400 },
    );
  }

  const invitationIsActive = Boolean(
    currentInvitation &&
      ["sent", "viewed", "accepted"].includes(currentInvitation.status) &&
      (!currentInvitation.expires_at ||
        new Date(currentInvitation.expires_at).getTime() > Date.now()),
  );

  if (instance.visibility === "invite_only" && !invitationIsActive) {
    return NextResponse.json(
      { error: "An invitation is required.", code: "invitation_required" },
      { status: 403 },
    );
  }

  const membershipStatus = displayMembershipStatus({
    status: profile.membership_status,
    endDate: profile.membership_end_date,
  });

  if (membershipStatus !== "active" && membershipStatus !== "pending") {
    return NextResponse.json(
      {
        error: "Membership is required.",
        code: "membership_required",
      },
      { status: 402 },
    );
  }

  const waitlistStatus =
    membershipStatus === "active" ? "waitlisted" : "payment_pending";

  const { data: existingWaitlist, error: existingWaitlistError } = await admin
    .from("ticket_participations")
    .select("id,status")
    .eq("user_id", user.id)
    .or(`ticket_instance_id.eq.${ticket.id},ticket_id.eq.${ticket.id}`)
    .limit(1)
    .maybeSingle<{ id: number | string; status: string }>();

  if (existingWaitlistError) {
    console.error("Meeting waitlist lookup error:", existingWaitlistError);
    return NextResponse.json(
      { error: "Failed to join meeting waitlist." },
      { status: 500 },
    );
  }

  const protectedStatuses = new Set([
    "approved",
    "feedback_done",
    "completed",
  ]);
  const effectiveStatus =
    existingWaitlist && protectedStatuses.has(existingWaitlist.status)
      ? existingWaitlist.status
      : waitlistStatus;
  const now = new Date().toISOString();
  const { data: invitation, error: invitationError } = await admin
    .from("ticket_invitations")
    .upsert(
      {
        ticket_instance_id: ticket.id,
        user_id: user.id,
        source_type: currentInvitation?.source_type ?? "service",
        inviter_id: currentInvitation?.inviter_id ?? null,
        status: "accepted",
        responded_at: now,
        updated_at: now,
      },
      { onConflict: "ticket_instance_id,user_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (invitationError) {
    console.error("Ticket invitation accept error:", invitationError);
    return NextResponse.json(
      { error: "Failed to accept the ticket invitation." },
      { status: 500 },
    );
  }

  const waitlistResult =
    existingWaitlist?.id != null && effectiveStatus === existingWaitlist.status
      ? null
      : await admin.rpc("set_ticket_participation_status", {
          p_ticket_instance_id: ticket.id,
          p_user_id: user.id,
          p_status: effectiveStatus,
          p_ticket_snapshot: ticket,
          p_invitation_id: invitation.id,
        });

  if (waitlistResult?.error) {
    console.error("Meeting waitlist insert error:", {
      code: waitlistResult.error.code,
      message: waitlistResult.error.message,
      details: waitlistResult.error.details,
      hint: waitlistResult.error.hint,
    });

    return NextResponse.json(
      { error: "Failed to join meeting waitlist." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ticket,
    status: effectiveStatus,
    duplicate: Boolean(existingWaitlist),
  });
}
