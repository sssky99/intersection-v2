import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RangeKey = "today" | "7d" | "30d";
type UserEventRow = {
  id: string;
  anonymous_session_id: string | null;
  profile_id: string | null;
  event_name: string;
  created_at: string;
};
type FunnelStage = {
  key: string;
  label: string;
  eventNames: string[];
  previousKey?: string | null;
};
type UserProgress = {
  userKey: string;
  reachedStageKeys: Set<string>;
  furthestStageKey: string;
  furthestStageOrder: number;
  lastEventAt: string;
};

const funnelStages: FunnelStage[] = [
  { key: "landing", label: "랜딩 방문", eventNames: ["landing_view"] },
  {
    key: "kakao_login_click",
    label: "카카오 로그인 클릭",
    eventNames: ["kakao_login_click"],
  },
  {
    key: "kakao_auth_return",
    label: "카카오 인증 복귀",
    eventNames: ["kakao_auth_return"],
  },
  { key: "question_start", label: "질문 시작", eventNames: ["question_start"] },
  {
    key: "questions_complete",
    label: "질문 완료",
    eventNames: ["questions_complete"],
  },
  {
    key: "basic_info_complete",
    label: "기본정보 완료",
    eventNames: ["basic_info_complete"],
  },
  {
    key: "profile_generated",
    label: "프로필 생성",
    eventNames: ["profile_generated"],
  },
  {
    key: "recommendation_view",
    label: "추천 보기",
    eventNames: ["recommendation_view"],
  },
  {
    key: "ticket_detail_view",
    label: "티켓 상세 보기",
    eventNames: ["ticket_detail_view"],
  },
  {
    key: "application_submit_click",
    label: "신청 클릭",
    eventNames: ["application_submit_click"],
  },
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

const eventSelect = "id,anonymous_session_id,profile_id,event_name,created_at";
const pageSize = 1000;
const maxFunnelRows = 50000;

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

function percent(part: number, total: number) {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function stageByEventName() {
  const map = new Map<string, { stage: FunnelStage; order: number }>();
  funnelStages.forEach((stage, index) => {
    for (const eventName of stage.eventNames) {
      map.set(eventName, { stage, order: index + 1 });
    }
  });
  return map;
}

function anonymousProfileLookup(rows: UserEventRow[]) {
  const lookup = new Map<string, string>();
  for (const row of rows) {
    if (row.anonymous_session_id && row.profile_id) {
      lookup.set(row.anonymous_session_id, row.profile_id);
    }
  }
  return lookup;
}

function userKey(row: UserEventRow, anonymousProfiles: Map<string, string>) {
  if (row.profile_id) return row.profile_id;
  if (row.anonymous_session_id) {
    return anonymousProfiles.get(row.anonymous_session_id) ?? row.anonymous_session_id;
  }
  return `event:${row.id}`;
}

async function fetchFunnelRows(start: string) {
  const supabase = createAdminClient();
  const eventNames = Array.from(
    new Set(funnelStages.flatMap((stage) => stage.eventNames)),
  );
  const rows: UserEventRow[] = [];

  for (let from = 0; from < maxFunnelRows; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("user_events")
      .select(eventSelect)
      .in("event_name", eventNames)
      .gte("created_at", start)
      .order("created_at", { ascending: true })
      .range(from, to)
      .returns<UserEventRow[]>();

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

function progressByUser(rows: UserEventRow[]) {
  const stageLookup = stageByEventName();
  const anonymousProfiles = anonymousProfileLookup(rows);
  const progress = new Map<string, UserProgress>();

  for (const row of rows) {
    const stageEntry = stageLookup.get(row.event_name);
    if (!stageEntry) continue;

    const key = userKey(row, anonymousProfiles);
    const current = progress.get(key) ?? {
      userKey: key,
      reachedStageKeys: new Set<string>(),
      furthestStageKey: stageEntry.stage.key,
      furthestStageOrder: stageEntry.order,
      lastEventAt: row.created_at,
    };

    current.reachedStageKeys.add(stageEntry.stage.key);
    if (
      stageEntry.order > current.furthestStageOrder ||
      (stageEntry.order === current.furthestStageOrder &&
        new Date(row.created_at).getTime() >
          new Date(current.lastEventAt).getTime())
    ) {
      current.furthestStageKey = stageEntry.stage.key;
      current.furthestStageOrder = stageEntry.order;
      current.lastEventAt = row.created_at;
    }

    progress.set(key, current);
  }

  return Array.from(progress.values());
}

function emptyResponse(range: RangeKey, start: string, tableMissing = false) {
  return {
    range,
    startedAt: start,
    totalUsers: 0,
    rowsScanned: 0,
    reached: funnelStages.map((stage, index) => ({
      stage_key: stage.key,
      stage_label: stage.label,
      stage_order: index + 1,
      user_count: 0,
      total_rate: null,
      previous_stage_rate: null,
    })),
    finalStages: funnelStages.map((stage, index) => ({
      stage_key: stage.key,
      stage_label: stage.label,
      stage_order: index + 1,
      user_count: 0,
      total_rate: null,
    })),
    tableMissing,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const range = rangeKey(request.nextUrl.searchParams.get("range"));
  const start = rangeStart(range).toISOString();

  try {
    const rows = await fetchFunnelRows(start);
    const users = progressByUser(rows);
    const totalUsers = users.length;

    const reachedCounts = new Map<string, number>();
    const finalCounts = new Map<string, number>();

    for (const user of users) {
      for (const stageKey of user.reachedStageKeys) {
        reachedCounts.set(stageKey, (reachedCounts.get(stageKey) ?? 0) + 1);
      }
      finalCounts.set(
        user.furthestStageKey,
        (finalCounts.get(user.furthestStageKey) ?? 0) + 1,
      );
    }

    const reached = funnelStages.map((stage, index) => {
      const count = reachedCounts.get(stage.key) ?? 0;
      const previousStageKey =
        stage.previousKey !== undefined
          ? stage.previousKey
          : index > 0
            ? funnelStages[index - 1].key
            : null;
      const previousCount = previousStageKey
        ? reachedCounts.get(previousStageKey) ?? 0
        : null;

      return {
        stage_key: stage.key,
        stage_label: stage.label,
        stage_order: index + 1,
        user_count: count,
        total_rate: percent(count, totalUsers),
        previous_stage_rate:
          previousCount == null ? null : percent(count, previousCount),
      };
    });

    const finalStages = funnelStages.map((stage, index) => {
      const count = finalCounts.get(stage.key) ?? 0;
      return {
        stage_key: stage.key,
        stage_label: stage.label,
        stage_order: index + 1,
        user_count: count,
        total_rate: percent(count, totalUsers),
      };
    });

    return NextResponse.json({
      range,
      startedAt: start,
      totalUsers,
      rowsScanned: rows.length,
      reached,
      finalStages,
      tableMissing: false,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      isMissingTableError(error as { code?: string; message?: string })
    ) {
      return NextResponse.json(emptyResponse(range, start, true));
    }

    console.error("[admin funnel]", error);
    return NextResponse.json(
      { error: "Funnel events could not be loaded." },
      { status: 500 },
    );
  }
}
