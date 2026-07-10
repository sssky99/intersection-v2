import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import {
  type AdminArrivalStatus,
  isWaitlistStatus,
  type AdminWaitlistData,
  type AdminWaitlistRow,
  type WaitlistTicketInstance,
  type WaitlistTicketTemplate,
} from "@/features/admin/waitlistAdminTypes";
import type { GatheringTicket } from "@/types/ticket";
import {
  meetingDateDepositStatusLabels,
  type MeetingDateDepositStatus,
} from "@/lib/meetingDateApplications";

export const dynamic = "force-dynamic";

type WaitlistDbRow = {
  id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string;
  arrival_status: AdminArrivalStatus | null;
  arrival_status_updated_at: string | null;
  admin_note: string | null;
  ticket_snapshot: GatheringTicket | null;
  created_at: string | null;
  updated_at: string | null;
};

type DateApplicationDbRow = {
  id: number | string;
  user_id: string;
  meeting_date: string;
  meeting_time: string;
  region: string;
  status: string;
  deposit_amount: number;
  deposit_status: MeetingDateDepositStatus;
  assigned_ticket_instance_id: string | null;
  ticket_participation_id: number | string | null;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const profileSelect = [
  "user_id",
  "name",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "public_intro_model",
  "created_at",
  "profile_completed",
  "questions_completed",
  "membership_status",
  "membership_plan",
  "membership_start_date",
  "membership_end_date",
  "membership_purchase_clicked_at",
  "membership_updated_at",
].join(",");

const instanceSelect =
  "id,template_id,title,event_date,event_time,region,operation_code";

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json(
    { error: "관리자 인증이 필요합니다." },
    { status: 401 },
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMeetingDateDepositStatus(
  value: unknown,
): value is MeetingDateDepositStatus {
  return (
    typeof value === "string" && value in meetingDateDepositStatusLabels
  );
}

async function loadWaitlistData(): Promise<AdminWaitlistData> {
  const supabase = createAdminClient();

  const [waitlistResult, dateApplicationsResult] = await Promise.all([
    supabase
      .from("ticket_participations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("meeting_date_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (waitlistResult.error) throw waitlistResult.error;
  if (
    dateApplicationsResult.error &&
    dateApplicationsResult.error.code !== "PGRST205"
  ) {
    throw dateApplicationsResult.error;
  }

  const waitlistRows = (waitlistResult.data ?? []) as WaitlistDbRow[];
  const dateApplicationRows = (dateApplicationsResult.data ?? []) as DateApplicationDbRow[];
  const userIds = uniqueText([
    ...waitlistRows.map((row) => row.user_id),
    ...dateApplicationRows.map((row) => row.user_id),
  ]);
  const rowTemplateIds = uniqueText(
    waitlistRows.map((row) => row.ticket_template_id),
  );
  const rowInstanceIds = uniqueText(
    [
      ...waitlistRows.map((row) => row.ticket_instance_id),
      ...dateApplicationRows.map((row) => row.assigned_ticket_instance_id),
    ],
  );

  let profiles: AdminProfile[] = [];
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect)
      .in("user_id", userIds)
      .order("name");
    if (error) throw error;
    profiles = ((data ?? []) as unknown as AdminProfile[]).map(
      normalizeAdminProfile,
    );
  }

  let seedInstances: WaitlistTicketInstance[] = [];
  if (rowInstanceIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .in("id", rowInstanceIds);
    if (error) throw error;
    seedInstances = (data ?? []) as WaitlistTicketInstance[];
  }

  const templateIds = uniqueText([
    ...rowTemplateIds,
    ...seedInstances.map((instance) => instance.template_id),
  ]);

  let templates: WaitlistTicketTemplate[] = [];
  if (templateIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_templates")
      .select("id,title")
      .in("id", templateIds)
      .order("title");
    if (error) throw error;
    templates = (data ?? []) as WaitlistTicketTemplate[];
  }

  let templateInstances: WaitlistTicketInstance[] = [];
  if (templateIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .in("template_id", templateIds)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("event_time", { ascending: true, nullsFirst: false });
    if (error) throw error;
    templateInstances = (data ?? []) as WaitlistTicketInstance[];
  }

  const applicationDates = uniqueText(
    dateApplicationRows.map((row) => row.meeting_date),
  );
  let dateInstances: WaitlistTicketInstance[] = [];
  if (applicationDates.length > 0) {
    const { data, error } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .in("event_date", applicationDates)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("event_time", { ascending: true, nullsFirst: false });
    if (error) throw error;
    dateInstances = (data ?? []) as WaitlistTicketInstance[];
  }

  const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const instances = sortInstances(
    dedupeInstances([...seedInstances, ...templateInstances, ...dateInstances]),
  );
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));

  const waitlist = waitlistRows.map(
    (row): AdminWaitlistRow => {
      const instance = row.ticket_instance_id
        ? instanceMap.get(row.ticket_instance_id) ?? null
        : null;
      const templateId = row.ticket_template_id ?? instance?.template_id ?? null;

      return {
        ...row,
        source: "ticket_participation",
        source_id: row.id,
        status: isWaitlistStatus(row.status) ? row.status : "waitlisted",
        deposit_amount: null,
        deposit_status: null,
        profile: profilesMap.get(row.user_id) ?? null,
        ticket_template: templateId ? templateMap.get(templateId) ?? null : null,
        ticket_instance: instance,
      };
    },
  );

  const dateApplications = dateApplicationRows.map(
    (row): AdminWaitlistRow => {
      const instance = row.assigned_ticket_instance_id
        ? instanceMap.get(row.assigned_ticket_instance_id) ?? null
        : null;
      const templateId = instance?.template_id ?? null;

      return {
        id: `date:${row.id}`,
        source: "date_application",
        source_id: row.id,
        user_id: row.user_id,
        ticket_id: `date:${row.meeting_date}`,
        ticket_template_id: templateId,
        ticket_instance_id: row.assigned_ticket_instance_id,
        meeting_date: row.meeting_date,
        status: isWaitlistStatus(row.status) ? row.status : "waitlisted",
        arrival_status: null,
        arrival_status_updated_at: null,
        admin_note: row.admin_note,
        ticket_snapshot: null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deposit_amount: row.deposit_amount,
        deposit_status: row.deposit_status,
        profile: profilesMap.get(row.user_id) ?? null,
        ticket_template: templateId ? templateMap.get(templateId) ?? null : null,
        ticket_instance: instance,
      };
    },
  );

  return {
    waitlist: [...dateApplications, ...waitlist].sort((left, right) =>
      (right.created_at ?? "").localeCompare(left.created_at ?? ""),
    ),
    templates,
    instances,
  };
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function dedupeInstances(instances: WaitlistTicketInstance[]) {
  return Array.from(
    new Map(instances.map((instance) => [instance.id, instance])).values(),
  );
}

function sortInstances(instances: WaitlistTicketInstance[]) {
  return [...instances].sort((a, b) => {
    const dateCompare = (a.event_date ?? "").localeCompare(b.event_date ?? "");
    if (dateCompare !== 0) return dateCompare;

    const timeCompare = (a.event_time ?? "").localeCompare(b.event_time ?? "");
    if (timeCompare !== 0) return timeCompare;

    return a.title.localeCompare(b.title, "ko");
  });
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    return NextResponse.json(await loadWaitlistData());
  } catch (error) {
    console.error("Admin waitlist load failed:", error);
    return NextResponse.json(
      { error: "대기열 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = body?.id;
  const status = body?.status;
  const adminNote = body?.adminNote;
  const depositStatus = body?.depositStatus;
  const ticketInstanceId =
    body && "ticketInstanceId" in body ? body.ticketInstanceId : undefined;

  if (typeof id !== "string" && typeof id !== "number") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (status !== undefined && !isWaitlistStatus(status)) {
    return NextResponse.json(
      { error: "대기열 상태가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (
    depositStatus !== undefined &&
    !isMeetingDateDepositStatus(depositStatus)
  ) {
    return NextResponse.json(
      { error: "참여 보증금 상태가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (
    ticketInstanceId !== undefined &&
    ticketInstanceId !== null &&
    typeof ticketInstanceId !== "string"
  ) {
    return NextResponse.json(
      { error: "세부 티켓 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const dateApplicationId =
      typeof id === "string" && /^date:\d+$/.test(id)
        ? Number(id.slice("date:".length))
        : null;

    if (dateApplicationId !== null) {
      const { data: current, error: currentError } = await supabase
        .from("meeting_date_applications")
        .select(
          "id,user_id,meeting_date,status,deposit_status,assigned_ticket_instance_id,ticket_participation_id",
        )
        .eq("id", dateApplicationId)
        .single<{
          id: number | string;
          user_id: string;
          meeting_date: string;
          status: string;
          deposit_status: MeetingDateDepositStatus;
          assigned_ticket_instance_id: string | null;
          ticket_participation_id: number | string | null;
        }>();
      if (currentError) throw currentError;

      let nextInstanceId = current.assigned_ticket_instance_id;
      if (ticketInstanceId !== undefined) {
        const instanceId = text(ticketInstanceId);
        if (instanceId) {
          const { data: instance, error: instanceError } = await supabase
            .from("ticket_instances")
            .select("id,event_date")
            .eq("id", instanceId)
            .single<{ id: string; event_date: string | null }>();
          if (instanceError) throw instanceError;
          if (instance.event_date !== current.meeting_date) {
            return NextResponse.json(
              { error: "신청 날짜와 같은 날짜의 티켓만 배정할 수 있습니다." },
              { status: 400 },
            );
          }
          nextInstanceId = instance.id;
        } else {
          nextInstanceId = null;
        }
      }

      if (
        current.ticket_participation_id !== null &&
        nextInstanceId !== current.assigned_ticket_instance_id
      ) {
        return NextResponse.json(
          { error: "참여 확정된 신청은 세부 티켓을 다시 배정할 수 없습니다." },
          { status: 409 },
        );
      }

      if (status === "approved" && !nextInstanceId) {
        return NextResponse.json(
          { error: "참여 확정 전에 세부 티켓을 배정해주세요." },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const payload: Record<string, unknown> = { updated_at: now };
      if (ticketInstanceId !== undefined) {
        payload.assigned_ticket_instance_id = nextInstanceId;
        payload.assigned_at = nextInstanceId ? now : null;
      }
      if (adminNote !== undefined) {
        payload.admin_note =
          typeof adminNote === "string" && adminNote.trim()
            ? adminNote.trim()
            : null;
      }
      if (status !== undefined) {
        payload.status = status;
        if (status === "waitlisted") {
          payload.deposit_status = "confirmed";
          payload.deposit_confirmed_at = now;
        }
        if (["not_selected", "completed", "feedback_done"].includes(status)) {
          payload.deposit_status = "refund_pending";
        }
        if (status === "cancelled") payload.cancelled_at = now;
      }
      if (depositStatus !== undefined) {
        payload.deposit_status = depositStatus;
        if (depositStatus === "confirmed") payload.deposit_confirmed_at = now;
        if (depositStatus === "refunded") payload.refund_completed_at = now;
      }

      if (status !== undefined && nextInstanceId) {
        const shouldSyncParticipation =
          status === "approved" || current.ticket_participation_id !== null;
        if (shouldSyncParticipation) {
          const { data: participationId, error: participationError } =
            await supabase.rpc("set_ticket_participation_status", {
              p_ticket_instance_id: nextInstanceId,
              p_user_id: current.user_id,
              p_status: status,
            });
          if (participationError) throw participationError;
          payload.ticket_participation_id = participationId;
          if (status === "approved") payload.confirmed_at = now;
        }
      }

      const { error: updateError } = await supabase
        .from("meeting_date_applications")
        .update(payload)
        .eq("id", dateApplicationId);
      if (updateError) throw updateError;

      return NextResponse.json(await loadWaitlistData());
    }

    const { data: currentParticipation, error: currentParticipationError } =
      await supabase
        .from("ticket_participations")
        .select("user_id,ticket_instance_id")
        .eq("id", id)
        .single<{ user_id: string; ticket_instance_id: string | null }>();
    if (currentParticipationError) throw currentParticipationError;
    let nextTemplateId: string | null | undefined;
    let nextInstanceId: string | null | undefined;

    if (ticketInstanceId !== undefined) {
      const instanceId = text(ticketInstanceId);
      if (instanceId) {
        const { data: instance, error } = await supabase
          .from("ticket_instances")
          .select("id,template_id")
          .eq("id", instanceId)
          .single();
        if (error) throw error;
        nextInstanceId = instance.id;
        nextTemplateId = instance.template_id;
      } else {
        nextInstanceId = null;
        nextTemplateId = null;
      }
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const effectiveInstanceId =
      nextInstanceId !== undefined
        ? nextInstanceId
        : currentParticipation.ticket_instance_id;
    if (status !== undefined && !effectiveInstanceId) payload.status = status;
    if (adminNote !== undefined) {
      payload.admin_note =
        typeof adminNote === "string" && adminNote.trim()
          ? adminNote.trim()
          : null;
    }
    if (nextInstanceId !== undefined) payload.ticket_instance_id = nextInstanceId;
    if (nextTemplateId !== undefined) payload.ticket_template_id = nextTemplateId;

    const { error } = await supabase
      .from("ticket_participations")
      .update(payload)
      .eq("id", id);
    if (error) throw error;

    if (status !== undefined && effectiveInstanceId) {
      const { error: statusError } = await supabase.rpc(
        "set_ticket_participation_status",
        {
          p_ticket_instance_id: effectiveInstanceId,
          p_user_id: currentParticipation.user_id,
          p_status: status,
        },
      );
      if (statusError) throw statusError;
    }

    return NextResponse.json(await loadWaitlistData());
  } catch (error) {
    console.error("Admin waitlist update failed:", { id, error });
    return NextResponse.json(
      { error: "대기열 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
