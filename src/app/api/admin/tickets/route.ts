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
  "membership_status",
  "membership_plan",
  "membership_start_date",
  "membership_end_date",
  "membership_purchase_clicked_at",
  "membership_updated_at",
].join(",");

const templateSelect = [
  "id",
  "title",
  "short_description",
  "image_url",
  "mood_tags",
  "activity_type",
  "recommendation_copy",
  "default_region",
  "default_time",
  "visibility",
  "question_order",
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
  "score_alcohol",
  "score_romance",
  "created_at",
  "updated_at",
].join(",");

const instanceSelect = [
  "id",
  "template_id",
  "title",
  "event_date",
  "event_time",
  "region",
  "place_name",
  "address",
  "place_visibility",
  "visibility",
  "remaining_seat_label_count",
  "created_at",
  "updated_at",
].join(",");

const assignmentSelect = [
  "id",
  "ticket_instance_id",
  "profile_id",
  "assigned_at",
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

function questionOrder(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : null;
  if (number === null || !Number.isFinite(number)) return null;
  return Math.max(1, Math.min(5, Math.trunc(number)));
}

function scoreValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : null;
  if (number === null || !Number.isFinite(number)) return null;
  return Math.max(1, Math.min(5, Math.trunc(number)));
}

function operationalVisibility(value: unknown) {
  const visibility = isTicketVisibility(value)
    ? value
    : ("draft" as TicketVisibility);
  return visibility === "question" ? "public" : visibility;
}

function templatePayload(body: Record<string, unknown>) {
  const visibility = operationalVisibility(body.visibility);

  return {
    title: text(body.title),
    short_description: text(body.shortDescription),
    image_url: text(body.imageUrl),
    mood_tags: tags(body.moodTags),
    activity_type: text(body.activityType),
    recommendation_copy: text(body.recommendationCopy),
    default_region: text(body.defaultRegion),
    default_time: text(body.defaultTime),
    visibility,
    question_order: questionOrder(body.questionOrder),
    score_temperature: scoreValue(body.scoreTemperature),
    score_texture: scoreValue(body.scoreTexture),
    score_tone: scoreValue(body.scoreTone),
    score_rhythm: scoreValue(body.scoreRhythm),
    score_alcohol: scoreValue(body.scoreAlcohol),
    score_romance: scoreValue(body.scoreRomance),
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
    visibility: operationalVisibility(body.visibility),
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
        .select(templateSelect)
        .order("updated_at", { ascending: false }),
      supabase
        .from("ticket_instances")
        .select(instanceSelect)
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("event_time", { ascending: true, nullsFirst: false }),
      supabase.from("ticket_assignments").select(assignmentSelect),
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
  const assignments = (assignmentsResult.data ?? []) as unknown as AssignmentRow[];
  const waitlistCounts = new Map<string, number>();

  for (const row of waitlistResult.data ?? []) {
    const key = row.ticket_instance_id ?? row.ticket_id;
    if (key) waitlistCounts.set(key, (waitlistCounts.get(key) ?? 0) + 1);
  }

  const instances = ((instancesResult.data ?? []) as unknown as InstanceRow[]).map(
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

  const templates = ((templatesResult.data ?? []) as unknown as TemplateRow[]).map(
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
    console.error("[admin tickets]", error);
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
        .select(templateSelect)
        .eq("id", templateId)
        .single();
      if (sourceError) throw sourceError;
      const sourceTemplate = source as unknown as TemplateRow;

      const { data: copy, error: copyError } = await supabase
        .from("ticket_templates")
        .insert({
          title: `${sourceTemplate.title} 복사본`,
          short_description: sourceTemplate.short_description,
          image_url: sourceTemplate.image_url,
          mood_tags: sourceTemplate.mood_tags,
          activity_type: sourceTemplate.activity_type,
          recommendation_copy: sourceTemplate.recommendation_copy,
          default_region: sourceTemplate.default_region,
          default_time: sourceTemplate.default_time,
          visibility:
            sourceTemplate.visibility === "question"
              ? "public"
              : sourceTemplate.visibility,
          question_order: null,
          score_temperature: sourceTemplate.score_temperature ?? null,
          score_texture: sourceTemplate.score_texture ?? null,
          score_tone: sourceTemplate.score_tone ?? null,
          score_rhythm: sourceTemplate.score_rhythm ?? null,
          score_alcohol: sourceTemplate.score_alcohol ?? null,
          score_romance: sourceTemplate.score_romance ?? null,
        })
        .select("id")
        .single();
      if (copyError) throw copyError;

      if (body?.includeInstances === true) {
        const { data: sourceInstances, error: instancesError } = await supabase
          .from("ticket_instances")
          .select(instanceSelect)
          .eq("template_id", templateId);
        if (instancesError) throw instancesError;
        const sourceInstanceRows =
          (sourceInstances ?? []) as unknown as InstanceRow[];
        if (sourceInstanceRows.length) {
          const { error } = await supabase.from("ticket_instances").insert(
            sourceInstanceRows.map((instance) => ({
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
        .select(instanceSelect)
        .eq("id", instanceId)
        .single();
      if (sourceError) throw sourceError;
      const sourceInstance = source as unknown as InstanceRow;
      const { error } = await supabase.from("ticket_instances").insert({
        template_id: sourceInstance.template_id,
        title: `${sourceInstance.title} 복사본`,
        event_date: sourceInstance.event_date,
        event_time: sourceInstance.event_time,
        region: sourceInstance.region,
        place_name: sourceInstance.place_name,
        address: sourceInstance.address,
        place_visibility: sourceInstance.place_visibility,
        visibility: sourceInstance.visibility,
        remaining_seat_label_count: sourceInstance.remaining_seat_label_count ?? 0,
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
    console.error("[admin tickets]", { action, error });
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
    console.error("[admin tickets]", { entity, id, error });
    return NextResponse.json(
      { error: "티켓 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const templateId = request.nextUrl.searchParams.get("templateId");
  const instanceId = request.nextUrl.searchParams.get("instanceId");
  const profileId = request.nextUrl.searchParams.get("profileId");
  if (templateId) {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("ticket_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
      return NextResponse.json(await loadTicketData());
    } catch (error) {
      console.error("[admin tickets]", error);
      return NextResponse.json(
        { error: "티켓 템플릿을 삭제하지 못했습니다." },
        { status: 500 },
      );
    }
  }

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
    console.error("[admin tickets]", error);
    return NextResponse.json(
      { error: "멤버를 제거하지 못했습니다." },
      { status: 500 },
    );
  }
}
