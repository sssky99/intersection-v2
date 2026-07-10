import { NextResponse } from "next/server";
import {
  MEETING_DATE_DEPOSIT_AMOUNT,
  MEETING_DATE_REGION,
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
};

type DateApplicationRow = {
  id: number | string;
  meeting_date: string;
  meeting_time: string;
  region: string;
  status: MeetingDateApplication["status"];
  deposit_amount: number;
  deposit_status: MeetingDateApplication["depositStatus"];
  assigned_ticket_instance_id: string | null;
  created_at: string | null;
};

const activeStatuses = [
  "payment_pending",
  "waitlisted",
  "on_hold",
  "approved",
] as const;

function toApplication(row: DateApplicationRow): MeetingDateApplication {
  return {
    id: row.id,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time.slice(0, 5),
    region: row.region,
    status: row.status,
    depositAmount: row.deposit_amount,
    depositStatus: row.deposit_status,
    assignedTicketInstanceId: row.assigned_ticket_instance_id,
    createdAt: row.created_at,
  };
}

function requestedDates(value: unknown) {
  if (!Array.isArray(value)) return [];

  const today = todayInKst();
  const selectableDates = new Set(
    meetingDateApplicationDates(today).filter((date) => date > today),
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
        "id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at",
      )
      .eq("user_id", user.id)
      .gte("meeting_date", todayInKst())
      .in("status", [...activeStatuses])
      .order("meeting_date", { ascending: true })
      .returns<DateApplicationRow[]>();

    if (error) throw error;

    return NextResponse.json({
      applications: (data ?? []).map(toApplication),
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

  const body = (await request.json().catch(() => ({}))) as DateApplicationRequest;
  const dates = requestedDates(body.dates);
  if (dates.length === 0 || dates.length > 12) {
    return NextResponse.json(
      { error: "신청할 금요일 또는 토요일을 선택해주세요." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  try {
    const { data: existingRows, error: existingError } = await admin
      .from("meeting_date_applications")
      .select(
        "id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at",
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
      .filter((date) => !protectedRows.some((row) => row.meeting_date === date))
      .map((date) => {
        const schedule = meetingDateSchedule(date)!;
        return {
          application_group_id: groupId,
          user_id: user.id,
          meeting_date: date,
          meeting_time: schedule.time,
          region: MEETING_DATE_REGION,
          status: "payment_pending",
          deposit_amount: MEETING_DATE_DEPOSIT_AMOUNT,
          deposit_status: "payment_pending",
          deposit_requested_at: now,
          deposit_confirmed_at: null,
          refund_completed_at: null,
          assigned_ticket_instance_id: null,
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
          "id,meeting_date,meeting_time,region,status,deposit_amount,deposit_status,assigned_ticket_instance_id,created_at",
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

    return NextResponse.json({
      applications: rows.map(toApplication),
      duplicateDates: protectedRows.map((row) => row.meeting_date),
      totalDepositAmount: dates.length * MEETING_DATE_DEPOSIT_AMOUNT,
    });
  } catch (error) {
    console.error("Meeting date applications save failed:", error);
    return NextResponse.json(
      { error: "날짜 신청을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
