import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdminMeetingEvent,
  AdminMeetingEventsData,
  AdminMeetingGroup,
  AdminMeetingProgram,
  MeetingEventVisibility,
} from "@/features/admin/meetingEventAdminTypes";

export const dynamic = "force-dynamic";

const eventSelect = [
  "id",
  "program_id",
  "title",
  "short_description",
  "event_date",
  "starts_at",
  "region",
  "visibility",
  "application_opens_at",
  "application_closes_at",
  "capacity",
  "confirmed_application_count",
  "price_amount",
  "currency",
  "created_at",
  "updated_at",
].join(",");

const visibilities = new Set<MeetingEventVisibility>([
  "draft",
  "test_only",
  "public",
  "closed",
  "archived",
]);

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadData(): Promise<AdminMeetingEventsData> {
  const admin = createAdminClient();
  const [programResult, eventResult, groupResult, applicationResult] =
    await Promise.all([
      admin
        .from("ticket_templates")
        .select("id,title")
        .eq("template_kind", "experience")
        .order("title")
        .returns<AdminMeetingProgram[]>(),
      admin
        .from("meeting_events")
        .select(eventSelect)
        .order("event_date", { ascending: true })
        .order("starts_at", { ascending: true })
        .returns<AdminMeetingEvent[]>(),
      admin
        .from("meeting_groups")
        .select("id,event_id,code,title,capacity,status,operation_note")
        .order("code")
        .returns<Array<Omit<AdminMeetingGroup, "assigned_count">>>(),
      admin
        .from("meeting_date_applications")
        .select("assigned_group_id")
        .not("assigned_group_id", "is", null)
        .returns<Array<{ assigned_group_id: string }>>(),
    ]);
  if (programResult.error) throw programResult.error;
  if (eventResult.error) throw eventResult.error;
  if (groupResult.error) throw groupResult.error;
  if (applicationResult.error) throw applicationResult.error;

  const counts = new Map<string, number>();
  for (const row of applicationResult.data ?? []) {
    counts.set(
      row.assigned_group_id,
      (counts.get(row.assigned_group_id) ?? 0) + 1,
    );
  }

  return {
    programs: programResult.data ?? [],
    events: eventResult.data ?? [],
    groups: (groupResult.data ?? []).map((group) => ({
      ...group,
      assigned_count: counts.get(group.id) ?? 0,
    })),
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return NextResponse.json(await loadData());
  } catch (error) {
    console.error("Admin meeting events load failed:", error);
    return NextResponse.json(
      { error: "행사 정보를 불러오지 못했습니다. DB 마이그레이션을 확인해주세요." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = text(body?.action);

  try {
    const admin = createAdminClient();
    if (action === "create_event") {
      const programId = text(body?.programId);
      const eventDate = text(body?.eventDate);
      const startsAt = text(body?.startsAt);
      if (!programId || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !startsAt) {
        return NextResponse.json({ error: "프로그램, 날짜, 시간을 입력해주세요." }, { status: 400 });
      }
      const { data: program, error: programError } = await admin
        .from("ticket_templates")
        .select("id,title,short_description,detail_summary,detail_activities,detail_flow,detail_good_for,detail_notice,course_steps,mood_tags,activity_type,default_region")
        .eq("id", programId)
        .single();
      if (programError) throw programError;

      const { error } = await admin.from("meeting_events").insert({
        program_id: program.id,
        title: text(body?.title) || program.title,
        short_description: program.short_description,
        event_date: eventDate,
        starts_at: startsAt,
        region: text(body?.region) || program.default_region || "서울",
        capacity: Number(body?.capacity) > 0 ? Number(body?.capacity) : 30,
        visibility: "draft",
        detail_snapshot: {
          detailSummary: program.detail_summary,
          detailActivities: program.detail_activities,
          detailFlow: program.detail_flow,
          detailGoodFor: program.detail_good_for,
          detailNotice: program.detail_notice,
          courseSteps: program.course_steps,
          moodTags: program.mood_tags,
          activityType: program.activity_type,
        },
      });
      if (error) throw error;
    } else if (action === "create_group") {
      const eventId = text(body?.eventId);
      const code = text(body?.code);
      if (!eventId || !code) {
        return NextResponse.json({ error: "행사와 그룹 코드를 입력해주세요." }, { status: 400 });
      }
      const { data: event, error: eventError } = await admin
        .from("meeting_events")
        .select("id,program_id,title,event_date,starts_at,region")
        .eq("id", eventId)
        .single<{
          id: string;
          program_id: string;
          title: string;
          event_date: string;
          starts_at: string;
          region: string;
        }>();
      if (eventError) throw eventError;
      const groupTitle = text(body?.title) || `${code} 그룹`;
      const groupCapacity = Number(body?.capacity) > 0 ? Number(body?.capacity) : 6;
      const { data: instance, error: instanceError } = await admin
        .from("ticket_instances")
        .insert({
          template_id: event.program_id,
          title: event.title,
          event_date: event.event_date,
          event_time: event.starts_at,
          region: event.region,
          operation_code: code,
          operation_note: groupTitle,
          visibility: "draft",
          minimum_participant_count: 2,
          max_participant_count: groupCapacity,
        })
        .select("id")
        .single<{ id: string }>();
      if (instanceError) throw instanceError;

      const { error } = await admin.from("meeting_groups").insert({
        event_id: eventId,
        code,
        title: groupTitle,
        capacity: groupCapacity,
        legacy_ticket_instance_id: instance.id,
      });
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }
    return NextResponse.json(await loadData());
  } catch (error) {
    console.error("Admin meeting event create failed:", error);
    return NextResponse.json({ error: "행사 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = text(body?.eventId);
  const visibility = text(body?.visibility) as MeetingEventVisibility;
  if (!eventId || !visibilities.has(visibility)) {
    return NextResponse.json({ error: "행사 공개 상태가 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const { error } = await createAdminClient()
      .from("meeting_events")
      .update({ visibility, updated_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) throw error;
    return NextResponse.json(await loadData());
  } catch (error) {
    console.error("Admin meeting event update failed:", error);
    return NextResponse.json({ error: "행사 공개 상태를 저장하지 못했습니다." }, { status: 500 });
  }
}
