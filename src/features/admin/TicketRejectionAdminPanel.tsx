"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TicketRejectionAdminRow = {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  reasonLabel: string;
  originalTicketTitle: string;
  replacementTicketTitle: string;
  createdAt: string;
};

type TicketRejectionStat = {
  reason: string;
  reasonLabel: string;
  count: number;
  ratio: number;
};

type TicketRejectionAdminData = {
  rejections: TicketRejectionAdminRow[];
  stats: TicketRejectionStat[];
  total: number;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
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

async function loadTicketRejections() {
  const response = await fetch("/api/admin/ticket-rejections", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ticket-rejections-load-failed");
  return (await response.json()) as TicketRejectionAdminData;
}

export function TicketRejectionAdminPanel() {
  const [data, setData] = useState<TicketRejectionAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await loadTicketRejections());
    } catch {
      setError("거절 사유 데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const topReason = useMemo(
    () =>
      [...(data?.stats ?? [])]
        .filter((stat) => stat.count > 0)
        .sort((left, right) => right.count - left.count)[0] ?? null,
    [data?.stats],
  );

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              ticket rejections
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              거절 사유 관리
            </h2>
            <p className="mt-2 text-sm font-semibold text-black/50">
              누가 어떤 티켓에서 어떤 이유로 거절했고, 어떤 티켓을 다시
              추천받았는지 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-black/58 transition hover:border-black/20 hover:text-black disabled:opacity-45"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : undefined}
              aria-hidden
            />
            새로고침
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      <section className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
            total
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight">
            {data?.total ?? 0}
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-black/50">
            {topReason
              ? `가장 많은 사유는 ${topReason.reasonLabel} (${topReason.count}건)입니다.`
              : "아직 저장된 거절 사유가 없습니다."}
          </p>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
            reason stats
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.stats ?? []).map((stat) => (
              <div
                key={stat.reason}
                className="rounded-2xl border border-black/8 bg-[#f7f7f5] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-sm font-black text-black">
                    {stat.reasonLabel}
                  </p>
                  <span className="shrink-0 text-lg font-black text-black">
                    {stat.count}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${stat.ratio}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-bold text-black/40">
                  {stat.ratio}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/8 px-5 py-4">
          <h3 className="text-lg font-black">거절 사유 보관함</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[#f7f7f5] text-xs font-black uppercase tracking-[0.12em] text-black/40">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">사용자 이름</th>
                <th className="whitespace-nowrap px-5 py-3">거절 사유</th>
                <th className="min-w-[360px] px-5 py-3">티켓 변경</th>
                <th className="whitespace-nowrap px-5 py-3">저장 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {loading && !data ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm font-semibold text-black/42"
                  >
                    불러오는 중입니다.
                  </td>
                </tr>
              ) : (data?.rejections ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm font-semibold text-black/42"
                  >
                    저장된 거절 사유가 없습니다.
                  </td>
                </tr>
              ) : (
                data?.rejections.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-black/[0.02]">
                    <td className="whitespace-nowrap px-5 py-4 font-black text-black">
                      {row.userName}
                    </td>
                    <td className="px-5 py-4 font-semibold text-black/70">
                      {row.reasonLabel}
                    </td>
                    <td className="px-5 py-4 font-semibold text-black/70">
                      <span className="font-black text-black">
                        {row.originalTicketTitle}
                      </span>
                      <span className="px-2 text-black/35">-&gt;</span>
                      <span className="font-black text-black">
                        {row.replacementTicketTitle}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-black/42">
                      {formatDateTime(row.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
