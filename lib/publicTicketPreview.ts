import { createAdminClient } from "@/lib/supabase/admin";
import {
  meetingAtmosphereDefaultsFromProfiles,
  normalizeMeetingAtmosphereAgeBandId,
  normalizeMeetingAtmosphereGenderMood,
  type MeetingAtmosphereDefaults,
} from "@/lib/meetingAtmosphere";
import {
  displayTicketCourseSteps,
  ensureMinimumStoredTicketCourseSteps,
  legacyStoredTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
} from "@/lib/ticketCourse";
import { hasTicketStarted, todayInKst } from "@/lib/ticketDate";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type AvailableDate,
  type GatheringTicket,
} from "@/types/ticket";

type PublicTicketInstanceRow = {
  id: string;
  template_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  remaining_seat_label_count: number | null;
  minimum_participant_count: number | null;
  max_participant_count: number | null;
};

type PublicTicketTemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  detail_summary: string | null;
  detail_activities: string[] | null;
  detail_flow: string[] | null;
  detail_good_for: string[] | null;
  detail_notice: string | null;
  image_url: string | null;
  course_steps: unknown;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  recommendation_preferred_activities: string[] | null;
  recommendation_recent_interests: string[] | null;
  default_region: string | null;
  default_time: string | null;
  atmosphere_gender_mood: string | null;
  atmosphere_age_band_id: string | null;
};

type AtmosphereParticipationRow = {
  user_id: string;
  ticket_id: string | null;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
};

type AtmosphereProfileRow = {
  user_id: string;
  gender: string | null;
  birth_year: string | number | null;
};

const publicTicketInstanceSelect = [
  "id",
  "template_id",
  "title",
  "event_date",
  "event_time",
  "region",
  "remaining_seat_label_count",
  "minimum_participant_count",
  "max_participant_count",
].join(",");

const publicTicketTemplateSelect = [
  "id",
  "title",
  "short_description",
  "detail_summary",
  "detail_activities",
  "detail_flow",
  "detail_good_for",
  "detail_notice",
  "image_url",
  "course_steps",
  "mood_tags",
  "activity_type",
  "recommendation_copy",
  "recommendation_preferred_activities",
  "recommendation_recent_interests",
  "default_region",
  "default_time",
  "atmosphere_gender_mood",
  "atmosphere_age_band_id",
].join(",");

const atmosphereParticipationStatuses = [
  "payment_pending",
  "waitlisted",
  "approved",
  "on_hold",
];

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = weekdayLabels[date.getUTCDay()] ?? "";

  return `${month}월 ${day}일 ${weekday}요일`;
}

function toPublicPreviewTicket(
  instance: PublicTicketInstanceRow,
  template: PublicTicketTemplateRow,
  atmosphereDefaults?: MeetingAtmosphereDefaults | null,
): GatheringTicket | null {
  if (!instance.event_date) return null;

  const subtitle =
    template.short_description ??
    template.recommendation_copy ??
    "교집합이 준비한 실제 운영 모임";
  const time =
    instance.event_time?.slice(0, 5) ??
    template.default_time?.slice(0, 5) ??
    "시간 미정";
  const area = instance.region ?? template.default_region ?? "지역 미정";
  const storedSteps = normalizeStoredTicketCourseSteps(template.course_steps);
  const courseSteps = displayTicketCourseSteps(
    ensureMinimumStoredTicketCourseSteps(
      storedSteps.length
        ? storedSteps
        : legacyStoredTicketCourseSteps({
            title: template.title,
            activityType: template.activity_type,
            imageUrl: template.image_url,
          }),
    ),
    { includePlaceDetails: false },
  );
  const mainCourseStep =
    courseSteps.find((step) => step.isMainActivity) ?? courseSteps[0] ?? null;
  const ageBandOverride = normalizeMeetingAtmosphereAgeBandId(
    template.atmosphere_age_band_id,
  );
  const genderMoodOverride = normalizeMeetingAtmosphereGenderMood(
    template.atmosphere_gender_mood,
  );

  return {
    id: instance.id,
    templateId: instance.template_id,
    title: instance.title || template.title,
    subtitle,
    date: instance.event_date,
    time,
    area,
    moodTags: template.mood_tags ?? [],
    activityType: mainCourseStep?.activityType ?? template.activity_type,
    imageUrl: mainCourseStep?.imageUrl ?? template.image_url ?? undefined,
    courseSteps,
    remainingSeatCount: instance.remaining_seat_label_count ?? 0,
    minimumParticipantCount:
      instance.minimum_participant_count ?? MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      instance.max_participant_count ?? MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: template.recommendation_copy ?? subtitle,
    reason: template.recommendation_copy ?? subtitle,
    recommendationAudience: {
      preferredActivities:
        template.recommendation_preferred_activities ?? [],
      recentInterests: template.recommendation_recent_interests ?? [],
    },
    detailSummary: template.detail_summary ?? subtitle,
    detailActivities: template.detail_activities ?? [],
    detailFlow: template.detail_flow ?? [],
    detailGoodFor: template.detail_good_for ?? [],
    detailNotice: template.detail_notice ?? undefined,
    atmosphere: {
      ageBandId: ageBandOverride ?? atmosphereDefaults?.ageBandId ?? null,
      genderMood:
        genderMoodOverride ?? atmosphereDefaults?.genderMood ?? null,
      defaultAgeBandId: atmosphereDefaults?.ageBandId ?? null,
      defaultGenderMood: atmosphereDefaults?.genderMood ?? null,
      ageBandOverrideId: ageBandOverride,
      genderMoodOverride,
    },
  };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function participationInstanceId(
  row: AtmosphereParticipationRow,
  instanceIds: Set<string>,
  templateDateMap: Map<string, string>,
) {
  if (row.ticket_instance_id && instanceIds.has(row.ticket_instance_id)) {
    return row.ticket_instance_id;
  }
  if (row.ticket_id && instanceIds.has(row.ticket_id)) {
    return row.ticket_id;
  }
  if (row.ticket_template_id && row.meeting_date) {
    return templateDateMap.get(`${row.ticket_template_id}|${row.meeting_date}`) ?? null;
  }
  return null;
}

async function atmosphereDefaultsForInstances(
  supabase: ReturnType<typeof createAdminClient>,
  instances: PublicTicketInstanceRow[],
) {
  const instanceIds = unique(instances.map((instance) => instance.id));
  if (instanceIds.length === 0) return new Map<string, MeetingAtmosphereDefaults>();

  const templateIds = unique(instances.map((instance) => instance.template_id));
  const participationSelect =
    "user_id,ticket_id,ticket_template_id,ticket_instance_id,meeting_date";
  const rows: AtmosphereParticipationRow[] = [];

  const { data: byInstanceId, error: byInstanceIdError } = await supabase
    .from("ticket_participations")
    .select(participationSelect)
    .in("ticket_instance_id", instanceIds)
    .in("status", atmosphereParticipationStatuses)
    .returns<AtmosphereParticipationRow[]>();
  if (byInstanceIdError) throw byInstanceIdError;
  rows.push(...(byInstanceId ?? []));

  const { data: byTicketId, error: byTicketIdError } = await supabase
    .from("ticket_participations")
    .select(participationSelect)
    .in("ticket_id", instanceIds)
    .in("status", atmosphereParticipationStatuses)
    .returns<AtmosphereParticipationRow[]>();
  if (byTicketIdError) throw byTicketIdError;
  rows.push(...(byTicketId ?? []));

  if (templateIds.length > 0) {
    const { data: byTemplateId, error: byTemplateIdError } = await supabase
      .from("ticket_participations")
      .select(participationSelect)
      .in("ticket_template_id", templateIds)
      .in("status", atmosphereParticipationStatuses)
      .returns<AtmosphereParticipationRow[]>();
    if (byTemplateIdError) throw byTemplateIdError;
    rows.push(...(byTemplateId ?? []));
  }

  const instanceIdSet = new Set(instanceIds);
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
    const instanceId = participationInstanceId(
      row,
      instanceIdSet,
      templateDateMap,
    );
    if (!instanceId || !row.user_id) continue;
    const userIds = userIdsByInstance.get(instanceId) ?? new Set<string>();
    userIds.add(row.user_id);
    userIdsByInstance.set(instanceId, userIds);
  }

  const profileIds = unique(rows.map((row) => row.user_id));
  if (profileIds.length === 0) {
    return new Map<string, MeetingAtmosphereDefaults>();
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,gender,birth_year")
    .in("user_id", profileIds)
    .returns<AtmosphereProfileRow[]>();
  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile]),
  );

  return new Map(
    [...userIdsByInstance.entries()].map(([instanceId, userIds]) => [
      instanceId,
      meetingAtmosphereDefaultsFromProfiles(
        [...userIds]
          .map((userId) => profileMap.get(userId))
          .filter((profile): profile is AtmosphereProfileRow => Boolean(profile)),
      ),
    ]),
  );
}

async function previewTicketsFromInstances(
  instances: PublicTicketInstanceRow[],
): Promise<GatheringTicket[]> {
  const templateIds = Array.from(
    new Set(instances.map((instance) => instance.template_id)),
  );
  if (templateIds.length === 0) return [];

  const supabase = createAdminClient();
  const { data: templates, error: templatesError } = await supabase
    .from("ticket_templates")
    .select(publicTicketTemplateSelect)
    .in("id", templateIds)
    .returns<PublicTicketTemplateRow[]>();
  if (templatesError) throw templatesError;

  const atmosphereDefaultsMap = await atmosphereDefaultsForInstances(
    supabase,
    instances,
  );

  const templateMap = new Map(
    (templates ?? []).map((template) => [template.id, template]),
  );
  return instances
    .map((instance) => {
      const template = templateMap.get(instance.template_id);
      return template
        ? toPublicPreviewTicket(
            instance,
            template,
            atmosphereDefaultsMap.get(instance.id),
          )
        : null;
    })
    .filter((ticket): ticket is GatheringTicket => Boolean(ticket));
}

export async function getAvailableMeetingTickets({
  userId,
  includeTestOnly = false,
}: {
  userId: string | null;
  includeTestOnly?: boolean;
}): Promise<GatheringTicket[]> {
  const supabase = createAdminClient();
  const visibilities = includeTestOnly
    ? ["public", "test_only"]
    : ["public"];
  const today = todayInKst();

  const { data: instances, error: instancesError } = await supabase
    .from("ticket_instances")
    .select(publicTicketInstanceSelect)
    .in("visibility", visibilities)
    .not("event_date", "is", null)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .returns<PublicTicketInstanceRow[]>();

  if (instancesError) throw instancesError;

  const tickets = await previewTicketsFromInstances(
    (instances ?? []).filter(
      (instance) =>
        !hasTicketStarted(instance.event_date, instance.event_time),
    ),
  );
  if (!userId) return tickets;

  const rejectionResult = await supabase
    .from("ticket_rejections")
    .select("ticket_instance_id")
    .eq("user_id", userId)
    .returns<Array<{ ticket_instance_id: string }>>();
  if (rejectionResult.error) throw rejectionResult.error;

  const rejectedIds = new Set(
    (rejectionResult.data ?? []).map((row) => row.ticket_instance_id),
  );
  return tickets.map((ticket) =>
    rejectedIds.has(ticket.id) ? { ...ticket, rejected: true } : ticket,
  );
}

export async function getRejectedMeetingTickets({
  userId,
  includeTestOnly = false,
}: {
  userId: string;
  includeTestOnly?: boolean;
}): Promise<GatheringTicket[]> {
  const supabase = createAdminClient();
  const visibilities = includeTestOnly
    ? ["public", "test_only"]
    : ["public"];

  const { data: rejections, error: rejectionsError } = await supabase
    .from("ticket_rejections")
    .select("ticket_instance_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<Array<{ ticket_instance_id: string; created_at: string }>>();
  if (rejectionsError) throw rejectionsError;

  const rejectedIds = Array.from(
    new Set((rejections ?? []).map((row) => row.ticket_instance_id)),
  );
  if (rejectedIds.length === 0) return [];

  const { data: instances, error: instancesError } = await supabase
    .from("ticket_instances")
    .select(publicTicketInstanceSelect)
    .in("id", rejectedIds)
    .in("visibility", visibilities)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("event_time", { ascending: true, nullsFirst: false })
    .returns<PublicTicketInstanceRow[]>();
  if (instancesError) throw instancesError;

  const tickets = await previewTicketsFromInstances(instances ?? []);
  return tickets.map((ticket) => ({ ...ticket, rejected: true }));
}

export async function getMeetingTicketsByInstanceIds({
  instanceIds,
  includeTestOnly = false,
}: {
  instanceIds: string[];
  includeTestOnly?: boolean;
}): Promise<GatheringTicket[]> {
  const ids = unique(instanceIds);
  if (ids.length === 0) return [];

  const supabase = createAdminClient();
  const visibilities = includeTestOnly
    ? ["public", "test_only"]
    : ["public"];
  const { data: instances, error } = await supabase
    .from("ticket_instances")
    .select(publicTicketInstanceSelect)
    .in("id", ids)
    .in("visibility", visibilities)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("event_time", { ascending: true, nullsFirst: false })
    .returns<PublicTicketInstanceRow[]>();
  if (error) throw error;

  return previewTicketsFromInstances(instances ?? []);
}

export async function getPublicTicketPreviewDate(): Promise<AvailableDate | null> {
  try {
    const supabase = createAdminClient();
    const { data: instances, error: instancesError } = await supabase
      .from("ticket_instances")
      .select(publicTicketInstanceSelect)
      .eq("visibility", "public")
      .not("event_date", "is", null)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: false })
      .returns<PublicTicketInstanceRow[]>();

    if (instancesError) throw instancesError;

    const publicInstances = instances ?? [];
    const today = todayInKst();
    const previewDate =
      publicInstances.find((instance) => (instance.event_date ?? "") >= today)
        ?.event_date ??
      publicInstances[0]?.event_date ??
      null;

    if (!previewDate) return null;

    const previewInstances = publicInstances.filter(
      (instance) => instance.event_date === previewDate,
    );
    const templateIds = Array.from(
      new Set(previewInstances.map((instance) => instance.template_id)),
    );

    if (templateIds.length === 0) return null;

    const { data: templates, error: templatesError } = await supabase
      .from("ticket_templates")
      .select(publicTicketTemplateSelect)
      .in("id", templateIds)
      .returns<PublicTicketTemplateRow[]>();

    if (templatesError) throw templatesError;

    const templateMap = new Map(
      (templates ?? []).map((template) => [template.id, template]),
    );
    const tickets = previewInstances
      .map((instance) => {
        const template = templateMap.get(instance.template_id);
        return template ? toPublicPreviewTicket(instance, template) : null;
      })
      .filter((ticket): ticket is GatheringTicket => Boolean(ticket));

    if (tickets.length === 0) return null;

    return {
      id: `date-${previewDate}`,
      date: previewDate,
      label: dateLabel(previewDate),
      tickets,
      ticketCount: tickets.length,
    };
  } catch (error) {
    console.error("[public ticket preview]", error);
    return null;
  }
}
