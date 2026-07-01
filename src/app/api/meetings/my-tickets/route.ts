import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  meetingAtmosphereDefaultsFromProfiles,
  normalizeMeetingAtmosphereAgeBandId,
  normalizeMeetingAtmosphereGenderMood,
  normalizeProfileGender,
  type MeetingAtmosphereDefaults,
} from "@/lib/meetingAtmosphere";
import {
  normalizeMeetingPlace,
  ticketPlaceFromLegacyFields,
} from "@/lib/placePayload";
import {
  sanitizeTicketStageCopy,
  ticketStageCopyKeys,
} from "@/lib/ticketStageCopy";
import {
  MEETING_MAX_PARTICIPANT_COUNT,
  MEETING_MIN_PARTICIPANT_COUNT,
  type GatheringTicket,
  type TicketArrivalStatus,
  type TicketMemberIntro,
  type TicketProgressStep,
  type TicketStageCopy,
  type UserTicket,
  type UserTicketStatus,
} from "@/types/ticket";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  detail_summary: string | null;
  detail_activities: unknown;
  detail_flow: unknown;
  detail_good_for: unknown;
  detail_notice: string | null;
  stage_copy: unknown;
  image_url: string | null;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  place_name: string | null;
  address: string | null;
  place_payload: unknown;
  atmosphere_gender_mood: string | null;
  atmosphere_age_band_id: string | null;
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
};

type InstanceRow = {
  id: string;
  template_id: string;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
  place_visibility: string | null;
  place_payload: unknown;
  remaining_seat_label_count: number | null;
  visibility: string | null;
};

type WaitlistRow = {
  id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string;
  ticket_snapshot: GatheringTicket | null;
  arrival_status: TicketArrivalStatus | null;
  arrival_status_updated_at: string | null;
  created_at: string | null;
};

type AssignmentRow = {
  ticket_instance_id: string;
  profile_id: string;
};

type UserAssignmentRow = {
  ticket_instance_id: string;
};

type MemberArrivalRow = {
  user_id: string;
  ticket_instance_id: string | null;
  ticket_id: string | null;
  status: string;
  arrival_status: TicketArrivalStatus | null;
  arrival_status_updated_at: string | null;
};

type AtmosphereWaitlistRow = {
  user_id: string;
  ticket_id: string | null;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string | null;
};

type ProfileIntroRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  gender: string | null;
  birth_year: string | number | null;
  public_intro: string | null;
  public_emoji?: string | null;
};

type ProfileAccessRow = {
  is_test_participant: boolean | null;
  name: string | null;
  nickname: string | null;
  gender: string | null;
  birth_year: string | number | null;
  public_intro: string | null;
  public_emoji: string | null;
};

type TicketSourceRow = WaitlistRow & {
  assignment_only?: boolean;
};


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
  "place_name",
  "address",
  "place_payload",
  "atmosphere_gender_mood",
  "atmosphere_age_band_id",
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
  "score_alcohol",
  "score_romance",
].join(",");

const templateSelectWithoutPlacePayload = templateSelect.replace(
  ",place_payload",
  "",
);

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
  "place_payload",
  "remaining_seat_label_count",
  "visibility",
].join(",");

const instanceSelectWithoutPlacePayload = instanceSelect.replace(
  ",place_payload",
  "",
);

function isMissingPlacePayloadColumn(error: unknown) {
  const databaseError = error as { code?: string; message?: string } | null;
  return (
    databaseError?.code === "42703" &&
    (databaseError.message ?? "").includes("place_payload")
  );
}

async function fetchInstanceRows(
  supabase: ReturnType<typeof createAdminClient>,
  instanceIds: string[],
) {
  const { data, error } = await supabase
    .from("ticket_instances")
    .select(instanceSelect)
    .in("id", instanceIds);

  if (isMissingPlacePayloadColumn(error)) {
    const fallback = await supabase
      .from("ticket_instances")
      .select(instanceSelectWithoutPlacePayload)
      .in("id", instanceIds);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as unknown as InstanceRow[];
  }

  if (error) throw error;
  return (data ?? []) as unknown as InstanceRow[];
}

async function fetchTemplateRows(
  supabase: ReturnType<typeof createAdminClient>,
  templateIds: string[],
) {
  const { data, error } = await supabase
    .from("ticket_templates")
    .select(templateSelect)
    .in("id", templateIds);

  if (isMissingPlacePayloadColumn(error)) {
    const fallback = await supabase
      .from("ticket_templates")
      .select(templateSelectWithoutPlacePayload)
      .in("id", templateIds);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as unknown as TemplateRow[];
  }

  if (error) throw error;
  return (data ?? []) as unknown as TemplateRow[];
}

const hiddenStatuses = new Set([
  "cancelled",
  "not_selected",
]);

const confirmedStatuses = new Set([
  "approved",
  "completed",
  "feedback_done",
]);

const autoCancellationStatuses = [
  "waitlisted",
  "approved",
  "on_hold",
  "payment_pending",
];

const atmosphereWaitlistStatuses = [
  "payment_pending",
  "waitlisted",
  "approved",
  "on_hold",
];

const statusPriority: Record<UserTicketStatus, number> = {
  approved: 0,
  in_progress: 0,
  feedback_open: 0,
  waitlisted: 1,
  payment_pending: 2,
};

const statusLabels: Record<UserTicketStatus, string> = {
  payment_pending: "결제 확인 필요",
  waitlisted: "신청 완료",
  approved: "참여 확정",
  in_progress: "진행 중",
  feedback_open: "피드백 작성 가능",
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function atmosphereForTicket(
  template: TemplateRow,
  defaults: MeetingAtmosphereDefaults | null | undefined,
): GatheringTicket["atmosphere"] {
  const ageBandOverride = normalizeMeetingAtmosphereAgeBandId(
    template.atmosphere_age_band_id,
  );
  const genderMoodOverride = normalizeMeetingAtmosphereGenderMood(
    template.atmosphere_gender_mood,
  );

  return {
    ageBandId: ageBandOverride ?? defaults?.ageBandId ?? null,
    genderMood: genderMoodOverride ?? defaults?.genderMood ?? null,
    defaultAgeBandId: defaults?.ageBandId ?? null,
    defaultGenderMood: defaults?.genderMood ?? null,
    ageBandOverrideId: ageBandOverride,
    genderMoodOverride,
  };
}

function atmosphereInstanceId(
  row: AtmosphereWaitlistRow,
  instanceMap: Map<string, InstanceRow>,
  templateDateMap: Map<string, string>,
) {
  if (row.ticket_instance_id && instanceMap.has(row.ticket_instance_id)) {
    return row.ticket_instance_id;
  }
  if (row.ticket_id && instanceMap.has(row.ticket_id)) {
    return row.ticket_id;
  }
  if (row.ticket_template_id && row.meeting_date) {
    return templateDateMap.get(`${row.ticket_template_id}|${row.meeting_date}`) ?? null;
  }
  return null;
}

async function fetchAtmosphereWaitlistRows(
  supabase: ReturnType<typeof createAdminClient>,
  instances: InstanceRow[],
) {
  const instanceIds = unique(instances.map((instance) => instance.id));
  if (instanceIds.length === 0) return [];

  const templateIds = unique(instances.map((instance) => instance.template_id));
  const waitlistSelect =
    "user_id,ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status";
  const rows: AtmosphereWaitlistRow[] = [];

  const { data: byInstanceId, error: byInstanceIdError } = await supabase
    .from("meeting_waitlist")
    .select(waitlistSelect)
    .in("ticket_instance_id", instanceIds)
    .in("status", atmosphereWaitlistStatuses)
    .returns<AtmosphereWaitlistRow[]>();
  if (byInstanceIdError) throw byInstanceIdError;
  rows.push(...(byInstanceId ?? []));

  const { data: byTicketId, error: byTicketIdError } = await supabase
    .from("meeting_waitlist")
    .select(waitlistSelect)
    .in("ticket_id", instanceIds)
    .in("status", atmosphereWaitlistStatuses)
    .returns<AtmosphereWaitlistRow[]>();
  if (byTicketIdError) throw byTicketIdError;
  rows.push(...(byTicketId ?? []));

  if (templateIds.length > 0) {
    const { data: byTemplateId, error: byTemplateIdError } = await supabase
      .from("meeting_waitlist")
      .select(waitlistSelect)
      .in("ticket_template_id", templateIds)
      .in("status", atmosphereWaitlistStatuses)
      .returns<AtmosphereWaitlistRow[]>();
    if (byTemplateIdError) throw byTemplateIdError;
    rows.push(...(byTemplateId ?? []));
  }

  return rows;
}

function atmosphereDefaultsByInstance(
  rows: AtmosphereWaitlistRow[],
  instances: InstanceRow[],
  profileMap: Map<string, ProfileIntroRow>,
) {
  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
  const templateDateMap = new Map(
    instances
      .filter((instance) => instance.event_date)
      .map((instance) => [
        `${instance.template_id}|${instance.event_date}`,
        instance.id,
      ]),
  );
  const userIdsByInstance = new Map<string, Set<string>>();

  for (const row of rows) {
    const instanceId = atmosphereInstanceId(row, instanceMap, templateDateMap);
    if (!instanceId || !row.user_id) continue;
    const current = userIdsByInstance.get(instanceId) ?? new Set<string>();
    current.add(row.user_id);
    userIdsByInstance.set(instanceId, current);
  }

  return new Map(
    [...userIdsByInstance.entries()].map(([instanceId, userIds]) => [
      instanceId,
      meetingAtmosphereDefaultsFromProfiles(
        [...userIds]
          .map((userId) => profileMap.get(userId))
          .filter((profile): profile is ProfileIntroRow => Boolean(profile)),
      ),
    ]),
  );
}

function mergedStageCopy(...values: unknown[]): TicketStageCopy {
  const merged: TicketStageCopy = {};

  for (const value of values) {
    const copy = sanitizeTicketStageCopy(value);
    for (const key of ticketStageCopyKeys) {
      if (copy[key]) merged[key] = copy[key];
    }
  }

  return merged;
}

function toStartAt(date: string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const normalizedTime = time?.slice(0, 5) || "00:00";
  const start = new Date(`${date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(start.getTime()) ? start : null;
}

function isoOrNull(date: Date | null) {
  return date ? date.toISOString() : null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function toTicket(
  row: WaitlistRow,
  instance: InstanceRow | null,
  template: TemplateRow | null,
  atmosphereDefaults?: MeetingAtmosphereDefaults | null,
): GatheringTicket | null {
  const snapshot = row.ticket_snapshot;

  if (!instance || !template) {
    return snapshot?.id ? snapshot : null;
  }

  const date = instance.event_date ?? row.meeting_date ?? snapshot?.date;
  const time =
    instance.event_time?.slice(0, 5) ??
    template.default_time?.slice(0, 5) ??
    snapshot?.time;

  if (!date || !time) return snapshot?.id ? snapshot : null;

  const subtitle =
    template.short_description ??
    template.recommendation_copy ??
    snapshot?.subtitle ??
    "교집합이 준비한 실제 운영 모임";
  const area =
    instance.region ?? template.default_region ?? snapshot?.area ?? "지역 미정";
  const place =
    normalizeMeetingPlace(instance.place_payload) ??
    normalizeMeetingPlace(template.place_payload);

  return {
    id: instance.id,
    templateId: instance.template_id,
    title: instance.title || template.title || snapshot?.title || "티켓",
    subtitle,
    date,
    time,
    area,
    moodTags: template.mood_tags ?? snapshot?.moodTags ?? [],
    activityType: template.activity_type ?? snapshot?.activityType,
    imageUrl: template.image_url ?? snapshot?.imageUrl,
    remainingSeatCount:
      instance.remaining_seat_label_count ?? snapshot?.remainingSeatCount ?? 0,
    minimumParticipantCount:
      snapshot?.minimumParticipantCount ?? MEETING_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      snapshot?.maxParticipantCount ?? MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: template.recommendation_copy ?? snapshot?.peopleHint ?? subtitle,
    reason: template.recommendation_copy ?? snapshot?.reason ?? subtitle,
    detailSummary: template.detail_summary?.trim() || snapshot?.detailSummary,
    detailActivities: textList(template.detail_activities).length
      ? textList(template.detail_activities)
      : snapshot?.detailActivities,
    detailFlow: textList(template.detail_flow).length
      ? textList(template.detail_flow)
      : snapshot?.detailFlow,
    detailGoodFor: textList(template.detail_good_for).length
      ? textList(template.detail_good_for)
      : snapshot?.detailGoodFor,
    detailNotice: template.detail_notice?.trim() || snapshot?.detailNotice,
    place:
      ticketPlaceFromLegacyFields({
        placeName: instance.place_name ?? template.place_name,
        address: instance.address ?? template.address,
        place,
      }) ?? snapshot?.place,
    stageCopy: mergedStageCopy(snapshot?.stageCopy, template.stage_copy),
    atmosphere: atmosphereForTicket(template, atmosphereDefaults),
    vibeScores: {
      temperature:
        template.score_temperature ?? snapshot?.vibeScores?.temperature ?? null,
      texture: template.score_texture ?? snapshot?.vibeScores?.texture ?? null,
      tone: template.score_tone ?? snapshot?.vibeScores?.tone ?? null,
      rhythm: template.score_rhythm ?? snapshot?.vibeScores?.rhythm ?? null,
      alcohol: template.score_alcohol ?? snapshot?.vibeScores?.alcohol ?? null,
      romance: template.score_romance ?? snapshot?.vibeScores?.romance ?? null,
    },
  };
}

function deriveStatus(
  rawStatus: string,
  startAt: Date | null,
  now: Date,
): {
  status: UserTicketStatus | null;
  statusLabel: string;
  progressStep: TicketProgressStep;
  progressIndex: number;
  canSetArrival: boolean;
} {
  if (hiddenStatuses.has(rawStatus)) {
    return {
      status: null,
      statusLabel: "",
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (rawStatus === "payment_pending") {
    return {
      status: "payment_pending",
      statusLabel: statusLabels.payment_pending,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (!confirmedStatuses.has(rawStatus)) {
    return {
      status: "waitlisted",
      statusLabel: statusLabels.waitlisted,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (!startAt) {
    if (rawStatus !== "approved") {
      return {
        status: null,
        statusLabel: "",
        progressStep: "feedback",
        progressIndex: 4,
        canSetArrival: false,
      };
    }

    return {
      status: "approved",
      statusLabel: statusLabels.approved,
      progressStep: "approved",
      progressIndex: 1,
      canSetArrival: false,
    };
  }

  const approvalOpenAt = addHours(startAt, -24);
  const arrivalOpenAt = addHours(startAt, -3);
  const feedbackOpenAt = addHours(startAt, 3);
  const chatClosesAt = addHours(startAt, 27);
  const canSetArrival = rawStatus === "approved" && now >= arrivalOpenAt;

  if (now >= chatClosesAt) {
    return {
      status: null,
      statusLabel: "",
      progressStep: "feedback",
      progressIndex: 4,
      canSetArrival: false,
    };
  }

  if (now < approvalOpenAt) {
    return {
      status: "approved",
      statusLabel: statusLabels.waitlisted,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (now >= feedbackOpenAt) {
    return {
      status: "feedback_open",
      statusLabel:
        rawStatus === "feedback_done" ? "피드백 작성 완료" : statusLabels.feedback_open,
      progressStep: "feedback",
      progressIndex: 4,
      canSetArrival,
    };
  }

  if (now >= startAt) {
    return {
      status: "in_progress",
      statusLabel: statusLabels.in_progress,
      progressStep: "in_progress",
      progressIndex: 3,
      canSetArrival,
    };
  }

  if (now >= arrivalOpenAt) {
    return {
      status: "approved",
      statusLabel: "시작 전 안내",
      progressStep: "pre_start",
      progressIndex: 2,
      canSetArrival,
    };
  }

  return {
    status: "approved",
    statusLabel: statusLabels.approved,
    progressStep: "approved",
    progressIndex: 1,
    canSetArrival,
  };
}

function sortUserTickets(left: UserTicket, right: UserTicket) {
  const priority = statusPriority[left.status] - statusPriority[right.status];
  if (priority !== 0) return priority;

  const leftStart = left.meetingStartAt ?? `${left.ticket.date}T${left.ticket.time}`;
  const rightStart = right.meetingStartAt ?? `${right.ticket.date}T${right.ticket.time}`;
  const dateCompare = leftStart.localeCompare(rightStart);
  if (dateCompare !== 0) return dateCompare;

  return left.ticket.title.localeCompare(right.ticket.title, "ko");
}

type UserTicketsPagination = {
  offset: number;
  limit: number | null;
};

type UserTicketsPageMeta = {
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
};

type SourceTicketCandidate = {
  kind: "source";
  row: TicketSourceRow;
  instanceId: string | null;
  sortStatus: UserTicketStatus;
  sortStart: string;
  sortTitle: string;
};

type UserTicketCandidate = SourceTicketCandidate;

const maxUserTicketsPageLimit = 50;

function integerSearchParam(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function userTicketsPagination(request: Request): UserTicketsPagination {
  const url = new URL(request.url);
  const offset = Math.max(0, integerSearchParam(url.searchParams.get("offset")) ?? 0);
  const rawLimit = integerSearchParam(url.searchParams.get("limit"));
  const limit =
    rawLimit === null
      ? null
      : Math.min(maxUserTicketsPageLimit, Math.max(1, rawLimit));

  return { offset, limit };
}

function paginateItems<T>(
  items: T[],
  pagination: UserTicketsPagination,
): { items: T[]; meta: UserTicketsPageMeta } {
  const totalCount = items.length;
  const start = Math.min(pagination.offset, totalCount);
  const end =
    pagination.limit === null
      ? totalCount
      : Math.min(start + pagination.limit, totalCount);
  const nextOffset = end < totalCount ? end : null;

  return {
    items: items.slice(start, end),
    meta: {
      totalCount,
      hasMore: nextOffset !== null,
      nextOffset,
    },
  };
}

function sourceRowInstanceId(row: TicketSourceRow) {
  return row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id ?? null;
}

function sourceRowAssigned(
  row: TicketSourceRow,
  instanceId: string | null,
  userAssignedInstanceIds: Set<string>,
) {
  return Boolean(
    row.assignment_only || (instanceId && userAssignedInstanceIds.has(instanceId)),
  );
}

function effectiveSourceStatus(
  row: TicketSourceRow,
  instanceId: string | null,
  userAssignedInstanceIds: Set<string>,
) {
  if (row.status === "approved" && instanceId) {
    return sourceRowAssigned(row, instanceId, userAssignedInstanceIds)
      ? row.status
      : "waitlisted";
  }

  return row.status;
}

function sourceTicketCandidate(
  row: TicketSourceRow,
  instanceMap: Map<string, InstanceRow>,
  userAssignedInstanceIds: Set<string>,
  now: Date,
): SourceTicketCandidate | null {
  const instanceId = sourceRowInstanceId(row);
  const instance = instanceId ? instanceMap.get(instanceId) ?? null : null;
  const date = instance?.event_date ?? row.meeting_date ?? row.ticket_snapshot?.date;
  const time = instance?.event_time ?? row.ticket_snapshot?.time;
  const startAt = toStartAt(date, time);
  const derived = deriveStatus(
    effectiveSourceStatus(row, instanceId, userAssignedInstanceIds),
    startAt,
    now,
  );

  if (!derived.status) return null;

  return {
    kind: "source",
    row,
    instanceId,
    sortStatus: derived.status,
    sortStart: isoOrNull(startAt) ?? `${date ?? ""}T${time ?? ""}`,
    sortTitle: instance?.title ?? row.ticket_snapshot?.title ?? "",
  };
}

function compareTicketCandidates(
  left: UserTicketCandidate,
  right: UserTicketCandidate,
) {
  const priority = statusPriority[left.sortStatus] - statusPriority[right.sortStatus];
  if (priority !== 0) return priority;

  const dateCompare = left.sortStart.localeCompare(right.sortStart);
  if (dateCompare !== 0) return dateCompare;

  return left.sortTitle.localeCompare(right.sortTitle, "ko");
}

function profileEmoji(userId: string) {
  const emojis = ["💎", "🌿", "☕", "🎧", "✨", "🫧", "🪩", "🧭"];
  const sum = Array.from(userId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return emojis[sum % emojis.length];
}

function displayProfileEmoji(profile: ProfileIntroRow | undefined, userId: string) {
  return profile?.public_emoji?.trim() || profileEmoji(userId);
}

function fallbackNickname(name: string | null | undefined) {
  const korean = (name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || null;
}

function displayNickname(profile: ProfileIntroRow | undefined) {
  return profile?.nickname?.trim() || fallbackNickname(profile?.name);
}

function ticketsResponse(
  tickets: UserTicket[],
  participationCount: number,
  pageMeta?: UserTicketsPageMeta,
) {
  const totalCount = pageMeta?.totalCount ?? tickets.length;
  const hasMore = pageMeta?.hasMore ?? false;
  const nextOffset = pageMeta?.nextOffset ?? null;

  return NextResponse.json(
    {
      tickets,
      participationCount,
      totalCount,
      hasMore,
      nextOffset,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
      },
    },
  );
}

export async function GET(request: Request) {
  const pagination = userTicketsPagination(request);
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: profileAccess, error: profileAccessError } = await supabase
      .from("profiles")
      .select(
        "is_test_participant,name,nickname,gender,birth_year,public_intro,public_emoji",
      )
      .eq("user_id", user.id)
      .maybeSingle<ProfileAccessRow>();
    if (profileAccessError) throw profileAccessError;
    const canSeeTestTickets = profileAccess?.is_test_participant === true;

    const { data: waitlistData, error: waitlistError } = await supabase
      .from("meeting_waitlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (waitlistError) throw waitlistError;

    const waitlistRows = (waitlistData ?? []) as unknown as WaitlistRow[];
    const participationCount = waitlistRows.filter((row) =>
      ["completed", "feedback_done"].includes(row.status),
    ).length;
    const { data: userAssignmentData, error: userAssignmentError } =
      await supabase
        .from("ticket_assignments")
        .select("ticket_instance_id")
        .eq("profile_id", user.id)
        .returns<UserAssignmentRow[]>();
    if (userAssignmentError) throw userAssignmentError;

    const userAssignments = userAssignmentData ?? [];
    const userAssignedInstanceIds = new Set(
      userAssignments.map((assignment) => assignment.ticket_instance_id),
    );

    if (waitlistRows.length === 0 && userAssignments.length === 0) {
      return ticketsResponse([], participationCount, pagination ? { totalCount: 0, hasMore: false, nextOffset: null } : undefined);
    }

    const instanceIds = unique(
      [
        ...waitlistRows.map(
          (row) =>
            row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id,
        ),
        ...userAssignments.map((assignment) => assignment.ticket_instance_id),
      ],
    );

    let instances: InstanceRow[] = [];
    if (instanceIds.length > 0) {
      instances = await fetchInstanceRows(supabase, instanceIds);
    }

    const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
    const waitlistInstanceIds = new Set(
      waitlistRows
        .map((row) => row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id)
        .filter(Boolean),
    );
    const assignmentOnlyRows = userAssignments
      .filter((assignment) => !waitlistInstanceIds.has(assignment.ticket_instance_id))
      .map((assignment): TicketSourceRow | null => {
        const instance = instanceMap.get(assignment.ticket_instance_id);
        if (!instance) return null;

        return {
          id: `assignment:${assignment.ticket_instance_id}`,
          user_id: user.id,
          ticket_id: assignment.ticket_instance_id,
          ticket_template_id: instance.template_id,
          ticket_instance_id: assignment.ticket_instance_id,
          meeting_date: instance.event_date,
          status: "approved",
          ticket_snapshot: null,
          arrival_status: null,
          arrival_status_updated_at: null,
          created_at: null,
          assignment_only: true,
        };
      })
      .filter((row): row is TicketSourceRow => Boolean(row));
    const ticketSourceRows: TicketSourceRow[] = [
      ...waitlistRows,
      ...assignmentOnlyRows,
    ].filter((row) => {
      const instanceId =
        row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
      const instance = instanceId ? instanceMap.get(instanceId) : null;
      return instance?.visibility !== "test_only" || canSeeTestTickets;
    });

    if (ticketSourceRows.length === 0) {
      return ticketsResponse([], participationCount, { totalCount: 0, hasMore: false, nextOffset: null });
    }

    const now = new Date();
    const candidatePage = paginateItems(
      [
        ...ticketSourceRows
          .map((row) =>
            sourceTicketCandidate(row, instanceMap, userAssignedInstanceIds, now),
          )
          .filter(
            (candidate): candidate is SourceTicketCandidate =>
              Boolean(candidate),
          ),
      ].sort(compareTicketCandidates),
      pagination,
    );
    const pagedTicketSourceRows = candidatePage.items
      .filter(
        (candidate): candidate is SourceTicketCandidate =>
          candidate.kind === "source",
      )
      .map((candidate) => candidate.row);
    const pagedInstanceIds = unique(
      pagedTicketSourceRows.map((row) => sourceRowInstanceId(row)),
    );
    const pagedInstanceIdSet = new Set(pagedInstanceIds);
    const pagedInstances = instances.filter((instance) =>
      pagedInstanceIdSet.has(instance.id),
    );

    if (candidatePage.items.length === 0) {
      return ticketsResponse(
        [],
        participationCount,
        candidatePage.meta,
      );
    }

    const templateIds = unique([
      ...pagedTicketSourceRows.map((row) => row.ticket_template_id),
      ...pagedInstances.map((instance) => instance.template_id),
      ...pagedTicketSourceRows.map((row) => row.ticket_snapshot?.templateId),
    ]);

    let templates: TemplateRow[] = [];
    if (templateIds.length > 0) {
      templates = await fetchTemplateRows(supabase, templateIds);
    }

    const templateMap = new Map(templates.map((template) => [template.id, template]));
    let assignments: AssignmentRow[] = [];
    if (pagedInstanceIds.length > 0) {
      const { data, error } = await supabase
        .from("ticket_assignments")
        .select("ticket_instance_id,profile_id")
        .in("ticket_instance_id", pagedInstanceIds);
      if (error) throw error;
      assignments = (data ?? []) as unknown as AssignmentRow[];
    }

    let memberArrivalRows: MemberArrivalRow[] = [];
    if (pagedInstanceIds.length > 0) {
      const { data: byInstanceId, error: byInstanceIdError } = await supabase
        .from("meeting_waitlist")
        .select(
          "user_id,ticket_instance_id,ticket_id,status,arrival_status,arrival_status_updated_at",
        )
        .in("ticket_instance_id", pagedInstanceIds)
        .in("status", Array.from(confirmedStatuses))
        .returns<MemberArrivalRow[]>();
      if (byInstanceIdError) throw byInstanceIdError;

      const { data: byTicketId, error: byTicketIdError } = await supabase
        .from("meeting_waitlist")
        .select(
          "user_id,ticket_instance_id,ticket_id,status,arrival_status,arrival_status_updated_at",
        )
        .in("ticket_id", pagedInstanceIds)
        .in("status", Array.from(confirmedStatuses))
        .returns<MemberArrivalRow[]>();
      if (byTicketIdError) throw byTicketIdError;

      memberArrivalRows = [...(byInstanceId ?? []), ...(byTicketId ?? [])];
    }

    const atmosphereWaitlistRows = await fetchAtmosphereWaitlistRows(
      supabase,
      pagedInstances,
    );
    const profileIds = unique([
      user.id,
      ...assignments.map((assignment) => assignment.profile_id),
      ...memberArrivalRows.map((arrivalRow) => arrivalRow.user_id),
      ...atmosphereWaitlistRows.map((row) => row.user_id),
    ]);

    let profileRows: ProfileIntroRow[] = [];
    if (profileIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,name,nickname,gender,birth_year,public_intro,public_emoji")
        .in("user_id", profileIds);
      if (error) throw error;
      profileRows = (data ?? []) as unknown as ProfileIntroRow[];
    }

    const profileMap = new Map(
      profileRows.map((profile) => [profile.user_id, profile]),
    );
    const atmosphereDefaultsMap = atmosphereDefaultsByInstance(
      atmosphereWaitlistRows,
      pagedInstances,
      profileMap,
    );
    const assignmentsByInstance = assignments.reduce((map, assignment) => {
      const current = map.get(assignment.ticket_instance_id) ?? [];
      current.push(assignment.profile_id);
      map.set(assignment.ticket_instance_id, current);
      return map;
    }, new Map<string, string[]>());
    const arrivalByMember = memberArrivalRows.reduce((map, arrivalRow) => {
      const arrivalInstanceId =
        arrivalRow.ticket_instance_id ?? arrivalRow.ticket_id;
      if (arrivalInstanceId) {
        map.set(`${arrivalInstanceId}:${arrivalRow.user_id}`, arrivalRow);
      }
      return map;
    }, new Map<string, MemberArrivalRow>());

    const participantIdsByInstance = new Map<string, Set<string>>();
    const addParticipant = (instanceId: string | null | undefined, userId: string) => {
      if (!instanceId) return;
      const current = participantIdsByInstance.get(instanceId) ?? new Set<string>();
      current.add(userId);
      participantIdsByInstance.set(instanceId, current);
    };

    for (const assignment of assignments) {
      addParticipant(assignment.ticket_instance_id, assignment.profile_id);
    }
    for (const arrivalRow of memberArrivalRows) {
      addParticipant(
        arrivalRow.ticket_instance_id ?? arrivalRow.ticket_id,
        arrivalRow.user_id,
      );
    }

    const autoCancelledInstanceIds = new Set(
      pagedInstances
        .filter((instance) => {
          const startAt = toStartAt(instance.event_date, instance.event_time);
          if (!startAt || now < startAt) return false;
          const participantCount =
            participantIdsByInstance.get(instance.id)?.size ?? 0;
          return participantCount < MEETING_MIN_PARTICIPANT_COUNT;
        })
        .map((instance) => instance.id),
    );

    if (autoCancelledInstanceIds.size > 0) {
      const cancelledAt = now.toISOString();
      const autoCancelledIds = Array.from(autoCancelledInstanceIds);
      const cancelPayload = {
        status: "cancelled",
        admin_note: "최소 인원 미달로 자동 취소됨",
        updated_at: cancelledAt,
      };

      const { error: cancelByInstanceError } = await supabase
        .from("meeting_waitlist")
        .update(cancelPayload)
        .in("ticket_instance_id", autoCancelledIds)
        .in("status", autoCancellationStatuses);
      if (cancelByInstanceError) throw cancelByInstanceError;

      const { error: cancelByTicketError } = await supabase
        .from("meeting_waitlist")
        .update(cancelPayload)
        .in("ticket_id", autoCancelledIds)
        .in("status", autoCancellationStatuses);
      if (cancelByTicketError) throw cancelByTicketError;
    }

    const tickets = pagedTicketSourceRows
      .map((row): UserTicket | null => {
        const instanceId =
          row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
        if (instanceId && autoCancelledInstanceIds.has(instanceId)) return null;
        const instance = instanceId ? instanceMap.get(instanceId) ?? null : null;
        const templateId =
          row.ticket_template_id ??
          instance?.template_id ??
          row.ticket_snapshot?.templateId ??
          null;
        const template = templateId ? templateMap.get(templateId) ?? null : null;
        const ticket = toTicket(
          row,
          instance,
          template,
          instanceId ? atmosphereDefaultsMap.get(instanceId) ?? null : null,
        );
        if (!ticket) return null;

        const startAt = toStartAt(ticket.date, ticket.time);
        const effectiveStatus = effectiveSourceStatus(
          row,
          instanceId,
          userAssignedInstanceIds,
        );
        const derived = deriveStatus(effectiveStatus, startAt, now);
        if (!derived.status) return null;

        const confirmed = confirmedStatuses.has(effectiveStatus);
        const memberInfoVisible = confirmed && derived.progressIndex >= 1;
        const assignedIds = memberInfoVisible
          ? assignmentsByInstance.get(instanceId ?? "") ?? []
          : [];
        const memberIds = memberInfoVisible
          ? unique([...assignedIds, user.id])
          : [];
        const members: TicketMemberIntro[] = memberIds.map((id) => {
          const memberProfile = profileMap.get(id);
          const memberArrival = instanceId
            ? arrivalByMember.get(`${instanceId}:${id}`)
            : null;
          const arrivalStatus =
            id === user.id
              ? row.arrival_status ?? memberArrival?.arrival_status ?? null
              : memberArrival?.arrival_status ?? null;
          const arrivalStatusUpdatedAt =
            id === user.id
              ? row.arrival_status_updated_at ??
                memberArrival?.arrival_status_updated_at ??
                null
              : memberArrival?.arrival_status_updated_at ?? null;

          return {
            id,
            name: memberProfile?.name ?? null,
            nickname: displayNickname(memberProfile),
            gender: normalizeProfileGender(memberProfile?.gender),
            emoji: displayProfileEmoji(memberProfile, id),
            publicIntro: memberProfile?.public_intro ?? null,
            arrivalStatus,
            arrivalStatusUpdatedAt,
            isSelf: id === user.id,
          };
        });

        const placeVisible = instance?.place_visibility !== "hidden";

        return {
          id: String(row.id),
          waitlistId: String(row.id),
          ticket,
          rawStatus: effectiveStatus,
          status: derived.status,
          statusLabel: derived.statusLabel,
          progressStep: derived.progressStep,
          progressIndex: derived.progressIndex,
          meetingStartAt: isoOrNull(startAt),
          arrivalOpensAt: isoOrNull(startAt ? addHours(startAt, -3) : null),
          feedbackOpensAt: isoOrNull(startAt ? addHours(startAt, 3) : null),
          canSetArrival:
            confirmed && !row.assignment_only && derived.canSetArrival,
          arrivalStatus: row.arrival_status ?? null,
          arrivalStatusUpdatedAt: row.arrival_status_updated_at ?? null,
          place: placeVisible
            ? {
                name: ticket.place?.name ?? instance?.place_name ?? null,
                address: ticket.place?.address ?? instance?.address ?? null,
                category: ticket.place?.category ?? null,
                roadAddress: ticket.place?.roadAddress ?? null,
                jibunAddress: ticket.place?.jibunAddress ?? null,
                mapx: ticket.place?.mapx ?? null,
                mapy: ticket.place?.mapy ?? null,
                link: ticket.place?.link ?? null,
                source: ticket.place?.source ?? null,
              }
            : null,
          members,
        };
      })
      .filter((ticket): ticket is UserTicket => Boolean(ticket));

    const visibleTickets = [...tickets].sort(
      sortUserTickets,
    );

    return ticketsResponse(
      visibleTickets,
      participationCount,
      candidatePage.meta,
    );
  } catch (error) {
    console.error("[meetings my-tickets]", error);
    return NextResponse.json(
      { error: "내 티켓 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
