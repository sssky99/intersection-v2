import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMeetingEventSnapshotStageTitle } from "@/lib/meetingEventSnapshot";
import type {
  AdminMeetingEvent,
  AdminMeetingEventsData,
  AdminMeetingGroup,
  AdminMeetingEventStage,
  AdminGroupStageLocation,
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

function addMinutesToTime(value: string, minutes: number) {
  const [hours = 0, minute = 0] = value.split(":").map(Number);
  const total = (hours * 60 + minute + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function loadData(): Promise<AdminMeetingEventsData> {
  const admin = createAdminClient();
  const [programResult, eventResult, groupResult, stageResult, locationResult, applicationResult] =
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
        .order("event_date", { ascending: false })
        .order("starts_at", { ascending: false })
        .returns<AdminMeetingEvent[]>(),
      admin
        .from("meeting_groups")
        .select("id,event_id,code,title,capacity,status,operation_note,legacy_ticket_instance_id")
        .order("code")
        .returns<Array<Omit<AdminMeetingGroup, "assigned_count">>>(),
      admin
        .from("meeting_event_stages")
        .select("id,event_id,title,stage_type,sequence,starts_at,location_mode,place_name,address")
        .order("sequence")
        .returns<AdminMeetingEventStage[]>(),
      admin
        .from("meeting_group_stage_locations")
        .select("id,group_id,stage_id,place_name,address")
        .returns<AdminGroupStageLocation[]>(),
      admin
        .from("meeting_date_applications")
        .select("assigned_group_id,user_id,status")
        .not("assigned_group_id", "is", null)
        .in("status", ["waitlisted", "on_hold", "approved", "feedback_done", "completed"])
        .returns<Array<{ assigned_group_id: string; user_id: string; status: string }>>(),
    ]);
  if (programResult.error) throw programResult.error;
  if (eventResult.error) throw eventResult.error;
  if (groupResult.error) throw groupResult.error;
  if (stageResult.error) throw stageResult.error;
  if (locationResult.error) throw locationResult.error;
  if (applicationResult.error) throw applicationResult.error;

  const assignedUsers = new Map<string, Set<string>>();
  for (const row of applicationResult.data ?? []) {
    const users = assignedUsers.get(row.assigned_group_id) ?? new Set<string>();
    users.add(row.user_id);
    assignedUsers.set(row.assigned_group_id, users);
  }

  return {
    programs: programResult.data ?? [],
    events: eventResult.data ?? [],
    groups: (groupResult.data ?? []).map((group) => ({
      ...group,
      assigned_count: assignedUsers.get(group.id)?.size ?? 0,
    })),
    stages: stageResult.data ?? [],
    groupLocations: locationResult.data ?? [],
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

      const { data: createdEvent, error } = await admin.from("meeting_events").insert({
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
      }).select("id,starts_at").single<{ id: string; starts_at: string }>();
      if (error) throw error;
      const { error: stageError } = await admin.from("meeting_event_stages").insert([
        { event_id: createdEvent.id, title: "저녁 식사", stage_type: "meal", sequence: 1, starts_at: addMinutesToTime(createdEvent.starts_at, 0), location_mode: "group_specific" },
        { event_id: createdEvent.id, title: "공통 활동", stage_type: "activity", sequence: 2, starts_at: addMinutesToTime(createdEvent.starts_at, 90), location_mode: "shared" },
        { event_id: createdEvent.id, title: "피드백", stage_type: "feedback", sequence: 3, starts_at: addMinutesToTime(createdEvent.starts_at, 180), location_mode: "hidden" },
      ]);
      if (stageError) throw stageError;
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
    } else if (action === "save_stage") {
      const eventId = text(body?.eventId);
      const stageId = text(body?.stageId);
      const title = text(body?.title);
      const locationMode = text(body?.locationMode);
      if (!eventId || !title || !["shared", "group_specific", "hidden"].includes(locationMode)) {
        return NextResponse.json({ error: "일정 제목과 장소 방식을 확인해주세요." }, { status: 400 });
      }
      const payload = {
        event_id: eventId,
        title,
        stage_type: ["meal", "activity", "feedback", "other"].includes(text(body?.stageType)) ? text(body?.stageType) : "activity",
        sequence: Math.max(1, Number(body?.sequence) || 1),
        starts_at: text(body?.startsAt) || null,
        location_mode: locationMode,
        place_name: locationMode === "shared" ? text(body?.placeName) || null : null,
        address: locationMode === "shared" ? text(body?.address) || null : null,
        updated_at: new Date().toISOString(),
      };
      const query = stageId
        ? admin.from("meeting_event_stages").update(payload).eq("id", stageId)
        : admin.from("meeting_event_stages").insert(payload);
      const { error } = await query;
      if (error) throw error;

      const { data: event, error: eventError } = await admin
        .from("meeting_events")
        .select("detail_snapshot")
        .eq("id", eventId)
        .single<{ detail_snapshot: Record<string, unknown> | null }>();
      if (eventError) throw eventError;

      const nextSnapshot = syncMeetingEventSnapshotStageTitle(
        event.detail_snapshot,
        payload.sequence,
        title,
      );
      if (nextSnapshot !== event.detail_snapshot) {
        const { error: snapshotError } = await admin
          .from("meeting_events")
          .update({ detail_snapshot: nextSnapshot, updated_at: new Date().toISOString() })
          .eq("id", eventId);
        if (snapshotError) throw snapshotError;
      }
    } else if (action === "save_group") {
      const groupId = text(body?.groupId);
      if (!groupId) return NextResponse.json({ error: "그룹을 선택해주세요." }, { status: 400 });
      const capacity = Math.max(1, Number(body?.capacity) || 1);
      const { data: group, error: groupError } = await admin
        .from("meeting_groups")
        .update({
          code: text(body?.code),
          title: text(body?.title),
          capacity,
          operation_note: text(body?.operationNote) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId)
        .select("legacy_ticket_instance_id")
        .single<{ legacy_ticket_instance_id: string | null }>();
      if (groupError) throw groupError;
      if (group.legacy_ticket_instance_id) {
        const { error: instanceError } = await admin
          .from("ticket_instances")
          .update({
            operation_code: text(body?.code),
            operation_note: text(body?.title),
            max_participant_count: capacity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", group.legacy_ticket_instance_id);
        if (instanceError) throw instanceError;
      }
    } else if (action === "save_group_location") {
      const groupId = text(body?.groupId);
      const stageId = text(body?.stageId);
      if (!groupId || !stageId) return NextResponse.json({ error: "그룹과 일정을 선택해주세요." }, { status: 400 });
      const { error } = await admin.from("meeting_group_stage_locations").upsert({
        group_id: groupId,
        stage_id: stageId,
        place_name: text(body?.placeName) || null,
        address: text(body?.address) || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "group_id,stage_id" });
      if (error) throw error;
      const { data: group, error: groupError } = await admin
        .from("meeting_groups")
        .select("legacy_ticket_instance_id")
        .eq("id", groupId)
        .single<{ legacy_ticket_instance_id: string | null }>();
      if (groupError) throw groupError;
      if (group.legacy_ticket_instance_id) {
        const { error: instanceError } = await admin
          .from("ticket_instances")
          .update({
            place_name: text(body?.placeName) || null,
            address: text(body?.address) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", group.legacy_ticket_instance_id);
        if (instanceError) throw instanceError;
      }
    } else {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }
    return NextResponse.json(await loadData());
  } catch (error) {
    console.error("Admin meeting event create failed:", error);
    return NextResponse.json({ error: "행사 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const groupId = text(body?.groupId);
  if (!groupId) return NextResponse.json({ error: "그룹을 선택해주세요." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data: group, error: groupError } = await admin
      .from("meeting_groups")
      .select("legacy_ticket_instance_id")
      .eq("id", groupId)
      .single<{ legacy_ticket_instance_id: string | null }>();
    if (groupError) throw groupError;
    const { count, error: countError } = await admin
      .from("meeting_date_applications")
      .select("id", { count: "exact", head: true })
      .eq("assigned_group_id", groupId)
      .in("status", ["waitlisted", "on_hold", "approved", "feedback_done", "completed"]);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "배정 인원이 있는 그룹은 삭제할 수 없습니다." }, { status: 409 });
    }
    const { error } = await admin.from("meeting_groups").delete().eq("id", groupId);
    if (error) throw error;
    if (group.legacy_ticket_instance_id) {
      const { error: instanceError } = await admin
        .from("ticket_instances")
        .delete()
        .eq("id", group.legacy_ticket_instance_id);
      if (instanceError) throw instanceError;
    }
    return NextResponse.json(await loadData());
  } catch (error) {
    console.error("Admin meeting group delete failed:", error);
    return NextResponse.json({ error: "그룹을 삭제하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = text(body?.eventId);
  const action = text(body?.action) || "update_event";
  if (!eventId) return NextResponse.json({ error: "행사를 선택해주세요." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const visibility = text(body?.visibility) as MeetingEventVisibility;
    if (body?.visibility !== undefined && !visibilities.has(visibility)) {
      return NextResponse.json({ error: "행사 공개 상태가 올바르지 않습니다." }, { status: 400 });
    }
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body?.visibility !== undefined) payload.visibility = visibility;
    if (action === "update_event") {
      if (body?.title !== undefined) payload.title = text(body.title);
      if (body?.shortDescription !== undefined) payload.short_description = text(body.shortDescription) || null;
      if (body?.eventDate !== undefined) payload.event_date = text(body.eventDate);
      if (body?.startsAt !== undefined) payload.starts_at = text(body.startsAt);
      if (body?.region !== undefined) payload.region = text(body.region);
      if (body?.capacity !== undefined) payload.capacity = Math.max(1, Number(body.capacity) || 1);
    }
    const { error } = await admin.from("meeting_events").update(payload).eq("id", eventId);
    if (error) throw error;
    if (action === "update_event" && body?.startsAt !== undefined) {
      const startsAt = text(body.startsAt);
      const stageOffsets = new Map([[1, 0], [2, 90], [3, 180]]);
      const { data: stages, error: stagesError } = await admin
        .from("meeting_event_stages")
        .select("id,sequence")
        .eq("event_id", eventId)
        .returns<Array<{ id: string; sequence: number }>>();
      if (stagesError) throw stagesError;
      for (const stage of stages) {
        const offset = stageOffsets.get(stage.sequence);
        if (offset === undefined) continue;
        const { error: stageTimeError } = await admin
          .from("meeting_event_stages")
          .update({ starts_at: addMinutesToTime(startsAt, offset), updated_at: new Date().toISOString() })
          .eq("id", stage.id);
        if (stageTimeError) throw stageTimeError;
      }
    }
    if (action === "update_event" && ["title", "eventDate", "startsAt", "region"].some((key) => body?.[key] !== undefined)) {
      const { data: groups, error: groupsError } = await admin
        .from("meeting_groups")
        .select("legacy_ticket_instance_id")
        .eq("event_id", eventId)
        .not("legacy_ticket_instance_id", "is", null)
        .returns<Array<{ legacy_ticket_instance_id: string }>>();
      if (groupsError) throw groupsError;
      const instanceIds = groups.map((group) => group.legacy_ticket_instance_id);
      if (instanceIds.length > 0) {
        const instancePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body?.title !== undefined) instancePayload.title = text(body.title);
        if (body?.eventDate !== undefined) instancePayload.event_date = text(body.eventDate);
        if (body?.startsAt !== undefined) instancePayload.event_time = text(body.startsAt);
        if (body?.region !== undefined) instancePayload.region = text(body.region);
        const { error: instanceError } = await admin.from("ticket_instances").update(instancePayload).in("id", instanceIds);
        if (instanceError) throw instanceError;
      }
      const applicationPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body?.eventDate !== undefined) applicationPayload.meeting_date = text(body.eventDate);
      if (body?.startsAt !== undefined) applicationPayload.meeting_time = text(body.startsAt);
      if (Object.keys(applicationPayload).length > 1) {
        const { error: applicationError } = await admin
          .from("meeting_date_applications")
          .update(applicationPayload)
          .eq("event_id", eventId);
        if (applicationError) throw applicationError;
      }
    }
    return NextResponse.json(await loadData());
  } catch (error) {
    console.error("Admin meeting event update failed:", error);
    return NextResponse.json({ error: "행사 공개 상태를 저장하지 못했습니다." }, { status: 500 });
  }
}
