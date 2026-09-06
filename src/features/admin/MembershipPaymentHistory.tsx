"use client";
import { useState } from "react";
type EventRow = {
  event_id: string;
  merchant_uid: string | null;
  processing_status: string;
  last_error: string | null;
  received_at: string;
};
type EffectRow = {
  transaction_id: number;
  merchant_uid: string | null;
  after_state: { plan: string; start_date: string; end_date: string };
  applied_at: string;
  cancelled_at: string | null;
  cancellation_revoked_access: boolean | null;
  profile: { name: string | null } | null;
};
const statuses: Record<string, string> = {
  failed: "처리 실패",
  received: "처리 대기",
  unmatched: "결제자 확인 필요",
  ambiguous: "결제자 중복 확인",
};
export function MembershipPaymentHistory() {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]),
    [effects, setEffects] = useState<EffectRow[]>([]);
  const [target, setTarget] = useState<EventRow | null>(null),
    [notice, setNotice] = useState("");
  async function load() {
    const response = await fetch("/api/admin/membership-payments", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setEvents(data.events);
    setEffects(data.effects);
  }
  async function show() {
    setOpen(true);
    setBusy(true);
    setError("");
    try {
      await load();
    } catch {
      setError("기록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    if (!target || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/membership-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: target.event_id }),
      });
      const data = await response.json();
      if (!response.ok)
        setError("처리를 완료하지 못했습니다. 아래 오류 내용을 확인해주세요.");
      else
        setNotice(
          data.status === "processed" || data.duplicate
            ? "재처리가 완료되었습니다."
            : "확인이 필요한 알림입니다. 처리 상태를 확인해주세요.",
        );
      setTarget(null);
      await load();
    } catch {
      setError("재처리 결과를 불러오지 못했습니다. 기록을 새로고침해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void show()}
        className="rounded-xl border px-4 py-2 text-sm font-semibold"
      >
        결제 처리 기록
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-history-title"
            className="max-h-[85dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="membership-history-title" className="font-bold">
                멤버십 결제 처리 기록
              </h3>
              <button disabled={busy} onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <p className="mt-2 text-sm text-black/55">
              결제 알림 처리 결과와 실제 반영 이력을 함께 확인하세요. 각각 최근
              30건을 표시합니다.
            </p>
            <button
              disabled={busy}
              onClick={() => void show()}
              className="mt-3 rounded-lg border px-3 py-2 text-xs"
            >
              새로고침
            </button>
            {busy && (
              <p role="status" className="mt-3 text-sm">
                처리 중입니다…
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="mt-3 text-sm text-emerald-700">
                {notice}
              </p>
            )}
            <h4 className="mt-6 font-bold">확인이 필요한 알림</h4>
            {!busy && !events.length && (
              <p className="mt-2 text-sm text-black/50">
                표시할 알림이 없습니다.
              </p>
            )}
            {events.map((event) => (
              <article
                key={event.event_id}
                className="mt-3 rounded-xl border p-3 text-xs"
              >
                <p className="font-bold">
                  {statuses[event.processing_status] ?? event.processing_status}{" "}
                  · {new Date(event.received_at).toLocaleString("ko-KR")}
                </p>
                <p className="mt-1 break-all text-black/50">
                  주문: {event.merchant_uid ?? "미확인"} · 알림:{" "}
                  {event.event_id}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {event.last_error ?? "결제자와 결제 상태를 확인해주세요."}
                </p>
                {["failed", "received"].includes(event.processing_status) && (
                  <button
                    disabled={busy}
                    onClick={() => setTarget(event)}
                    className="mt-3 rounded-lg border px-3 py-2 font-bold"
                  >
                    재처리
                  </button>
                )}
              </article>
            ))}
            <h4 className="mt-6 font-bold">최근 반영 이력</h4>
            {!busy && !effects.length && (
              <p className="mt-2 text-sm text-black/50">
                표시할 반영 이력이 없습니다.
              </p>
            )}
            {effects.map((effect) => (
              <article
                key={effect.transaction_id}
                className="mt-3 rounded-xl bg-black/[0.03] p-3 text-sm"
              >
                <p className="font-semibold">
                  {effect.profile?.name ?? "회원"} ·{" "}
                  {effect.cancelled_at ? "결제 취소" : "반영 완료"}
                </p>
                <p className="mt-1 text-xs text-black/55">
                  {effect.after_state.start_date} ~{" "}
                  {effect.after_state.end_date} · 주문{" "}
                  {effect.merchant_uid ?? effect.transaction_id}
                </p>
                {effect.cancelled_at && (
                  <p className="mt-1 text-xs">
                    {effect.cancellation_revoked_access
                      ? "멤버십 이용 권한도 취소했습니다."
                      : "현재 멤버십 이용 권한은 유지했습니다."}
                  </p>
                )}
              </article>
            ))}
            {target && (
              <div
                role="alertdialog"
                aria-labelledby="membership-retry-title"
                className="sticky bottom-0 mt-4 rounded-xl border border-black/20 bg-white p-4 shadow-lg"
              >
                <h4 id="membership-retry-title" className="font-bold">
                  이 결제 알림을 재처리할까요?
                </h4>
                <p className="mt-2 text-sm">
                  주문 {target.merchant_uid ?? target.event_id}의 저장된
                  알림으로 멤버십을 다시 반영합니다. 이미 완료된 결제는 중복
                  적용하지 않습니다.
                </p>
                <div className="mt-3 flex justify-end gap-3">
                  <button disabled={busy} onClick={() => setTarget(null)}>
                    닫기
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void retry()}
                    className="rounded-lg bg-black px-4 py-2 text-white"
                  >
                    재처리 실행
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
