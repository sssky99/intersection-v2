"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Subscription = {
  externalId: string | null;
  order: string;
  round: number;
  state: "open" | "ending" | "past_due";
  payment: "paid" | "refunded" | "partial" | "requested";
  buyer: string | null;
  membership: "applied" | "unlinked" | "missing" | "review" | "refunded";
};

type Overview = {
  snapshot: string;
  incomplete: boolean;
  paidBuyers: number;
  paidSubscriptions: number;
  unresolvedEvents: number;
  rows: Subscription[];
};

const filters = [
  { key: "all", label: "전체" },
  { key: "review", label: "확인 필요" },
  { key: "ending", label: "해지 예정" },
  { key: "refunded", label: "환불" },
] as const;
type Filter = (typeof filters)[number]["key"];

const subscriptionLabels = { open: "유지 중", ending: "해지 예정", past_due: "갱신 실패" };
const paymentLabels = { paid: "결제 완료", refunded: "환불 완료", partial: "부분 환불", requested: "환불 요청" };
const membershipLabels = {
  applied: "반영 완료",
  unlinked: "회원 연결 없음",
  missing: "장부 미반영",
  review: "확인 필요",
  refunded: "환불",
};
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
const pageSize = 15;

function needsReview({ membership }: Subscription) {
  return membership === "missing" || membership === "unlinked" || membership === "review";
}

function Badge({ children, tone = "neutral" }: {
  children: string;
  tone?: "neutral" | "positive" | "attention";
}) {
  return (
    <span className={cn(
      "inline-flex rounded-md px-2 py-1 text-xs font-medium",
      tone === "positive" && "bg-emerald-50 text-emerald-800",
      tone === "attention" && "bg-amber-50 text-amber-900",
      tone === "neutral" && "bg-stone-100 text-stone-700",
    )}>
      {children}
    </span>
  );
}

export function GrobleSubscriptionOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/groble-subscriptions", { cache: "no-store" });
      if (!response.ok) throw new Error("Subscription overview unavailable");
      const result = await response.json() as Overview | { snapshot: null };
      setData(result.snapshot === null ? null : result);
    } catch {
      setError("그로블 구독 현황을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];
  const groups = {
    all: rows,
    review: rows.filter(needsReview),
    ending: rows.filter((row) => row.state === "ending"),
    refunded: rows.filter((row) => row.payment === "refunded" || row.payment === "partial"),
  };
  const applied = rows.filter((row) => row.membership === "applied").length;
  const needsReconciliation = data && (data.incomplete || data.unresolvedEvents > 0);
  const filtered = groups[filter];
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function selectFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <section aria-labelledby="groble-overview-heading" className="min-w-0 space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="groble-overview-heading" className="text-base font-bold text-stone-950">그로블 구독 현황</h3>
          {data && (
            <p className="mt-1 text-xs text-stone-600">
              원본 확인 <time dateTime={data.snapshot}>{dateFormat.format(new Date(data.snapshot))}</time>
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden /> {busy ? "불러오는 중" : "새로고침"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {!data && !error && <p role="status" className="text-sm text-stone-600">{busy ? "구독 현황을 불러오는 중입니다." : "확인된 그로블 원본 목록이 없습니다."}</p>}
      {data && (
        <>
          {needsReconciliation && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              그로블 원본을 다시 확인해야 합니다.
              {data.unresolvedEvents > 0 && ` 연결을 확인할 알림 ${data.unresolvedEvents}건이 있습니다.`}
            </p>
          )}
          <dl className="grid grid-cols-1 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-stone-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">유료 구매자</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">
                {needsReconciliation ? "확인 중" : <>{data.paidBuyers}명 <span className="text-sm font-normal text-stone-600">· {data.paidSubscriptions}건</span></>}
              </dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">멤버십 반영</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">{applied}건</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">확인 필요</dt>
              <dd className={cn("mt-1 text-2xl font-semibold tabular-nums", groups.review.length ? "text-amber-800" : "text-stone-950")}>{groups.review.length}건</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="구독 목록 필터" className="flex flex-wrap gap-1">
              {filters.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => selectFilter(key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold",
                    filter === key ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100",
                  )}
                >
                  {label} <span className="ml-0.5 tabular-nums opacity-75">{groups[key].length}</span>
                </button>
              ))}
            </div>
            <p className="text-xs leading-5 text-stone-600">유료 집계는 전액 환불·해지 완료를 제외합니다.</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200">
            <div aria-hidden className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-4 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-600 md:grid">
              <span>구매자 · 주문</span><span>구독 상태</span><span>최근 결제</span><span>교집합 반영</span>
            </div>
            {shown.length ? (
              <ul aria-label="그로블 구독 목록" className="divide-y divide-stone-100">
                {shown.map((row) => (
                  <li key={row.order} className="grid grid-cols-3 items-center gap-x-2 gap-y-3 px-4 py-3 text-sm hover:bg-stone-50/60 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:gap-x-4">
                    <div className="col-span-3 min-w-0 md:col-span-1">
                      <p className="break-words font-semibold text-stone-950">{row.buyer ?? "이름 미제공"}</p>
                      {row.externalId && /^[a-zA-Z0-9]+$/.test(row.externalId) ? (
                        <a
                          className="mt-0.5 inline-flex min-w-0 items-center gap-1 break-all text-xs tabular-nums text-stone-600 underline-offset-4 hover:text-stone-950 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://groble.im/manage/store/products/pMT39R/sales/subscription/${row.externalId}?round=${row.round}`}
                        >
                          {row.order}<ArrowUpRight size={12} className="shrink-0" aria-label="새 탭" />
                        </a>
                      ) : <p className="mt-0.5 break-all text-xs tabular-nums text-stone-600">{row.order}</p>}
                    </div>
                    <div><span className="sr-only">구독 상태 </span><Badge tone={row.state === "open" ? "neutral" : "attention"}>{subscriptionLabels[row.state]}</Badge></div>
                    <div><span className="sr-only">최근 결제 </span><Badge tone={row.payment === "paid" ? "positive" : "neutral"}>{paymentLabels[row.payment]}</Badge></div>
                    <div><span className="sr-only">교집합 반영 </span><Badge tone={needsReview(row) ? "attention" : "neutral"}>{membershipLabels[row.membership]}</Badge></div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-8 text-center text-sm text-stone-600">표시할 구독이 없습니다.</p>}

            {pageCount > 1 && (
              <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-4 py-2 text-xs text-stone-600">
                <button type="button" aria-label="이전 페이지" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-md p-2 hover:bg-stone-100 disabled:opacity-35"><ChevronLeft size={16} aria-hidden /></button>
                <span aria-live="polite" className="tabular-nums">{currentPage} / {pageCount}</span>
                <button type="button" aria-label="다음 페이지" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-md p-2 hover:bg-stone-100 disabled:opacity-35"><ChevronRight size={16} aria-hidden /></button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
