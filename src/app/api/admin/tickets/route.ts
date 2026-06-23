import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { meetingProposalDisplayName } from "@/lib/meetingProposalAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeTicketStageCopy } from "@/lib/ticketStageCopy";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import {
  isPlaceVisibility,
  isTicketVisibility,
  type AdminTicketInstance,
  type AdminTicketTemplate,
  type AdminTicketWaitlistEntry,
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
type WaitlistRow = AdminTicketWaitlistEntry;

const candidateWaitlistStatuses = [
  "payment_pending",
  "waitlisted",
  "approved",
  "on_hold",
];

const profileSelect = [
  "user_id",
  "name",
  "nickname",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "public_emoji",
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
  "is_test_participant",
].join(",");

const profileSelectWithoutTestParticipant = [
  "user_id",
  "name",
  "nickname",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "public_emoji",
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

const templateSelect = [
  "id",
  "title",
  "short_description",
  "detail_summary",
  "detail_activities",
  "detail_flow",
  "detail_good_for",
  "detail_notice",
  "stage_copy",
  "image_url",
  "mood_tags",
  "activity_type",
  "recommendation_copy",
  "default_region",
  "default_time",
  "event_date",
  "event_time",
  "region",
  "place_name",
  "address",
  "place_visibility",
  "operation_code",
  "operation_note",
  "remaining_seat_label_count",
  "max_participant_count",
  "visibility",
  "question_order",
  "proposal_id",
  "proposer_user_id",
  "proposer_display_name",
  "proposer_public_intro",
  "proposer_public_emoji",
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
  "score_alcohol",
  "score_romance",
  "created_at",
  "updated_at",
].join(",");

class AdminTicketRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const instanceSelect = [
  "id",
  "template_id",
  "title",
  "event_date",
  "event_time",
  "region",
  "place_name",
  "address",
  "operation_code",
  "operation_note",
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

function timeText(value: unknown) {
  const raw = text(value);
  const match = raw?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;

  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return null;

  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, "0")}:${match[2]}`;
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

function textList(value: unknown) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];

  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dbTextList(value: unknown) {
  return textList(value);
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

function testTimeTarget(mode: unknown) {
  const now = new Date();
  if (mode === "applied") {
    return new Date(now.getTime() + (24 * 60 + 5) * 60 * 1000);
  }
  if (mode === "approved") return new Date(now.getTime() + 12 * 60 * 60 * 1000);
  if (mode === "pre_start") return new Date(now.getTime() + 60 * 60 * 1000);
  if (mode === "in_progress") return new Date(now.getTime() - 5 * 60 * 1000);
  if (mode === "feedback") {
    return new Date(now.getTime() - (3 * 60 + 5) * 60 * 1000);
  }
  return null;
}

function kstDateTimePayload(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    event_date: `${value("year")}-${value("month")}-${value("day")}`,
    event_time: `${value("hour")}:${value("minute")}`,
    updated_at: new Date().toISOString(),
  };
}

function operationalVisibility(value: unknown) {
  return isTicketVisibility(value) ? value : ("draft" as TicketVisibility);
}

function templatePayload(body: Record<string, unknown>) {
  const visibility = operationalVisibility(body.visibility);

  return {
    title: text(body.title),
    short_description: text(body.shortDescription),
    detail_summary: text(body.detailSummary),
    detail_activities: textList(body.detailActivities),
    detail_flow: textList(body.detailFlow),
    detail_good_for: textList(body.detailGoodFor),
    detail_notice: text(body.detailNotice),
    stage_copy: sanitizeTicketStageCopy(body.stageCopy),
    image_url: text(body.imageUrl),
    mood_tags: tags(body.moodTags),
    activity_type: text(body.activityType),
    recommendation_copy: text(body.recommendationCopy),
    default_region: text(body.defaultRegion),
    default_time: timeText(body.defaultTime),
    event_date: text(body.eventDate),
    event_time: timeText(body.eventTime),
    region: text(body.region),
    place_name: text(body.placeName),
    address: text(body.address),
    place_visibility: isPlaceVisibility(body.placeVisibility)
      ? body.placeVisibility
      : ("confirmed_only" as PlaceVisibility),
    operation_code: text(body.operationCode),
    operation_note: text(body.operationNote),
    remaining_seat_label_count: remainingSeatCount(
      body.remainingSeatLabelCount,
    ),
    max_participant_count: 6,
    visibility,
    question_order: questionOrder(body.questionOrder),
    proposer_user_id: text(body.proposerUserId),
    proposer_display_name: text(body.proposerDisplayName),
    proposer_public_intro: text(body.proposerPublicIntro),
    proposer_public_emoji: text(body.proposerPublicEmoji),
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
    event_time: timeText(body.eventTime),
    region: text(body.region),
    place_name: text(body.placeName),
    address: text(body.address),
    operation_code: text(body.operationCode),
    operation_note: text(body.operationNote),
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

type TemplatePayload = ReturnType<typeof templatePayload>;

function publicProfileText(value: string | null | undefined) {
  return value?.trim() || null;
}

async function operatorProposerPayload(
  supabase: ReturnType<typeof createAdminClient>,
  proposerUserId: string,
) {
  const profiles = await fetchProfiles(supabase);
  const profile = profiles.find((item) => item.user_id === proposerUserId);

  if (!profile || profile.is_test_participant !== true) {
    throw new AdminTicketRequestError(
      "관리자에서 직접 만드는 티켓의 제안자는 운영자 중에서 선택해주세요.",
    );
  }

  return {
    proposer_user_id: profile.user_id,
    proposer_display_name: meetingProposalDisplayName(profile),
    proposer_public_intro: publicProfileText(profile.public_intro),
    proposer_public_emoji: publicProfileText(profile.public_emoji),
  };
}

async function unifiedTicketPayload(
  supabase: ReturnType<typeof createAdminClient>,
  body: Record<string, unknown>,
) {
  const payload = templatePayload(body);
  const proposerUserId = text(body.proposerUserId);

  if (!payload.title) {
    throw new AdminTicketRequestError("티켓 제목을 입력해주세요.");
  }
  if (payload.visibility === "question") {
    if (!payload.question_order) {
      throw new AdminTicketRequestError("샘플 티켓 순서를 선택해주세요.");
    }

    return {
      ...payload,
      proposer_user_id: null as string | null,
      proposer_display_name: null as string | null,
      proposer_public_intro: null as string | null,
      proposer_public_emoji: null as string | null,
      default_region: payload.default_region ?? payload.region,
      default_time: payload.default_time ?? payload.event_time,
      max_participant_count: 6,
    };
  }
  if (!proposerUserId) {
    throw new AdminTicketRequestError("제안자를 운영자 중에서 선택해주세요.");
  }

  const proposer = await operatorProposerPayload(supabase, proposerUserId);

  return {
    ...payload,
    ...proposer,
    default_region: payload.default_region ?? payload.region,
    default_time: payload.default_time ?? payload.event_time,
    max_participant_count: 6,
  };
}

function instancePayloadFromTemplate(
  templateId: string,
  payload: TemplatePayload,
) {
  return {
    template_id: templateId,
    title: payload.title,
    event_date: payload.event_date,
    event_time: payload.event_time ?? payload.default_time,
    region: payload.region ?? payload.default_region,
    place_name: payload.place_name,
    address: payload.address,
    operation_code: payload.operation_code,
    operation_note: payload.operation_note,
    place_visibility: payload.place_visibility,
    visibility: payload.visibility,
    remaining_seat_label_count: payload.remaining_seat_label_count,
    updated_at: new Date().toISOString(),
  };
}

async function syncProposerParticipation({
  supabase,
  instanceId,
  templateId,
  proposerUserId,
  eventDate,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  instanceId: string;
  templateId: string;
  proposerUserId: string | null;
  eventDate: string | null;
}) {
  if (!proposerUserId) return;

  const { error: assignmentError } = await supabase
    .from("ticket_assignments")
    .insert({
      ticket_instance_id: instanceId,
      profile_id: proposerUserId,
    });
  if (assignmentError && assignmentError.code !== "23505") {
    throw assignmentError;
  }

  if (!eventDate) return;

  const { data: existingWaitlist, error: existingWaitlistError } =
    await supabase
      .from("meeting_waitlist")
      .select("id")
      .eq("user_id", proposerUserId)
      .eq("ticket_instance_id", instanceId)
      .maybeSingle();
  if (existingWaitlistError) throw existingWaitlistError;

  const waitlistPayload = {
    status: "approved",
    ticket_id: instanceId,
    ticket_instance_id: instanceId,
    ticket_template_id: templateId,
    meeting_date: eventDate,
    updated_at: new Date().toISOString(),
  };

  if (existingWaitlist?.id) {
    const { error } = await supabase
      .from("meeting_waitlist")
      .update(waitlistPayload)
      .eq("id", existingWaitlist.id);
    if (error) throw error;
    return;
  }

  const { error: waitlistInsertError } = await supabase
    .from("meeting_waitlist")
    .insert({
      ...waitlistPayload,
      user_id: proposerUserId,
    });
  if (waitlistInsertError && waitlistInsertError.code !== "23505") {
    throw waitlistInsertError;
  }
}

async function syncTemplateInstance(
  supabase: ReturnType<typeof createAdminClient>,
  templateId: string,
  payload: TemplatePayload,
) {
  const { data: existing, error: existingError } = await supabase
    .from("ticket_instances")
    .select("id")
    .eq("template_id", templateId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const nextInstancePayload = instancePayloadFromTemplate(templateId, payload);
  const mutation = existing?.id
    ? supabase
        .from("ticket_instances")
        .update(nextInstancePayload)
        .eq("id", existing.id)
        .select("id")
        .single()
    : supabase
        .from("ticket_instances")
        .insert(nextInstancePayload)
        .select("id")
        .single();

  const { data: instance, error } = await mutation;
  if (error) throw error;

  const { error: archiveError } = await supabase
    .from("ticket_instances")
    .update({ visibility: "archived", updated_at: new Date().toISOString() })
    .eq("template_id", templateId)
    .neq("id", instance.id);
  if (archiveError) throw archiveError;

  await syncProposerParticipation({
    supabase,
    instanceId: instance.id,
    templateId,
    proposerUserId: payload.proposer_user_id,
    eventDate: payload.event_date,
  });

  return instance.id as string;
}

async function loadTicketData() {
  const supabase = createAdminClient();
  const [templatesResult, instancesResult, assignmentsResult, waitlistResult] =
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
      supabase
        .from("meeting_waitlist")
        .select(
          "user_id,ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status",
        )
        .in("status", candidateWaitlistStatuses),
    ]);

  const error =
    templatesResult.error ??
    instancesResult.error ??
    assignmentsResult.error ??
    waitlistResult.error;
  if (error) throw error;

  const profiles = await fetchProfiles(supabase);
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const assignments = (assignmentsResult.data ?? []) as unknown as AssignmentRow[];
  const waitlist = (waitlistResult.data ?? []) as unknown as WaitlistRow[];
  const waitlistCounts = new Map<string, number>();

  for (const row of waitlist) {
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
      const proposerProfile = template.proposer_user_id
        ? profileMap.get(template.proposer_user_id)
        : null;

      return {
        ...template,
        proposer_display_name: proposerProfile
          ? meetingProposalDisplayName(proposerProfile)
          : template.proposer_display_name,
        detail_activities: dbTextList(template.detail_activities),
        detail_flow: dbTextList(template.detail_flow),
        detail_good_for: dbTextList(template.detail_good_for),
        place_visibility: isPlaceVisibility(template.place_visibility)
          ? template.place_visibility
          : "confirmed_only",
        remaining_seat_label_count: remainingSeatCount(
          template.remaining_seat_label_count,
        ),
        max_participant_count: 6,
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

  return { templates, profiles, waitlist };
}

async function fetchProfiles(supabase: ReturnType<typeof createAdminClient>) {
  const selects = [profileSelect, profileSelectWithoutTestParticipant];

  for (const select of selects) {
    const { data, error } = await supabase
      .from("profiles")
      .select(select)
      .order("name");

    if (!error) {
      return (data ?? []).map((profile) =>
        normalizeAdminProfile(profile as unknown as AdminProfile),
      );
    }
  }

  throw new Error("profiles-load-failed");
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

    if (action === "create_ticket") {
      const payload = await unifiedTicketPayload(supabase, body ?? {});
      const { data: template, error } = await supabase
        .from("ticket_templates")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      await syncTemplateInstance(supabase, template.id, payload);
    } else if (action === "create_template") {
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
          detail_summary: sourceTemplate.detail_summary,
          detail_activities: sourceTemplate.detail_activities,
          detail_flow: sourceTemplate.detail_flow,
          detail_good_for: sourceTemplate.detail_good_for,
          detail_notice: sourceTemplate.detail_notice,
          stage_copy: sourceTemplate.stage_copy ?? {},
          image_url: sourceTemplate.image_url,
          mood_tags: sourceTemplate.mood_tags,
          activity_type: sourceTemplate.activity_type,
          recommendation_copy: sourceTemplate.recommendation_copy,
          default_region: sourceTemplate.default_region,
          default_time: sourceTemplate.default_time,
          event_date: sourceTemplate.event_date,
          event_time: sourceTemplate.event_time,
          region: sourceTemplate.region,
          place_name: sourceTemplate.place_name,
          address: sourceTemplate.address,
          place_visibility: sourceTemplate.place_visibility,
          operation_code: sourceTemplate.operation_code,
          operation_note: sourceTemplate.operation_note,
          remaining_seat_label_count:
            sourceTemplate.remaining_seat_label_count ?? 0,
          max_participant_count: 6,
          visibility: sourceTemplate.visibility,
          question_order: null,
          proposal_id: sourceTemplate.proposal_id,
          proposer_user_id: sourceTemplate.proposer_user_id,
          proposer_display_name: sourceTemplate.proposer_display_name,
          proposer_public_intro: sourceTemplate.proposer_public_intro,
          proposer_public_emoji: sourceTemplate.proposer_public_emoji,
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
              operation_code: instance.operation_code,
              operation_note: instance.operation_note,
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
        operation_code: sourceInstance.operation_code,
        operation_note: sourceInstance.operation_note,
        place_visibility: sourceInstance.place_visibility,
        visibility: sourceInstance.visibility,
        remaining_seat_label_count: sourceInstance.remaining_seat_label_count ?? 0,
      });
      if (error) throw error;
    } else if (action === "set_instance_test_time") {
      const instanceId = text(body?.instanceId);
      const target = testTimeTarget(body?.mode);
      if (!instanceId || !target) {
        return NextResponse.json(
          { error: "잘못된 운영자 시간 이동 요청입니다." },
          { status: 400 },
        );
      }

      const { data: instance, error: instanceError } = await supabase
        .from("ticket_instances")
        .select("id,visibility")
        .eq("id", instanceId)
        .single();
      if (instanceError) throw instanceError;

      if (instance.visibility !== "test_only") {
        return NextResponse.json(
          { error: "운영자 전용 티켓에서만 시간을 이동할 수 있습니다." },
          { status: 403 },
        );
      }

      const { error } = await supabase
        .from("ticket_instances")
        .update(kstDateTimePayload(target))
        .eq("id", instanceId);
      if (error) throw error;
    } else if (action === "add_assignment") {
      const instanceId = text(body?.instanceId);
      const profileId = text(body?.profileId);
      if (!instanceId || !profileId) {
        return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
      }

      const { data: instance, error: instanceError } = await supabase
        .from("ticket_instances")
        .select("id,template_id,event_date,visibility")
        .eq("id", instanceId)
        .single();
      if (instanceError) throw instanceError;

      if (instance.visibility === "test_only") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_test_participant")
          .eq("user_id", profileId)
          .single();
        if (profileError) throw profileError;

        if (profile?.is_test_participant !== true) {
          return NextResponse.json(
            { error: "운영자만 운영자 전용 티켓에 배정할 수 있습니다." },
            { status: 403 },
          );
        }
      }

      const { error } = await supabase.from("ticket_assignments").insert({
        ticket_instance_id: instanceId,
        profile_id: profileId,
      });
      if (error && error.code !== "23505") throw error;

      if (instance.event_date) {
        const { data: existingWaitlist, error: existingWaitlistError } =
          await supabase
            .from("meeting_waitlist")
            .select("id")
            .eq("user_id", profileId)
            .eq("ticket_instance_id", instanceId)
            .maybeSingle();
        if (existingWaitlistError) throw existingWaitlistError;

        if (existingWaitlist?.id) {
          const { error: waitlistUpdateError } = await supabase
            .from("meeting_waitlist")
            .update({
              status: "approved",
              ticket_id: instanceId,
              ticket_template_id: instance.template_id,
              meeting_date: instance.event_date,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingWaitlist.id);
          if (waitlistUpdateError) throw waitlistUpdateError;
        } else {
          const { error: waitlistInsertError } = await supabase
            .from("meeting_waitlist")
            .insert({
              user_id: profileId,
              ticket_id: instanceId,
              ticket_instance_id: instanceId,
              ticket_template_id: instance.template_id,
              meeting_date: instance.event_date,
              status: "approved",
            });
          if (waitlistInsertError && waitlistInsertError.code !== "23505") {
            throw waitlistInsertError;
          }
        }
      }
    } else {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }

    return NextResponse.json(await loadTicketData());
  } catch (error) {
    if (error instanceof AdminTicketRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
    if (entity === "ticket") {
      const payload = await unifiedTicketPayload(supabase, body ?? {});
      const { error } = await supabase
        .from("ticket_templates")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      await syncTemplateInstance(supabase, id, payload);
    } else if (entity === "template") {
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
    if (error instanceof AdminTicketRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
