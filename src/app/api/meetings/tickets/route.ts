import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AvailableDate, GatheringTicket } from "@/types/ticket";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  detail_summary: string | null;
  detail_activities: unknown;
  detail_good_for: unknown;
  detail_notice: string | null;
  image_url: string | null;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  visibility: string;
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
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  remaining_seat_label_count: number | null;
  visibility: string;
};

type WaitlistRow = {
  ticket_id: string | null;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string | null;
};

type AssignmentRow = {
  ticket_instance_id: string;
};

const templateSelect = [
  "id",
  "title",
  "short_description",
  "detail_summary",
  "detail_activities",
  "detail_good_for",
  "detail_notice",
  "image_url",
  "mood_tags",
  "activity_type",
  "recommendation_copy",
  "default_region",
  "default_time",
  "visibility",
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
  "score_alcohol",
  "score_romance",
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

function textList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
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
    templateId: instance.template_id,
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
    detailSummary: template.detail_summary?.trim() || undefined,
    detailActivities: textList(template.detail_activities),
    detailGoodFor: textList(template.detail_good_for),
    detailNotice: template.detail_notice?.trim() || undefined,
    vibeScores: {
      temperature: template.score_temperature,
      texture: template.score_texture,
      tone: template.score_tone,
      rhythm: template.score_rhythm,
      alcohol: template.score_alcohol,
      romance: template.score_romance,
    },
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

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const includeApplied = requestUrl.searchParams.get("includeApplied") === "1";
    const supabase = createAdminClient();
    const userSupabase = await createClient();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();

    const { data: instances, error: instancesError } = await supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .eq("visibility", "public")
      .not("event_date", "is", null)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: false });

    if (instancesError) throw instancesError;

    const publicInstanceRows = (instances ?? []) as unknown as InstanceRow[];
    let testInstanceRows: InstanceRow[] = [];

    if (user) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("ticket_assignments")
        .select("ticket_instance_id")
        .eq("profile_id", user.id)
        .returns<AssignmentRow[]>();

      if (assignmentsError) throw assignmentsError;

      const testInstanceIds = Array.from(
        new Set(
          (assignments ?? [])
            .map((assignment) => assignment.ticket_instance_id)
            .filter(Boolean),
        ),
      );

      if (testInstanceIds.length > 0) {
        const { data: assignedInstances, error: assignedInstancesError } =
          await supabase
            .from("ticket_instances")
            .select(instanceSelect)
            .in("id", testInstanceIds)
            .eq("visibility", "test_only")
            .not("event_date", "is", null)
            .order("event_date", { ascending: true })
            .order("event_time", { ascending: true, nullsFirst: false });

        if (assignedInstancesError) throw assignedInstancesError;
        testInstanceRows = (assignedInstances ?? []) as unknown as InstanceRow[];
      }
    }

    const instanceRows = Array.from(
      new Map(
        [...publicInstanceRows, ...testInstanceRows].map((instance) => [
          instance.id,
          instance,
        ]),
      ).values(),
    ).sort((left, right) =>
      `${left.event_date ?? ""}${left.event_time ?? ""}${left.title}`.localeCompare(
        `${right.event_date ?? ""}${right.event_time ?? ""}${right.title}`,
      ),
    );
    const instanceMap = new Map(
      instanceRows.map((instance) => [instance.id, instance]),
    );
    const excludedTemplateDates = new Set<string>();

    if (!includeApplied && user) {
      const { data: waitlistRows, error: waitlistError } = await userSupabase
        .from("meeting_waitlist")
        .select(
          "ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status",
        )
        .eq("user_id", user.id)
        .returns<WaitlistRow[]>();

      if (waitlistError) throw waitlistError;

      for (const row of waitlistRows ?? []) {
        const linkedInstance =
          (row.ticket_instance_id
            ? instanceMap.get(row.ticket_instance_id)
            : null) ??
          (row.ticket_id ? instanceMap.get(row.ticket_id) : null);
        const templateId =
          row.ticket_template_id ?? linkedInstance?.template_id ?? null;
        const meetingDate = row.meeting_date ?? linkedInstance?.event_date ?? null;

        if (templateId && meetingDate) {
          excludedTemplateDates.add(`${templateId}|${meetingDate}`);
        }
      }
    }

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
      .filter(
        (instance) =>
          !excludedTemplateDates.has(
            `${instance.template_id}|${instance.event_date ?? ""}`,
          ),
      )
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
