import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
};

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
              .select("user_id,name,nickname,phone")
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

    const { data: templatesData, error: templatesError } = templateIds.length
      ? await supabase
          .from("ticket_templates")
          .select("id,title")
          .in("id", templateIds)
          .returns<TicketTemplateRow[]>()
      : { data: [] as TicketTemplateRow[], error: null };
    if (templatesError) throw templatesError;

    return NextResponse.json({
      feedbacks,
      profiles: profilesData ?? [],
      instances,
      templates: templatesData ?? [],
    });
  } catch (error) {
    console.error("[admin feedback GET]", error);
    return NextResponse.json(
      { error: "Feedback data could not be loaded." },
      { status: 500 },
    );
  }
}
