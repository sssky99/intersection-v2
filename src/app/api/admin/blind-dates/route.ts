import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { blindDateSelectableDatesFrom } from "@/lib/blindDateDates";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BlindDateAdminOffer,
  BlindDateAdminProfile,
  BlindDateMutualCandidate,
  BlindDateOfferStatus,
  BlindDateResponseStatus,
  BlindDateSourceType,
  BlindDateTemplate,
} from "@/types/blindDate";

export const dynamic = "force-dynamic";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type FeedbackRow = {
  id: string;
  waitlist_id: number | string;
  user_id: string;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
  ticket_snapshot: Record<string, unknown> | null;
  selected_member_ids: string[] | null;
  place_feedback: Record<string, unknown> | null;
  created_at: string;
};

type TicketInstanceRow = {
  id: string;
  template_id: string | null;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
};

type TicketTemplateRow = {
  id: string;
  title: string;
};

type BlindDateOfferRow = {
  id: string;
  status: BlindDateOfferStatus;
  source_type: BlindDateSourceType;
  participant_a_id: string;
  participant_b_id: string;
  template_id: string | null;
  time_label: string;
  region: string;
  actual_place_name: string | null;
  actual_place_address: string | null;
  candidate_dates: unknown;
  a_response: BlindDateResponseStatus;
  b_response: BlindDateResponseStatus;
  a_available_dates: unknown;
  b_available_dates: unknown;
  scheduled_date: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  feedback_a_id: string | null;
  feedback_b_id: string | null;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
};

const adminOfferStatuses: BlindDateOfferStatus[] = [
  "pending_admin",
  "offered",
  "waiting_response",
  "scheduled",
  "needs_reschedule",
  "declined",
  "expired",
  "cancelled",
  "completed",
];

const templateSelect = [
  "id",
  "title",
  "image_url",
  "short_description",
  "time_label",
  "region",
  "actual_place_name",
  "actual_place_address",
  "guide_text",
  "stage_copy",
  "active",
  "deleted_at",
  "created_at",
  "updated_at",
].join(",");

const offerSelect = [
  "id",
  "status",
  "source_type",
  "participant_a_id",
  "participant_b_id",
  "template_id",
  "time_label",
  "region",
  "actual_place_name",
  "actual_place_address",
  "candidate_dates",
  "a_response",
  "b_response",
  "a_available_dates",
  "b_available_dates",
  "scheduled_date",
  "expires_at",
  "created_at",
  "updated_at",
  "feedback_a_id",
  "feedback_b_id",
  "ticket_instance_id",
  "ticket_template_id",
].join(",");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function stageCopyFromBody(body: Record<string, unknown> | null | undefined) {
  return {
    invite: text(body?.stageInviteText),
    waiting: text(body?.stageWaitingText),
    scheduled: text(body?.stageScheduledText),
    guidance: text(body?.stageGuidanceText),
    completed: text(body?.stageCompletedText),
  };
}

function uuid(value: unknown) {
  const candidate = text(value);
  return candidate && uuidPattern.test(candidate) ? candidate : null;
}

function dateList(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : [];

  const values = rawItems
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
    .filter((item) => Number.isFinite(new Date(`${item}T00:00:00+09:00`).getTime()));

  return Array.from(new Set(values)).sort();
}

function datesFromDb(value: unknown) {
  return dateList(value);
}

function defaultExpiresAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function validExpiresAt(value: unknown) {
  const candidate = text(value);
  if (!candidate) return defaultExpiresAt();
  const date = new Date(candidate);
  return Number.isFinite(date.getTime()) ? date.toISOString() : defaultExpiresAt();
}

function snapshotText(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value.trim() || null : null;
}

function meetingKey(row: FeedbackRow) {
  const snapshotId = snapshotText(row.ticket_snapshot, "id");
  const snapshotTemplateId = snapshotText(row.ticket_snapshot, "templateId");

  if (row.ticket_instance_id) return `instance:${row.ticket_instance_id}`;
  if (snapshotId) return `instance:${snapshotId}`;
  if (row.ticket_template_id) return `template:${row.ticket_template_id}`;
  if (snapshotTemplateId) return `template:${snapshotTemplateId}`;
  return null;
}

function feedbackDate(row: FeedbackRow, instance: TicketInstanceRow | undefined) {
  return (
    instance?.event_date ??
    snapshotText(row.ticket_snapshot, "date") ??
    row.created_at.slice(0, 10)
  );
}

function ticketLabel(
  row: FeedbackRow,
  instance: TicketInstanceRow | undefined,
  template: TicketTemplateRow | undefined,
) {
  return (
    instance?.title ??
    template?.title ??
    snapshotText(row.ticket_snapshot, "title") ??
    "피드백 모임"
  );
}

function negativeReasons(row: FeedbackRow | undefined, targetId: string) {
  const negativeMemberFeedback = row?.place_feedback?.negative_member_feedback;
  if (
    !negativeMemberFeedback ||
    typeof negativeMemberFeedback !== "object" ||
    Array.isArray(negativeMemberFeedback)
  ) {
    return [];
  }

  const entry = (negativeMemberFeedback as Record<string, unknown>)[targetId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
  const reasons = (entry as Record<string, unknown>).reasons;
  return Array.isArray(reasons)
    ? reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
}

function hasMannerIssue(reasons: string[]) {
  return reasons.some((reason) =>
    [
      "no_show",
      "rude_or_aggressive",
      "uncomfortable_conversation",
      "romantic_pressure",
      "religion_or_sales",
    ].includes(reason),
  );
}

function profileName(profile: BlindDateAdminProfile | null | undefined) {
  return profile?.name?.trim() || profile?.nickname?.trim() || "이름 없음";
}

function normalizeOffer(
  row: BlindDateOfferRow,
  profileMap: Map<string, BlindDateAdminProfile>,
  templateMap: Map<string, BlindDateTemplate>,
): BlindDateAdminOffer {
  return {
    id: row.id,
    status: row.status,
    source_type: row.source_type,
    participant_a_id: row.participant_a_id,
    participant_b_id: row.participant_b_id,
    template_id: row.template_id,
    time_label: row.time_label,
    region: row.region,
    actual_place_name: row.actual_place_name,
    actual_place_address: row.actual_place_address,
    candidate_dates: datesFromDb(row.candidate_dates).length
      ? datesFromDb(row.candidate_dates)
      : blindDateSelectableDatesFrom(row.created_at),
    a_response: row.a_response,
    b_response: row.b_response,
    a_available_dates: datesFromDb(row.a_available_dates),
    b_available_dates: datesFromDb(row.b_available_dates),
    scheduled_date: row.scheduled_date,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    participantA: profileMap.get(row.participant_a_id) ?? null,
    participantB: profileMap.get(row.participant_b_id) ?? null,
    template: row.template_id ? templateMap.get(row.template_id) ?? null : null,
    is_test: row.source_type === "test",
  };
}

function buildCandidates({
  feedbacks,
  profiles,
  instances,
  templates,
  offers,
}: {
  feedbacks: FeedbackRow[];
  profiles: BlindDateAdminProfile[];
  instances: TicketInstanceRow[];
  templates: TicketTemplateRow[];
  offers: BlindDateOfferRow[];
}) {
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const feedbackByMeetingUser = new Map<string, FeedbackRow>();
  const existingOfferFeedbackPairs = new Set<string>();

  for (const offer of offers) {
    if (offer.feedback_a_id && offer.feedback_b_id) {
      existingOfferFeedbackPairs.add(`${offer.feedback_a_id}:${offer.feedback_b_id}`);
      existingOfferFeedbackPairs.add(`${offer.feedback_b_id}:${offer.feedback_a_id}`);
    }
  }

  for (const feedback of feedbacks) {
    const key = meetingKey(feedback);
    if (key) feedbackByMeetingUser.set(`${key}:${feedback.user_id}`, feedback);
  }

  const candidates = new Map<string, BlindDateMutualCandidate>();

  for (const feedback of feedbacks) {
    const key = meetingKey(feedback);
    if (!key) continue;

    for (const selectedId of feedback.selected_member_ids ?? []) {
      const reciprocal = feedbackByMeetingUser.get(`${key}:${selectedId}`);
      if (!reciprocal?.selected_member_ids?.includes(feedback.user_id)) continue;

      const [participantAId, participantBId] = [feedback.user_id, selectedId].sort();
      const feedbackA = feedbackByMeetingUser.get(`${key}:${participantAId}`);
      const feedbackB = feedbackByMeetingUser.get(`${key}:${participantBId}`);
      if (!feedbackA || !feedbackB) continue;

      const id = `${key}:${participantAId}:${participantBId}`;
      if (candidates.has(id)) continue;

      const instanceId =
        feedbackA.ticket_instance_id ??
        feedbackB.ticket_instance_id ??
        snapshotText(feedbackA.ticket_snapshot, "id") ??
        snapshotText(feedbackB.ticket_snapshot, "id");
      const templateId =
        feedbackA.ticket_template_id ??
        feedbackB.ticket_template_id ??
        snapshotText(feedbackA.ticket_snapshot, "templateId") ??
        snapshotText(feedbackB.ticket_snapshot, "templateId");
      const instance = instanceId ? instanceMap.get(instanceId) : undefined;
      const template = templateId ? templateMap.get(templateId) : undefined;
      const aNegativeReasons = negativeReasons(feedbackA, participantBId);
      const bNegativeReasons = negativeReasons(feedbackB, participantAId);

      candidates.set(id, {
        id,
        participantAId,
        participantBId,
        participantA: profileMap.get(participantAId) ?? null,
        participantB: profileMap.get(participantBId) ?? null,
        ticketLabel: ticketLabel(feedbackA, instance, template),
        occurredDate: feedbackDate(feedbackA, instance),
        feedbackAId: feedbackA.id,
        feedbackBId: feedbackB.id,
        ticketInstanceId: instanceId ?? null,
        ticketTemplateId: templateId ?? null,
        aSelectedB: feedbackA.selected_member_ids?.includes(participantBId) ?? false,
        bSelectedA: feedbackB.selected_member_ids?.includes(participantAId) ?? false,
        hasNegativeFeedback:
          aNegativeReasons.length > 0 || bNegativeReasons.length > 0,
        hasNoShowOrMannerIssue:
          hasMannerIssue(aNegativeReasons) || hasMannerIssue(bNegativeReasons),
        alreadyOffered: existingOfferFeedbackPairs.has(`${feedbackA.id}:${feedbackB.id}`),
      });
    }
  }

  return Array.from(candidates.values()).sort((left, right) => {
    const dateCompare = right.occurredDate.localeCompare(left.occurredDate);
    if (dateCompare !== 0) return dateCompare;
    return `${profileName(left.participantA)} ${profileName(left.participantB)}`.localeCompare(
      `${profileName(right.participantA)} ${profileName(right.participantB)}`,
      "ko",
    );
  });
}

async function expireOldOffers(supabase: SupabaseAdminClient) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("blind_date_offers")
    .update({
      status: "expired",
      expired_at: now,
      updated_at: now,
    })
    .lt("expires_at", now)
    .in("status", ["pending_admin", "offered", "waiting_response"]);

  if (error) throw error;
}

async function loadData(supabase: SupabaseAdminClient) {
  await expireOldOffers(supabase);

  const [templatesResult, offersResult, feedbacksResult, profilesResult] =
    await Promise.all([
      supabase
        .from("blind_date_templates")
        .select(templateSelect)
        .order("created_at", { ascending: false })
        .returns<BlindDateTemplate[]>(),
      supabase
        .from("blind_date_offers")
        .select(offerSelect)
        .order("created_at", { ascending: false })
        .returns<BlindDateOfferRow[]>(),
      supabase
        .from("meeting_feedback")
        .select(
          "id,waitlist_id,user_id,ticket_instance_id,ticket_template_id,ticket_snapshot,selected_member_ids,place_feedback,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000)
        .returns<FeedbackRow[]>(),
      supabase
        .from("profiles")
        .select("user_id,name,nickname,phone,is_test_participant")
        .order("name")
        .limit(1000)
        .returns<BlindDateAdminProfile[]>(),
    ]);

  const error =
    templatesResult.error ??
    offersResult.error ??
    feedbacksResult.error ??
    profilesResult.error;
  if (error) throw error;

  const templates = templatesResult.data ?? [];
  const offers = offersResult.data ?? [];
  const feedbacks = feedbacksResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const instanceIds = Array.from(
    new Set(
      feedbacks
        .flatMap((feedback) => [
          feedback.ticket_instance_id,
          snapshotText(feedback.ticket_snapshot, "id"),
        ])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const templateIds = Array.from(
    new Set(
      feedbacks
        .flatMap((feedback) => [
          feedback.ticket_template_id,
          snapshotText(feedback.ticket_snapshot, "templateId"),
        ])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [instancesResult, ticketTemplatesResult] = await Promise.all([
    instanceIds.length
      ? supabase
          .from("ticket_instances")
          .select("id,template_id,title,event_date,event_time,region")
          .in("id", instanceIds)
          .returns<TicketInstanceRow[]>()
      : Promise.resolve({ data: [] as TicketInstanceRow[], error: null }),
    templateIds.length
      ? supabase
          .from("ticket_templates")
          .select("id,title")
          .in("id", templateIds)
          .returns<TicketTemplateRow[]>()
      : Promise.resolve({ data: [] as TicketTemplateRow[], error: null }),
  ]);

  if (instancesResult.error) throw instancesResult.error;
  if (ticketTemplatesResult.error) throw ticketTemplatesResult.error;

  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  return {
    templates,
    offers: offers.map((offer) => normalizeOffer(offer, profileMap, templateMap)),
    profiles,
    candidates: buildCandidates({
      feedbacks,
      profiles,
      instances: instancesResult.data ?? [],
      templates: ticketTemplatesResult.data ?? [],
      offers,
    }),
    smsCopy:
      "블라인드 데이트 제안이 도착했어요.\n교집합 사이트에서 24시간 안에 응답해주세요.",
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    return NextResponse.json(await loadData(supabase));
  } catch (error) {
    console.error("[admin blind dates GET]", error);
    return NextResponse.json(
      { error: "블라인드 데이트 정보를 불러오지 못했습니다." },
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
      const title = text(body?.title);
      if (!title) {
        return NextResponse.json(
          { error: "템플릿 제목을 입력해주세요." },
          { status: 400 },
        );
      }

      const { error } = await supabase.from("blind_date_templates").insert({
        title,
        image_url: text(body?.imageUrl),
        short_description: text(body?.shortDescription),
        time_label: text(body?.timeLabel),
        region: text(body?.region),
        actual_place_name: text(body?.actualPlaceName),
        actual_place_address: text(body?.actualPlaceAddress),
        guide_text: text(body?.guideText),
        stage_copy: stageCopyFromBody(body),
        active: body?.active !== false,
      });
      if (error) throw error;

      return NextResponse.json(await loadData(supabase));
    }

    if (action === "duplicate_template") {
      const templateId = uuid(body?.templateId);
      if (!templateId) {
        return NextResponse.json({ error: "템플릿을 선택해주세요." }, { status: 400 });
      }

      const { data: sourceTemplate, error: sourceError } = await supabase
        .from("blind_date_templates")
        .select(templateSelect)
        .eq("id", templateId)
        .maybeSingle<BlindDateTemplate>();
      if (sourceError) throw sourceError;
      if (!sourceTemplate) {
        return NextResponse.json(
          { error: "복제할 템플릿을 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      const { error } = await supabase.from("blind_date_templates").insert({
        title: `${sourceTemplate.title} 복사본`,
        image_url: sourceTemplate.image_url,
        short_description: sourceTemplate.short_description,
        time_label: sourceTemplate.time_label,
        region: sourceTemplate.region,
        actual_place_name: sourceTemplate.actual_place_name,
        actual_place_address: sourceTemplate.actual_place_address,
        guide_text: sourceTemplate.guide_text,
        stage_copy: sourceTemplate.stage_copy ?? {},
        active: sourceTemplate.active,
        deleted_at: null,
      });
      if (error) throw error;

      return NextResponse.json(await loadData(supabase));
    }

    if (action === "delete_template") {
      const templateId = uuid(body?.templateId);
      if (!templateId) {
        return NextResponse.json({ error: "템플릿을 선택해주세요." }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("blind_date_templates")
        .update({
          active: false,
          deleted_at: now,
          updated_at: now,
        })
        .eq("id", templateId);
      if (error) throw error;

      return NextResponse.json(await loadData(supabase));
    }

    if (action === "create_offer") {
      const participantAId = uuid(body?.participantAId);
      const participantBId = uuid(body?.participantBId);
      const templateId = uuid(body?.templateId);
      const sourceType: BlindDateSourceType =
        body?.sourceType === "test" ? "test" : "mutual_feedback";
      const createdAt = new Date();
      const candidateDates = blindDateSelectableDatesFrom(createdAt);

      if (!participantAId || !participantBId || participantAId === participantBId) {
        return NextResponse.json(
          { error: "서로 다른 참가자 2명을 선택해주세요." },
          { status: 400 },
        );
      }
      if (!templateId) {
        return NextResponse.json(
          { error: "블라인드 데이트 템플릿을 선택해주세요." },
          { status: 400 },
        );
      }

      const { data: template, error: templateError } = await supabase
        .from("blind_date_templates")
        .select(templateSelect)
        .eq("id", templateId)
        .maybeSingle<BlindDateTemplate>();
      if (templateError) throw templateError;
      if (!template) {
        return NextResponse.json(
          { error: "템플릿을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      if (!template.active || template.deleted_at) {
        return NextResponse.json(
          {
            error:
              "삭제되었거나 비활성화된 템플릿으로는 새 제안을 만들 수 없습니다.",
          },
          { status: 400 },
        );
      }

      const { error } = await supabase.from("blind_date_offers").insert({
        template_id: templateId,
        participant_a_id: participantAId,
        participant_b_id: participantBId,
        source_type: sourceType,
        feedback_a_id: uuid(body?.feedbackAId),
        feedback_b_id: uuid(body?.feedbackBId),
        ticket_instance_id: uuid(body?.ticketInstanceId),
        ticket_template_id: uuid(body?.ticketTemplateId),
        status: "offered",
        time_label: text(body?.timeLabel) ?? template.time_label ?? "저녁 7시",
        region: text(body?.region) ?? template.region ?? "지역 미정",
        actual_place_name:
          text(body?.actualPlaceName) ?? template.actual_place_name,
        actual_place_address:
          text(body?.actualPlaceAddress) ?? template.actual_place_address,
        candidate_dates: candidateDates,
        expires_at: validExpiresAt(body?.expiresAt),
        created_at: createdAt.toISOString(),
      });
      if (error) throw error;

      return NextResponse.json(await loadData(supabase));
    }

    return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    console.error("[admin blind dates POST]", { action, error });
    return NextResponse.json(
      { error: "블라인드 데이트 작업을 처리하지 못했습니다." },
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
  const id = uuid(body?.id);

  if (!id) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    if (entity === "template") {
      const title = text(body?.title);
      if (!title) {
        return NextResponse.json(
          { error: "템플릿 제목을 입력해주세요." },
          { status: 400 },
        );
      }

      const { error } = await supabase
        .from("blind_date_templates")
        .update({
          title,
          image_url: text(body?.imageUrl),
          short_description: text(body?.shortDescription),
          time_label: text(body?.timeLabel),
          region: text(body?.region),
          actual_place_name: text(body?.actualPlaceName),
          actual_place_address: text(body?.actualPlaceAddress),
          guide_text: text(body?.guideText),
          stage_copy: stageCopyFromBody(body),
          active: body?.active !== false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    } else if (entity === "offer") {
      const status = text(body?.status);
      const resetParticipant =
        body?.resetParticipant === "a" || body?.resetParticipant === "b"
          ? body.resetParticipant
          : null;
      const hasPlaceUpdate =
        Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceName") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceAddress");
      if (
        status &&
        !adminOfferStatuses.includes(status as BlindDateOfferStatus)
      ) {
        return NextResponse.json(
          { error: "상태 값이 올바르지 않습니다." },
          { status: 400 },
        );
      }
      if (!status && !hasPlaceUpdate && !resetParticipant) {
        return NextResponse.json(
          { error: "변경할 제안 정보가 없습니다." },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        updated_at: now,
      };
      if (status) {
        updates.status = status;
        if (status === "cancelled") updates.cancelled_at = now;
        if (status === "completed") updates.completed_at = now;
        if (status === "expired") updates.expired_at = now;
      }
      if (resetParticipant) {
        updates.status = "waiting_response";
        updates[`${resetParticipant}_response`] = "pending";
        updates[`${resetParticipant}_available_dates`] = [];
        updates.scheduled_date = null;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceName")) {
        updates.actual_place_name = text(body?.actualPlaceName);
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "actualPlaceAddress")) {
        updates.actual_place_address = text(body?.actualPlaceAddress);
      }

      const { error } = await supabase
        .from("blind_date_offers")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    }

    return NextResponse.json(await loadData(supabase));
  } catch (error) {
    console.error("[admin blind dates PATCH]", { entity, id, error });
    return NextResponse.json(
      { error: "블라인드 데이트 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
