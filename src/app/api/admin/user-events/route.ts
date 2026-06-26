import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const funnelEvents = [
  "landing_view",
  "kakao_login_click",
  "kakao_auth_return",
  "login_success",
  "question_start",
  "question_answered",
  "questions_complete",
  "basic_info_start",
  "basic_info_complete",
  "profile_generated",
  "recommendation_view",
  "ticket_detail_view",
  "application_submit_click",
  "application_created",
] as const;

type RangeKey = "today" | "7d" | "30d";
type UserEventRow = {
  id: string;
  anonymous_session_id: string | null;
  profile_id: string | null;
  application_id: string | null;
  event_name: string;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function rangeKey(value: string | null): RangeKey {
  if (value === "today" || value === "7d" || value === "30d") return value;
  return "7d";
}

function startOfTodayInKst(now = new Date()) {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffsetMs);
  return new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
    ) - kstOffsetMs,
  );
}

function rangeStart(range: RangeKey) {
  const now = new Date();
  if (range === "today") return startOfTodayInKst(now);

  const days = range === "30d" ? 30 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.toLowerCase().includes("user_events") === true
  );
}

function normalizeEvent(row: UserEventRow) {
  return {
    id: row.id,
    anonymous_session_id: row.anonymous_session_id,
    profile_id: row.profile_id,
    application_id: row.application_id,
    event_name: row.event_name,
    path: row.path,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

function userKey(row: UserEventRow) {
  return row.profile_id ?? row.anonymous_session_id ?? "unknown";
}

function userSummaries(rows: UserEventRow[]) {
  const summaries = new Map<
    string,
    {
      user_key: string;
      profile_id: string | null;
      anonymous_session_id: string | null;
      first_event_at: string;
      last_event_at: string;
      last_event_name: string;
      event_count: number;
    }
  >();

  for (const row of rows) {
    const key = userKey(row);
    const current = summaries.get(key);

    if (!current) {
      summaries.set(key, {
        user_key: key,
        profile_id: row.profile_id,
        anonymous_session_id: row.anonymous_session_id,
        first_event_at: row.created_at,
        last_event_at: row.created_at,
        last_event_name: row.event_name,
        event_count: 1,
      });
      continue;
    }

    current.event_count += 1;
    if (new Date(row.created_at).getTime() < new Date(current.first_event_at).getTime()) {
      current.first_event_at = row.created_at;
    }
    if (new Date(row.created_at).getTime() > new Date(current.last_event_at).getTime()) {
      current.last_event_at = row.created_at;
      current.last_event_name = row.event_name;
    }
  }

  return Array.from(summaries.values())
    .sort(
      (left, right) =>
        new Date(right.last_event_at).getTime() -
        new Date(left.last_event_at).getTime(),
    )
    .slice(0, 100);
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const range = rangeKey(request.nextUrl.searchParams.get("range"));
  const start = rangeStart(range).toISOString();

  try {
    const supabase = createAdminClient();

    const countResults = await Promise.all(
      funnelEvents.map(async (eventName) => {
        const { count, error } = await supabase
          .from("user_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", eventName)
          .gte("created_at", start);
        if (error) throw error;
        return { eventName, count: count ?? 0 };
      }),
    );

    const [{ data: logData, error: logError }, { data: summaryData, error: summaryError }] =
      await Promise.all([
        supabase
          .from("user_events")
          .select(
            "id,anonymous_session_id,profile_id,application_id,event_name,path,referrer,user_agent,metadata,created_at",
          )
          .gte("created_at", start)
          .order("created_at", { ascending: false })
          .limit(200)
          .returns<UserEventRow[]>(),
        supabase
          .from("user_events")
          .select(
            "id,anonymous_session_id,profile_id,application_id,event_name,path,referrer,user_agent,metadata,created_at",
          )
          .gte("created_at", start)
          .order("created_at", { ascending: false })
          .limit(5000)
          .returns<UserEventRow[]>(),
      ]);
    if (logError) throw logError;
    if (summaryError) throw summaryError;

    const funnel = countResults.map((item, index) => {
      const previousCount = index > 0 ? countResults[index - 1].count : null;
      return {
        event_name: item.eventName,
        count: item.count,
        conversion_rate:
          previousCount && previousCount > 0
            ? Math.round((item.count / previousCount) * 1000) / 10
            : null,
      };
    });

    return NextResponse.json({
      range,
      startedAt: start,
      funnel,
      logs: (logData ?? []).map(normalizeEvent),
      userSummaries: userSummaries(summaryData ?? []),
      tableMissing: false,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      isMissingTableError(error as { code?: string; message?: string })
    ) {
      return NextResponse.json({
        range,
        startedAt: start,
        funnel: funnelEvents.map((eventName) => ({
          event_name: eventName,
          count: 0,
          conversion_rate: null,
        })),
        logs: [],
        userSummaries: [],
        tableMissing: true,
      });
    }

    console.error("[admin user events]", error);
    return NextResponse.json(
      { error: "Visitor events could not be loaded." },
      { status: 500 },
    );
  }
}
