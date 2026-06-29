"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type FunnelRange = "today" | "7d" | "30d";
type FunnelStageMetric = {
  stage_key: string;
  stage_label: string;
  stage_order: number;
  user_count: number;
  total_rate: number | null;
  previous_stage_rate?: number | null;
};
type FunnelResponse = {
  range: FunnelRange;
  startedAt: string;
  totalUsers: number;
  rowsScanned: number;
  reached: FunnelStageMetric[];
  finalStages: FunnelStageMetric[];
  tableMissing?: boolean;
  error?: string;
};

const rangeOptions: Array<{ value: FunnelRange; label: string }> = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
];

const summaryStageKeys = [
  "landing",
  "question_start",
  "profile_generated",
  "application_submit_click",
  "membership_purchase_click",
] as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatRate(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toLocaleString()}%` : "-";
}

function stageMetric(
  metrics: FunnelStageMetric[] | undefined,
  stageKey: string,
) {
  return metrics?.find((metric) => metric.stage_key === stageKey) ?? null;
}

function barWidth(value: number | null | undefined) {
  return `${Math.max(0, Math.min(100, value ?? 0))}%`;
}

export function FunnelAdminPanel() {
  const [range, setRange] = useState<FunnelRange>("7d");
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFunnel = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/funnel?range=${range}`, {
        cache: "no-store",
      });
      const nextData = (await response.json().catch(() => null)) as
        | FunnelResponse
        | null;

      if (!response.ok || !nextData) {
        throw new Error(nextData?.error ?? "funnel-load-failed");
      }

      setData(nextData);
    } catch {
      setError("퍼널 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadFunnel();
  }, [loadFunnel]);

  const summaryMetrics = useMemo(
    () =>
      summaryStageKeys
        .map((key) => stageMetric(data?.reached, key))
        .filter((metric): metric is FunnelStageMetric => Boolean(metric)),
    [data?.reached],
  );
  const visibleFinalStages = useMemo(
    () => (data?.finalStages ?? []).filter((stage) => stage.user_count > 0),
    [data?.finalStages],
  );

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">퍼널 관리</h2>
            <p className="mt-1 text-xs text-black/45">
              Supabase user_events 기준 · 사용자 단위 중복 제거 · 분석 이벤트{" "}
              {(data?.rowsScanned ?? 0).toLocaleString()}건
            </p>
            {data?.tableMissing && (
              <p className="mt-1 text-[11px] font-semibold text-red-500">
                user_events 테이블이 아직 적용되지 않았습니다.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-[#f2f3f1] p-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={cn(
                    "h-9 rounded-lg px-4 text-sm font-semibold transition",
                    range === option.value
                      ? "bg-white text-black shadow-sm"
                      : "text-black/45 hover:text-black",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void loadFunnel()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black disabled:opacity-45"
            >
              <RefreshCw
                size={15}
                aria-hidden
                className={loading ? "animate-spin" : ""}
              />
              새로고침
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          <article className="rounded-2xl border border-black/10 bg-black px-4 py-4 text-white">
            <p className="text-xs font-bold text-white/55">분석 대상 사용자</p>
            <p className="mt-2 text-3xl font-black tracking-tight">
              {(data?.totalUsers ?? 0).toLocaleString()}
              <span className="ml-1 text-xs font-bold text-white/45">명</span>
            </p>
            <p className="mt-1 text-[11px] font-semibold text-white/45">
              기간 내 퍼널 이벤트가 있는 사용자
            </p>
          </article>

          {summaryMetrics.map((metric) => (
            <article
              key={metric.stage_key}
              className="rounded-2xl border border-black/10 bg-[#fbfbfa] px-4 py-4"
            >
              <p className="truncate text-xs font-bold text-black/45">
                {metric.stage_label}
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-black">
                {metric.user_count.toLocaleString()}
                <span className="ml-1 text-xs font-bold text-black/35">명</span>
              </p>
              <p className="mt-1 text-[11px] font-semibold text-black/45">
                전체 대비 {formatRate(metric.total_rate)}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-3">
            <h3 className="text-sm font-bold">단계별 도달 사용자</h3>
            <p className="mt-1 text-[11px] font-semibold text-black/40">
              같은 사용자의 같은 단계 이벤트는 한 번만 집계합니다.
            </p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-[920px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-4 py-3">단계</th>
                  <th className="px-4 py-3">사용자 수</th>
                  <th className="px-4 py-3">전체 대비</th>
                  <th className="px-4 py-3">이전 단계 대비</th>
                  <th className="px-4 py-3">도달률</th>
                </tr>
              </thead>
              <tbody>
                {(data?.reached ?? []).map((stage) => (
                  <tr key={stage.stage_key} className="border-b border-black/5">
                    <td className="px-4 py-3 font-semibold">
                      <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/[0.055] px-2 text-[11px] font-black text-black/45">
                        {stage.stage_order}
                      </span>
                      {stage.stage_label}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {stage.user_count.toLocaleString()}명
                    </td>
                    <td className="px-4 py-3">{formatRate(stage.total_rate)}</td>
                    <td className="px-4 py-3">
                      {formatRate(stage.previous_stage_rate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full min-w-[180px] overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: barWidth(stage.total_rate) }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-3">
            <h3 className="text-sm font-bold">최종 도달 단계</h3>
            <p className="mt-1 text-[11px] font-semibold text-black/40">
              사용자별로 가장 멀리 간 단계를 기준으로 묶었습니다.
            </p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-4 py-3">최종 도달 단계</th>
                  <th className="px-4 py-3">사용자 수</th>
                  <th className="px-4 py-3">전체 대비</th>
                  <th className="px-4 py-3">분포</th>
                </tr>
              </thead>
              <tbody>
                {visibleFinalStages.map((stage) => (
                  <tr key={stage.stage_key} className="border-b border-black/5">
                    <td className="px-4 py-3 font-semibold">
                      <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/[0.055] px-2 text-[11px] font-black text-black/45">
                        {stage.stage_order}
                      </span>
                      {stage.stage_label}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {stage.user_count.toLocaleString()}명
                    </td>
                    <td className="px-4 py-3">{formatRate(stage.total_rate)}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full min-w-[220px] overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className="h-full rounded-full bg-black"
                          style={{ width: barWidth(stage.total_rate) }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && visibleFinalStages.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm font-semibold text-black/40"
                    >
                      표시할 퍼널 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
