"use client";

import { useCallback, useEffect, useState } from "react";

type Overview = {
  snapshot: string | null;
  incomplete: boolean;
  paidBuyers: number;
  paidSubscriptions: number;
  unresolvedEvents: number;
  rows: Array<{
    externalId: string | null;
    order: string;
    round: number;
    state: "open" | "ending" | "past_due";
    payment: "paid" | "refunded" | "partial" | "requested";
    buyer: string | null;
    nextBillingDate: string | null;
    membership: "applied" | "unlinked" | "missing" | "review" | "refunded";
  }>;
};

const subscriptionLabels = { open: "유지", ending: "해지 예정", past_due: "갱신 실패" };
const paymentLabels = { paid: "결제 완료", refunded: "환불 완료", partial: "부분 환불", requested: "환불 요청" };
const membershipLabels = {
  applied: "반영 완료",
  unlinked: "회원 연결 없음",
  missing: "결제 장부 없음",
  review: "확인 필요",
  refunded: "환불",
};
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul",
});

export function GrobleSubscriptionOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/groble-subscriptions", { cache: "no-store" });
      if (!response.ok) throw new Error("Subscription overview unavailable");
      setData(await response.json());
      setError("");
    } catch {
      setError("그로블 구독 현황을 불러오지 못했습니다.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <details className="rounded-xl border border-black/10">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
        그로블 구독 현황
        {data?.snapshot && !data.incomplete && !data.unresolvedEvents
          ? ` · 유료 ${data.paidBuyers}명 (${data.paidSubscriptions}건)`
          : ""}
      </summary>
      <div className="border-t border-black/10 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-black/65">
            {error || (!data ? "불러오는 중…" : data.snapshot
              ? `그로블 원본 확인 ${dateFormat.format(new Date(data.snapshot))} · 이후 수신한 결제·해지 알림 반영`
              : "확인된 그로블 원본 목록이 없습니다.")}
          </p>
          <button type="button" className="rounded-lg border px-2 py-1" onClick={() => void load()}>
            새로고침
          </button>
        </div>
        {data?.snapshot && (
          <>
            <p className="mt-1 text-black/60">유료는 최신 회차 전액 환불과 해지 완료를 제외한 수입니다. 초대·수동 멤버십은 아래 멤버십 목록에서 확인하세요.</p>
            {(data.incomplete || data.unresolvedEvents > 0) && (
              <p role="status" className="mt-2 font-semibold text-amber-800">
                원본 재확인이 필요합니다.
                {data.unresolvedEvents > 0 && ` 연결 확인이 필요한 알림 ${data.unresolvedEvents}건.`}
              </p>
            )}
            <div className="mt-2 max-h-56 overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white text-black/60">
                  <tr><th className="p-2">구매자</th><th className="p-2">주문번호</th><th className="p-2">그로블 상태</th><th className="p-2">교집합 반영</th></tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.order} className="border-t border-black/5">
                      <td className="p-2">{row.buyer ?? "이름 미제공"}</td>
                      <td className="p-2">
                        {row.externalId && /^[a-zA-Z0-9]+$/.test(row.externalId) ? (
                          <a className="underline" target="_blank" rel="noreferrer"
                            href={`https://groble.im/manage/store/products/pMT39R/sales/subscription/${row.externalId}?round=${row.round}`}>
                            {row.order}
                          </a>
                        ) : row.order}
                      </td>
                      <td className="p-2">{subscriptionLabels[row.state]} · {paymentLabels[row.payment]}</td>
                      <td className="p-2">{membershipLabels[row.membership]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
