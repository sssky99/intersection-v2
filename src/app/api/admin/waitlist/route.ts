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

const profileSelect = [
  "user_id",
  "name",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
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

async function loadWaitlistData(): Promise<AdminWaitlistData> {
  const supabase = createAdminClient();

  const { data: waitlistData, error: waitlistError } = await supabase
    .from("meeting_waitlist")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (waitlistError) throw waitlistError;

  const waitlistRows = (waitlistData ?? []) as WaitlistDbRow[];
  const userIds = uniqueText(waitlistRows.map((row) => row.user_id));
  const rowTemplateIds = uniqueText(
    waitlistRows.map((row) => row.ticket_template_id),
  );
  const rowInstanceIds = uniqueText(
    waitlistRows.map((row) => row.ticket_instance_id),
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

  const profilesMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const instances = sortInstances(dedupeInstances([...seedInstances, ...templateInstances]));
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
        status: isWaitlistStatus(row.status) ? row.status : "waitlisted",
        profile: profilesMap.get(row.user_id) ?? null,
        ticket_template: templateId ? templateMap.get(templateId) ?? null : null,
        ticket_instance: instance,
      };
    },
  );

  return { waitlist, templates, instances };
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
    if (status !== undefined) payload.status = status;
    if (adminNote !== undefined) {
      payload.admin_note =
        typeof adminNote === "string" && adminNote.trim()
          ? adminNote.trim()
          : null;
    }
    if (nextInstanceId !== undefined) payload.ticket_instance_id = nextInstanceId;
    if (nextTemplateId !== undefined) payload.ticket_template_id = nextTemplateId;

    const { error } = await supabase
      .from("meeting_waitlist")
      .update(payload)
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json(await loadWaitlistData());
  } catch (error) {
    console.error("Admin waitlist update failed:", { id, error });
    return NextResponse.json(
      { error: "대기열 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
