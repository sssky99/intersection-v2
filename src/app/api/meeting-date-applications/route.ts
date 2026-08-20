import { NextRequest, NextResponse } from "next/server";
import { requestUserId } from "@/lib/adminUserView";
import {
  MEETING_DATE_REGION,
  MEETING_DATE_SINGLE_USE_AMOUNT,
  isMeetingDateClosed,
  meetingDateSchedule,
  requestedMeetingApplicationDates,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentMembershipAccess } from "@/features/membership/membershipTypes";
import {
  hasTicketStarted,
  isTicketApplicationClosed,
  todayInKst,
} from "@/lib/ticketDate";
import {
  membershipPlanAmounts,
  oneTimeMembershipCreditAmount,
} from "@/lib/membershipPlans";
import { membershipStoreUrls } from "@/lib/membershipStore";
import { oneTimeTicketStoreUrl } from "@/lib/paymentStore";

export const dynamic = "force-dynamic";

type DateApplicationRequest = {
  dates?: unknown;
  openPayment?: unknown;
  prepareCheckout?: unknown;
  waitlist?: unknown;
  ticketInstanceId?: unknown;
  eventId?: unknown;
  attribution?: unknown;
};

const landingExperimentId = "landing_ab_2026_08";
const landingExperimentCookie = "landing_ab_v1";
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

type SelectedTicketInstance = {
  id: string;
  template_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  visibility: string;
};

type SelectedMeetingEvent = {
  id: string;
  program_id: string;
  title: string;
  event_date: string;
  starts_at: string;
  region: string;
  visibility: string;
  application_closes_at: string | null;
};

type SelectedTicketInvitation = {
  id: string;
  source_type: "service" | "admin" | "friend";
  inviter_id: string | null;
};

type DateApplicationRow = {
  id: number | string;
  application_group_id: string;
  meeting_date: string;
  meeting_time: string;
  region: string;
  status: MeetingDateApplication["status"];
  deposit_amount: number | null;
  deposit_status: MeetingDateApplication["depositStatus"];
  assigned_ticket_instance_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AssignedTicketSchedule = {
  id: string;
  event_date: string | null;
  event_time: string | null;
  ticket_reveal_override_at: string | null;
};

const activeStatuses = [
  "payment_pending",
  "waitlisted",
  "on_hold",
  "approved",
] as const;

function ticketRevealsAt(schedule: AssignedTicketSchedule | undefined) {
  if (!schedule?.event_date) return null;
  const time = schedule.event_time?.slice(0, 5) || "00:00";
  const startAt = new Date(`${schedule.event_date}T${time}:00+09:00`);
  if (!Number.isFinite(startAt.getTime())) return null;
  const scheduledRevealAt = new Date(
    startAt.getTime() - 24 * 60 * 60 * 1000,
  );
  if (!schedule.ticket_reveal_override_at) {
    return scheduledRevealAt.toISOString();
  }

  const override = new Date(schedule.ticket_reveal_override_at);
  if (!Number.isFinite(override.getTime()) || override > scheduledRevealAt) {
    return scheduledRevealAt.toISOString();
  }
  return override.toISOString();
}

function toApplication(
  row: DateApplicationRow,
  schedule?: AssignedTicketSchedule,
): MeetingDateApplication {
  return {
    id: row.id,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time.slice(0, 5),
    region: row.region,
    status: row.status,
    depositAmount: row.deposit_amount,
    depositStatus: row.deposit_status,
    assignedTicketInstanceId: row.assigned_ticket_instance_id,
    ticketRevealsAt: ticketRevealsAt(schedule),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function authenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function isMissingApplicationsTable(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "PGRST205",
  );
}

export async function GET() {
  const requestUser = await requestUserId({ allowAdminView: true });
  if (!requestUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await createAdminClient()
      .from("meeting_date_applications")
      .select(
        "id,application_group_id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at,updated_at",
      )
      .eq("user_id", requestUser.userId)
      .gte("meeting_date", todayInKst())
      .in("status", [...activeStatuses])
      .order("meeting_date", { ascending: true })
      .returns<DateApplicationRow[]>();

    if (error) throw error;

    const rows = (data ?? []).filter(
      (row) => !hasTicketStarted(row.meeting_date, row.meeting_time),
    );
    const assignedInstanceIds = Array.from(
      new Set(
        rows
          .map((row) => row.assigned_ticket_instance_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    let scheduleMap = new Map<string, AssignedTicketSchedule>();

    if (assignedInstanceIds.length > 0) {
      const { data: schedules, error: scheduleError } =
        await createAdminClient()
          .from("ticket_instances")
          .select("id,event_date,event_time,ticket_reveal_override_at")
          .in("id", assignedInstanceIds)
          .returns<AssignedTicketSchedule[]>();
      if (scheduleError) throw scheduleError;
      scheduleMap = new Map(
        (schedules ?? []).map((schedule) => [schedule.id, schedule]),
      );
    }

    return NextResponse.json({
      applications: rows.map((row) =>
        toApplication(
          row,
          row.assigned_ticket_instance_id
            ? scheduleMap.get(row.assigned_ticket_instance_id)
            : undefined,
        ),
      ),
    });
  } catch (error) {
    if (isMissingApplicationsTable(error)) {
      return NextResponse.json({ applications: [] });
    }
    console.error("Meeting date applications load failed:", error);
    return NextResponse.json(
      { error: "날짜 신청 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: applicantProfile, error: applicantProfileError } = await admin
    .from("profiles")
    .select(
      "is_test_participant,membership_status,membership_start_date,membership_end_date",
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      is_test_participant: boolean | null;
      membership_status: string | null;
      membership_start_date: string | null;
      membership_end_date: string | null;
    }>();
  if (applicantProfileError) {
    return NextResponse.json(
      { error: "프로필 정보를 확인하지 못했어요." },
      { status: 500 },
    );
  }
  if (!applicantProfile) {
    return NextResponse.json(
      { error: "프로필 정보를 찾지 못했어요." },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as DateApplicationRequest;
  const openPayment = body.openPayment === true;
  const prepareCheckout = body.prepareCheckout === true;
  const joinWaitlist = body.waitlist === true;
  const membershipCovered = hasCurrentMembershipAccess({
    status: applicantProfile.membership_status,
    startDate: applicantProfile.membership_start_date,
    endDate: applicantProfile.membership_end_date,
  });
  const ticketInstanceId =
    typeof body.ticketInstanceId === "string" && body.ticketInstanceId.trim()
      ? body.ticketInstanceId.trim()
      : null;
  const requestedEventId =
    typeof body.eventId === "string" && body.eventId.trim()
      ? body.eventId.trim()
      : null;
  let selectedEvent: SelectedMeetingEvent | null = null;
  if (requestedEventId) {
    const allowedVisibilities =
      applicantProfile.is_test_participant === true
        ? ["public", "test_only"]
        : ["public"];
    const { data, error } = await admin
      .from("meeting_events")
      .select("id,program_id,title,event_date,starts_at,region,visibility,application_closes_at")
      .eq("id", requestedEventId)
      .in("visibility", allowedVisibilities)
      .maybeSingle<SelectedMeetingEvent>();
    if (error) {
      return NextResponse.json({ error: "선택한 행사를 확인하지 못했어요." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "선택한 행사를 찾지 못했어요." }, { status: 404 });
    }
    selectedEvent = data;
  }
  const dates = requestedMeetingApplicationDates(body.dates, todayInKst(), {
    ticketInstanceProvided: ticketInstanceId !== null || selectedEvent !== null,
    eventProvided: selectedEvent !== null,
  });
  if (dates.length !== 1) {
    return NextResponse.json(
      { error: "신청할 날짜를 하나만 선택해주세요." },
      { status: 400 },
    );
  }
  if (selectedEvent && selectedEvent.event_date !== dates[0]) {
    return NextResponse.json(
      { error: "선택한 행사와 날짜가 일치하지 않아요." },
      { status: 409 },
    );
  }
  let selectedTicket: SelectedTicketInstance | null = null;
  if (ticketInstanceId) {
    const allowedVisibilities =
      applicantProfile.is_test_participant === true
        ? ["public", "test_only"]
        : ["public"];
    const { data, error } = await admin
      .from("ticket_instances")
      .select("id,template_id,title,event_date,event_time,region,visibility")
      .eq("id", ticketInstanceId)
      .in("visibility", allowedVisibilities)
      .maybeSingle<SelectedTicketInstance>();
    if (error) {
      return NextResponse.json(
        { error: "선택한 티켓을 확인하지 못했어요." },
        { status: 500 },
      );
    }
    if (!data || data.event_date !== dates[0]) {
      return NextResponse.json(
        { error: "선택한 티켓과 날짜가 일치하지 않아요." },
        { status: 409 },
      );
    }
    selectedTicket = data;
  }

  const applicationTime =
    selectedEvent?.starts_at ??
    selectedTicket?.event_time ??
    meetingDateSchedule(dates[0])?.time;
  if (
    isTicketApplicationClosed(
      dates[0],
      applicationTime,
      selectedEvent?.application_closes_at,
    )
  ) {
    return NextResponse.json(
      { error: "신청이 마감된 행사예요." },
      { status: 409 },
    );
  }

  const closed = isMeetingDateClosed(dates[0]);
  if (closed && !joinWaitlist) {
    return NextResponse.json(
      { error: "마감된 날짜예요. 빈 자리 대기를 신청해주세요." },
      { status: 409 },
    );
  }
  if (!closed && joinWaitlist) {
    return NextResponse.json(
      { error: "현재 마감된 날짜가 아니에요." },
      { status: 409 },
    );
  }

  try {
    const existingRowsLookup = admin
      .from("meeting_date_applications")
      .select(
        "id,application_group_id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .eq(selectedEvent ? "event_id" : "meeting_date", selectedEvent?.id ?? dates[0])
      .returns<DateApplicationRow[]>();
    const paymentHistoryLookup = prepareCheckout && !membershipCovered
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
    const ticketInvitationLookup = (prepareCheckout || openPayment) && selectedTicket
      ? admin
          .from("ticket_invitations")
          .select("id,source_type,inviter_id")
          .eq("ticket_instance_id", selectedTicket.id)
          .eq("user_id", user.id)
          .maybeSingle<SelectedTicketInvitation>()
      : Promise.resolve({ data: null, error: null });
    const [existingRowsResult, paymentHistoryResult, ticketInvitationResult] =
      await Promise.all([
      existingRowsLookup,
      paymentHistoryLookup,
      ticketInvitationLookup,
    ]);
    const { data: existingRows, error: existingError } = existingRowsResult;
    if (existingError) throw existingError;
    if (ticketInvitationResult.error) throw ticketInvitationResult.error;

    const existingByDate = new Map(
      (existingRows ?? []).map((row) => [row.meeting_date, row]),
    );
    const protectedRows = (existingRows ?? []).filter((row) =>
      [
        "payment_pending",
        "waitlisted",
        "on_hold",
        "approved",
        "feedback_done",
        "completed",
      ].includes(row.status),
    );
    const groupId = crypto.randomUUID();
    const now = new Date().toISOString();
    const rowsToSave = dates
      .filter((date) => {
        const existing = existingByDate.get(date);
        if (!existing) return true;
        return existing.status === "payment_pending";
      })
      .map((date) => {
        const schedule = meetingDateSchedule(date)!;
        return {
          application_group_id: groupId,
          event_id: selectedEvent?.id ?? null,
          user_id: user.id,
          meeting_date: date,
          meeting_time:
            selectedEvent?.starts_at?.slice(0, 5) ??
            selectedTicket?.event_time?.slice(0, 5) ??
            schedule.time,
          region: selectedEvent?.region ?? selectedTicket?.region ?? MEETING_DATE_REGION,
          status:
            joinWaitlist || membershipCovered ? "waitlisted" : "payment_pending",
          deposit_amount: membershipCovered
            ? 0
            : openPayment
              ? MEETING_DATE_SINGLE_USE_AMOUNT
              : null,
          deposit_status: openPayment ? "payment_pending" : null,
          deposit_requested_at: openPayment ? now : null,
          deposit_confirmed_at: null,
          refund_completed_at: null,
          assigned_ticket_instance_id: selectedTicket?.id ?? null,
          ticket_participation_id: null,
          assigned_at: null,
          confirmed_at: null,
          cancelled_at: null,
          updated_at: now,
        };
      });

    let savedRows: DateApplicationRow[] = [];
    if (rowsToSave.length > 0) {
      const existingEventApplication = selectedEvent
        ? (existingRows ?? []).find((row) => row.status === "payment_pending")
        : null;
      const saveQuery =
        selectedEvent && existingEventApplication
          ? admin
              .from("meeting_date_applications")
              .update(rowsToSave[0])
              .eq("id", existingEventApplication.id)
          : selectedEvent
            ? admin.from("meeting_date_applications").insert(rowsToSave)
            : admin
                .from("meeting_date_applications")
                .upsert(rowsToSave, { onConflict: "user_id,meeting_date" });
      const { data, error } = await saveQuery
        .select(
          "id,application_group_id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at,updated_at",
        )
        .returns<DateApplicationRow[]>();
      if (error) throw error;
      savedRows = data ?? [];
    }

    if (membershipCovered && selectedTicket) {
      const { data: participationId, error: participationError } =
        await admin.rpc("set_ticket_participation_status", {
          p_ticket_instance_id: selectedTicket.id,
          p_user_id: user.id,
          p_status: "waitlisted",
          p_ticket_snapshot: {
            id: selectedTicket.id,
            templateId: selectedTicket.template_id,
            title: selectedTicket.title,
            date: selectedTicket.event_date,
            time: selectedTicket.event_time,
            area: selectedTicket.region,
          },
          p_invitation_id: null,
        });
      if (participationError) throw participationError;

      if (participationId != null) {
        const { error: linkError } = await admin
          .from("meeting_date_applications")
          .update({ ticket_participation_id: participationId, updated_at: now })
          .eq("user_id", user.id)
          .in("meeting_date", dates);
        if (linkError) throw linkError;
      }
    }

    const rows = dates
      .map(
        (date) =>
          savedRows.find((row) => row.meeting_date === date) ??
          existingByDate.get(date) ??
          null,
      )
      .filter((row): row is DateApplicationRow => Boolean(row));

    if (openPayment && !joinWaitlist && !membershipCovered) {
      const application = rows[0];
      if (
        !application ||
        application.deposit_amount !== MEETING_DATE_SINGLE_USE_AMOUNT ||
        application.deposit_status !== "payment_pending" ||
        !["payment_pending", "waitlisted", "on_hold", "approved"].includes(
          application.status,
        )
      ) {
        return NextResponse.json(
          { error: "결제 대상을 확인할 수 없습니다." },
          { status: 409 },
        );
      }

      const applicationId =
        typeof application.id === "number"
          ? application.id
          : Number(application.id);
      if (!Number.isSafeInteger(applicationId)) {
        throw new Error("Invalid meeting date application id.");
      }

      const { data: paymentIntent, error: paymentIntentError } = await admin.rpc(
        "activate_meeting_date_payment_intent",
        {
          p_user_id: user.id,
          p_application_id: applicationId,
        },
      );
      if (
        paymentIntentError ||
        !Array.isArray(paymentIntent) ||
        paymentIntent.length !== 1
      ) {
        throw paymentIntentError ?? new Error("payment-intent-create-failed");
      }

      const intentId = paymentIntent[0]?.intent_id;
      if (intentId == null) {
        throw new Error("payment-intent-id-missing");
      }
      const { error: attributionError } = await admin
        .from("meeting_date_payment_intents")
        .update({
          acquisition_context: checkoutAttribution(body.attribution),
          updated_at: now,
        })
        .eq("id", intentId)
        .eq("user_id", user.id);
      if (attributionError) throw attributionError;

      return NextResponse.json({
        applications: rows.map((row) => toApplication(row)),
        duplicateDates: protectedRows.map((row) => row.meeting_date),
        totalDepositAmount: MEETING_DATE_SINGLE_USE_AMOUNT,
        paymentIntentCreated: true,
        membershipCovered: false,
        checkoutUrl: oneTimeTicketStoreUrl,
      });
    }

    if (prepareCheckout && !membershipCovered) {
      if (paymentHistoryResult.error) throw paymentHistoryResult.error;

      const completedKinds = new Set(
        (paymentHistoryResult.data ?? []).map((row) => row.payment_kind),
      );
      const hasCompletedMembership = [
        "membership_initial",
        "membership_upgrade",
        "membership_renewal",
      ].some((kind) => completedKinds.has(kind));
      const creditAmount =
        !hasCompletedMembership && completedKinds.has("one_time")
          ? oneTimeMembershipCreditAmount
          : 0;
      const expectedAmount = membershipPlanAmounts.one_month;
      const application = rows[0];
      if (!application) throw new Error("application-create-failed");
      const sellerReference = `mem_${crypto.randomUUID()}`;
      const variantCookie = request.cookies.get(landingExperimentCookie)?.value;
      const landingVariant =
        variantCookie === "a" || variantCookie === "b" ? variantCookie : null;
      const [paymentIntentResult, existingParticipationResult, invitationResult] =
        await Promise.all([
          admin.rpc("prepare_membership_checkout", {
            p_user_id: user.id,
            p_application_id: application.id,
            p_plan: "one_month",
            p_expected_amount: expectedAmount,
            p_credit_amount: creditAmount,
            p_seller_reference: sellerReference,
            p_experiment_id: landingVariant ? landingExperimentId : null,
            p_landing_variant: landingVariant,
            p_acquisition_context: checkoutAttribution(body.attribution),
          }),
          selectedTicket
            ? admin
                .from("ticket_participations")
                .select("id,status")
                .eq("user_id", user.id)
                .or(
                  `ticket_instance_id.eq.${selectedTicket.id},ticket_id.eq.${selectedTicket.id}`,
                )
                .limit(1)
                .maybeSingle<{ id: number | string; status: string }>()
            : Promise.resolve({ data: null, error: null }),
          selectedTicket
            ? admin
                .from("ticket_invitations")
                .upsert(
                  {
                    ticket_instance_id: selectedTicket.id,
                    user_id: user.id,
                    source_type: ticketInvitationResult.data?.source_type ?? "service",
                    inviter_id: ticketInvitationResult.data?.inviter_id ?? null,
                    status: "accepted",
                    responded_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "ticket_instance_id,user_id" },
                )
                .select("id")
                .single<{ id: string }>()
            : Promise.resolve({ data: null, error: null }),
        ]);
      const { data: paymentIntent, error: paymentIntentError } = paymentIntentResult;
      if (
        paymentIntentError ||
        !Array.isArray(paymentIntent) ||
        paymentIntent.length !== 1
      ) {
        throw paymentIntentError ?? new Error("payment-intent-create-failed");
      }
      if (existingParticipationResult.error) {
        throw existingParticipationResult.error;
      }
      if (invitationResult.error) throw invitationResult.error;

      const protectedParticipationStatuses = new Set([
        "approved",
        "feedback_done",
        "completed",
      ]);
      const participationUpdate =
        selectedTicket &&
        !protectedParticipationStatuses.has(
          existingParticipationResult.data?.status ?? "",
        )
          ? admin.rpc("set_ticket_participation_status", {
              p_ticket_instance_id: selectedTicket.id,
              p_user_id: user.id,
              p_status: "payment_pending",
              p_ticket_snapshot: {
                id: selectedTicket.id,
                templateId: selectedTicket.template_id,
                title: selectedTicket.title,
                date: selectedTicket.event_date,
                time: selectedTicket.event_time,
                area: selectedTicket.region,
              },
              p_invitation_id: invitationResult.data?.id ?? null,
            })
          : Promise.resolve({ data: null, error: null });

      const participationUpdateResult = await participationUpdate;
      if (participationUpdateResult.error) throw participationUpdateResult.error;

      return NextResponse.json({
        applications: rows.map((row) => toApplication(row)),
        duplicateDates: protectedRows.map((row) => row.meeting_date),
        totalDepositAmount: 0,
        paymentIntentCreated: true,
        membershipCovered: false,
        expectedAmount,
        creditAmount,
        payableAmount: expectedAmount - creditAmount,
        checkoutUrl: `${membershipStoreUrls.one_month}?ref=${encodeURIComponent(sellerReference)}`,
      });
    }

    return NextResponse.json({
      applications: rows.map((row) => toApplication(row)),
      duplicateDates: protectedRows.map((row) => row.meeting_date),
      totalDepositAmount: 0,
      paymentIntentCreated: false,
      membershipCovered,
    });
  } catch (error) {
    console.error("Meeting date applications save failed:", error);
    return NextResponse.json(
      { error: "날짜 신청을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
