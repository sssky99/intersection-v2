import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailableDate, GatheringTicket } from "@/types/ticket";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  image_url: string | null;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  visibility: string;
};

type InstanceRow = {
  id: string;
  template_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  remaining_seat_label_count: number | null;
  visibility: string;
};

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
].join(",");

const instanceSelect = [
  "id",
  "template_id",
  "title",
  "event_date",
  "event_time",
  "region",
  "remaining_seat_label_count",
  "visibility",
].join(",");

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = weekdayLabels[date.getUTCDay()] ?? "";
  return `${month}월 ${day}일 ${weekday}요일`;
}

function toTicket(
  instance: InstanceRow,
  template: TemplateRow,
): GatheringTicket | null {
  if (!instance.event_date) return null;

  const time = instance.event_time?.slice(0, 5) ?? template.default_time?.slice(0, 5);
  if (!time) return null;

  const area = instance.region ?? template.default_region ?? "지역 미정";
  const subtitle =
    template.short_description ??
    template.recommendation_copy ??
    "교집합이 준비한 실제 운영 모임";

  return {
    id: instance.id,
    title: instance.title || template.title,
    subtitle,
    date: instance.event_date,
    time,
    area,
    moodTags: template.mood_tags ?? [],
    imageUrl: template.image_url ?? undefined,
    remainingSeatCount: instance.remaining_seat_label_count ?? 0,
    peopleHint: template.recommendation_copy ?? subtitle,
    reason: template.recommendation_copy ?? subtitle,
  };
}

function groupByDate(tickets: GatheringTicket[]) {
  const groups = new Map<string, GatheringTicket[]>();

  for (const ticket of tickets) {
    groups.set(ticket.date, [...(groups.get(ticket.date) ?? []), ticket]);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([date, dateTickets]): AvailableDate => ({
        id: `date-${date}`,
        date,
        label: dateLabel(date),
        tickets: dateTickets.sort((left, right) =>
          `${left.time}${left.title}`.localeCompare(`${right.time}${right.title}`),
        ),
      }),
    );
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: instances, error: instancesError } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .eq("visibility", "public")
      .not("event_date", "is", null)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: false });

    if (instancesError) throw instancesError;

    const instanceRows = (instances ?? []) as unknown as InstanceRow[];
    const templateIds = Array.from(
      new Set(instanceRows.map((instance) => instance.template_id)),
    );

    if (templateIds.length === 0) {
      return NextResponse.json({ dates: [] satisfies AvailableDate[] });
    }

    const { data: templates, error: templatesError } = await supabase
      .from("ticket_templates")
      .select(templateSelect)
      .in("id", templateIds);

    if (templatesError) throw templatesError;

    const templateMap = new Map(
      ((templates ?? []) as unknown as TemplateRow[]).map((template) => [
        template.id,
        template,
      ]),
    );

    const tickets = instanceRows
      .map((instance) => {
        const template = templateMap.get(instance.template_id);
        return template ? toTicket(instance, template) : null;
      })
      .filter((ticket): ticket is GatheringTicket => Boolean(ticket));

    return NextResponse.json({ dates: groupByDate(tickets) });
  } catch (error) {
    console.error("[meetings tickets]", error);
    return NextResponse.json(
      { error: "모임 티켓 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
