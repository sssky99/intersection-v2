import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMembershipPlan } from "@/features/membership/membershipTypes";
import {
  membershipPlanAmounts,
  oneTimeMembershipCreditAmount,
} from "@/lib/membershipPlans";
import { membershipStoreUrls } from "@/lib/membershipStore";
import { isPastTicketDate } from "@/lib/ticketDate";
import type { GatheringTicket } from "@/types/ticket";

type PurchaseRequest = {
  plan?: unknown;
  ticket?: Partial<GatheringTicket> | null;
  meetingDateApplicationId?: unknown;
  attribution?: unknown;
};

const attributionKeys = [
  "source_type",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "referrer_host",
  "landing_path",
] as const;

function checkoutAttribution(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of attributionKeys) {
    const entry = source[key];
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    result[key] = trimmed.slice(0, key === "landing_path" ? 240 : 160);
  }

  return Object.keys(result).length > 0 ? result : null;
}

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

const landingExperimentId = "landing_ab_2026_08";
const landingExperimentCookie = "landing_ab_v1";

export async function POST(request: NextRequest) {
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

  const meetingDateApplicationId =
    typeof body?.meetingDateApplicationId === "number" &&
    Number.isSafeInteger(body.meetingDateApplicationId) &&
    body.meetingDateApplicationId > 0
      ? body.meetingDateApplicationId
      : null;
  if (
    body?.meetingDateApplicationId !== undefined &&
    meetingDateApplicationId === null
  ) {
    return NextResponse.json(
      { error: "Invalid meeting date application." },
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

  if (meetingDateApplicationId !== null) {
    const { data: application, error: applicationError } = await admin
      .from("meeting_date_applications")
      .select("id,assigned_ticket_instance_id")
      .eq("id", meetingDateApplicationId)
      .eq("user_id", user.id)
      .eq("status", "payment_pending")
      .eq("deposit_status", "payment_pending")
      .maybeSingle<{
        id: number | string;
        assigned_ticket_instance_id: string | null;
      }>();
    if (applicationError || !application) {
      return NextResponse.json(
        { error: "결제할 신청 정보를 확인하지 못했습니다." },
        { status: 409 },
      );
    }
    if (
      body?.ticket &&
      application.assigned_ticket_instance_id !== body.ticket.id
    ) {
      return NextResponse.json(
        { error: "신청 정보와 초대장이 일치하지 않습니다." },
        { status: 409 },
      );
    }
  }

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
  let creditAmount = 0;

  if (body.plan === "one_month") {
    const { data: completedMembership, error: completedMembershipError } =
      await admin
        .from("payment_transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .in("payment_kind", [
          "membership_initial",
          "membership_upgrade",
          "membership_renewal",
        ])
        .limit(1)
        .maybeSingle<{ id: number | string }>();
    if (completedMembershipError) {
      console.error(
        "Membership payment history lookup failed:",
        completedMembershipError.message,
      );
      return NextResponse.json(
        { error: "멤버십 결제 이력을 확인하지 못했습니다." },
        { status: 500 },
      );
    }

    if (!completedMembership) {
      const { data: completedOneTime, error: completedOneTimeError } =
        await admin
          .from("payment_transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("payment_kind", "one_time")
          .eq("status", "completed")
          .limit(1)
          .maybeSingle<{ id: number | string }>();
      if (completedOneTimeError) {
        console.error(
          "One-time payment history lookup failed:",
          completedOneTimeError.message,
        );
        return NextResponse.json(
          { error: "1회권 결제 이력을 확인하지 못했습니다." },
          { status: 500 },
        );
      }
      if (completedOneTime) {
        creditAmount = oneTimeMembershipCreditAmount;
      }
    }
  }

  const expectedAmount = membershipPlanAmounts[body.plan];
  const { data: paymentIntent, error: paymentIntentError } = await admin.rpc(
    "activate_membership_payment_intent",
    {
      p_user_id: user.id,
      p_plan: body.plan,
      p_expected_amount: expectedAmount,
      p_credit_amount: creditAmount,
    },
  );
  if (
    paymentIntentError ||
    !Array.isArray(paymentIntent) ||
    paymentIntent.length !== 1
  ) {
    console.error(
      "Membership payment intent save failed:",
      paymentIntentError?.message,
    );
    return NextResponse.json(
      { error: "멤버십 결제를 준비하지 못했습니다." },
      { status: 500 },
    );
  }

  const membershipIntentId = paymentIntent[0].intent_id as number | string;
  const sellerReference = `mem_${crypto.randomUUID()}`;
  const landingVariantCookie = request.cookies.get(landingExperimentCookie)?.value;
  const landingVariant =
    landingVariantCookie === "a" || landingVariantCookie === "b"
      ? landingVariantCookie
      : null;
  const attribution = checkoutAttribution(body?.attribution);
  const { error: intentLinkError } = await admin
    .from("membership_payment_intents")
    .update({
      meeting_date_application_id: meetingDateApplicationId,
      seller_reference: sellerReference,
      experiment_id: landingVariant ? landingExperimentId : null,
      landing_variant: landingVariant,
      acquisition_context: attribution,
      updated_at: now,
    })
    .eq("id", membershipIntentId)
    .eq("user_id", user.id);
  if (intentLinkError) {
    console.error(
      "Membership application link failed:",
      intentLinkError.message,
    );
    return NextResponse.json(
      { error: "멤버십 신청 정보를 연결하지 못했습니다." },
      { status: 500 },
    );
  }

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

  return NextResponse.json({
    ok: true,
    paymentIntentCreated: true,
    expectedAmount,
    creditAmount,
    payableAmount: expectedAmount - creditAmount,
    checkoutUrl: `${membershipStoreUrls[body.plan]}?ref=${encodeURIComponent(sellerReference)}`,
  });
}
