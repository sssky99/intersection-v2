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
  nextBillingDate?: string | null;
  membership: "applied" | "unlinked" | "missing" | "review" | "refunded";
  withdrawnAccount?: boolean;
  access?: "active" | "scheduled" | "ended" | "inactive" | null;
  noticeStatus?: string | null;
  unpostedRounds?: Array<{ order: string; round: number; paidAt: string | null; amount: number }>;
  memberName?: string | null;
  accessEndsOn?: string | null;
  orderCount?: number;
};

type Overview = {
  snapshot: string;
  lastNoticeAt: string | null;
  incomplete: boolean;
  paidSubscriptions: number;
  unresolvedEvents: number;
  rows: Subscription[];
  subscribers: Array<Omit<Subscription, "membership">>;
};

const filters = [
  { key: "subscribers", label: "구독자" },
  { key: "paid", label: "유료 주문" },
  { key: "withdrawn", label: "탈퇴(결제 유지중)" },
  { key: "review", label: "확인 필요" },
  { key: "ending", label: "해지 예정" },
  { key: "refunded", label: "환불" },
] as const;
type Filter = (typeof filters)[number]["key"];

const subscriptionLabels = { open: "유지 중", ending: "해지 예정", past_due: "갱신 실패" };
const paymentLabels = { paid: "결제 완료", refunded: "환불 완료", partial: "부분 환불", requested: "환불 요청" };
const membershipLabels = {
  applied: "반영 완료",
  unlinked: "장부 있음 · 회원 연결 없음",
  missing: "장부 미반영",
  review: "확인 필요",
  refunded: "환불",
};
const accessLabels = { active: "이용 중", scheduled: "이용 시작 전", ended: "이용 종료", inactive: "현재 이용 불가" };
const noticeLabels: Record<string, string> = {
  unmatched: "알림 수신 · 회원 연결 실패",
  ambiguous: "알림 수신 · 연결할 회원 확인 필요",
  failed: "알림 수신 · 처리 실패",
  received: "알림 수신 · 처리 대기",
  processed: "알림 처리 완료 · 장부 확인 필요",
};
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
const pageSize = 15;

function needsReview({ membership, state, withdrawnAccount }: Subscription) {
  return !(withdrawnAccount && state !== "past_due") &&
    (membership === "missing" || membership === "unlinked" || membership === "review");
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
  const [filter, setFilter] = useState<Filter>("subscribers");
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
  const subscribers = (data?.subscribers ?? []).map((row) => ({ ...row, membership: "applied" as const }));
  const paid = rows.filter((row) => row.payment !== "refunded");
  const groups = {
    subscribers,
    paid,
    withdrawn: paid.filter((row) => row.withdrawnAccount && row.state === "open"),
    review: paid.filter(needsReview),
    ending: paid.filter((row) => row.state === "ending"),
    refunded: rows.filter((row) => row.payment === "refunded" || row.payment === "partial"),
  };
  const activeOrders = paid.filter((row) => row.access === "active").length;
  const scheduledOrders = paid.filter((row) => row.access === "scheduled").length;
  const withdrawnEnding = groups.ending.filter((row) => row.withdrawnAccount).length;
  const otherOrders = paid.length - activeOrders - scheduledOrders - groups.review.length -
    groups.withdrawn.length - withdrawnEnding;
  const needsReconciliation = data && (data.incomplete || data.unresolvedEvents > 0);
  const isSubscriberList = filter === "subscribers";
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
          <h3 id="groble-overview-heading" className="text-base font-bold text-stone-950">멤버십 구독자</h3>
          {data && (
            <p className="mt-1 text-xs text-stone-600">
              그로블 원본 대조 <time dateTime={data.snapshot}>{dateFormat.format(new Date(data.snapshot))}</time>
              {data.lastNoticeAt && (
                <> · 마지막 알림 <time dateTime={data.lastNoticeAt}>{dateFormat.format(new Date(data.lastNoticeAt))}</time></>
              )}
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
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-stone-50 px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">멤버십 구독자</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">
                {needsReconciliation ? "확인 중" : `${subscribers.length}명`}
              </dd>
            </div>
            <div className="bg-stone-50 px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">그로블 유료 주문</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">{data.paidSubscriptions}건</dd>
              <dd className="mt-1 text-xs leading-5 text-stone-600">
                이용 중 {activeOrders}
                {scheduledOrders > 0 && ` · 시작 전 ${scheduledOrders}`}
                {withdrawnEnding > 0 && ` · 탈퇴·해지 예정 ${withdrawnEnding}`}
                {otherOrders > 0 && ` · 그 외 ${otherOrders}`}
              </dd>
            </div>
            <div className="bg-stone-50 px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">탈퇴(결제 유지중)</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">{groups.withdrawn.length}건</dd>
            </div>
            <div className="bg-stone-50 px-4 py-3">
              <dt className="text-xs font-medium text-stone-600">확인 필요</dt>
              <dd className={cn("mt-1 text-2xl font-semibold tabular-nums", groups.review.length ? "text-amber-800" : "text-stone-950")}>{groups.review.length}건</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
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
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200">
            <div aria-hidden className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-4 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-600 md:grid">
              <span>{isSubscriberList ? "회원 · 주문" : "구매자 · 주문"}</span>
              <span>구독 상태</span><span>최근 결제</span>
              <span>{isSubscriberList ? "이용 종료일" : "교집합 반영"}</span>
            </div>
            {shown.length ? (
              <ul aria-label="그로블 구독 목록" className="divide-y divide-stone-100">
                {shown.map((row) => (
                  <li key={row.order} className="grid grid-cols-3 items-center gap-x-2 gap-y-3 px-4 py-3 text-sm hover:bg-stone-50/60 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:gap-x-4">
                    <div className="col-span-3 min-w-0 md:col-span-1">
                      <p className="break-words font-semibold text-stone-950">
                        {row.memberName ?? row.buyer ?? "이름 미제공"}
                        {isSubscriberList && (row.orderCount ?? 0) > 1 && (
                          <span className="ml-2 text-xs font-normal text-stone-600">주문 {row.orderCount}건</span>
                        )}
                      </p>
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
                    <div>
                      <span className="sr-only">구독 상태 </span>
                      <Badge tone={row.state === "open" ? "neutral" : "attention"}>{subscriptionLabels[row.state]}</Badge>
                      {row.withdrawnAccount && row.state === "open" && row.nextBillingDate && (
                        <p className="mt-1 text-xs tabular-nums text-stone-600">
                          다음 결제 <time dateTime={row.nextBillingDate}>{row.nextBillingDate}</time>
                        </p>
                      )}
                    </div>
                    <div><span className="sr-only">최근 결제 </span><Badge tone={row.payment === "paid" ? "positive" : "neutral"}>{paymentLabels[row.payment]}</Badge></div>
                    {isSubscriberList ? (
                      <div className="text-xs tabular-nums text-stone-700 sm:text-sm">
                        <span className="sr-only">이용 종료일 </span>
                        <time dateTime={row.accessEndsOn ?? undefined}>{row.accessEndsOn}</time>
                      </div>
                    ) : (
                      <div>
                        <span className="sr-only">교집합 반영 </span>
                        <Badge tone={needsReview(row) ? "attention" : "neutral"}>
                          {row.withdrawnAccount ? "탈퇴" : row.access ? accessLabels[row.access] : membershipLabels[row.membership]}
                        </Badge>
                        {row.membership === "missing" && !row.withdrawnAccount && (
                          <p className="mt-1 text-xs leading-5 text-stone-600">
                            {row.noticeStatus ? noticeLabels[row.noticeStatus] ?? "결제 알림 수신" : "결제 알림 미수신"}
                          </p>
                        )}
                      </div>
                    )}
                    {(row.unpostedRounds?.length ?? 0) > 1 && (
                      <details className="col-span-full text-xs text-stone-600">
                        <summary className="cursor-pointer font-semibold text-stone-800">
                          같은 구독의 장부 미반영 {row.unpostedRounds?.length}건
                        </summary>
                        <ul className="mt-1 space-y-1 pl-4">
                          {row.unpostedRounds?.map((charge) => (
                            <li key={charge.order} className="break-words">
                              {charge.round}회차 · {charge.paidAt && dateFormat.format(new Date(charge.paidAt))}
                              {" · "}{charge.amount.toLocaleString("ko-KR")}원 · {charge.order}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
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
