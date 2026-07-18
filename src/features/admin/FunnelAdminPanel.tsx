"use client";

import { CalendarDays, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type FunnelBasis = "event" | "acquisition";
type FunnelSource = "all" | "instagram" | "organic" | "direct" | "other";
type FunnelStageMetric = {
  stage_key: string;
  stage_label: string;
  stage_order: number;
  user_count: number;
  total_rate: number | null;
  previous_stage_rate?: number | null;
  dropoff_count?: number;
  dropoff_rate?: number | null;
};
type DailyMetric = {
  date: string;
  total_users: number;
  stages: Record<string, number>;
};
type FunnelAggregate = {
  totalUsers: number;
  visitorUsers: number;
  reached: FunnelStageMetric[];
  finalStages: FunnelStageMetric[];
  daily: DailyMetric[];
};
type FunnelResponse = FunnelAggregate & {
  basis: FunnelBasis;
  source: FunnelSource;
  startedAt: string;
  endedAt: string;
  rowsScanned: number;
  comparison: (FunnelAggregate & { startedAt: string; endedAt: string }) | null;
  tableMissing?: boolean;
  error?: string;
};

const summaryStageKeys = [
  "landing",
  "question_start",
  "questions_complete",
  "application_submit_click",
  "membership_purchase_click",
] as const;

const trendSeries = [
  { key: "landing", label: "방문", color: "#111111" },
  { key: "questions_complete", label: "질문 완료", color: "#7eb3c7" },
  { key: "application_submit_click", label: "신청 클릭", color: "#d88a5b" },
  { key: "membership_purchase_click", label: "결제 이동", color: "#7d9b76" },
] as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function localDateString(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function initialDates() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: localDateString(from), to: localDateString(to) };
}

function formatRate(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toLocaleString()}%` : "-";
}

function stageMetric(metrics: FunnelStageMetric[] | undefined, stageKey: string) {
  return metrics?.find((metric) => metric.stage_key === stageKey) ?? null;
}

function barWidth(value: number | null | undefined) {
  return `${Math.max(0, Math.min(100, value ?? 0))}%`;
}

function changePercent(current: number, previous: number | undefined) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function ComparisonBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[10px] font-semibold text-black/30">비교값 없음</span>;
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-black", positive ? "text-emerald-600" : "text-red-500")}>
      {positive ? <TrendingUp size={11} aria-hidden /> : <TrendingDown size={11} aria-hidden />}
      이전 기간 대비 {positive ? "+" : ""}{value}%
    </span>
  );
}

function DailyTrendChart({ rows }: { rows: DailyMetric[] }) {
  const width = 860;
  const height = 250;
  const padding = { left: 42, right: 18, top: 18, bottom: 38 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...rows.flatMap((row) => trendSeries.map((series) => row.stages[series.key] ?? 0)));
  const x = (index: number) => padding.left + (rows.length <= 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight;

  if (rows.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm font-semibold text-black/35">선택한 기간의 추이 데이터가 없습니다.</div>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {trendSeries.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-black/50">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] w-full" role="img" aria-label="날짜별 퍼널 추이">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const lineY = padding.top + innerHeight * ratio;
            return (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} stroke="rgba(0,0,0,0.08)" />
                <text x={padding.left - 8} y={lineY + 4} textAnchor="end" fontSize="10" fill="rgba(0,0,0,0.38)">
                  {Math.round(maxValue * (1 - ratio))}
                </text>
              </g>
            );
          })}
          {trendSeries.map((series) => (
            <polyline
              key={series.key}
              points={rows.map((row, index) => `${x(index)},${y(row.stages[series.key] ?? 0)}`).join(" ")}
              fill="none"
              stroke={series.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {rows.map((row, index) => (
            <text key={row.date} x={x(index)} y={height - 10} textAnchor="middle" fontSize="10" fill="rgba(0,0,0,0.42)">
              {row.date.slice(5).replace("-", ".")}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function FunnelAdminPanel() {
  const initial = useMemo(initialDates, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [basis, setBasis] = useState<FunnelBasis>("acquisition");
  const [source, setSource] = useState<FunnelSource>("all");
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFunnel = useCallback(async () => {
    if (!from || !to || from > to) {
      setError("시작일과 종료일을 확인해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to, basis, source, compare: compare ? "1" : "0" });
    try {
      const response = await fetch(`/api/admin/funnel?${params.toString()}`, { cache: "no-store" });
      const nextData = (await response.json().catch(() => null)) as FunnelResponse | null;
      if (!response.ok || !nextData) throw new Error(nextData?.error ?? "funnel-load-failed");
      setData(nextData);
    } catch {
      setError("퍼널 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [basis, compare, from, source, to]);

  useEffect(() => {
    void loadFunnel();
  }, [loadFunnel]);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    setFrom(localDateString(start));
    setTo(localDateString(end));
  };

  const summaryMetrics = useMemo(
    () => summaryStageKeys.map((key) => stageMetric(data?.reached, key)).filter((metric): metric is FunnelStageMetric => Boolean(metric)),
    [data?.reached],
  );
  const visibleFinalStages = useMemo(() => (data?.finalStages ?? []).filter((stage) => stage.user_count > 0), [data?.finalStages]);

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">퍼널 관리</h2>
            <p className="mt-1 text-xs text-black/45">사용자 단위 중복 제거 · 분석 이벤트 {(data?.rowsScanned ?? 0).toLocaleString()}건</p>
          </div>
          <button type="button" onClick={() => void loadFunnel()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 disabled:opacity-45">
            <RefreshCw size={15} aria-hidden className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl bg-[#f7f7f5] p-3 lg:grid-cols-[minmax(270px,1fr)_160px_150px_auto]">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-black/40" aria-hidden />
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold" />
              <span className="text-black/30">~</span>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold" />
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1, 7, 14, 30].map((days) => (
                <button key={days} type="button" onClick={() => applyPreset(days)} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-black/45 hover:text-black">
                  {days === 1 ? "오늘" : `${days}일`}
                </button>
              ))}
            </div>
          </div>
          <label className="text-[11px] font-bold text-black/40">
            집계 기준
            <select value={basis} onChange={(event) => setBasis(event.target.value as FunnelBasis)} className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-black/70">
              <option value="acquisition">유입일 기준</option>
              <option value="event">이벤트일 기준</option>
            </select>
          </label>
          <label className="text-[11px] font-bold text-black/40">
            유입경로
            <select value={source} onChange={(event) => setSource(event.target.value as FunnelSource)} className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-black/70">
              <option value="all">전체</option>
              <option value="instagram">인스타 광고</option>
              <option value="organic">검색 유입</option>
              <option value="direct">직접 유입</option>
              <option value="other">기타</option>
            </select>
          </label>
          <label className="flex h-10 self-end items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-black/55">
            <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} className="h-4 w-4 accent-black" />
            이전 동일 기간 비교
          </label>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">{error}</p>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          <article className="rounded-2xl border border-black/10 bg-black px-4 py-4 text-white">
            <p className="text-xs font-bold text-white/55">전체 방문자</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{(data?.visitorUsers ?? 0).toLocaleString()}<span className="ml-1 text-xs text-white/45">명</span></p>
            <div className="mt-2"><ComparisonBadge value={changePercent(data?.visitorUsers ?? 0, data?.comparison?.visitorUsers)} /></div>
          </article>
          {summaryMetrics.map((metric) => {
            const previousMetric = stageMetric(data?.comparison?.reached, metric.stage_key);
            return (
              <article key={metric.stage_key} className="rounded-2xl border border-black/10 bg-[#fbfbfa] px-4 py-4">
                <p className="truncate text-xs font-bold text-black/45">{metric.stage_label}</p>
                <p className="mt-2 text-3xl font-black tracking-tight">{metric.user_count.toLocaleString()}<span className="ml-1 text-xs text-black/35">명</span></p>
                <p className="mt-1 text-xs font-black text-black/65">이전 단계 대비 {formatRate(metric.previous_stage_rate)}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-black/40">전체 방문자 대비 {formatRate(metric.total_rate)}</p>
                <div className="mt-2"><ComparisonBadge value={changePercent(metric.user_count, previousMetric?.user_count)} /></div>
              </article>
            );
          })}
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-sm font-bold">날짜별 전환 추이</h3>
            <p className="mt-1 text-[11px] font-semibold text-black/40">{basis === "acquisition" ? "같은 날 유입된 사용자들이 각 단계까지 도달한 흐름입니다." : "각 날짜에 실제 발생한 단계별 사용자 수입니다."}</p>
          </div>
          <DailyTrendChart rows={data?.daily ?? []} />
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-3">
            <h3 className="text-sm font-bold">단계별 전환과 이탈</h3>
            <p className="mt-1 text-[11px] font-semibold text-black/40">큰 비율은 이전 단계 대비, 작은 비율은 전체 방문자 대비입니다.</p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#f8f8f6] text-xs font-bold text-black/45">
                <tr><th className="px-4 py-3">단계</th><th className="px-4 py-3">사용자</th><th className="px-4 py-3">이전 단계 대비</th><th className="px-4 py-3">전체 방문자 대비</th><th className="px-4 py-3">이탈</th><th className="px-4 py-3">도달률</th></tr>
              </thead>
              <tbody>
                {(data?.reached ?? []).map((stage) => (
                  <tr key={stage.stage_key} className="border-b border-black/5">
                    <td className="px-4 py-3 font-semibold"><span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/[0.055] px-2 text-[11px] font-black text-black/45">{stage.stage_order}</span>{stage.stage_label}</td>
                    <td className="px-4 py-3 font-bold">{stage.user_count.toLocaleString()}명</td>
                    <td className="px-4 py-3"><p className="text-base font-black">{formatRate(stage.previous_stage_rate)}</p><p className="text-[10px] font-semibold text-black/35">직전 단계 기준</p></td>
                    <td className="px-4 py-3"><p className="font-bold">{formatRate(stage.total_rate)}</p><p className="text-[10px] font-semibold text-black/35">전체 방문자 기준</p></td>
                    <td className="px-4 py-3"><p className="font-bold text-red-500">{(stage.dropoff_count ?? 0).toLocaleString()}명</p><p className="text-[10px] font-semibold text-black/35">{formatRate(stage.dropoff_rate)} 이탈</p></td>
                    <td className="px-4 py-3"><div className="h-2 min-w-[180px] overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-accent" style={{ width: barWidth(stage.total_rate) }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-3"><h3 className="text-sm font-bold">최종 도달 단계</h3><p className="mt-1 text-[11px] font-semibold text-black/40">사용자별로 가장 멀리 간 단계를 기준으로 묶었습니다.</p></div>
          <div className="overflow-auto">
            <table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-[#f8f8f6] text-xs font-bold text-black/45"><tr><th className="px-4 py-3">최종 단계</th><th className="px-4 py-3">사용자</th><th className="px-4 py-3">전체 대비</th><th className="px-4 py-3">분포</th></tr></thead>
              <tbody>{visibleFinalStages.map((stage) => <tr key={stage.stage_key} className="border-b border-black/5"><td className="px-4 py-3 font-semibold">{stage.stage_label}</td><td className="px-4 py-3 font-bold">{stage.user_count.toLocaleString()}명</td><td className="px-4 py-3">{formatRate(stage.total_rate)}</td><td className="px-4 py-3"><div className="h-2 min-w-[220px] overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-black" style={{ width: barWidth(stage.total_rate) }} /></div></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
