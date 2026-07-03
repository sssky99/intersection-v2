import { createAdminClient } from "@/lib/supabase/admin";
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
  image_url: string | null;
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
  "image_url",
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

  return {
    id: instance.id,
    templateId: instance.template_id,
    title: instance.title || template.title,
    subtitle,
    date: instance.event_date,
    time,
    area,
    moodTags: template.mood_tags ?? [],
    activityType: template.activity_type,
    imageUrl: template.image_url ?? undefined,
    remainingSeatCount: instance.remaining_seat_label_count ?? 0,
    minimumParticipantCount:
      instance.minimum_participant_count ?? MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      instance.max_participant_count ?? MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: template.recommendation_copy ?? subtitle,
    reason: template.recommendation_copy ?? subtitle,
  };
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
