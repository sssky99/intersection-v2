import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import {
  isPlaceVisibility,
  isTicketVisibility,
  type AdminTicketInstance,
  type AdminTicketTemplate,
  type PlaceVisibility,
  type TicketAssignment,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";

export const dynamic = "force-dynamic";

type TemplateRow = Omit<
  AdminTicketTemplate,
  "instances" | "instance_count" | "assignment_count" | "waitlist_count"
>;
type InstanceRow = Omit<
  AdminTicketInstance,
  "assignment_count" | "waitlist_count" | "assignments"
>;
type AssignmentRow = Omit<TicketAssignment, "profile">;

const profileSelect = [
  "user_id",
  "name",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "launch_notification_requested",
  "launch_notification_requested_at",
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
  return typeof value === "string" ? value.trim() || null : null;
}

function tags(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
}

function remainingSeatCount(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 0;
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(6, Math.trunc(number)));
}

function templatePayload(body: Record<string, unknown>) {
  return {
    title: text(body.title),
    short_description: text(body.shortDescription),
    image_url: text(body.imageUrl),
    mood_tags: tags(body.moodTags),
    activity_type: text(body.activityType),
    recommendation_copy: text(body.recommendationCopy),
    default_region: text(body.defaultRegion),
    default_time: text(body.defaultTime),
    visibility: isTicketVisibility(body.visibility)
      ? body.visibility
      : ("draft" as TicketVisibility),
    updated_at: new Date().toISOString(),
  };
}

function instancePayload(body: Record<string, unknown>) {
  return {
    title: text(body.title),
    event_date: text(body.eventDate),
    event_time: text(body.eventTime),
    region: text(body.region),
    place_name: text(body.placeName),
    address: text(body.address),
    place_visibility: isPlaceVisibility(body.placeVisibility)
      ? body.placeVisibility
      : ("confirmed_only" as PlaceVisibility),
    visibility: isTicketVisibility(body.visibility)
      ? body.visibility
      : ("draft" as TicketVisibility),
    remaining_seat_label_count: remainingSeatCount(
      body.remainingSeatLabelCount,
    ),
    updated_at: new Date().toISOString(),
  };
}

async function loadTicketData() {
  const supabase = createAdminClient();
  const [templatesResult, instancesResult, assignmentsResult, profilesResult, waitlistResult] =
    await Promise.all([
      supabase
        .from("ticket_templates")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("ticket_instances")
        .select("*")
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("event_time", { ascending: true, nullsFirst: false }),
      supabase.from("ticket_assignments").select("*"),
      supabase.from("profiles").select(profileSelect).order("name"),
      supabase
        .from("meeting_waitlist")
        .select("ticket_id,ticket_instance_id,status")
        .in("status", ["waitlisted", "approved"]),
    ]);

  const error =
    templatesResult.error ??
    instancesResult.error ??
    assignmentsResult.error ??
    profilesResult.error ??
    waitlistResult.error;
  if (error) throw error;

  const profiles = (profilesResult.data ?? []).map((profile) =>
    normalizeAdminProfile(profile as unknown as AdminProfile),
  );
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const waitlistCounts = new Map<string, number>();

  for (const row of waitlistResult.data ?? []) {
    const key = row.ticket_instance_id ?? row.ticket_id;
    if (key) waitlistCounts.set(key, (waitlistCounts.get(key) ?? 0) + 1);
  }

  const instances = ((instancesResult.data ?? []) as InstanceRow[]).map(
    (instance): AdminTicketInstance => {
      const instanceAssignments = assignments
        .filter((assignment) => assignment.ticket_instance_id === instance.id)
        .map((assignment) => ({
          ...assignment,
          profile: profileMap.get(assignment.profile_id) ?? null,
        }));

      return {
        ...instance,
        assignments: instanceAssignments,
        assignment_count: instanceAssignments.length,
        waitlist_count: waitlistCounts.get(instance.id) ?? 0,
      };
    },
  );

  const templates = ((templatesResult.data ?? []) as TemplateRow[]).map(
    (template): AdminTicketTemplate => {
      const templateInstances = instances.filter(
        (instance) => instance.template_id === template.id,
      );

      return {
        ...template,
        instances: templateInstances,
        instance_count: templateInstances.length,
        assignment_count: templateInstances.reduce(
          (sum, instance) => sum + instance.assignment_count,
          0,
        ),
        waitlist_count: templateInstances.reduce(
          (sum, instance) => sum + instance.waitlist_count,
          0,
        ),
      };
    },
  );

  return { templates, profiles };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    return NextResponse.json(await loadTicketData());
  } catch (error) {
    console.error("Admin tickets load failed:", error);
    return NextResponse.json(
      { error: "티켓 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = body?.action;

  try {
    const supabase = createAdminClient();

    if (action === "create_template") {
      const payload = templatePayload(body ?? {});
      if (!payload.title) {
        return NextResponse.json(
          { error: "템플릿 제목을 입력해주세요." },
          { status: 400 },
        );
      }
      const { error } = await supabase.from("ticket_templates").insert(payload);
      if (error) throw error;
    } else if (action === "duplicate_template") {
      const templateId = text(body?.templateId);
      if (!templateId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

      const { data: source, error: sourceError } = await supabase
        .from("ticket_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (sourceError) throw sourceError;

      const { data: copy, error: copyError } = await supabase
        .from("ticket_templates")
        .insert({
          title: `${source.title} 복사본`,
          short_description: source.short_description,
          image_url: source.image_url,
          mood_tags: source.mood_tags,
          activity_type: source.activity_type,
          recommendation_copy: source.recommendation_copy,
          default_region: source.default_region,
          default_time: source.default_time,
          visibility: source.visibility,
        })
        .select("id")
        .single();
      if (copyError) throw copyError;

      if (body?.includeInstances === true) {
        const { data: sourceInstances, error: instancesError } = await supabase
          .from("ticket_instances")
          .select("*")
          .eq("template_id", templateId);
        if (instancesError) throw instancesError;
        if (sourceInstances?.length) {
          const { error } = await supabase.from("ticket_instances").insert(
            sourceInstances.map((instance) => ({
              template_id: copy.id,
              title: `${instance.title} 복사본`,
              event_date: instance.event_date,
              event_time: instance.event_time,
              region: instance.region,
              place_name: instance.place_name,
              address: instance.address,
              place_visibility: instance.place_visibility,
              visibility: instance.visibility,
              remaining_seat_label_count: instance.remaining_seat_label_count ?? 0,
            })),
          );
          if (error) throw error;
        }
      }
    } else if (action === "create_instance") {
      const templateId = text(body?.templateId);
      const payload = instancePayload(body ?? {});
      if (!templateId || !payload.title) {
        return NextResponse.json(
          { error: "세부 티켓명과 템플릿이 필요합니다." },
          { status: 400 },
        );
      }
      const { error } = await supabase
        .from("ticket_instances")
        .insert({ ...payload, template_id: templateId });
      if (error) throw error;
    } else if (action === "duplicate_instance") {
      const instanceId = text(body?.instanceId);
      if (!instanceId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
      const { data: source, error: sourceError } = await supabase
        .from("ticket_instances")
        .select("*")
        .eq("id", instanceId)
        .single();
      if (sourceError) throw sourceError;
      const { error } = await supabase.from("ticket_instances").insert({
        template_id: source.template_id,
        title: `${source.title} 복사본`,
        event_date: source.event_date,
        event_time: source.event_time,
        region: source.region,
        place_name: source.place_name,
        address: source.address,
        place_visibility: source.place_visibility,
        visibility: source.visibility,
        remaining_seat_label_count: source.remaining_seat_label_count ?? 0,
      });
      if (error) throw error;
    } else if (action === "add_assignment") {
      const instanceId = text(body?.instanceId);
      const profileId = text(body?.profileId);
      if (!instanceId || !profileId) {
        return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
      }
      const { error } = await supabase.from("ticket_assignments").insert({
        ticket_instance_id: instanceId,
        profile_id: profileId,
      });
      if (error && error.code !== "23505") throw error;
    } else {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }

    return NextResponse.json(await loadTicketData());
  } catch (error) {
    console.error("Admin ticket create action failed:", { action, error });
    return NextResponse.json(
      { error: "티켓 작업을 처리하지 못했습니다." },
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
  const entity = body?.entity;
  const id = text(body?.id);
  if (!id) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  try {
    const supabase = createAdminClient();
    if (entity === "template") {
      const payload = templatePayload(body ?? {});
      if (!payload.title) {
        return NextResponse.json({ error: "템플릿 제목을 입력해주세요." }, { status: 400 });
      }
      const { error } = await supabase.from("ticket_templates").update(payload).eq("id", id);
      if (error) throw error;
    } else if (entity === "instance") {
      const payload = instancePayload(body ?? {});
      if (!payload.title) {
        return NextResponse.json({ error: "세부 티켓명을 입력해주세요." }, { status: 400 });
      }
      const { error } = await supabase.from("ticket_instances").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }

    return NextResponse.json(await loadTicketData());
  } catch (error) {
    console.error("Admin ticket update failed:", { entity, id, error });
    return NextResponse.json(
      { error: "티켓 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const instanceId = request.nextUrl.searchParams.get("instanceId");
  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!instanceId || !profileId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ticket_assignments")
      .delete()
      .eq("ticket_instance_id", instanceId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return NextResponse.json(await loadTicketData());
  } catch (error) {
    console.error("Admin ticket assignment removal failed:", error);
    return NextResponse.json(
      { error: "멤버를 제거하지 못했습니다." },
      { status: 500 },
    );
  }
}
