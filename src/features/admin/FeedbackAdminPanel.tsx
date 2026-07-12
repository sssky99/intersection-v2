"use client";

import { Check, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PersonAxis = "temperature" | "texture" | "tone" | "rhythm";
type PlaceAxis = PersonAxis | "alcohol" | "romance";

type MeetingFeedback = {
  id: string;
  waitlist_id: number | string;
  user_id: string;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
  ticket_snapshot: Record<string, unknown> | null;
  selected_member_ids: string[] | null;
  member_feedback: Record<string, MemberFeedbackEntry> | null;
  place_feedback: StructuredPlaceFeedback | null;
  created_at: string;
  updated_at: string;
};

type MemberFeedbackEntry = {
  status?: "done" | "skipped";
} & Partial<Record<PersonAxis, number | null>>;

type MeetingRatingsFeedback = {
  overall?: number | null;
  expectation_match?: number | null;
};

type NegativeMemberFeedbackEntry = {
  reasons?: unknown;
  otherText?: unknown;
  other_text?: unknown;
};

type StructuredPlaceFeedback = Partial<Record<PlaceAxis, number>> & {
  meeting_ratings?: MeetingRatingsFeedback;
  negative_member_feedback?: Record<string, NegativeMemberFeedbackEntry>;
};

type FeedbackProfile = {
  user_id: string;
  name: string | null;
  nickname?: string | null;
  phone?: string | null;
  score_temperature?: number | null;
  score_texture?: number | null;
  score_tone?: number | null;
  score_rhythm?: number | null;
};

type FeedbackInstance = {
  id: string;
  template_id: string | null;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
};

type FeedbackTemplate = {
  id: string;
  title: string;
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
};

type FeedbackAverage = {
  id: string;
  ticket_instance_id: string | null;
  ticket_template_id: string | null;
  avg_temperature: number | null;
  avg_texture: number | null;
  avg_tone: number | null;
  avg_rhythm: number | null;
  avg_alcohol: number | null;
  avg_romance: number | null;
  feedback_count: number;
  feedback_average_applied_at: string | null;
};

type FeedbackAdminData = {
  feedbacks: MeetingFeedback[];
  profiles: FeedbackProfile[];
  instances: FeedbackInstance[];
  templates: FeedbackTemplate[];
  averages: FeedbackAverage[];
};

type MemberSuggestion = {
  memberId: string;
  profile: FeedbackProfile | null;
  axes: Record<PersonAxis, AxisSuggestion>;
};

type AxisSuggestion = {
  current: number;
  average: number | null;
  count: number;
  suggested: number;
};

const personAxes: PersonAxis[] = ["temperature", "texture", "tone", "rhythm"];
const placeAxes: PlaceAxis[] = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
  "alcohol",
  "romance",
];

const axisLabels: Record<PlaceAxis, string> = {
  temperature: "온도",
  texture: "결",
  tone: "톤",
  rhythm: "리듬",
  alcohol: "술",
  romance: "설렘",
};

const scoreKeys: Record<PersonAxis, keyof FeedbackProfile> = {
  temperature: "score_temperature",
  texture: "score_texture",
  tone: "score_tone",
  rhythm: "score_rhythm",
};

const templateScoreKeys: Record<PlaceAxis, keyof FeedbackTemplate> = {
  temperature: "score_temperature",
  texture: "score_texture",
  tone: "score_tone",
  rhythm: "score_rhythm",
  alcohol: "score_alcohol",
  romance: "score_romance",
};

const averageKeys: Record<PlaceAxis, keyof FeedbackAverage> = {
  temperature: "avg_temperature",
  texture: "avg_texture",
  tone: "avg_tone",
  rhythm: "avg_rhythm",
  alcohol: "avg_alcohol",
  romance: "avg_romance",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function memberName(profile: FeedbackProfile | null | undefined, fallback = "멤버") {
  return profile?.name?.trim() || profile?.nickname?.trim() || fallback;
}

function formatDateTime(date: string | null | undefined, time?: string | null) {
  if (!date) return "-";
  return `${date}${time ? ` ${time.slice(0, 5)}` : ""}`;
}

function feedbackDate(row: MeetingFeedback, instance?: FeedbackInstance) {
  const snapshotDate =
    typeof row.ticket_snapshot?.date === "string" ? row.ticket_snapshot.date : null;
  return instance?.event_date ?? snapshotDate ?? row.created_at.slice(0, 10);
}

function ticketKey(row: MeetingFeedback) {
  return row.ticket_instance_id ?? row.ticket_template_id ?? `waitlist:${row.waitlist_id}`;
}

function scoreDisplay(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(1).replace(/\.0$/, "");
}

function savedAt(value: string | null | undefined) {
  if (!value) return "저장 전";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function loadFeedbackData() {
  const response = await fetch("/api/admin/feedback", { cache: "no-store" });
  if (!response.ok) throw new Error("feedback-load-failed");
  return (await response.json()) as FeedbackAdminData;
}

export function FeedbackAdminPanel() {
  const [data, setData] = useState<FeedbackAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTicketKey, setSelectedTicketKey] = useState("");
  const [draftScores, setDraftScores] = useState<
    Record<string, Partial<Record<PersonAxis, string>>>
  >({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [savingAverage, setSavingAverage] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await loadFeedbackData();
      setData(nextData);
    } catch {
      setError("피드백 데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const instanceMap = useMemo(
    () => new Map((data?.instances ?? []).map((instance) => [instance.id, instance])),
    [data?.instances],
  );
  const profileMap = useMemo(
    () => new Map((data?.profiles ?? []).map((profile) => [profile.user_id, profile])),
    [data?.profiles],
  );
  const templateMap = useMemo(
    () => new Map((data?.templates ?? []).map((template) => [template.id, template])),
    [data?.templates],
  );
  const averageMap = useMemo(
    () =>
      new Map(
        (data?.averages ?? [])
          .filter((average) => average.ticket_instance_id)
          .map((average) => [average.ticket_instance_id as string, average]),
      ),
    [data?.averages],
  );

  const dateOptions = useMemo(() => {
    const values = new Set<string>();
    for (const feedback of data?.feedbacks ?? []) {
      values.add(feedbackDate(feedback, instanceMap.get(feedback.ticket_instance_id ?? "")));
    }
    return Array.from(values).sort().reverse();
  }, [data?.feedbacks, instanceMap]);

  useEffect(() => {
    if (!dateOptions.length) {
      setSelectedDate("");
      return;
    }
    setSelectedDate((current) => (dateOptions.includes(current) ? current : dateOptions[0]));
  }, [dateOptions]);

  const ticketOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        instanceId: string | null;
        templateId: string | null;
        label: string;
        date: string;
        count: number;
      }
    >();

    for (const feedback of data?.feedbacks ?? []) {
      const instance = instanceMap.get(feedback.ticket_instance_id ?? "");
      const date = feedbackDate(feedback, instance);
      if (selectedDate && date !== selectedDate) continue;

      const key = ticketKey(feedback);
      const templateId = feedback.ticket_template_id ?? instance?.template_id ?? null;
      const template = templateId ? templateMap.get(templateId) : null;
      const snapshotTitle =
        typeof feedback.ticket_snapshot?.title === "string"
          ? feedback.ticket_snapshot.title
          : null;
      const current = map.get(key);
      map.set(key, {
        key,
        instanceId: feedback.ticket_instance_id,
        templateId,
        label: instance?.title ?? template?.title ?? snapshotTitle ?? "피드백 모임",
        date,
        count: (current?.count ?? 0) + 1,
      });
    }

    return Array.from(map.values()).sort((left, right) =>
      left.label.localeCompare(right.label, "ko"),
    );
  }, [data?.feedbacks, instanceMap, selectedDate, templateMap]);

  useEffect(() => {
    if (!ticketOptions.length) {
      setSelectedTicketKey("");
      return;
    }
    setSelectedTicketKey((current) =>
      ticketOptions.some((ticket) => ticket.key === current)
        ? current
        : ticketOptions[0].key,
    );
  }, [ticketOptions]);

  useEffect(() => {
    setDraftScores({});
    setNotice(null);
  }, [selectedTicketKey]);

  const selectedTicket = ticketOptions.find((ticket) => ticket.key === selectedTicketKey);
  const selectedFeedbacks = useMemo(
    () =>
      (data?.feedbacks ?? []).filter((feedback) => {
        const instance = instanceMap.get(feedback.ticket_instance_id ?? "");
        return (
          (!selectedDate || feedbackDate(feedback, instance) === selectedDate) &&
          (!selectedTicketKey || ticketKey(feedback) === selectedTicketKey)
        );
      }),
    [data?.feedbacks, instanceMap, selectedDate, selectedTicketKey],
  );

  const memberSuggestions = useMemo<MemberSuggestion[]>(() => {
    const aggregates = new Map<
      string,
      Record<PersonAxis, { sum: number; count: number }>
    >();

    for (const feedback of selectedFeedbacks) {
      for (const [memberId, memberFeedback] of Object.entries(
        feedback.member_feedback ?? {},
      )) {
        const current = aggregates.get(memberId) ?? {
          temperature: { sum: 0, count: 0 },
          texture: { sum: 0, count: 0 },
          tone: { sum: 0, count: 0 },
          rhythm: { sum: 0, count: 0 },
        };
        for (const axis of personAxes) {
          const score = memberFeedback?.[axis];
          if (typeof score === "number" && Number.isFinite(score)) {
            current[axis].sum += score;
            current[axis].count += 1;
          }
        }
        aggregates.set(memberId, current);
      }
    }

    return Array.from(aggregates.entries())
      .map(([memberId, axes]) => {
        const profile = profileMap.get(memberId) ?? null;
        const axisSuggestions = Object.fromEntries(
          personAxes.map((axis) => {
            const stats = axes[axis];
            const average = stats.count > 0 ? stats.sum / stats.count : null;
            const current =
              typeof profile?.[scoreKeys[axis]] === "number"
                ? (profile[scoreKeys[axis]] as number)
                : 0;
            const suggested =
              average === null
                ? current
                : clamp(Math.round(current + (average - current) * (stats.count * 0.1)), -100, 100);
            return [axis, { current, average, count: stats.count, suggested }];
          }),
        ) as Record<PersonAxis, AxisSuggestion>;

        return { memberId, profile, axes: axisSuggestions };
      })
      .sort((left, right) =>
        memberName(left.profile, left.memberId).localeCompare(
          memberName(right.profile, right.memberId),
          "ko",
        ),
      );
  }, [profileMap, selectedFeedbacks]);

  const placeStats = useMemo(() => {
    const stats = Object.fromEntries(
      placeAxes.map((axis) => [axis, { sum: 0, count: 0 }]),
    ) as Record<PlaceAxis, { sum: number; count: number }>;
    let feedbackCount = 0;

    for (const feedback of selectedFeedbacks) {
      let hasValue = false;
      for (const axis of placeAxes) {
        const score = feedback.place_feedback?.[axis];
        if (typeof score === "number" && Number.isFinite(score)) {
          stats[axis].sum += score;
          stats[axis].count += 1;
          hasValue = true;
        }
      }
      if (hasValue) feedbackCount += 1;
    }

    const averages = Object.fromEntries(
      placeAxes.map((axis) => [
        axis,
        stats[axis].count > 0
          ? Math.round((stats[axis].sum / stats[axis].count) * 100) / 100
          : null,
      ]),
    ) as Partial<Record<PlaceAxis, number | null>>;

    return { stats, averages, feedbackCount };
  }, [selectedFeedbacks]);

  const selectedTemplate =
    selectedTicket?.templateId ? templateMap.get(selectedTicket.templateId) ?? null : null;
  const savedAverage =
    selectedTicket?.instanceId ? averageMap.get(selectedTicket.instanceId) ?? null : null;

  const applyMemberScore = async (suggestion: MemberSuggestion) => {
    if (savingMemberId) return;
    setSavingMemberId(suggestion.memberId);
    setNotice(null);

    const scores = Object.fromEntries(
      personAxes.map((axis) => {
        const value =
          draftScores[suggestion.memberId]?.[axis] ??
          String(suggestion.axes[axis].suggested);
        return [`score_${axis}`, clamp(Number.parseInt(value, 10) || 0, -100, 100)];
      }),
    );

    try {
      const response = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_member_score",
          profileId: suggestion.memberId,
          scores,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        profile?: FeedbackProfile;
      } | null;
      if (!response.ok || !result?.profile) throw new Error("apply-failed");
      const savedProfile = result.profile;

      setData((current) =>
        current
          ? {
              ...current,
              profiles: current.profiles.map((profile) =>
                profile.user_id === savedProfile.user_id ? savedProfile : profile,
              ),
            }
          : current,
      );
      setNotice(`${memberName(savedProfile)}님의 사람 지표를 저장했어요.`);
    } catch {
      setNotice("사람 지표를 저장하지 못했어요.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const savePlaceAverage = async () => {
    if (!selectedTicket?.instanceId || savingAverage) return;
    setSavingAverage(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_place_average",
          ticketInstanceId: selectedTicket.instanceId,
          ticketTemplateId: selectedTicket.templateId,
          averages: placeStats.averages,
          feedbackCount: placeStats.feedbackCount,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        average?: FeedbackAverage;
      } | null;
      if (!response.ok || !result?.average) throw new Error("average-failed");
      const savedAverageResult = result.average;

      setData((current) =>
        current
          ? {
              ...current,
              averages: [
                ...current.averages.filter(
                  (average) =>
                    average.ticket_instance_id !== savedAverageResult.ticket_instance_id,
                ),
                savedAverageResult,
              ],
            }
          : current,
      );
      setNotice("장소 피드백 평균값을 저장했어요.");
    } catch {
      setNotice("장소 평균값을 저장하지 못했어요.");
    } finally {
      setSavingAverage(false);
    }
  };

  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[680px] grid-cols-[320px_minmax(0,1fr)] gap-5">
      <aside className="flex min-h-0 flex-col rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              feedback
            </p>
            <h2 className="mt-1 text-xl font-bold">피드백 관리</h2>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/45 transition hover:text-black disabled:opacity-40"
            aria-label="새로고침"
          >
            <RefreshCw size={16} aria-hidden />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-black/45">날짜</span>
            <select
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-accent"
            >
              {dateOptions.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-black/45">티켓 / 장소</span>
            <select
              value={selectedTicketKey}
              onChange={(event) => setSelectedTicketKey(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold outline-none focus:border-accent"
            >
              {ticketOptions.map((ticket) => (
                <option key={ticket.key} value={ticket.key}>
                  {ticket.label} ({ticket.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <SummaryBox label="원본 피드백" value={String(selectedFeedbacks.length)} />
          <SummaryBox label="사람 제안" value={String(memberSuggestions.length)} />
          <SummaryBox label="장소 응답" value={String(placeStats.feedbackCount)} />
          <SummaryBox label="평균 저장" value={savedAverage ? "완료" : "전"} />
        </div>

        {notice && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-700">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
            {error}
          </p>
        )}
      </aside>

      <section className="min-h-0 overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <StateMessage message="피드백 데이터를 불러오는 중입니다." />
        ) : !data || data.feedbacks.length === 0 ? (
          <StateMessage message="아직 제출된 피드백이 없습니다." />
        ) : (
          <div className="space-y-5 p-5">
            <section className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                summary
              </p>
              <h3 className="mt-1 text-lg font-bold">
                {selectedTicket?.label ?? "피드백 모임"}
              </h3>
              <p className="mt-2 text-sm font-semibold text-black/45">
                {selectedDate || "-"} · 제출 {selectedFeedbacks.length}건
              </p>
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">사람 지표 보정 제안</h3>
                  <p className="mt-1 text-xs font-semibold text-black/40">
                    평균 피드백과 응답 수를 반영해 제안만 표시합니다. 적용은 버튼을 눌러야 저장돼요.
                  </p>
                </div>
              </div>

              {memberSuggestions.length === 0 ? (
                <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-4 text-sm font-semibold text-black/45">
                  사람 지표로 쓸 피드백이 아직 없습니다.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {memberSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.memberId}
                      className="rounded-2xl border border-black/10 bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black">
                            {memberName(suggestion.profile, suggestion.memberId)}
                          </h4>
                          <p className="mt-1 text-xs font-semibold text-black/40">
                            현재값 + (피드백 평균 - 현재값) × (응답 수 × 0.1)
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={savingMemberId === suggestion.memberId}
                          onClick={() => void applyMemberScore(suggestion)}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white transition hover:bg-black/85 disabled:opacity-40"
                        >
                          <Check size={15} aria-hidden />
                          적용하기
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {personAxes.map((axis) => {
                          const item = suggestion.axes[axis];
                          const draftValue =
                            draftScores[suggestion.memberId]?.[axis] ??
                            String(item.suggested);

                          return (
                            <label
                              key={axis}
                              className="rounded-xl bg-[#f7f7f5] px-3 py-3"
                            >
                              <span className="text-[11px] font-bold text-black/40">
                                {axisLabels[axis]}
                              </span>
                              <span className="mt-1 block text-[11px] font-semibold text-black/45">
                                현재 {item.current} · 평균 {scoreDisplay(item.average)} · {item.count}건
                              </span>
                              <input
                                type="number"
                                min={-100}
                                max={100}
                                value={draftValue}
                                onChange={(event) =>
                                  setDraftScores((current) => ({
                                    ...current,
                                    [suggestion.memberId]: {
                                      ...current[suggestion.memberId],
                                      [axis]: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-2 h-9 w-full rounded-lg border border-black/10 bg-white px-2 text-sm font-bold outline-none focus:border-accent"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">장소 피드백 평균</h3>
                  <p className="mt-1 text-xs font-semibold text-black/40">
                    단순 평균값만 별도 저장합니다. 티켓 템플릿 점수는 바꾸지 않습니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!selectedTicket?.instanceId || savingAverage}
                  onClick={() => void savePlaceAverage()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-40"
                >
                  <Save size={15} aria-hidden />
                  평균값 저장하기
                </button>
              </div>

              <div className="mt-4 grid grid-cols-6 gap-2">
                {placeAxes.map((axis) => (
                  <div key={axis} className="rounded-xl bg-[#f7f7f5] px-3 py-3">
                    <p className="text-[11px] font-bold text-black/40">
                      {axisLabels[axis]}
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {scoreDisplay(placeStats.averages[axis])}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-black/40">
                      기존 {scoreDisplay(selectedTemplate?.[templateScoreKeys[axis]] as number | null)}
                    </p>
                    <p className="text-[11px] font-semibold text-black/40">
                      저장 {scoreDisplay(savedAverage?.[averageKeys[axis]] as number | null)}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs font-semibold text-black/35">
                저장 상태: {savedAt(savedAverage?.feedback_average_applied_at)}
              </p>
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <h3 className="text-base font-bold">원본 피드백 리스트</h3>
              <div className="mt-4 space-y-3">
                {selectedFeedbacks.map((feedback) => {
                  const writer = profileMap.get(feedback.user_id);
                  const selectedNames = (feedback.selected_member_ids ?? []).map((id) =>
                    memberName(profileMap.get(id), id),
                  );

                  return (
                    <article
                      key={feedback.id}
                      className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4"
                    >
                      <div>
                        <h4 className="text-sm font-black">
                          {memberName(writer, "작성자")}
                        </h4>
                        <p className="mt-1 text-xs font-semibold text-black/40">
                          {savedAt(feedback.created_at)}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                        <SelectedMembersSummary selectedNames={selectedNames} />
                        <PersonFeedbackSummary
                          memberFeedback={feedback.member_feedback}
                          profileMap={profileMap}
                        />
                        <MeetingFeedbackSummary
                          placeFeedback={feedback.place_feedback}
                          profileMap={profileMap}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f7f5] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-black">{value}</p>
    </div>
  );
}

const negativeFeedbackReasonLabels: Record<string, string> = {
  no_show: "노쇼했어요",
  not_my_vibe: "결이 맞지 않았어요",
  uncomfortable_conversation: "대화가 불편했어요",
  rude_or_aggressive: "무례하거나 공격적인 표현이 있었어요",
  romantic_pressure: "노골적인 이성 목적이 느껴졌어요",
  religion_or_sales: "종교 포교 또는 영업처럼 느껴졌어요",
  other: "기타",
};

function feedbackReasons(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function feedbackOtherText(entry: NegativeMemberFeedbackEntry) {
  const value = entry.otherText ?? entry.other_text;
  return typeof value === "string" ? value.trim() : "";
}

function feedbackScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function SelectedMembersSummary({ selectedNames }: { selectedNames: string[] }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-black/35">다시 만나고 싶은 분</p>
        <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-bold text-black/45">
          {selectedNames.length}명
        </span>
      </div>

      {selectedNames.length === 0 ? (
        <p className="mt-3 text-xs font-semibold text-black/35">선택한 사람이 없습니다.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {selectedNames.map((name, index) => (
            <div
              key={`${name}-${index}`}
              className="rounded-xl border border-black/[0.07] bg-[#fbfbfa] px-3 py-3"
            >
              <p className="text-sm font-black text-black">{name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonFeedbackSummary({
  memberFeedback,
  profileMap,
}: {
  memberFeedback: Record<string, MemberFeedbackEntry> | null;
  profileMap: Map<string, FeedbackProfile>;
}) {
  const entries = Object.entries(memberFeedback ?? {});

  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-black/35">비슷한 결로 추천한 사람</p>
        <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-bold text-black/45">
          {entries.length}명
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-xs font-semibold text-black/35">선택한 사람이 없습니다.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map(([memberId, entry]) => {
            const scores = personAxes
              .map((axis) => ({ axis, value: feedbackScore(entry?.[axis]) }))
              .filter(
                (item): item is { axis: PersonAxis; value: number } =>
                  item.value !== null,
              );

            return (
              <div
                key={memberId}
                className="rounded-xl border border-black/[0.07] bg-[#fbfbfa] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-black">
                    {memberName(profileMap.get(memberId), memberId)}
                  </p>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">
                    {entry?.status === "skipped" ? "건너뜀" : "추천 참고"}
                  </span>
                </div>
                {scores.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scores.map(({ axis, value }) => (
                      <span
                        key={axis}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-black/55"
                      >
                        {axisLabels[axis]} {scoreDisplay(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RatingRow({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const rating = feedbackScore(value);
  const filled = rating === null ? 0 : clamp(Math.round(rating), 0, 5);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fbfbfa] px-3 py-2.5">
      <span className="text-xs font-bold text-black/55">{label}</span>
      {rating === null ? (
        <span className="text-xs font-bold text-black/30">응답 없음</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5" aria-label={`${label} ${rating}점`}>
            {[1, 2, 3, 4, 5].map((score) => (
              <span
                key={score}
                className={score <= filled ? "text-amber-400" : "text-black/10"}
              >
                ★
              </span>
            ))}
          </span>
          <span className="text-xs font-black text-black">{scoreDisplay(rating)}/5</span>
        </div>
      )}
    </div>
  );
}

function MeetingFeedbackSummary({
  placeFeedback,
  profileMap,
}: {
  placeFeedback: StructuredPlaceFeedback | null;
  profileMap: Map<string, FeedbackProfile>;
}) {
  const ratings = placeFeedback?.meeting_ratings;
  const negativeEntries = Object.entries(
    placeFeedback?.negative_member_feedback ?? {},
  );
  const legacyScores = placeAxes
    .map((axis) => ({ axis, value: feedbackScore(placeFeedback?.[axis]) }))
    .filter(
      (item): item is { axis: PlaceAxis; value: number } => item.value !== null,
    );
  const hasRatings =
    feedbackScore(ratings?.overall) !== null ||
    feedbackScore(ratings?.expectation_match) !== null;

  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <p className="text-[11px] font-bold text-black/35">모임 평가</p>

      {hasRatings ? (
        <div className="mt-3 space-y-2">
          <RatingRow label="전반적인 만족도" value={ratings?.overall} />
          <RatingRow label="친구에게 추천할 의향" value={ratings?.expectation_match} />
        </div>
      ) : legacyScores.length === 0 ? (
        <p className="mt-3 text-xs font-semibold text-black/35">모임 평가가 없습니다.</p>
      ) : null}

      {legacyScores.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {legacyScores.map(({ axis, value }) => (
            <span
              key={axis}
              className="rounded-full bg-[#f7f7f5] px-2.5 py-1 text-[10px] font-bold text-black/55"
            >
              {axisLabels[axis]} {scoreDisplay(value)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-black/[0.06] pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-black/35">
            다시 같은 자리에 있고 싶지 않은 사람
          </p>
          <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-bold text-black/45">
            {negativeEntries.length}명
          </span>
        </div>

        {negativeEntries.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-black/35">선택한 사람이 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {negativeEntries.map(([memberId, entry]) => {
              const reasons = feedbackReasons(entry?.reasons);
              const otherText = feedbackOtherText(entry);

              return (
                <div
                  key={memberId}
                  className="rounded-xl border border-red-100 bg-red-50/50 px-3 py-3"
                >
                  <p className="text-sm font-black text-black">
                    {memberName(profileMap.get(memberId), "알 수 없는 멤버")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-red-700"
                      >
                        {negativeFeedbackReasonLabels[reason] ?? reason}
                      </span>
                    ))}
                  </div>
                  {otherText && (
                    <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold leading-5 text-black/60">
                      {otherText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StateMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm font-semibold text-black/45">
      {message}
    </div>
  );
}
