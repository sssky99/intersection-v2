"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type VisitorRange = "today" | "7d" | "30d";

type FunnelMetric = {
  event_name: string;
  count: number;
  conversion_rate: number | null;
};

type VisitorEventLog = {
  id: string;
  anonymous_session_id: string | null;
  profile_id: string | null;
  application_id: string | null;
  applicant_name: string | null;
  display_identifier: string;
  event_name: string;
  path: string | null;
  metadata: unknown;
  created_at: string;
};

type VisitorUserSummary = {
  user_key: string;
  profile_id: string | null;
  anonymous_session_id: string | null;
  applicant_name: string | null;
  display_identifier: string;
  first_event_at: string;
  last_event_at: string;
  last_event_name: string;
  event_count: number;
};

type VisitorEventsResponse = {
  range: VisitorRange;
  startedAt: string;
  funnel: FunnelMetric[];
  logs: VisitorEventLog[];
  userSummaries: VisitorUserSummary[];
  tableMissing?: boolean;
  error?: string;
};

const rangeOptions: Array<{ value: VisitorRange; label: string }> = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
];

const eventLabels: Record<string, string> = {
  landing_view: "랜딩 방문",
  kakao_login_click: "카카오 로그인 클릭",
  kakao_auth_return: "카카오 인증 복귀",
  login_success: "로그인 성공",
  question_start: "질문 시작",
  question_answered: "질문 응답",
  questions_complete: "질문 완료",
  basic_info_start: "기본정보 시작",
  basic_info_complete: "기본정보 완료",
  profile_generated: "프로필 생성",
  recommendation_view: "추천 보기",
  ticket_detail_view: "티켓 상세 보기",
  application_submit_click: "신청 클릭",
  application_created: "신청 생성",
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function textOrDash(value: string | null | undefined) {
  return value || "-";
}

function metadataText(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
    return "{}";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function eventLabel(eventName: string) {
  return eventLabels[eventName] ?? eventName;
}

function identifierClassName(hasApplicantName: boolean) {
  return cn(
    "break-all px-4 py-3 text-xs text-black/65",
    hasApplicantName ? "font-bold" : "font-mono",
  );
}

export function VisitorAdminPanel() {
  const [range, setRange] = useState<VisitorRange>("7d");
  const [data, setData] = useState<VisitorEventsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/user-events?range=${range}`, {
        cache: "no-store",
      });
      const nextData = (await response.json().catch(() => null)) as
        | VisitorEventsResponse
        | null;

      if (!response.ok || !nextData) {
        throw new Error(nextData?.error ?? "visitor-events-load-failed");
      }

      setData(nextData);
    } catch {
      setError("방문자 이벤트 로그를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const totals = useMemo(() => {
    const eventTotal = data?.logs.length ?? 0;
    const userTotal = data?.userSummaries.length ?? 0;
    return { eventTotal, userTotal };
  }, [data]);

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">방문자 관리</h2>
            <p className="mt-1 text-xs text-black/45">
              Supabase user_events 기준 · 최근 로그 {totals.eventTotal.toLocaleString()}건 · 진행 요약{" "}
              {totals.userTotal.toLocaleString()}명
            </p>
            {data?.tableMissing && (
              <p className="mt-1 text-[11px] font-semibold text-red-500">
                user_events 테이블이 아직 적용되지 않았습니다. 마이그레이션 적용 후 데이터가 표시됩니다.
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
              onClick={() => void loadEvents()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black disabled:opacity-45"
            >
              <RefreshCw size={15} aria-hidden className={loading ? "animate-spin" : ""} />
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
        <section>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            {(data?.funnel ?? []).map((metric) => (
              <article
                key={metric.event_name}
                className="rounded-2xl border border-black/10 bg-[#fbfbfa] px-4 py-4"
              >
                <p className="truncate text-xs font-bold text-black/45">
                  {eventLabel(metric.event_name)}
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight text-black">
                  {metric.count.toLocaleString()}
                  <span className="ml-1 text-xs font-bold text-black/35">건</span>
                </p>
                <p className="mt-1 text-[11px] font-semibold text-black/45">
                  {metric.conversion_rate === null
                    ? "이전 단계 없음"
                    : `이전 단계 대비 ${metric.conversion_rate.toLocaleString()}%`}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-3">
            <h3 className="text-sm font-bold">사용자별 진행 상태</h3>
          </div>
          <div className="max-h-[320px] overflow-auto">
            <table className="min-w-[880px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-4 py-3">신청자</th>
                  <th className="px-4 py-3">첫 이벤트 시간</th>
                  <th className="px-4 py-3">마지막 이벤트 시간</th>
                  <th className="px-4 py-3">마지막 이벤트명</th>
                  <th className="px-4 py-3">이벤트 개수</th>
                </tr>
              </thead>
              <tbody>
                {(data?.userSummaries ?? []).map((summary) => (
                  <tr key={summary.user_key} className="border-b border-black/5">
                    <td className={identifierClassName(Boolean(summary.applicant_name))}>
                      {textOrDash(summary.display_identifier)}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(summary.first_event_at)}</td>
                    <td className="px-4 py-3">{formatDateTime(summary.last_event_at)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {eventLabel(summary.last_event_name)}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {summary.event_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!loading && (data?.userSummaries ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm font-semibold text-black/40">
                      표시할 진행 요약이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-3">
            <h3 className="text-sm font-bold">최근 이벤트 로그</h3>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-4 py-3">시간</th>
                  <th className="px-4 py-3">이벤트명</th>
                  <th className="px-4 py-3">profile_id</th>
                  <th className="px-4 py-3">anonymous_session_id</th>
                  <th className="px-4 py-3">application_id</th>
                  <th className="px-4 py-3">path</th>
                  <th className="px-4 py-3">metadata</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs ?? []).map((event) => (
                  <tr key={event.id} className="border-b border-black/5 align-top">
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(event.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {eventLabel(event.event_name)}
                    </td>
                    <td className="break-all px-4 py-3 font-mono text-xs text-black/65">
                      {textOrDash(event.profile_id)}
                    </td>
                    <td className="break-all px-4 py-3 font-mono text-xs text-black/65">
                      {textOrDash(event.anonymous_session_id)}
                    </td>
                    <td className="break-all px-4 py-3 font-mono text-xs text-black/65">
                      {textOrDash(event.application_id)}
                    </td>
                    <td className="max-w-[260px] break-all px-4 py-3 text-black/65">
                      {event.path ?? "-"}
                    </td>
                    <td className="max-w-[360px] px-4 py-3 font-mono text-xs leading-5 text-black/55">
                      <span className="break-all">{metadataText(event.metadata)}</span>
                    </td>
                  </tr>
                ))}
                {!loading && (data?.logs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-black/40">
                      표시할 이벤트 로그가 없습니다.
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
