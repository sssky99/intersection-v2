import { NextResponse } from "next/server";
import { displayMembershipStatus } from "@/features/membership/membershipTypes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

  const { data: instance, error: instanceError } = await createAdminClient()
    .from("ticket_instances")
    .select("id,visibility")
    .eq("id", ticket.id)
    .maybeSingle<{ id: string; visibility: string | null }>();

  if (instanceError) {
    return NextResponse.json(
      { error: "Ticket visibility is not available." },
      { status: 400 },
    );
  }

  if (instance?.visibility === "test_only" && !profile.is_test_participant) {
    return NextResponse.json(
      { error: "Test ticket access is not available." },
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

  const { error } = await supabase.from("meeting_waitlist").insert({
    user_id: user.id,
    ticket_id: ticket.id,
    ticket_template_id: ticket.templateId,
    ticket_instance_id: ticket.id,
    meeting_date: ticket.date,
    status: waitlistStatus,
    ticket_snapshot: ticket,
  });

  if (error && error.code !== "23505") {
    console.error("Meeting waitlist insert error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return NextResponse.json(
      { error: "Failed to join meeting waitlist." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ticket,
    status: waitlistStatus,
    duplicate: error?.code === "23505",
  });
}
