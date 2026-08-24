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
  "meta_fbp",
  "meta_fbc",
  "meta_user_agent",
  "analytics_session_id",
  "landing_variant",
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
    const maxLength =
      key === "landing_path" ? 240 : key.startsWith("meta_") ? 500 : 160;
    result[key] = trimmed.slice(0, maxLength);
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
  const [authResult, body] = await Promise.all([
    supabase.auth.getUser(),
    request.json().catch(() => null) as Promise<PurchaseRequest | null>,
  ]);
  const {
    data: { user },
  } = authResult;

  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

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

  const applicationLookup =
    meetingDateApplicationId !== null
      ? admin
          .from("meeting_date_applications")
          .select("id,assigned_ticket_instance_id")
          .eq("id", meetingDateApplicationId)
          .eq("user_id", user.id)
          .eq("status", "payment_pending")
          .maybeSingle<{
            id: number | string;
            assigned_ticket_instance_id: string | null;
          }>()
      : Promise.resolve({ data: null, error: null });
  const ticketInstanceLookup = body?.ticket
    ? admin
        .from("ticket_instances")
        .select("id,template_id,event_date,visibility")
        .eq("id", body.ticket.id)
        .maybeSingle<TicketInstanceRow>()
    : Promise.resolve({ data: null, error: null });
  const ticketInvitationLookup = body?.ticket
    ? admin
        .from("ticket_invitations")
        .select("id,status,source_type,inviter_id,expires_at")
        .eq("ticket_instance_id", body.ticket.id)
        .eq("user_id", user.id)
        .maybeSingle<TicketInvitationRow>()
    : Promise.resolve({ data: null, error: null });
  const paymentHistoryLookup =
    body.plan === "one_month"
      ? admin
          .from("payment_transactions")
          .select("payment_kind")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .in("payment_kind", [
            "membership_initial",
            "membership_upgrade",
            "membership_renewal",
            "one_time",
          ])
          .returns<{ payment_kind: string }[]>()
      : Promise.resolve({ data: [], error: null });
  const [
    applicationResult,
    ticketInstanceResult,
    ticketInvitationResult,
    paymentHistoryResult,
  ] =
    await Promise.all([
      applicationLookup,
      ticketInstanceLookup,
      ticketInvitationLookup,
      paymentHistoryLookup,
    ]);

  if (meetingDateApplicationId !== null) {
    const { data: application, error: applicationError } = applicationResult;
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

  if (body?.ticket) {
    const { data: instance, error: instanceError } = ticketInstanceResult;

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

    const { data: invitation, error: invitationError } =
      ticketInvitationResult;
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
    if (paymentHistoryResult.error) {
      console.error(
        "Membership payment history lookup failed:",
        paymentHistoryResult.error.message,
      );
      return NextResponse.json(
        { error: "멤버십 결제 이력을 확인하지 못했습니다." },
        { status: 500 },
      );
    }

    const completedKinds = new Set(
      (paymentHistoryResult.data ?? []).map((row) => row.payment_kind),
    );
    const hasCompletedMembership = [
      "membership_initial",
      "membership_upgrade",
      "membership_renewal",
    ].some((kind) => completedKinds.has(kind));
    if (!hasCompletedMembership && completedKinds.has("one_time")) {
      creditAmount = oneTimeMembershipCreditAmount;
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
  const ticketPaymentPendingPromise = (async () => {
    if (!body.ticket || !ticketInstance) return { error: null };

    const instance = ticketInstance;
    const [existingWaitlistResult, acceptedInvitationResult] =
      await Promise.all([
        admin
          .from("ticket_participations")
          .select("id,status")
          .eq("user_id", user.id)
          .or(`ticket_instance_id.eq.${instance.id},ticket_id.eq.${instance.id}`)
          .limit(1)
          .maybeSingle<{ id: number | string; status: string }>(),
        admin
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
          .single<{ id: string }>(),
      ]);

    if (existingWaitlistResult.error) {
      console.error(
        "Membership waitlist lookup failed:",
        existingWaitlistResult.error.message,
      );
      return { error: "Failed to save the ticket application." };
    }
    if (acceptedInvitationResult.error) {
      console.error(
        "Membership invitation accept failed:",
        acceptedInvitationResult.error.message,
      );
      return { error: "Failed to accept the ticket invitation." };
    }

    const protectedStatuses = new Set([
      "approved",
      "feedback_done",
      "completed",
    ]);
    const existingWaitlist = existingWaitlistResult.data;
    if (
      existingWaitlist?.id != null &&
      protectedStatuses.has(existingWaitlist.status)
    ) {
      return { error: null };
    }

    const { error } = await admin.rpc("set_ticket_participation_status", {
      p_ticket_instance_id: instance.id,
      p_user_id: user.id,
      p_status: "payment_pending",
      p_ticket_snapshot: body.ticket,
      p_invitation_id: acceptedInvitationResult.data.id,
    });
    if (error) {
      console.error("Membership waitlist save failed:", error.message);
      return { error: "Failed to save the ticket application." };
    }

    return { error: null };
  })();

  const [intentLinkResult, profileUpdateResult, ticketPaymentPendingResult] =
    await Promise.all([
      admin
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
        .eq("user_id", user.id),
      admin
        .from("profiles")
        .update({
          membership_status: "pending",
          membership_plan: body.plan,
          membership_purchase_clicked_at: now,
          membership_updated_at: now,
        })
        .eq("user_id", user.id),
      ticketPaymentPendingPromise,
    ]);
  const intentLinkError = intentLinkResult.error;
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

  if (profileUpdateResult.error) {
    console.error(
      "Membership purchase click save failed:",
      profileUpdateResult.error.message,
    );
    return NextResponse.json(
      { error: "멤버십 신청 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  if (ticketPaymentPendingResult.error) {
    return NextResponse.json(
      { error: ticketPaymentPendingResult.error },
      { status: 500 },
    );
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
