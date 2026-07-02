"use client";

import { RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type VisitorRange = "today" | "7d" | "30d";

type FunnelMetric = {
  event_name: string;
  count: number;
  conversion_base_event_name?: string | null;
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
  timeline?: VisitorEventLog[];
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
  choice_questions_complete: "선택 질문 완료",
  text_questions_complete: "서술 질문 완료",
  questions_complete: "질문 완료",
  basic_info_start: "기본정보 시작",
  basic_info_complete: "기본정보 완료",
  profile_generated: "프로필 생성",
  recommendation_view: "추천 보기",
  ticket_detail_view: "티켓 상세 보기",
  application_submit_click: "신청 클릭",
  application_created: "신청 생성",
  membership_required_shown: "멤버십 필요 표시",
  membership_required_close: "멤버십 모달 닫기",
  membership_purchase_notice_open: "결제 안내 열기",
  membership_purchase_notice_close: "결제 안내 닫기",
  membership_purchase_click: "결제창 이동",
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
  const [selectedSummary, setSelectedSummary] =
    useState<VisitorUserSummary | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<VisitorEventLog[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

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

  const loadTimeline = useCallback(async (summary: VisitorUserSummary) => {
    setSelectedSummary(summary);
    setTimelineEvents([]);
    setTimelineError(null);

    const params = new URLSearchParams({ range: "7d" });
    if (summary.profile_id) params.set("profileId", summary.profile_id);
    if (summary.anonymous_session_id) {
      params.set("anonymousSessionId", summary.anonymous_session_id);
    }

    if (!summary.profile_id && !summary.anonymous_session_id) {
      setTimelineError("이 사용자를 조회할 식별자가 없습니다.");
      return;
    }

    setTimelineLoading(true);
    try {
      const response = await fetch(`/api/admin/user-events?${params.toString()}`, {
        cache: "no-store",
      });
      const nextData = (await response.json().catch(() => null)) as
        | VisitorEventsResponse
        | null;

      if (!response.ok || !nextData) {
        throw new Error(nextData?.error ?? "visitor-timeline-load-failed");
      }

      setTimelineEvents(nextData.timeline ?? []);
    } catch {
      setTimelineError("사용자 이벤트 타임라인을 불러오지 못했습니다.");
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const clearTimeline = () => {
    setSelectedSummary(null);
    setTimelineEvents([]);
    setTimelineError(null);
    setTimelineLoading(false);
  };

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
              Supabase user_events 기준 · 표시 로그 {totals.eventTotal.toLocaleString()}건 · 진행 요약{" "}
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
                    ? metric.conversion_base_event_name
                      ? `${eventLabel(metric.conversion_base_event_name)} 기준 없음`
                      : "기준 단계 없음"
                    : `${eventLabel(
                        metric.conversion_base_event_name ?? "",
                      )} 대비 ${metric.conversion_rate.toLocaleString()}%`}
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
                  <tr
                    key={summary.user_key}
                    role="button"
                    tabIndex={0}
                    onClick={() => void loadTimeline(summary)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void loadTimeline(summary);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-b border-black/5 outline-none transition hover:bg-black/[0.025] focus:bg-accent/[0.08]",
                      selectedSummary?.user_key === summary.user_key &&
                        "bg-accent/[0.08]",
                    )}
                  >
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
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold">사용자 이벤트 타임라인</h3>
              <p className="mt-1 text-[11px] font-semibold text-black/40">
                사용자별 진행 상태에서 행을 클릭하면 최근 7일 이벤트를 처음부터 불러옵니다.
              </p>
            </div>
            {selectedSummary && (
              <button
                type="button"
                onClick={clearTimeline}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/45 transition hover:border-black/20 hover:text-black"
                aria-label="타임라인 닫기"
              >
                <X size={15} aria-hidden />
              </button>
            )}
          </div>

          {!selectedSummary ? (
            <p className="px-4 py-8 text-center text-sm font-semibold text-black/38">
              위의 사용자 행을 클릭해 주세요.
            </p>
          ) : (
            <div>
              <div className="border-b border-black/5 px-4 py-3 text-xs font-semibold text-black/50">
                <span className="font-bold text-black">
                  {textOrDash(selectedSummary.display_identifier)}
                </span>
                <span className="mx-2 text-black/20">·</span>
                최근 7일
                {timelineLoading && (
                  <span className="ml-2 text-accent">불러오는 중...</span>
                )}
              </div>

              {timelineError ? (
                <p className="px-4 py-6 text-sm font-semibold text-red-600">
                  {timelineError}
                </p>
              ) : !timelineLoading && timelineEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm font-semibold text-black/40">
                  표시할 이벤트가 없습니다.
                </p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
                      <tr>
                        <th className="px-4 py-3">시간</th>
                        <th className="px-4 py-3">이벤트명</th>
                        <th className="px-4 py-3">path</th>
                        <th className="px-4 py-3">anonymous_session_id</th>
                        <th className="px-4 py-3">metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timelineEvents.map((event) => (
                        <tr key={event.id} className="border-b border-black/5 align-top">
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatDateTime(event.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">
                            {eventLabel(event.event_name)}
                          </td>
                          <td className="max-w-[220px] break-all px-4 py-3 text-black/65">
                            {event.path ?? "-"}
                          </td>
                          <td className="break-all px-4 py-3 font-mono text-xs text-black/65">
                            {textOrDash(event.anonymous_session_id)}
                          </td>
                          <td className="max-w-[440px] px-4 py-3 font-mono text-xs leading-5 text-black/55">
                            <span className="break-all">
                              {metadataText(event.metadata)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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
