import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FunnelBasis = "event" | "acquisition";
type FunnelSource = "all" | "instagram" | "organic" | "direct" | "other";
type WindowRange = { start: Date; end: Date };
type SummaryStage = { stage_key: string; stage_order: number; user_count: number };
type SummaryDaily = { date: string; stages: Record<string, number> };
type SummaryResult = { rowsScanned?: number; stageCounts?: SummaryStage[]; daily?: SummaryDaily[] };

const dayMs = 24 * 60 * 60 * 1000;
const maxFunnelRangeDays = 31;
const funnelRequestTimeoutMs = 5000;
const stages = [
  { key: "landing_view", label: "랜딩 방문" },
  { key: "onboarding_start", label: "교집합 시작" },
  { key: "questions_complete", label: "질문 완료" },
  { key: "otp_verified", label: "전화번호 인증 완료" },
  { key: "ticket_detail_view", label: "티켓 상세 확인" },
  { key: "application_created", label: "신청 생성" },
  { key: "payment_completed", label: "결제 완료" },
] as const;

function startOfTodayInKst(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 60 * 60 * 1000);
}

function dateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00+09:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function selectedWindow(request: NextRequest): WindowRange {
  const from = dateParam(request.nextUrl.searchParams.get("from"));
  const to = dateParam(request.nextUrl.searchParams.get("to"));
  if (from && to && from <= to) {
    const end = new Date(to.getTime() + dayMs);
    const earliest = new Date(end.getTime() - maxFunnelRangeDays * dayMs);
    return { start: from < earliest ? earliest : from, end };
  }
  const today = startOfTodayInKst();
  return { start: new Date(today.getTime() - 6 * dayMs), end: new Date(today.getTime() + dayMs) };
}

function previousWindow(range: WindowRange): WindowRange {
  const duration = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - duration), end: new Date(range.start) };
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}

function normalizeSummary(summary: SummaryResult | null | undefined) {
  const countByKey = new Map((summary?.stageCounts ?? []).map((stage) => [stage.stage_key, Number(stage.user_count) || 0]));
  const visitorUsers = countByKey.get("landing_view") ?? 0;
  const totalUsers = Math.max(0, ...stages.map((stage) => countByKey.get(stage.key) ?? 0));
  const totalRateBase = visitorUsers || totalUsers;
  const reached = stages.map((stage, index) => {
    const count = countByKey.get(stage.key) ?? 0;
    const previousCount = index === 0 ? null : countByKey.get(stages[index - 1].key) ?? 0;
    const dropoff = previousCount == null ? 0 : Math.max(0, previousCount - count);
    return {
      stage_key: stage.key,
      stage_label: stage.label,
      stage_order: index + 1,
      user_count: count,
      total_rate: percent(count, totalRateBase),
      previous_stage_rate: previousCount == null ? null : percent(count, previousCount),
      dropoff_count: dropoff,
      dropoff_rate: previousCount == null ? null : percent(dropoff, previousCount),
    };
  });
  const finalStages = stages.map((stage, index) => {
    const current = countByKey.get(stage.key) ?? 0;
    const next = index + 1 < stages.length ? countByKey.get(stages[index + 1].key) ?? 0 : 0;
    const count = Math.max(0, current - next);
    return { stage_key: stage.key, stage_label: stage.label, stage_order: index + 1, user_count: count, total_rate: percent(count, totalRateBase) };
  });
  return {
    totalUsers,
    visitorUsers,
    reached,
    finalStages,
    daily: (summary?.daily ?? []).map((row) => ({ date: row.date, stages: row.stages ?? {} })),
    questionDropoff: [],
  };
}

async function loadSummary(range: WindowRange, basis: FunnelBasis, source: FunnelSource) {
  const { data, error } = await createAdminClient({ timeoutMs: funnelRequestTimeoutMs }).rpc("admin_funnel_summary", {
    p_started_at: range.start.toISOString(),
    p_ended_at: range.end.toISOString(),
    p_basis: basis,
    p_source: source,
  });
  if (error) throw error;
  return (data ?? {}) as SummaryResult;
}

export async function GET(request: NextRequest) {
  if (!isAdminSessionTokenValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const range = selectedWindow(request);
  const compare = request.nextUrl.searchParams.get("compare") !== "0";
  const basis: FunnelBasis = request.nextUrl.searchParams.get("basis") === "acquisition" ? "acquisition" : "event";
  const requestedSource = request.nextUrl.searchParams.get("source");
  const source: FunnelSource = ["instagram", "organic", "direct", "other"].includes(requestedSource ?? "") ? requestedSource as FunnelSource : "all";
  const priorRange = previousWindow(range);

  try {
    const [currentSummary, previousSummary] = await Promise.all([
      loadSummary(range, basis, source),
      compare ? loadSummary(priorRange, basis, source) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      basis,
      source,
      startedAt: range.start.toISOString(),
      endedAt: range.end.toISOString(),
      rowsScanned: Number(currentSummary.rowsScanned) || 0,
      ...normalizeSummary(currentSummary),
      comparison: previousSummary ? {
        startedAt: priorRange.start.toISOString(),
        endedAt: priorRange.end.toISOString(),
        ...normalizeSummary(previousSummary),
      } : null,
      tableMissing: false,
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("[admin funnel]", error);
    return NextResponse.json({ error: "Funnel facts could not be loaded." }, { status: 503, headers: { "Retry-After": "5" } });
  }
}
