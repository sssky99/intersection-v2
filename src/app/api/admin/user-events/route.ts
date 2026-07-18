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
  "conversation_result_view",
  "recommendation_view",
  "ticket_detail_view",
  "application_intro_continue_click",
  "application_date_selected",
  "application_submit_click",
  "application_created",
  "payment_page_open",
  "membership_required_shown",
  "membership_required_close",
  "membership_purchase_notice_open",
  "membership_purchase_notice_close",
  "membership_purchase_click",
] as const;

const conversionBaseEvents: Record<string, string> = {
  application_intro_continue_click: "recommendation_view",
  application_date_selected: "application_intro_continue_click",
  application_submit_click: "application_date_selected",
  application_created: "application_submit_click",
  payment_page_open: "application_created",
  membership_required_shown: "application_submit_click",
  membership_required_close: "membership_required_shown",
  membership_purchase_notice_open: "membership_required_shown",
  membership_purchase_notice_close: "membership_purchase_notice_open",
  membership_purchase_click: "membership_purchase_notice_open",
};

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
type ProfileNameRow = {
  user_id: string;
  name: string | null;
};
type IdentityLookup = {
  anonymousProfileIds: Map<string, string>;
  profileNames: Map<string, string>;
};

const eventSelect =
  "id,anonymous_session_id,profile_id,application_id,event_name,path,referrer,user_agent,metadata,created_at";
const detailRowsLimit = 2000;
const maxDetailAnonymousIds = 50;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function uuidParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && uuidPattern.test(trimmed) ? trimmed : null;
}

function textParam(value: string | null, maxLength = 160) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
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

function profileName(row: ProfileNameRow) {
  return row.name?.trim() || null;
}

function resolvedProfileId(row: UserEventRow, lookup: IdentityLookup) {
  if (row.profile_id) return row.profile_id;
  if (!row.anonymous_session_id) return null;
  return lookup.anonymousProfileIds.get(row.anonymous_session_id) ?? null;
}

function fallbackIdentifier(row: UserEventRow) {
  return row.profile_id ?? row.anonymous_session_id ?? "unknown";
}

function displayIdentifier(row: UserEventRow, lookup: IdentityLookup) {
  const profileId = resolvedProfileId(row, lookup);
  if (profileId) {
    const name = lookup.profileNames.get(profileId);
    if (name) return name;
  }

  return fallbackIdentifier(row);
}

function applicantName(row: UserEventRow, lookup: IdentityLookup) {
  const profileId = resolvedProfileId(row, lookup);
  return profileId ? lookup.profileNames.get(profileId) ?? null : null;
}

function normalizeEvent(row: UserEventRow, lookup: IdentityLookup) {
  return {
    id: row.id,
    anonymous_session_id: row.anonymous_session_id,
    profile_id: row.profile_id,
    application_id: row.application_id,
    applicant_name: applicantName(row, lookup),
    display_identifier: displayIdentifier(row, lookup),
    event_name: row.event_name,
    path: row.path,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

function userKey(row: UserEventRow, lookup: IdentityLookup) {
  return resolvedProfileId(row, lookup) ?? row.anonymous_session_id ?? "unknown";
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function addTimelineRows(
  rowMap: Map<string, UserEventRow>,
  anonymousSessionIds: Set<string>,
  rows: UserEventRow[] | null,
) {
  for (const row of rows ?? []) {
    rowMap.set(row.id, row);
    if (row.anonymous_session_id) anonymousSessionIds.add(row.anonymous_session_id);
  }
}

async function fetchUserTimeline({
  anonymousSessionId,
  profileId,
  start,
}: {
  anonymousSessionId: string | null;
  profileId: string | null;
  start: string;
}) {
  const supabase = createAdminClient();
  const rowMap = new Map<string, UserEventRow>();
  const anonymousSessionIds = new Set<string>();

  if (anonymousSessionId) anonymousSessionIds.add(anonymousSessionId);

  if (profileId) {
    const { data, error } = await supabase
      .from("user_events")
      .select(eventSelect)
      .eq("profile_id", profileId)
      .gte("created_at", start)
      .order("created_at", { ascending: true })
      .limit(detailRowsLimit)
      .returns<UserEventRow[]>();

    if (error) throw error;
    addTimelineRows(rowMap, anonymousSessionIds, data ?? []);
  }

  const anonymousIdList = Array.from(anonymousSessionIds).slice(
    0,
    maxDetailAnonymousIds,
  );
  if (anonymousIdList.length > 0) {
    const { data, error } = await supabase
      .from("user_events")
      .select(eventSelect)
      .in("anonymous_session_id", anonymousIdList)
      .gte("created_at", start)
      .order("created_at", { ascending: true })
      .limit(detailRowsLimit)
      .returns<UserEventRow[]>();

    if (error) throw error;
    addTimelineRows(rowMap, anonymousSessionIds, data ?? []);
  }

  return Array.from(rowMap.values()).sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
}

async function identityLookup(rows: UserEventRow[]): Promise<IdentityLookup> {
  const supabase = createAdminClient();
  const profileIds = new Set<string>();
  const anonymousProfileIds = new Map<string, string>();

  for (const row of rows) {
    if (!row.profile_id) continue;

    profileIds.add(row.profile_id);
    if (row.anonymous_session_id && !anonymousProfileIds.has(row.anonymous_session_id)) {
      anonymousProfileIds.set(row.anonymous_session_id, row.profile_id);
    }
  }

  const profileNames = new Map<string, string>();
  const profileIdList = Array.from(profileIds);
  for (const chunk of chunkArray(profileIdList, 300)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,name")
      .in("user_id", chunk)
      .returns<ProfileNameRow[]>();

    if (error) throw error;

    for (const row of data ?? []) {
      const name = profileName(row);
      if (name) profileNames.set(row.user_id, name);
    }
  }

  return { anonymousProfileIds, profileNames };
}

function userSummaries(rows: UserEventRow[], lookup: IdentityLookup) {
  const summaries = new Map<
    string,
    {
      user_key: string;
      profile_id: string | null;
      anonymous_session_id: string | null;
      applicant_name: string | null;
      display_identifier: string;
      first_event_at: string;
      last_event_at: string;
      last_event_name: string;
      event_count: number;
    }
  >();

  for (const row of rows) {
    const key = userKey(row, lookup);
    const current = summaries.get(key);
    const rowProfileId = resolvedProfileId(row, lookup);
    const rowApplicantName = applicantName(row, lookup);
    const rowDisplayIdentifier = displayIdentifier(row, lookup);

    if (!current) {
      summaries.set(key, {
        user_key: key,
        profile_id: rowProfileId,
        anonymous_session_id: row.anonymous_session_id,
        applicant_name: rowApplicantName,
        display_identifier: rowDisplayIdentifier,
        first_event_at: row.created_at,
        last_event_at: row.created_at,
        last_event_name: row.event_name,
        event_count: 1,
      });
      continue;
    }

    current.event_count += 1;
    current.profile_id = current.profile_id ?? rowProfileId;
    current.anonymous_session_id =
      current.anonymous_session_id ?? row.anonymous_session_id;
    if (!current.applicant_name && rowApplicantName) {
      current.applicant_name = rowApplicantName;
      current.display_identifier = rowApplicantName;
    }
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
  const detailProfileId = uuidParam(request.nextUrl.searchParams.get("profileId"));
  const detailAnonymousSessionId = textParam(
    request.nextUrl.searchParams.get("anonymousSessionId"),
  );

  try {
    const supabase = createAdminClient();

    if (detailProfileId || detailAnonymousSessionId) {
      const timelineRows = await fetchUserTimeline({
        anonymousSessionId: detailAnonymousSessionId,
        profileId: detailProfileId,
        start,
      });
      const lookup = await identityLookup(timelineRows);

      return NextResponse.json({
        range,
        startedAt: start,
        timeline: timelineRows.map((row) => normalizeEvent(row, lookup)),
        tableMissing: false,
      });
    }

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
          .select(eventSelect)
          .gte("created_at", start)
          .order("created_at", { ascending: false })
          .limit(200)
          .returns<UserEventRow[]>(),
        supabase
          .from("user_events")
          .select(eventSelect)
          .gte("created_at", start)
          .order("created_at", { ascending: false })
          .limit(5000)
          .returns<UserEventRow[]>(),
      ]);
    if (logError) throw logError;
    if (summaryError) throw summaryError;
    const lookup = await identityLookup([...(logData ?? []), ...(summaryData ?? [])]);

    const countByEventName = new Map<string, number>(
      countResults.map((item) => [item.eventName, item.count]),
    );
    const funnel = countResults.map((item, index) => {
      const baseEventName =
        conversionBaseEvents[item.eventName] ??
        (index > 0 ? countResults[index - 1].eventName : null);
      const baseCount =
        baseEventName == null ? null : countByEventName.get(baseEventName) ?? 0;
      return {
        event_name: item.eventName,
        count: item.count,
        conversion_base_event_name: baseEventName,
        conversion_rate:
          baseCount && baseCount > 0
            ? Math.round((item.count / baseCount) * 1000) / 10
            : null,
      };
    });

    return NextResponse.json({
      range,
      startedAt: start,
      funnel,
      logs: (logData ?? []).map((row) => normalizeEvent(row, lookup)),
      userSummaries: userSummaries(summaryData ?? [], lookup),
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
          conversion_base_event_name: conversionBaseEvents[eventName] ?? null,
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
