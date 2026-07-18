import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FunnelBasis = "event" | "acquisition";
type FunnelSource = "all" | "instagram" | "organic" | "direct" | "other";
type UserEventRow = {
  id: string;
  anonymous_session_id: string | null;
  profile_id: string | null;
  event_name: string;
  path: string | null;
  referrer: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type FunnelStage = {
  key: string;
  label: string;
  eventNames: string[];
  previousKey?: string | null;
};
type WindowRange = { start: Date; end: Date };
type UserProgress = {
  reachedStageKeys: Set<string>;
  furthestStageKey: string;
  furthestStageOrder: number;
};

const funnelStages: FunnelStage[] = [
  { key: "landing", label: "랜딩 방문", eventNames: ["landing_view"] },
  { key: "kakao_login_click", label: "카카오 로그인 클릭", eventNames: ["kakao_login_click"] },
  { key: "kakao_auth_return", label: "카카오 인증 복귀", eventNames: ["kakao_auth_return"] },
  { key: "question_start", label: "질문 시작", eventNames: ["question_start"] },
  { key: "questions_complete", label: "질문 완료", eventNames: ["questions_complete"] },
  { key: "basic_info_complete", label: "기본정보 완료", eventNames: ["basic_info_complete"] },
  { key: "profile_generated", label: "프로필 완성", eventNames: ["profile_generated"] },
  { key: "recommendation_view", label: "추천 보기", eventNames: ["recommendation_view"] },
  { key: "ticket_detail_view", label: "티켓 상세 보기", eventNames: ["ticket_detail_view"] },
  { key: "application_submit_click", label: "신청 클릭", eventNames: ["application_submit_click"] },
  {
    key: "membership_required_shown",
    label: "멤버십 필요 표시",
    eventNames: ["membership_required_shown"],
    previousKey: "application_submit_click",
  },
  {
    key: "membership_purchase_notice_open",
    label: "결제 안내 열기",
    eventNames: ["membership_purchase_notice_open"],
    previousKey: "membership_required_shown",
  },
  {
    key: "membership_purchase_click",
    label: "결제창 이동",
    eventNames: ["membership_purchase_click"],
    previousKey: "membership_purchase_notice_open",
  },
  {
    key: "application_created",
    label: "신청 생성",
    eventNames: ["application_created"],
    previousKey: "application_submit_click",
  },
];

const eventSelect =
  "id,anonymous_session_id,profile_id,event_name,path,referrer,metadata,created_at";
const pageSize = 1000;
const maxFunnelRows = 100000;
const dayMs = 24 * 60 * 60 * 1000;

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function startOfTodayInKst(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) -
      9 * 60 * 60 * 1000,
  );
}

function dateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00+09:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function selectedWindow(request: NextRequest): WindowRange {
  const from = dateParam(request.nextUrl.searchParams.get("from"));
  const to = dateParam(request.nextUrl.searchParams.get("to"));
  if (from && to && from.getTime() <= to.getTime()) {
    const end = new Date(to.getTime() + dayMs);
    const maxStart = new Date(end.getTime() - 366 * dayMs);
    return { start: from < maxStart ? maxStart : from, end };
  }

  const today = startOfTodayInKst();
  return { start: new Date(today.getTime() - 6 * dayMs), end: new Date(today.getTime() + dayMs) };
}

function previousWindow(range: WindowRange): WindowRange {
  const duration = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - duration),
    end: new Date(range.start),
  };
}

function basisParam(value: string | null): FunnelBasis {
  return value === "acquisition" ? "acquisition" : "event";
}

function sourceParam(value: string | null): FunnelSource {
  return value === "instagram" || value === "organic" || value === "direct" || value === "other"
    ? value
    : "all";
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.toLowerCase().includes("user_events") === true;
}

function percent(part: number, total: number) {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function stageByEventName() {
  const map = new Map<string, { stage: FunnelStage; order: number }>();
  funnelStages.forEach((stage, index) => {
    stage.eventNames.forEach((eventName) => map.set(eventName, { stage, order: index + 1 }));
  });
  return map;
}

function anonymousProfileLookup(rows: UserEventRow[]) {
  const lookup = new Map<string, string>();
  rows.forEach((row) => {
    if (row.anonymous_session_id && row.profile_id) lookup.set(row.anonymous_session_id, row.profile_id);
  });
  return lookup;
}

function userKey(row: UserEventRow, anonymousProfiles: Map<string, string>) {
  if (row.profile_id) return row.profile_id;
  if (row.anonymous_session_id) {
    return anonymousProfiles.get(row.anonymous_session_id) ?? row.anonymous_session_id;
  }
  return `event:${row.id}`;
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function acquisitionSource(row: UserEventRow): Exclude<FunnelSource, "all"> {
  const source = metadataText(row.metadata, "utm_source");
  const medium = metadataText(row.metadata, "utm_medium");
  const initialReferrer = metadataText(row.metadata, "initial_referrer");
  const referrer = row.referrer?.toLowerCase() ?? "";
  const combined = `${source} ${medium} ${initialReferrer} ${referrer}`;

  if (/instagram|\big\b|facebook|\bmeta\b/.test(combined)) return "instagram";
  if (/organic|google|naver|daum|bing/.test(combined)) return "organic";
  if (!source && !initialReferrer && !referrer) return "direct";
  return "other";
}

function kstDate(value: string | Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

async function fetchFunnelRows(start: string, end: string) {
  const supabase = createAdminClient();
  const eventNames = Array.from(new Set(funnelStages.flatMap((stage) => stage.eventNames)));
  const rows: UserEventRow[] = [];

  for (let from = 0; from < maxFunnelRows; from += pageSize) {
    const { data, error } = await supabase
      .from("user_events")
      .select(eventSelect)
      .in("event_name", eventNames)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1)
      .returns<UserEventRow[]>();

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function aggregateFunnel(
  allRows: UserEventRow[],
  range: WindowRange,
  basis: FunnelBasis,
  sourceFilter: FunnelSource,
) {
  const stageLookup = stageByEventName();
  const anonymousProfiles = anonymousProfileLookup(allRows);
  const grouped = new Map<string, UserEventRow[]>();
  allRows.forEach((row) => {
    const key = userKey(row, anonymousProfiles);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });

  const progress = new Map<string, UserProgress>();
  const dailyStageUsers = new Map<string, Map<string, Set<string>>>();

  for (const [key, userRows] of grouped) {
    const attributionRow = userRows.find((row) => row.event_name === "landing_view") ?? userRows[0];
    if (sourceFilter !== "all" && acquisitionSource(attributionRow) !== sourceFilter) continue;

    const inWindow = (row: UserEventRow) => {
      const time = new Date(row.created_at).getTime();
      return time >= range.start.getTime() && time < range.end.getTime();
    };
    const landing = userRows.find((row) => row.event_name === "landing_view" && inWindow(row));
    const selectedRows =
      basis === "acquisition"
        ? landing
          ? userRows.filter((row) => {
              const time = new Date(row.created_at).getTime();
              return time >= new Date(landing.created_at).getTime() && time < range.end.getTime();
            })
          : []
        : userRows.filter(inWindow);
    if (selectedRows.length === 0) continue;

    let furthestStageKey = "landing";
    let furthestStageOrder = 0;
    const reachedStageKeys = new Set<string>();
    selectedRows.forEach((row) => {
      const entry = stageLookup.get(row.event_name);
      if (!entry) return;
      reachedStageKeys.add(entry.stage.key);
      if (entry.order > furthestStageOrder) {
        furthestStageOrder = entry.order;
        furthestStageKey = entry.stage.key;
      }

      const date = basis === "acquisition" && landing ? kstDate(landing.created_at) : kstDate(row.created_at);
      const stagesForDay = dailyStageUsers.get(date) ?? new Map<string, Set<string>>();
      const usersForStage = stagesForDay.get(entry.stage.key) ?? new Set<string>();
      usersForStage.add(key);
      stagesForDay.set(entry.stage.key, usersForStage);
      dailyStageUsers.set(date, stagesForDay);
    });
    progress.set(key, { reachedStageKeys, furthestStageKey, furthestStageOrder });
  }

  const totalUsers = progress.size;
  const reachedCounts = new Map<string, number>();
  const finalCounts = new Map<string, number>();
  progress.forEach((user) => {
    user.reachedStageKeys.forEach((stageKey) => reachedCounts.set(stageKey, (reachedCounts.get(stageKey) ?? 0) + 1));
    finalCounts.set(user.furthestStageKey, (finalCounts.get(user.furthestStageKey) ?? 0) + 1);
  });
  const visitorUsers = reachedCounts.get("landing") ?? 0;
  const totalRateBase = visitorUsers > 0 ? visitorUsers : totalUsers;

  const reached = funnelStages.map((stage, index) => {
    const count = reachedCounts.get(stage.key) ?? 0;
    const previousKey = stage.previousKey !== undefined ? stage.previousKey : index > 0 ? funnelStages[index - 1].key : null;
    const previousCount = previousKey ? reachedCounts.get(previousKey) ?? 0 : null;
    return {
      stage_key: stage.key,
      stage_label: stage.label,
      stage_order: index + 1,
      user_count: count,
      total_rate: percent(count, totalRateBase),
      previous_stage_rate: previousCount == null ? null : percent(count, previousCount),
      dropoff_count: previousCount == null ? 0 : Math.max(0, previousCount - count),
      dropoff_rate: previousCount == null ? null : percent(Math.max(0, previousCount - count), previousCount),
    };
  });
  const finalStages = funnelStages.map((stage, index) => {
    const count = finalCounts.get(stage.key) ?? 0;
    return {
      stage_key: stage.key,
      stage_label: stage.label,
      stage_order: index + 1,
      user_count: count,
      total_rate: percent(count, totalRateBase),
    };
  });
  const daily = Array.from(dailyStageUsers.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, stageUsers]) => ({
      date,
      total_users: new Set(Array.from(stageUsers.values()).flatMap((users) => Array.from(users))).size,
      stages: Object.fromEntries(funnelStages.map((stage) => [stage.key, stageUsers.get(stage.key)?.size ?? 0])),
    }));

  return { totalUsers, visitorUsers, reached, finalStages, daily };
}

function emptyResponse(range: WindowRange, basis: FunnelBasis, source: FunnelSource, tableMissing = false) {
  const empty = aggregateFunnel([], range, basis, source);
  return {
    basis,
    source,
    startedAt: range.start.toISOString(),
    endedAt: range.end.toISOString(),
    rowsScanned: 0,
    ...empty,
    comparison: null,
    tableMissing,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const range = selectedWindow(request);
  const comparisonRange = previousWindow(range);
  const compare = request.nextUrl.searchParams.get("compare") !== "0";
  const basis = basisParam(request.nextUrl.searchParams.get("basis"));
  const source = sourceParam(request.nextUrl.searchParams.get("source"));
  const fetchStart = compare ? comparisonRange.start : range.start;

  try {
    const rows = await fetchFunnelRows(fetchStart.toISOString(), range.end.toISOString());
    const current = aggregateFunnel(rows, range, basis, source);
    const comparison = compare
      ? {
          startedAt: comparisonRange.start.toISOString(),
          endedAt: comparisonRange.end.toISOString(),
          ...aggregateFunnel(rows, comparisonRange, basis, source),
        }
      : null;

    return NextResponse.json({
      basis,
      source,
      startedAt: range.start.toISOString(),
      endedAt: range.end.toISOString(),
      rowsScanned: rows.length,
      ...current,
      comparison,
      tableMissing: false,
    });
  } catch (error) {
    if (error && typeof error === "object" && isMissingTableError(error as { code?: string; message?: string })) {
      return NextResponse.json(emptyResponse(range, basis, source, true));
    }
    console.error("[admin funnel]", error);
    return NextResponse.json({ error: "Funnel events could not be loaded." }, { status: 500 });
  }
}
