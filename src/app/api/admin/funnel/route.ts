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
type ProfileFunnelRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  questions_completed: boolean | null;
  profile_completed: boolean | null;
  basic_info_completed_at: string | null;
  profile_completed_at: string | null;
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
type QuestionStepAccumulator = {
  stepKey: string;
  stepLabel: string;
  flowOrder: number;
  category: string | null;
  viewedUsers: Set<string>;
  answeredUsers: Set<string>;
  dropoffUsers: Set<string>;
};

const funnelStages: FunnelStage[] = [
  { key: "landing", label: "랜딩 방문", eventNames: ["landing_view"] },
  {
    key: "landing_video_complete",
    label: "랜딩 영상 완주",
    eventNames: ["landing_video_complete"],
  },
  {
    key: "phone_input_view",
    label: "전화번호 입력 화면 도달",
    eventNames: ["phone_input_view"],
  },
  {
    key: "phone_verification_complete",
    label: "전화번호 인증 완료",
    eventNames: ["phone_verification_complete"],
  },
  { key: "question_start", label: "질문 시작", eventNames: ["question_start"] },
  {
    key: "profile_photo_view",
    label: "사진 질문 도달",
    eventNames: ["profile_photo_view"],
  },
  {
    key: "profile_photo_submitted",
    label: "사진 제출",
    eventNames: ["profile_photo_submitted"],
  },
  {
    key: "profile_complete",
    label: "명단 등록·성향 배정",
    eventNames: ["profile_complete"],
    previousKey: "profile_photo_submitted",
  },
  { key: "invitation_yes", label: "초대 YES", eventNames: ["invitation_yes"] },
  {
    key: "payment_completed",
    label: "결제 완료",
    eventNames: ["payment_completed"],
    previousKey: "invitation_yes",
  },
];

const eventSelect =
  "id,anonymous_session_id,profile_id,event_name,path,referrer,metadata,created_at";
const pageSize = 1000;
const maxFunnelRows = 20000;
const maxFunnelRangeDays = 31;
const funnelRequestTimeoutMs = 5000;
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
    const maxStart = new Date(end.getTime() - maxFunnelRangeDays * dayMs);
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

function metadataNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function questionStep(row: UserEventRow) {
  if (row.event_name !== "question_view" && row.event_name !== "question_answered") {
    return null;
  }

  const questionKey = metadataText(row.metadata, "question_key");
  const questionOrder = metadataNumber(row.metadata, "question_order");
  const flowOrder = metadataNumber(row.metadata, "flow_order");
  const stepKey = questionKey || (questionOrder != null ? `question:${questionOrder}` : "");
  if (!stepKey || flowOrder == null) return null;

  const labels: Record<string, string> = {
    name: "이름 입력",
    gender: "성별 선택",
    photo: "사진 제출",
  };
  return {
    stepKey,
    stepLabel: labels[questionKey] ?? `질문 ${questionOrder ?? flowOrder}`,
    flowOrder,
    category: metadataText(row.metadata, "category") || null,
  };
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

async function fetchFunnelRows(start: string, end: string, signal: AbortSignal) {
  const supabase = createAdminClient({ timeoutMs: funnelRequestTimeoutMs });
  const eventNames = Array.from(
    new Set(funnelStages.flatMap((stage) => stage.eventNames)),
  );
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
      .abortSignal(signal)
      .returns<UserEventRow[]>();

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchCompletedProfiles(
  start: string,
  end: string,
  signal: AbortSignal,
) {
  const supabase = createAdminClient({ timeoutMs: funnelRequestTimeoutMs });
  const rows: ProfileFunnelRow[] = [];

  for (let from = 0; from < maxFunnelRows; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id,name,phone,questions_completed,profile_completed,basic_info_completed_at,profile_completed_at",
      )
      .or(`basic_info_completed_at.gte.${start},profile_completed_at.gte.${start}`)
      .order("user_id", { ascending: true })
      .range(from, from + pageSize - 1)
      .abortSignal(signal)
      .returns<ProfileFunnelRow[]>();

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const endTime = new Date(end).getTime();
  return rows.filter((profile) =>
    [profile.basic_info_completed_at, profile.profile_completed_at].some(
      (value) => value && new Date(value).getTime() < endTime,
    ),
  );
}

function profileStageRows(profiles: ProfileFunnelRow[]) {
  const rows: UserEventRow[] = [];

  profiles.forEach((profile) => {
    const hasBasicInfo = Boolean(
      profile.profile_completed && profile.name?.trim() && profile.phone?.trim(),
    );
    if (hasBasicInfo && profile.basic_info_completed_at) {
      rows.push({
        id: `profile-basic:${profile.user_id}`,
        anonymous_session_id: null,
        profile_id: profile.user_id,
        event_name: "basic_info_complete",
        path: null,
        referrer: null,
        metadata: { source: "profiles" },
        created_at: profile.basic_info_completed_at,
      });
    }

    if (
      hasBasicInfo &&
      profile.questions_completed &&
      profile.profile_completed_at
    ) {
      rows.push({
        id: `profile-complete:${profile.user_id}`,
        anonymous_session_id: null,
        profile_id: profile.user_id,
        event_name: "profile_complete",
        path: null,
        referrer: null,
        metadata: { source: "profiles" },
        created_at: profile.profile_completed_at,
      });
    }
  });

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
  const questionSteps = new Map<string, QuestionStepAccumulator>();

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

    const viewedQuestionSteps = selectedRows
      .filter((row) => row.event_name === "question_view")
      .map((row) => ({ row, step: questionStep(row) }))
      .filter(
        (entry): entry is { row: UserEventRow; step: NonNullable<ReturnType<typeof questionStep>> } =>
          Boolean(entry.step),
      );
    const answeredQuestionSteps = selectedRows
      .filter((row) => row.event_name === "question_answered")
      .map((row) => questionStep(row))
      .filter((step): step is NonNullable<ReturnType<typeof questionStep>> => Boolean(step));

    const accumulatorFor = (step: NonNullable<ReturnType<typeof questionStep>>) => {
      const existing = questionSteps.get(step.stepKey);
      if (existing) return existing;
      const next: QuestionStepAccumulator = {
        ...step,
        viewedUsers: new Set<string>(),
        answeredUsers: new Set<string>(),
        dropoffUsers: new Set<string>(),
      };
      questionSteps.set(step.stepKey, next);
      return next;
    };

    viewedQuestionSteps.forEach(({ step }) => accumulatorFor(step).viewedUsers.add(key));
    answeredQuestionSteps.forEach((step) => accumulatorFor(step).answeredUsers.add(key));

    const completedProfile = selectedRows.some(
      (row) => row.event_name === "profile_complete",
    );
    if (!completedProfile && viewedQuestionSteps.length > 0) {
      const lastViewed = [...viewedQuestionSteps].sort((left, right) => {
        const orderDifference = left.step.flowOrder - right.step.flowOrder;
        return orderDifference || left.row.created_at.localeCompare(right.row.created_at);
      }).at(-1);
      if (lastViewed) accumulatorFor(lastViewed.step).dropoffUsers.add(key);
    }

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

  const questionDropoff = Array.from(questionSteps.values())
    .sort((left, right) => left.flowOrder - right.flowOrder)
    .map((step) => ({
      step_key: step.stepKey,
      step_label: step.stepLabel,
      flow_order: step.flowOrder,
      category: step.category,
      viewed_users: step.viewedUsers.size,
      answered_users: step.answeredUsers.size,
      dropoff_users: step.dropoffUsers.size,
      answer_rate: percent(step.answeredUsers.size, step.viewedUsers.size),
      dropoff_rate: percent(step.dropoffUsers.size, step.viewedUsers.size),
    }));

  return { totalUsers, visitorUsers, reached, finalStages, daily, questionDropoff };
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), funnelRequestTimeoutMs);

  try {
    const [eventRows, completedProfiles] = await Promise.all([
      fetchFunnelRows(
        fetchStart.toISOString(),
        range.end.toISOString(),
        controller.signal,
      ),
      fetchCompletedProfiles(
        fetchStart.toISOString(),
        range.end.toISOString(),
        controller.signal,
      ),
    ]);
    const rows = [...eventRows, ...profileStageRows(completedProfiles)];
    const current = aggregateFunnel(rows, range, basis, source);
    const comparison = compare
      ? {
          startedAt: comparisonRange.start.toISOString(),
          endedAt: comparisonRange.end.toISOString(),
          ...aggregateFunnel(rows, comparisonRange, basis, source),
        }
      : null;

    return NextResponse.json(
      {
        basis,
        source,
        startedAt: range.start.toISOString(),
        endedAt: range.end.toISOString(),
        rowsScanned: eventRows.length,
        registeredProfilesScanned: completedProfiles.length,
        ...current,
        comparison,
        tableMissing: false,
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    if (error && typeof error === "object" && isMissingTableError(error as { code?: string; message?: string })) {
      return NextResponse.json(emptyResponse(range, basis, source, true));
    }
    console.error("[admin funnel]", error);
    return NextResponse.json(
      { error: "Funnel events could not be loaded." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  } finally {
    clearTimeout(timer);
  }
}
