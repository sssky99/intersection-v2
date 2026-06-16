"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateMembershipEndDate,
  displayMembershipStatus,
  membershipPlanLabels,
  membershipPlans,
  membershipStatusLabels,
  type MembershipPlan,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";

type AdminMembership = {
  user_id: string;
  name: string | null;
  phone: string | null;
  membership_status: MembershipStatus | null;
  membership_plan: MembershipPlan | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  membership_purchase_clicked_at: string | null;
  membership_updated_at: string | null;
  display_status: MembershipStatus | null;
};

type MembershipStatusFilter = "all" | "active" | "expired" | "pending";

type Draft = {
  plan: MembershipPlan | "";
  startDate: string;
  endDate: string;
};

const visibleStatusOptions: MembershipStatusFilter[] = [
  "all",
  "active",
  "expired",
  "pending",
];

const statusSelectOptions: MembershipStatus[] = [
  "active",
  "expired",
  "pending",
  "cancelled",
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function profileName(row: AdminMembership) {
  return row.name?.trim() || "이름 없음";
}

function statusForDisplay(row: AdminMembership) {
  return (
    displayMembershipStatus({
      status: row.membership_status,
      endDate: row.membership_end_date,
    }) ?? row.display_status
  );
}

function membershipName(row: AdminMembership) {
  const status = statusForDisplay(row);

  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-black">
      <span>{profileName(row)}</span>
      {status === "active" && <span aria-label="멤버십 적용중">💎</span>}
      {status === "expired" && (
        <span className="text-sm font-black text-red-500" aria-label="멤버십 만료">
          ♦
        </span>
      )}
    </span>
  );
}

function periodText(row: AdminMembership) {
  if (row.membership_start_date && row.membership_end_date) {
    return `${row.membership_start_date} ~ ${row.membership_end_date}`;
  }

  if (statusForDisplay(row) === "pending") return "결제 확인 전";
  return "기간 미설정";
}

function initialDraft(row: AdminMembership): Draft {
  return {
    plan: row.membership_plan ?? "",
    startDate: row.membership_start_date ?? "",
    endDate: row.membership_end_date ?? "",
  };
}

export function MembershipAdminPanel() {
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<MembershipStatusFilter>("all");

  const hydrateDrafts = (rows: AdminMembership[]) => {
    setDrafts(
      Object.fromEntries(rows.map((row) => [row.user_id, initialDraft(row)])),
    );
  };

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/memberships", {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("memberships-load-failed");

      const data = (await response.json()) as {
        memberships?: AdminMembership[];
      };
      const rows = data.memberships ?? [];
      setMemberships(rows);
      hydrateDrafts(rows);
    } catch {
      setError("멤버십 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const filteredMemberships = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return memberships.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${row.name ?? ""} ${row.phone ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      const displayStatus = statusForDisplay(row);
      const matchesStatus =
        statusFilter === "all" || displayStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [memberships, query, statusFilter]);

  const updateRow = (row: AdminMembership) => {
    const normalizedRow = {
      ...row,
      display_status: statusForDisplay(row),
    };

    setMemberships((current) =>
      normalizedRow.membership_status === "cancelled"
        ? current.filter((item) => item.user_id !== normalizedRow.user_id)
        : current.map((item) =>
            item.user_id === normalizedRow.user_id ? normalizedRow : item,
          ),
    );
    setDrafts((current) => {
      const next = { ...current };

      if (normalizedRow.membership_status === "cancelled") {
        delete next[normalizedRow.user_id];
      } else {
        next[normalizedRow.user_id] = initialDraft(normalizedRow);
      }

      return next;
    });
  };

  const saveMembership = async (
    row: AdminMembership,
    nextStatus: MembershipStatus,
    draft = drafts[row.user_id] ?? initialDraft(row),
  ) => {
    if (
      nextStatus === "active" &&
      (!draft.plan || !draft.startDate || !draft.endDate)
    ) {
      setNotice("멤버십 적용중으로 변경하려면 플랜과 기간을 먼저 설정해주세요.");
      return false;
    }

    setSavingId(row.user_id);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/memberships", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: row.user_id,
          status: nextStatus,
          plan: draft.plan || null,
          startDate: draft.startDate || null,
          endDate: draft.endDate || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        membership?: AdminMembership;
      } | null;

      if (!response.ok || !data?.membership) {
        setNotice(data?.error ?? "멤버십 상태를 저장하지 못했습니다.");
        return false;
      }

      updateRow(data.membership);
      setNotice("저장되었습니다.");
      return true;
    } catch {
      setNotice("멤버십 상태를 저장하지 못했습니다.");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const changeStatus = async (
    row: AdminMembership,
    status: MembershipStatus,
  ) => {
    await saveMembership(row, status);
  };

  const changeDraft = (userId: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? { plan: "", startDate: "", endDate: "" }),
        ...patch,
      },
    }));
  };

  const applyPlanDuration = (row: AdminMembership, plan: MembershipPlan) => {
    const current = drafts[row.user_id] ?? initialDraft(row);
    const startDate = current.startDate || new Date().toISOString().slice(0, 10);

    changeDraft(row.user_id, {
      plan,
      startDate,
      endDate: calculateMembershipEndDate(startDate, plan),
    });
  };

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[620px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">멤버십 관리</h2>
            <p className="mt-1 text-xs leading-5 text-black/45">
              결제 확인 전, 적용중, 만료 상태를 운영자가 직접 관리합니다.
              취소 상태는 저장 후 목록에서 제외됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={loadMemberships}
            className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
          >
            새로고침
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(300px,1fr)_180px] gap-2">
          <label className="relative block">
            <Search
              size={16}
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름 검색"
              className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as MembershipStatusFilter)
            }
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
          >
            {visibleStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "전체" : membershipStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        {notice && (
          <p
            className={cn(
              "mt-3 rounded-xl px-4 py-2 text-sm font-semibold",
              notice === "저장되었습니다."
                ? "bg-accent/12 text-black/65"
                : "bg-red-50 text-red-600",
            )}
          >
            {notice}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <StateMessage message="멤버십 목록을 불러오는 중입니다." />
        ) : error ? (
          <StateMessage tone="error" message={error} />
        ) : filteredMemberships.length === 0 ? (
          <StateMessage message="관리할 멤버십 내역이 없습니다." />
        ) : (
          <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
              <tr>
                <TableHead>이름</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>플랜</TableHead>
                <TableHead>기간</TableHead>
              </tr>
            </thead>
            <tbody>
              {filteredMemberships.map((row) => {
                const draft = drafts[row.user_id] ?? initialDraft(row);
                const saving = savingId === row.user_id;

                return (
                  <tr
                    key={row.user_id}
                    className="border-b border-black/5 align-top transition hover:bg-accent/10"
                  >
                    <td className="border-b border-black/5 px-5 py-4">
                      {membershipName(row)}
                      {row.phone && (
                        <p className="mt-1 text-xs font-semibold text-black/38">
                          {row.phone}
                        </p>
                      )}
                    </td>
                    <td className="border-b border-black/5 px-5 py-4">
                      <select
                        value={statusForDisplay(row) ?? "pending"}
                        disabled={saving}
                        onChange={(event) =>
                          void changeStatus(
                            row,
                            event.target.value as MembershipStatus,
                          )
                        }
                        className="h-10 w-40 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
                      >
                        {statusSelectOptions.map((status) => (
                          <option key={status} value={status}>
                            {membershipStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-black/5 px-5 py-4">
                      <select
                        value={draft.plan}
                        disabled={saving}
                        onChange={(event) =>
                          changeDraft(row.user_id, {
                            plan: event.target.value as MembershipPlan,
                          })
                        }
                        className="h-10 w-44 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
                      >
                        <option value="">-</option>
                        {membershipPlans.map((plan) => (
                          <option key={plan} value={plan}>
                            {membershipPlanLabels[plan]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 flex gap-1.5">
                        {membershipPlans.map((plan) => (
                          <button
                            key={plan}
                            type="button"
                            disabled={saving}
                            onClick={() => applyPlanDuration(row, plan)}
                            className="h-8 rounded-lg border border-black/10 bg-white px-2.5 text-xs font-bold text-black/50 transition hover:border-accent/60 hover:text-black disabled:opacity-45"
                          >
                            {membershipPlanLabels[plan].replace(" 멤버십", "")}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="border-b border-black/5 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={draft.startDate}
                          disabled={saving}
                          onChange={(event) => {
                            const startDate = event.target.value;
                            changeDraft(row.user_id, {
                              startDate,
                              endDate: draft.plan
                                ? calculateMembershipEndDate(
                                    startDate,
                                    draft.plan,
                                  )
                                : draft.endDate,
                            });
                          }}
                          className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
                        />
                        <span className="text-black/30">~</span>
                        <input
                          type="date"
                          value={draft.endDate}
                          disabled={saving}
                          onChange={(event) =>
                            changeDraft(row.user_id, {
                              endDate: event.target.value,
                            })
                          }
                          className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void saveMembership(
                              row,
                              row.membership_status ?? "pending",
                              draft,
                            )
                          }
                          className="h-10 rounded-xl bg-black px-4 text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/35"
                        >
                          {saving ? "저장 중" : "저장"}
                        </button>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-black/38">
                        {periodText(row)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-black/10 px-5 py-3 font-bold">
      {children}
    </th>
  );
}

function StateMessage({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-black/45",
      )}
    >
      {message}
    </div>
  );
}
