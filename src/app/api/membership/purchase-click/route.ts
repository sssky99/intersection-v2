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

  const admin = body?.ticket ? createAdminClient() : null;
  let ticketInstance: TicketInstanceRow | null = null;

  if (body?.ticket && admin) {
    const { data: instance, error: instanceError } = await admin
      .from("ticket_instances")
      .select("id,template_id,event_date")
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
  }

  const now = new Date().toISOString();
  const { error } = await supabase
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
      .from("meeting_waitlist")
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
    const waitlistPayload = {
      ticket_id: instance.id,
      ticket_template_id: instance.template_id,
      ticket_instance_id: instance.id,
      meeting_date: instance.event_date,
      ticket_snapshot: body.ticket,
      updated_at: now,
    };

    const waitlistResult =
      existingWaitlist?.id != null
        ? protectedStatuses.has(existingWaitlist.status)
          ? null
          : await admin
              .from("meeting_waitlist")
              .update({
                ...waitlistPayload,
                status: "payment_pending",
              })
              .eq("id", existingWaitlist.id)
        : await admin.from("meeting_waitlist").insert({
            ...waitlistPayload,
            user_id: user.id,
            status: "payment_pending",
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
