import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonAxis = "temperature" | "texture" | "tone" | "rhythm";
type PlaceAxis = PersonAxis | "alcohol" | "romance";

type MeetingFeedbackRow = {
  id: string;
  waitlist_id: number | string;
  user_id: string;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
  ticket_snapshot: Record<string, unknown> | null;
  selected_member_ids: string[] | null;
  member_feedback: Record<string, unknown> | null;
  place_feedback: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type TicketInstanceRow = {
  id: string;
  template_id: string | null;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
};

type TicketTemplateRow = {
  id: string;
  title: string;
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
};

const personAxes: PersonAxis[] = ["temperature", "texture", "tone", "rhythm"];
const placeAxes: PlaceAxis[] = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
  "alcohol",
  "romance",
];

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

function negativeMemberIds(placeFeedback: Record<string, unknown> | null) {
  const value = placeFeedback?.negative_member_feedback;
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value);
}

function scoreColumn(axis: PersonAxis) {
  return `score_${axis}` as const;
}

function avgColumn(axis: PlaceAxis) {
  return `avg_${axis}` as const;
}

function sanitizePersonScores(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const result: Partial<Record<ReturnType<typeof scoreColumn>, number | null>> = {};

  for (const axis of personAxes) {
    const key = scoreColumn(axis);
    const score = raw[key] ?? raw[axis];
    if (score === null || score === "") {
      result[key] = null;
      continue;
    }
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < -100 ||
      score > 100
    ) {
      return null;
    }
    result[key] = score;
  }

  return result;
}

function sanitizePlaceAverages(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const result: Partial<Record<ReturnType<typeof avgColumn>, number | null>> = {};

  for (const axis of placeAxes) {
    const score = raw[axis] ?? raw[avgColumn(axis)];
    const key = avgColumn(axis);
    if (score === null || score === undefined || score === "") {
      result[key] = null;
      continue;
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 1 || score > 5) {
      return null;
    }
    result[key] = Math.round(score * 100) / 100;
  }

  return result;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    const { data: feedbacksData, error: feedbacksError } = await supabase
      .from("meeting_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<MeetingFeedbackRow[]>();
    if (feedbacksError) throw feedbacksError;

    const feedbacks = feedbacksData ?? [];
    const instanceIds = unique(feedbacks.map((row) => row.ticket_instance_id));
    const initialTemplateIds = unique(feedbacks.map((row) => row.ticket_template_id));
    const profileIds = unique(
      feedbacks.flatMap((row) => [
        row.user_id,
        ...(Array.isArray(row.selected_member_ids) ? row.selected_member_ids : []),
        ...Object.keys(row.member_feedback ?? {}),
        ...negativeMemberIds(row.place_feedback),
      ]),
    );

    const [{ data: instancesData, error: instancesError }, { data: profilesData, error: profilesError }] =
      await Promise.all([
        instanceIds.length
          ? supabase
              .from("ticket_instances")
              .select("id,template_id,title,event_date,event_time,region,place_name,address")
              .in("id", instanceIds)
              .returns<TicketInstanceRow[]>()
          : Promise.resolve({ data: [] as TicketInstanceRow[], error: null }),
        profileIds.length
          ? supabase
              .from("profiles")
              .select(
                "user_id,name,nickname,phone,score_temperature,score_texture,score_tone,score_rhythm",
              )
              .in("user_id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (instancesError) throw instancesError;
    if (profilesError) throw profilesError;

    const instances = instancesData ?? [];
    const templateIds = unique([
      ...initialTemplateIds,
      ...instances.map((instance) => instance.template_id),
    ]);

    const [{ data: templatesData, error: templatesError }, { data: averagesData, error: averagesError }] =
      await Promise.all([
        templateIds.length
          ? supabase
              .from("ticket_templates")
              .select(
                "id,title,score_temperature,score_texture,score_tone,score_rhythm,score_alcohol,score_romance",
              )
              .in("id", templateIds)
              .returns<TicketTemplateRow[]>()
          : Promise.resolve({ data: [] as TicketTemplateRow[], error: null }),
        instanceIds.length
          ? supabase
              .from("ticket_feedback_averages")
              .select("*")
              .in("ticket_instance_id", instanceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (templatesError) throw templatesError;
    if (averagesError) throw averagesError;

    return NextResponse.json({
      feedbacks,
      profiles: profilesData ?? [],
      instances,
      templates: templatesData ?? [],
      averages: averagesData ?? [],
    });
  } catch (error) {
    console.error("[admin feedback GET]", error);
    return NextResponse.json(
      { error: "Feedback data could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        profileId?: unknown;
        scores?: unknown;
        ticketInstanceId?: unknown;
        ticketTemplateId?: unknown;
        averages?: unknown;
        feedbackCount?: unknown;
      }
    | null;

  try {
    const supabase = createAdminClient();

    if (body?.action === "apply_member_score") {
      const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
      const scores = sanitizePersonScores(body.scores);
      if (!profileId || !scores) {
        return NextResponse.json({ error: "Invalid member score payload." }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(scores)
        .eq("user_id", profileId)
        .select(
          "user_id,name,nickname,phone,score_temperature,score_texture,score_tone,score_rhythm",
        )
        .single();
      if (error) throw error;

      return NextResponse.json({ profile: data });
    }

    if (body?.action === "save_place_average") {
      const ticketInstanceId =
        typeof body.ticketInstanceId === "string" ? body.ticketInstanceId.trim() : "";
      const ticketTemplateId =
        typeof body.ticketTemplateId === "string" ? body.ticketTemplateId.trim() : null;
      const averages = sanitizePlaceAverages(body.averages);
      const feedbackCount =
        typeof body.feedbackCount === "number" &&
        Number.isInteger(body.feedbackCount) &&
        body.feedbackCount >= 0
          ? body.feedbackCount
          : 0;

      if (!ticketInstanceId || !averages) {
        return NextResponse.json({ error: "Invalid place average payload." }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("ticket_feedback_averages")
        .upsert(
          {
            ticket_instance_id: ticketInstanceId,
            ticket_template_id: ticketTemplateId,
            ...averages,
            feedback_count: feedbackCount,
            feedback_average_applied_at: now,
            updated_at: now,
          },
          { onConflict: "ticket_instance_id" },
        )
        .select("*")
        .single();
      if (error) throw error;

      return NextResponse.json({ average: data });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("[admin feedback POST]", error);
    return NextResponse.json(
      { error: "Feedback action could not be completed." },
      { status: 500 },
    );
  }
}
