import { createAdminClient } from "@/lib/supabase/admin";
import {
  displayTicketCourseSteps,
  ensureMinimumStoredTicketCourseSteps,
  legacyStoredTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
} from "@/lib/ticketCourse";
import { todayInKst } from "@/lib/ticketDate";
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
  default_region: string | null;
  default_time: string | null;
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
  "default_region",
  "default_time",
].join(",");

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
    detailSummary: template.detail_summary ?? subtitle,
    detailActivities: template.detail_activities ?? [],
    detailFlow: template.detail_flow ?? [],
    detailGoodFor: template.detail_good_for ?? [],
    detailNotice: template.detail_notice ?? undefined,
  };
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

  const templateMap = new Map(
    (templates ?? []).map((template) => [template.id, template]),
  );
  return instances
    .map((instance) => {
      const template = templateMap.get(instance.template_id);
      return template ? toPublicPreviewTicket(instance, template) : null;
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

  const tickets = await previewTicketsFromInstances(instances ?? []);
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
