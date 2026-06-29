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

  if (instanceError) {
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
    .from("meeting_waitlist")
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
  const waitlistPayload = {
    ticket_id: ticket.id,
    ticket_template_id: ticket.templateId,
    ticket_instance_id: ticket.id,
    meeting_date: ticket.date,
    ticket_snapshot: ticket,
    updated_at: new Date().toISOString(),
  };
  const waitlistResult =
    existingWaitlist?.id != null
      ? effectiveStatus === existingWaitlist.status
        ? null
        : await admin
            .from("meeting_waitlist")
            .update({
              ...waitlistPayload,
              status: effectiveStatus,
            })
            .eq("id", existingWaitlist.id)
      : await admin.from("meeting_waitlist").insert({
          ...waitlistPayload,
          user_id: user.id,
          status: waitlistStatus,
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
