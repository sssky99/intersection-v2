"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GenderBadge } from "./adminDisplay";

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
  connection_intent?: "interested" | "enough" | "no_show";
  connection_strength?: 1 | 2 | 3 | 4;
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
  place_ratings?: {
    first?: { name?: string | null; rating?: number | null };
    second?: { name?: string | null; rating?: number | null };
  };
  recommendation_rating?: number | null;
  dinner_member_ids?: string[];
  overall_member_ids?: string[];
  dinner_member_unsure?: boolean;
  overall_member_unsure?: boolean;
  disruptive_member_note?: string | null;
};

type FeedbackProfile = {
  user_id: string;
  name: string | null;
  nickname?: string | null;
  phone?: string | null;
  gender?: string | null;
};

type FeedbackInstance = {
  id: string;
  template_id: string | null;
  title: string | null;
  operation_code: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
};

type FeedbackTemplate = {
  id: string;
  title: string;
};

type BlindDateFeedback = {
  id: string;
  offer_id: string;
  user_id: string;
  counterpart_rating: number | null;
  counterpart_comment: string | null;
  place_rating: number | null;
  place_comment: string | null;
  feedback_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type BlindDateOffer = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  scheduled_date: string | null;
};

type FeedbackAdminData = {
  feedbacks: MeetingFeedback[];
  blindDateFeedbacks: BlindDateFeedback[];
  blindDateOffers: BlindDateOffer[];
  profiles: FeedbackProfile[];
  instances: FeedbackInstance[];
  templates: FeedbackTemplate[];
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

function meetingTicketLabel(
  title: string,
  operationCode: string | null | undefined,
) {
  const groupCode = operationCode?.trim();
  return groupCode ? `${title} · ${groupCode}조` : title;
}

function blindDateTicketKey(offerId: string) {
  return `blind-date:${offerId}`;
}

function blindDateFeedbackDate(
  feedback: BlindDateFeedback,
  offer?: BlindDateOffer,
) {
  return (
    offer?.scheduled_date ??
    feedback.feedback_completed_at?.slice(0, 10) ??
    feedback.created_at.slice(0, 10)
  );
}

function blindDateOfferLabel(
  offer: BlindDateOffer,
  profileMap: Map<string, FeedbackProfile>,
) {
  const participantA = memberName(
    profileMap.get(offer.participant_a_id),
    "이름 미확인",
  );
  const participantB = memberName(
    profileMap.get(offer.participant_b_id),
    "이름 미확인",
  );
  return `${participantA} · ${participantB}`;
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
  const blindDateOfferMap = useMemo(
    () => new Map((data?.blindDateOffers ?? []).map((offer) => [offer.id, offer])),
    [data?.blindDateOffers],
  );
  const dateOptions = useMemo(() => {
    const values = new Set<string>();
    for (const feedback of data?.feedbacks ?? []) {
      values.add(feedbackDate(feedback, instanceMap.get(feedback.ticket_instance_id ?? "")));
    }
    for (const feedback of data?.blindDateFeedbacks ?? []) {
      const offer = blindDateOfferMap.get(feedback.offer_id);
      values.add(blindDateFeedbackDate(feedback, offer));
    }
    return Array.from(values).sort().reverse();
  }, [blindDateOfferMap, data?.blindDateFeedbacks, data?.feedbacks, instanceMap]);

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
      const baseLabel =
        instance?.title ?? template?.title ?? snapshotTitle ?? "피드백 모임";
      const current = map.get(key);
      map.set(key, {
        key,
        instanceId: feedback.ticket_instance_id,
        templateId,
        label: meetingTicketLabel(baseLabel, instance?.operation_code),
        date,
        count: (current?.count ?? 0) + 1,
      });
    }

    for (const feedback of data?.blindDateFeedbacks ?? []) {
      const offer = blindDateOfferMap.get(feedback.offer_id);
      if (!offer) continue;
      const date = blindDateFeedbackDate(feedback, offer);
      if (selectedDate && date !== selectedDate) continue;

      const key = blindDateTicketKey(offer.id);
      const current = map.get(key);
      map.set(key, {
        key,
        instanceId: null,
        templateId: null,
        label: blindDateOfferLabel(offer, profileMap),
        date,
        count: (current?.count ?? 0) + 1,
      });
    }

    return Array.from(map.values()).sort((left, right) =>
      left.label.localeCompare(right.label, "ko"),
    );
  }, [
    blindDateOfferMap,
    data?.blindDateFeedbacks,
    data?.feedbacks,
    instanceMap,
    profileMap,
    selectedDate,
    templateMap,
  ]);

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
  const selectedBlindDateFeedbacks = useMemo(
    () =>
      (data?.blindDateFeedbacks ?? []).filter((feedback) => {
        const offer = blindDateOfferMap.get(feedback.offer_id);
        if (!offer) return false;
        const date = blindDateFeedbackDate(feedback, offer);
        return (
          (!selectedDate || date === selectedDate) &&
          (!selectedTicketKey || blindDateTicketKey(feedback.offer_id) === selectedTicketKey)
        );
      }),
    [blindDateOfferMap, data?.blindDateFeedbacks, selectedDate, selectedTicketKey],
  );
  const selectedFeedbackCount = selectedFeedbacks.length + selectedBlindDateFeedbacks.length;
  const totalFeedbackCount =
    (data?.feedbacks.length ?? 0) + (data?.blindDateFeedbacks.length ?? 0);

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

        <div className="mt-5">
          <SummaryBox label="원본 피드백" value={String(selectedFeedbackCount)} />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
            {error}
          </p>
        )}
      </aside>

      <section className="min-h-0 overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <StateMessage message="피드백 데이터를 불러오는 중입니다." />
        ) : !data || totalFeedbackCount === 0 ? (
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
                {selectedDate || "-"} · 제출 {selectedFeedbackCount}건
              </p>
            </section>

            <section className="rounded-2xl border border-black/10 p-5">
              <h3 className="text-base font-bold">원본 피드백 리스트</h3>
              <div className="mt-4 space-y-3">
                {selectedFeedbacks.map((feedback) => {
                  const writer = profileMap.get(feedback.user_id);
                  const selectedNames = (feedback.selected_member_ids ?? []).map((id) =>
                    memberName(profileMap.get(id), "알 수 없는 멤버"),
                  );
                  const hasCurrentQuestionnaire = Boolean(
                    feedback.place_feedback?.place_ratings ||
                      feedback.place_feedback?.dinner_member_ids ||
                      feedback.place_feedback?.overall_member_ids,
                  );

                  return (
                    <article
                      key={feedback.id}
                      className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black">
                            {memberName(writer, "작성자")}
                          </h4>
                          <GenderBadge gender={writer?.gender} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-black/40">
                          {savedAt(feedback.created_at)}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                        {hasCurrentQuestionnaire ? (
                          <>
                            <PersonFeedbackSummary
                              label="첫 테이블 멤버 평가"
                              memberFeedback={feedback.member_feedback}
                              ratedMembersOnly
                              profileMap={profileMap}
                            />
                            <MemberSelectionSummary
                              label="전체 멤버 중 단둘이 만나고 싶은 사람"
                              memberIds={feedback.place_feedback?.overall_member_ids ?? []}
                              unsure={feedback.place_feedback?.overall_member_unsure}
                              profileMap={profileMap}
                            />
                          </>
                        ) : (
                          <>
                            <SelectedMembersSummary selectedNames={selectedNames} />
                            <PersonFeedbackSummary
                              memberFeedback={feedback.member_feedback}
                              profileMap={profileMap}
                            />
                          </>
                        )}
                        <MeetingFeedbackSummary
                          placeFeedback={feedback.place_feedback}
                          profileMap={profileMap}
                        />
                      </div>
                    </article>
                  );
                })}
                {selectedBlindDateFeedbacks.map((feedback) => {
                  const offer = blindDateOfferMap.get(feedback.offer_id);
                  const writer = profileMap.get(feedback.user_id);
                  const counterpartId =
                    offer?.participant_a_id === feedback.user_id
                      ? offer.participant_b_id
                      : offer?.participant_a_id;
                  const counterpart = counterpartId
                    ? memberName(profileMap.get(counterpartId), "상대방")
                    : "상대방";

                  return (
                    <article
                      key={`blind-date-${feedback.id}`}
                      className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black">
                            {memberName(writer, "작성자")}
                          </h4>
                          <GenderBadge gender={writer?.gender} />
                          <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">
                            블라인드 데이트
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-black/40">
                          {savedAt(feedback.feedback_completed_at ?? feedback.created_at)}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <BlindDateRatingSummary
                          label={`${counterpart}님에 대한 호감도`}
                          value={feedback.counterpart_rating}
                        />
                        <BlindDateRatingSummary
                          label="장소 만족도"
                          value={feedback.place_rating}
                        />
                      </div>
                      {(feedback.counterpart_comment || feedback.place_comment) && (
                        <div className="mt-3 rounded-xl bg-white px-4 py-4">
                          <p className="text-[11px] font-bold text-black/35">남긴 의견</p>
                          <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5 text-black/65">
                            {feedback.counterpart_comment || feedback.place_comment}
                          </p>
                        </div>
                      )}
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

function MemberSelectionSummary({
  label,
  memberIds,
  unsure,
  profileMap,
}: {
  label: string;
  memberIds: string[];
  unsure?: boolean;
  profileMap: Map<string, FeedbackProfile>;
}) {
  const names = memberIds.map((id) =>
    memberName(profileMap.get(id), "알 수 없는 멤버"),
  );

  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold leading-4 text-black/45">{label}</p>
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-bold text-black/45">
          {names.length}명
        </span>
      </div>

      {unsure ? (
        <p className="mt-3 text-xs font-bold text-black/55">잘 모르겠어요</p>
      ) : names.length === 0 ? (
        <p className="mt-3 text-xs font-semibold text-black/35">
          선택한 사람이 없습니다.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {names.map((name, index) => (
            <div
              key={`${memberIds[index]}-${index}`}
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
  label = "사람별 인연 응답",
  memberFeedback,
  ratedMembersOnly = false,
  profileMap,
}: {
  label?: string;
  memberFeedback: Record<string, MemberFeedbackEntry> | null;
  ratedMembersOnly?: boolean;
  profileMap: Map<string, FeedbackProfile>;
}) {
  const entries = Object.entries(memberFeedback ?? {}).filter(
    ([, entry]) =>
      !ratedMembersOnly ||
      typeof entry.connection_strength === "number" ||
      entry.connection_intent === "no_show",
  );

  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-black/35">{label}</p>
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

            const intentLabel =
              entry?.connection_intent === "interested"
                ? "더 알아가고 싶음"
                : entry?.connection_intent === "enough"
                  ? "오늘 만남으로 충분"
                  : entry?.connection_intent === "no_show"
                    ? "만나지 못함 · 노쇼"
                    : entry?.status === "skipped"
                      ? "건너뜀"
                      : "추천 참고";
            const intentClass =
              entry?.connection_intent === "no_show"
                ? "bg-red-50 text-red-700"
                : entry?.connection_intent === "interested"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-sky-50 text-sky-700";

            return (
              <div
                key={memberId}
                className="rounded-xl border border-black/[0.07] bg-[#fbfbfa] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-black">
                    {memberName(profileMap.get(memberId), memberId)}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${intentClass}`}
                  >
                    {intentLabel}
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
                {entry?.connection_strength && (
                  <p className="mt-2 text-[10px] font-bold text-black/38">
                    다시 만나고 싶은 정도 {entry.connection_strength}/4
                  </p>
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

function BlindDateRatingSummary({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <p className="text-[11px] font-bold text-black/35">{label}</p>
      <div className="mt-3">
        <RatingRow label="평가" value={value} />
      </div>
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
  const placeRatings = placeFeedback?.place_ratings;
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
    feedbackScore(ratings?.expectation_match) !== null ||
    feedbackScore(placeFeedback?.recommendation_rating) !== null ||
    feedbackScore(placeRatings?.first?.rating) !== null ||
    feedbackScore(placeRatings?.second?.rating) !== null;

  return (
    <div className="min-w-0 rounded-xl bg-white px-4 py-4">
      <p className="text-[11px] font-bold text-black/35">모임 평가</p>

      {hasRatings ? (
        <div className="mt-3 space-y-2">
          {placeRatings ? (
            <>
              {placeRatings.first ? (
                <RatingRow
                  label={`첫 장소 · ${placeRatings.first.name || "장소명 없음"}`}
                  value={placeRatings.first.rating}
                />
              ) : null}
              <RatingRow
                label={`두 번째 장소 · ${placeRatings.second?.name || "장소명 없음"}`}
                value={placeRatings.second?.rating}
              />
              <RatingRow
                label="친구에게 추천할 의향"
                value={placeFeedback?.recommendation_rating}
              />
            </>
          ) : (
            <>
              <RatingRow label="전반적인 만족도" value={ratings?.overall} />
              <RatingRow label="친구에게 추천할 의향" value={ratings?.expectation_match} />
            </>
          )}
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

      {placeFeedback?.disruptive_member_note && (
        <div className="mt-4 border-t border-black/[0.06] pt-3">
          <p className="text-[11px] font-bold text-black/35">운영 참고 내용</p>
          <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5 text-black/65">
            {placeFeedback.disruptive_member_note}
          </p>
        </div>
      )}

      {placeFeedback?.negative_member_feedback && (
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
      )}
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
