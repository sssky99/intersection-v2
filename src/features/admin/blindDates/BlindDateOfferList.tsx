"use client";
import { useState } from "react";
import type {
  BlindDateAdminOffer,
  BlindDateOfferStatus,
} from "@/types/blindDate";
import { OfferPlaceEditor, ResponseCell } from "./OfferControls";

const labels: Record<BlindDateOfferStatus, string> = {
  pending_admin: "운영 검수",
  offered: "응답 대기",
  waiting_response: "응답 대기",
  scheduled: "일정 확정",
  needs_reschedule: "일정 조율 필요",
  declined: "거절",
  expired: "만료",
  cancelled: "취소",
  completed: "완료",
};
const closed = new Set<BlindDateOfferStatus>([
  "declined",
  "expired",
  "cancelled",
  "completed",
]);

export function BlindDateOfferList({
  offers,
  saving,
  onUpdate,
}: {
  offers: BlindDateAdminOffer[];
  saving: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [view, setView] = useState("active");
  const [search, setSearch] = useState("");
  const [reset, setReset] = useState<{
    offer: BlindDateAdminOffer;
    participant: "a" | "b";
  } | null>(null);
  const active = offers.filter((o) => !closed.has(o.status));
  const visible = offers.filter(
    (o) =>
      (view === "all" ||
        (view === "closed" ? closed.has(o.status) : !closed.has(o.status))) &&
      (!search.trim() ||
        [
          o.participantA?.name,
          o.participantA?.nickname,
          o.participantA?.phone,
          o.participantB?.name,
          o.participantB?.nickname,
          o.participantB?.phone,
          o.actual_place_name,
          o.scheduled_date,
        ].some((v) => v?.includes(search.trim()))),
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "active", label: "진행 중", count: active.length },
          {
            key: "closed",
            label: "종료 기록",
            count: offers.length - active.length,
          },
          { key: "all", label: "전체", count: offers.length },
        ].map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setView(tab.key)}
            aria-pressed={view === tab.key}
            className={
              "rounded-xl border px-4 py-2 text-sm " +
              (view === tab.key ? "bg-black text-white" : "bg-white")
            }
          >
            {tab.label} {tab.count}
          </button>
        ))}
        <input
          aria-label="데이트 검색"
          placeholder="이름·전화번호·장소·날짜 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border p-2 text-sm"
        />
      </div>
      {visible.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-black/50">
          해당하는 데이트가 없습니다.
        </p>
      )}
      {visible.map((offer) => (
        <article
          key={offer.id}
          className="grid gap-5 rounded-2xl border border-black/10 bg-white p-5 xl:grid-cols-[minmax(180px,0.65fr)_minmax(0,2fr)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">
                {offer.participantA?.name ||
                  offer.participantA?.nickname ||
                  "이름 없음"}{" "}
                ·{" "}
                {offer.participantB?.name ||
                  offer.participantB?.nickname ||
                  "이름 없음"}
              </h3>
              <p className="mt-1 text-sm text-black/55">
                {offer.scheduled_date || "날짜 미확정"} · {offer.time_label} ·{" "}
                {offer.actual_place_name || "장소 미정"}
              </p>
              <p className="mt-2 text-xs text-black/45">
                {labels[offer.status]} · 응답{" "}
                {Number(offer.a_response !== "pending") +
                  Number(offer.b_response !== "pending")}
                /2
              </p>
            </div>
          </div>
          <div className="grid min-w-0 gap-5 border-t pt-4 md:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
            <div className="min-w-0 space-y-4">
              <label className="block text-sm font-semibold">
                상태
                <select
                  aria-label="데이트 상태"
                  value={offer.status}
                  disabled={saving}
                  onChange={(e) =>
                    void onUpdate(offer.id, { status: e.target.value })
                  }
                  className="ml-3 rounded-xl border p-2"
                >
                  {(Object.keys(labels) as BlindDateOfferStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {status === "offered" ? "초대장 생성" : labels[status]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {(["a", "b"] as const).map((participant) => {
                const profile =
                  participant === "a" ? offer.participantA : offer.participantB;
                const dates =
                  participant === "a"
                    ? offer.a_available_dates
                    : offer.b_available_dates;
                return (
                  <div
                    key={participant}
                    className="rounded-xl bg-black/[0.025] p-3 text-sm"
                  >
                    <p className="mb-2 font-semibold">
                      {profile?.name || profile?.nickname || "이름 없음"} ·{" "}
                      {profile?.phone || "전화번호 없음"}
                    </p>
                    <ResponseCell
                      value={
                        participant === "a"
                          ? offer.a_response
                          : offer.b_response
                      }
                      disabled={saving}
                      onReset={() => setReset({ offer, participant })}
                    />
                    <p className="mt-2 text-xs text-black/50">
                      가능 날짜: {dates.join(", ") || "미선택"}
                    </p>
                  </div>
                );
              })}
              <p className="text-xs text-black/50">
                응답 마감:{" "}
                {new Date(offer.expires_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </p>
            </div>
            <OfferPlaceEditor
              offer={offer}
              saving={saving}
              onSave={(
                o,
                actualPlaceName,
                actualPlaceAddress,
                reservationName,
                scheduledDate,
              ) =>
                void onUpdate(o.id, {
                  actualPlaceName,
                  actualPlaceAddress,
                  reservationName,
                  ...(scheduledDate !== (o.scheduled_date ?? "")
                    ? { scheduledDate }
                    : {}),
                })
              }
            />
          </div>
        </article>
      ))}
      {reset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="blind-reset-title"
            className="max-w-md rounded-2xl bg-white p-6"
          >
            <h3 id="blind-reset-title" className="font-bold">
              응답을 초기화할까요?
            </h3>
            <p className="mt-3 text-sm">
              선택한 참가자의 응답과 가능 날짜, 이 데이트의 확정 날짜가
              초기화됩니다.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setReset(null)}
              >
                닫기
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-white"
                onClick={async () => {
                  if (
                    await onUpdate(reset.offer.id, {
                      resetParticipant: reset.participant,
                    })
                  )
                    setReset(null);
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
