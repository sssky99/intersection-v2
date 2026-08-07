import { NextResponse } from "next/server";
import { hasCompletedPreferenceProfile } from "@/data/preferenceQuestions";
import {
  MEETING_DATE_DEPOSIT_AMOUNT,
  MEETING_DATE_REGION,
  isMeetingDateClosed,
  meetingDateApplicationDates,
  meetingDateSchedule,
  type MeetingDateApplication,
} from "@/lib/meetingDateApplications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { todayInKst } from "@/lib/ticketDate";

export const dynamic = "force-dynamic";

type DateApplicationRequest = {
  dates?: unknown;
  openPayment?: unknown;
  waitlist?: unknown;
  ticketInstanceId?: unknown;
};

type SelectedTicketInstance = {
  id: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  visibility: string;
};

type DateApplicationRow = {
  id: number | string;
  application_group_id: string;
  meeting_date: string;
  meeting_time: string;
  region: string;
  status: MeetingDateApplication["status"];
  deposit_amount: number;
  deposit_status: MeetingDateApplication["depositStatus"];
  assigned_ticket_instance_id: string | null;
  created_at: string | null;
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
  };
}

function requestedDates(value: unknown) {
  if (!Array.isArray(value)) return [];

  const today = todayInKst();
  const selectableDates = new Set(
    meetingDateApplicationDates(today).filter((date) => date >= today),
  );

  return Array.from(
    new Set(
      value.filter(
        (date): date is string =>
          typeof date === "string" && selectableDates.has(date),
      ),
    ),
  ).sort();
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
  const user = await authenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await createAdminClient()
      .from("meeting_date_applications")
      .select(
        "id,application_group_id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at",
      )
      .eq("user_id", user.id)
      .gte("meeting_date", todayInKst())
      .in("status", [...activeStatuses])
      .order("meeting_date", { ascending: true })
      .returns<DateApplicationRow[]>();

    if (error) throw error;

    const rows = data ?? [];
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

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: applicantProfile, error: applicantProfileError } = await admin
    .from("profiles")
    .select(
      "profile_completed,questions_completed,profile_experience_version,is_test_participant",
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      profile_completed: boolean | null;
      questions_completed: boolean | null;
      profile_experience_version: string | null;
      is_test_participant: boolean | null;
    }>();
  if (applicantProfileError) {
    return NextResponse.json(
      { error: "프로필 정보를 확인하지 못했어요." },
      { status: 500 },
    );
  }
  if (!applicantProfile || !hasCompletedPreferenceProfile(applicantProfile)) {
    return NextResponse.json(
      { error: "간단한 정보를 입력하고 프로필을 완성해주세요." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as DateApplicationRequest;
  const dates = requestedDates(body.dates);
  const openPayment = body.openPayment === true;
  const joinWaitlist = body.waitlist === true;
  const ticketInstanceId =
    typeof body.ticketInstanceId === "string" && body.ticketInstanceId.trim()
      ? body.ticketInstanceId.trim()
      : null;
  if (dates.length !== 1) {
    return NextResponse.json(
      { error: "신청할 날짜를 하나만 선택해주세요." },
      { status: 400 },
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
      .select("id,event_date,event_time,region,visibility")
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

  const closed = selectedTicket ? false : isMeetingDateClosed(dates[0]);
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
    const { data: existingRows, error: existingError } = await admin
      .from("meeting_date_applications")
      .select(
        "id,application_group_id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at",
      )
      .eq("user_id", user.id)
      .in("meeting_date", dates)
      .returns<DateApplicationRow[]>();
    if (existingError) throw existingError;

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
        return (
          existing.status === "payment_pending" &&
          existing.deposit_status === "payment_pending"
        );
      })
      .map((date) => {
        const schedule = meetingDateSchedule(date)!;
        return {
          application_group_id: groupId,
          user_id: user.id,
          meeting_date: date,
          meeting_time: selectedTicket?.event_time?.slice(0, 5) ?? schedule.time,
          region: selectedTicket?.region ?? MEETING_DATE_REGION,
          status: joinWaitlist ? "waitlisted" : "payment_pending",
          deposit_amount: joinWaitlist ? 0 : MEETING_DATE_DEPOSIT_AMOUNT,
          deposit_status: "payment_pending",
          deposit_requested_at: joinWaitlist ? null : now,
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
      const { data, error } = await admin
        .from("meeting_date_applications")
        .upsert(rowsToSave, { onConflict: "user_id,meeting_date" })
        .select(
          "id,application_group_id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at",
        )
        .returns<DateApplicationRow[]>();
      if (error) throw error;
      savedRows = data ?? [];
    }

    const rows = dates
      .map(
        (date) =>
          savedRows.find((row) => row.meeting_date === date) ??
          existingByDate.get(date) ??
          null,
      )
      .filter((row): row is DateApplicationRow => Boolean(row));

    let paymentIntentCreated = false;
    if (openPayment && !joinWaitlist) {
      const application = rows[0];
      if (
        !application ||
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
      if (paymentIntentError) throw paymentIntentError;
      paymentIntentCreated =
        Array.isArray(paymentIntent) && paymentIntent.length === 1;
      if (!paymentIntentCreated) {
        throw new Error("Meeting date payment intent was not created.");
      }
    }

    return NextResponse.json({
      applications: rows.map((row) => toApplication(row)),
      duplicateDates: protectedRows.map((row) => row.meeting_date),
      totalDepositAmount: joinWaitlist
        ? 0
        : dates.length * MEETING_DATE_DEPOSIT_AMOUNT,
      paymentIntentCreated,
    });
  } catch (error) {
    console.error("Meeting date applications save failed:", error);
    return NextResponse.json(
      { error: "날짜 신청을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
