"use client";

import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  LockKeyhole,
  RefreshCw,
  Save,
  Search,
  UsersRound,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AdminMemberName,
  formatAgeAndBirthYear,
  membershipLabel,
  membershipStatusForDisplay,
} from "@/features/admin/adminDisplay";
import {
  membershipStatuses,
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";
import {
  arrivalStatusLabels,
  waitlistStatuses,
  waitlistStatusLabels,
  type AdminWaitlistData,
  type AdminWaitlistRow,
  type WaitlistStatus,
  type WaitlistTicketInstance,
  type WaitlistTicketTemplate,
} from "@/features/admin/waitlistAdminTypes";

type WaitlistPatch = {
  status?: WaitlistStatus;
  adminNote?: string | null;
  ticketInstanceId?: string | null;
};

type StatusFilter = WaitlistStatus | "all";
type GenderFilter = "all" | "남성" | "여성" | "unknown";
type MembershipFilter = MembershipStatus | "all";
const allDatesValue = "all" as const;
const actionableDatesValue = "actionable" as const;
const pastDatesValue = "past" as const;
type DateFilter =
  | typeof allDatesValue
  | typeof actionableDatesValue
  | typeof pastDatesValue
  | string;

type WaitlistGroup = {
  id: string;
  title: string;
  date: string;
  rows: AdminWaitlistRow[];
  total: number;
  counts: Record<WaitlistStatus, number>;
};

const actionableStatuses = new Set<WaitlistStatus>([
  "waitlisted",
  "payment_pending",
  "on_hold",
]);

const waitlistStatusPriority: Record<WaitlistStatus, number> = {
  waitlisted: 0,
  payment_pending: 1,
  on_hold: 2,
  approved: 3,
  not_selected: 4,
  feedback_done: 5,
  completed: 6,
  cancelled: 7,
};

const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const statusMetricLabels: Record<WaitlistStatus, string> = {
  payment_pending: "입금전",
  waitlisted: "대기",
  approved: "승인",
  on_hold: "보류",
  not_selected: "미선정",
  cancelled: "취소",
  feedback_done: "피드백",
  completed: "종료",
};

const statusBadgeClasses: Record<WaitlistStatus, string> = {
  payment_pending: "border-amber-200 bg-amber-50 text-amber-700",
  waitlisted: "border-sky-200 bg-sky-50 text-sky-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  on_hold: "border-zinc-200 bg-zinc-50 text-zinc-700",
  not_selected: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-black/10 bg-black/5 text-black/45",
  feedback_done: "border-violet-200 bg-violet-50 text-violet-700",
  completed: "border-black/10 bg-black/5 text-black/45",
};

const genderFilters: Array<{ value: GenderFilter; label: string }> = [
  { value: "all", label: "성별 전체" },
  { value: "남성", label: "남성" },
  { value: "여성", label: "여성" },
  { value: "unknown", label: "미입력" },
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatCreatedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return dateTimeFormatter.format(date);
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return "";
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function rowDate(row: AdminWaitlistRow) {
  return (
    normalizeDate(row.meeting_date) ||
    normalizeDate(row.ticket_instance?.event_date) ||
    normalizeDate(row.ticket_snapshot?.date)
  );
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value || "날짜 미선택";
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(year, month - 1, day).getDay()
  ];
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(
    2,
    "0",
  )} ${weekday}`;
}

function formatShortDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(year, month - 1, day).getDay()
  ];
  return `${String(month).padStart(2, "0")}.${String(day).padStart(
    2,
    "0",
  )} ${weekday}`;
}

function waitlistDateOptions(
  rows: AdminWaitlistRow[],
  predicate?: (date: string) => boolean,
) {
  return Array.from(
    new Set(
      rows
        .map(rowDate)
        .filter((date) => Boolean(date) && (!predicate || predicate(date))),
    ),
  ).sort();
}

function waitlistDateCounts(rows: AdminWaitlistRow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const date = rowDate(row);
    if (!date) return;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  });
  return counts;
}

function rowTemplateId(row: AdminWaitlistRow) {
  return (
    row.ticket_template_id ??
    row.ticket_instance?.template_id ??
    row.ticket_snapshot?.templateId ??
    ""
  );
}

function ticketTitle(row: AdminWaitlistRow) {
  if (row.source === "date_application") return "날짜 대기 신청";

  return (
    row.ticket_template?.title ??
    row.ticket_snapshot?.title ??
    row.ticket_instance?.title ??
    row.ticket_id ??
    "티켓 미확인"
  );
}

function rowGroupId(row: AdminWaitlistRow) {
  if (row.source === "date_application") return "date-applications";
  return rowTemplateId(row) || `ticket:${row.ticket_id || rowKey(row)}`;
}

function formatTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function instanceText(instance: WaitlistTicketInstance | null) {
  if (!instance) return "미배정";
  const label = instance.operation_code
    ? `${instance.operation_code} (${instance.title})`
    : instance.title;
  const schedule = [instance.event_date, formatTime(instance.event_time)]
    .filter(Boolean)
    .join(" ");
  return [label, schedule, instance.region].filter(Boolean).join(" / ");
}

function arrivalStatusText(row: AdminWaitlistRow) {
  if (!row.arrival_status) return "미응답";
  const label = arrivalStatusLabels[row.arrival_status] ?? row.arrival_status;
  return row.arrival_status_updated_at
    ? `${label} · ${formatCreatedAt(row.arrival_status_updated_at)}`
    : label;
}

function instanceOptionLabel(
  instance: WaitlistTicketInstance,
  templateMap: Map<string, WaitlistTicketTemplate>,
) {
  const template = templateMap.get(instance.template_id);
  const schedule = [instance.event_date, formatTime(instance.event_time)]
    .filter(Boolean)
    .join(" ");
  const code = instance.operation_code ? `[${instance.operation_code}]` : null;
  return [
    code,
    template?.title,
    instance.title,
    schedule,
    instance.region,
  ]
    .filter(Boolean)
    .join(" · ");
}

function rowKey(row: AdminWaitlistRow) {
  return String(row.id);
}

function compactPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const lastEight = digits.slice(-8);
  if (lastEight.length === 8) {
    return `${lastEight.slice(0, 4)}-${lastEight.slice(4)}`;
  }
  return display(value);
}

function searchMatches(row: AdminWaitlistRow, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const profile = row.profile;
  const name = profile?.name?.toLocaleLowerCase("ko-KR") ?? "";
  const queryText = trimmed.toLocaleLowerCase("ko-KR");
  const queryDigits = trimmed.replace(/\D/g, "");
  const phoneDigits = profile?.phone?.replace(/\D/g, "") ?? "";

  return (
    name.includes(queryText) ||
    (queryDigits.length > 0 && phoneDigits.includes(queryDigits))
  );
}

function rowMembershipStatus(row: AdminWaitlistRow): MembershipStatus {
  return row.profile ? membershipStatusForDisplay(row.profile) : "none";
}

function rowGenderFilter(row: AdminWaitlistRow): GenderFilter {
  const gender = row.profile?.gender;
  if (gender === "남성" || gender === "여성") return gender;
  return "unknown";
}

function countStatuses(rows: AdminWaitlistRow[]) {
  const counts = Object.fromEntries(
    waitlistStatuses.map((status) => [status, 0]),
  ) as Record<WaitlistStatus, number>;
  rows.forEach((row) => {
    counts[row.status] += 1;
  });
  return counts;
}

function groupWaitlistRows(
  rows: AdminWaitlistRow[],
  includeDateInGroup = false,
  dateDirection: "asc" | "desc" | "operational" = "asc",
): WaitlistGroup[] {
  const groups = new Map<string, WaitlistGroup>();

  rows.forEach((row) => {
    const date = rowDate(row);
    const id = includeDateInGroup
      ? `${date || "no-date"}:${rowGroupId(row)}`
      : rowGroupId(row);
    const current =
      groups.get(id) ??
      ({
        id,
        title: includeDateInGroup
          ? `${date ? formatShortDateLabel(date) : "날짜 미선택"} · ${ticketTitle(row)}`
          : ticketTitle(row),
        date,
        rows: [],
        total: 0,
        counts: countStatuses([]),
      } satisfies WaitlistGroup);

    current.rows.push(row);
    current.total += 1;
    current.counts[row.status] += 1;
    groups.set(id, current);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => {
        const statusCompare =
          waitlistStatusPriority[a.status] - waitlistStatusPriority[b.status];
        if (statusCompare !== 0) return statusCompare;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      }),
    }))
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) {
        if (dateDirection === "operational") {
          if (!a.date) return 1;
          if (!b.date) return -1;
          const today = todayInSeoul();
          const aIsPast = a.date < today;
          const bIsPast = b.date < today;
          if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
          return aIsPast ? -dateCompare : dateCompare;
        }
        return dateDirection === "desc" ? -dateCompare : dateCompare;
      }
      return a.title.localeCompare(b.title, "ko");
    });
}

function instancesForRow(
  row: AdminWaitlistRow,
  instances: WaitlistTicketInstance[],
) {
  const templateId = rowTemplateId(row);
  const date = rowDate(row);
  const filtered = instances.filter((instance) => {
    const templateMatches = templateId
      ? instance.template_id === templateId
      : true;
    const dateMatches = date ? normalizeDate(instance.event_date) === date : true;
    return templateMatches && dateMatches;
  });
  const current = row.ticket_instance;

  if (current && !filtered.some((instance) => instance.id === current.id)) {
    return [current, ...filtered];
  }

  return filtered;
}

export function WaitlistAdminPanel() {
  const [rows, setRows] = useState<AdminWaitlistRow[]>([]);
  const [templates, setTemplates] = useState<WaitlistTicketTemplate[]>([]);
  const [instances, setInstances] = useState<WaitlistTicketInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] =
    useState<DateFilter>(actionableDatesValue);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [membershipFilter, setMembershipFilter] =
    useState<MembershipFilter>("all");
  const [query, setQuery] = useState("");
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set());
  const [distributionSelection, setDistributionSelection] = useState<Set<string>>(
    new Set(),
  );
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSavingGroupId, setBulkSavingGroupId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback((data: AdminWaitlistData) => {
    const nextRows = data.waitlist ?? [];
    setRows(nextRows);
    setTemplates(data.templates ?? []);
    setInstances(data.instances ?? []);
    setNoteDrafts(
      Object.fromEntries(
        nextRows.map((row) => [rowKey(row), row.admin_note ?? ""]),
      ),
    );
    setSelectedDate((current) => {
      if (
        current === allDatesValue ||
        current === actionableDatesValue ||
        current === pastDatesValue
      ) {
        return current;
      }
      const dates = waitlistDateOptions(nextRows);
      return current && dates.includes(current) ? current : actionableDatesValue;
    });
    setSelectedId((current) => {
      if (current && nextRows.some((row) => rowKey(row) === current)) {
        return current;
      }
      return nextRows[0] ? rowKey(nextRows[0]) : null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/waitlist", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | (AdminWaitlistData & { error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "waitlist-load-failed");
      }
      hydrate(data);
    } catch {
      setError("대기열 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateMap = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const today = useMemo(() => todayInSeoul(), []);
  const dateOptions = useMemo(
    () => waitlistDateOptions(rows, (date) => date >= today),
    [rows, today],
  );
  const dateCounts = useMemo(() => waitlistDateCounts(rows), [rows]);
  const showingAllDates = selectedDate === allDatesValue;
  const showingActionableDates = selectedDate === actionableDatesValue;
  const showingPastDates = selectedDate === pastDatesValue;
  const showingExactDate =
    !showingAllDates && !showingActionableDates && !showingPastDates;

  const actionableCount = useMemo(
    () =>
      rows.filter((row) => {
        const date = rowDate(row);
        return date >= today && actionableStatuses.has(row.status);
      }).length,
    [rows, today],
  );
  const pastCount = useMemo(
    () =>
      rows.filter((row) => {
        const date = rowDate(row);
        return Boolean(date) && date < today;
      }).length,
    [rows, today],
  );

  const dateScopedRows = useMemo(() => {
    if (showingAllDates) return rows;
    if (showingActionableDates) {
      return rows.filter((row) => {
        const date = rowDate(row);
        return date >= today && actionableStatuses.has(row.status);
      });
    }
    if (showingPastDates) {
      return rows.filter((row) => {
        const date = rowDate(row);
        return Boolean(date) && date < today;
      });
    }
    if (!selectedDate) return [];
    return rows.filter((row) => rowDate(row) === selectedDate);
  }, [
    rows,
    selectedDate,
    showingActionableDates,
    showingAllDates,
    showingPastDates,
    today,
  ]);

  const filteredRows = useMemo(
    () =>
      dateScopedRows.filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (genderFilter !== "all" && rowGenderFilter(row) !== genderFilter) {
          return false;
        }
        if (
          membershipFilter !== "all" &&
          rowMembershipStatus(row) !== membershipFilter
        ) {
          return false;
        }
        return searchMatches(row, query);
      }),
    [dateScopedRows, genderFilter, membershipFilter, query, statusFilter],
  );

  const groups = useMemo(
    () =>
      groupWaitlistRows(
        filteredRows,
        !showingExactDate,
        showingPastDates ? "desc" : showingAllDates ? "operational" : "asc",
      ),
    [filteredRows, showingAllDates, showingExactDate, showingPastDates],
  );
  const selectedRow =
    rows.find((row) => rowKey(row) === selectedId) ?? null;

  useEffect(() => {
    if (filteredRows.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredRows.some((row) => rowKey(row) === selectedId)) {
      setSelectedId(rowKey(filteredRows[0]));
    }
  }, [filteredRows, selectedId]);

  useEffect(() => {
    setOpenGroupIds(new Set());
  }, [genderFilter, membershipFilter, query, selectedDate, statusFilter]);

  const patchRow = async (
    row: AdminWaitlistRow,
    patch: WaitlistPatch,
    successMessage: string,
  ) => {
    const id = rowKey(row);
    if (savingId === id) return;

    setSavingId(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, ...patch }),
      });
      const data = (await response.json().catch(() => null)) as
        | (AdminWaitlistData & { error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "waitlist-save-failed");
      }
      hydrate(data);
      setNotice(successMessage);
    } catch {
      setError("대기열 정보를 저장하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  const saveNote = (row: AdminWaitlistRow) =>
    patchRow(
      row,
      { adminNote: noteDrafts[rowKey(row)] ?? "" },
      "운영자 메모를 저장했습니다.",
    );

  const distributeSelectedRows = async (
    group: WaitlistGroup,
    ticketInstanceId: string | null,
  ) => {
    if (bulkSavingGroupId) return;

    const selectedRows = group.rows.filter(
      (row) =>
        distributionSelection.has(rowKey(row)) &&
        row.source === "date_application" &&
        row.status === "waitlisted" &&
        row.ticket_instance_id !== ticketInstanceId,
    );
    const applicationIds = selectedRows
      .map((row) => row.source_id)
      .filter((id): id is number => typeof id === "number");

    if (applicationIds.length === 0) {
      setError("이동할 신청자를 선택해주세요.");
      return;
    }

    setBulkSavingGroupId(group.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "distribute_date_applications",
          applicationIds,
          ticketInstanceId,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | (AdminWaitlistData & { movedCount?: number; error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "waitlist-distribution-failed");
      }

      hydrate(data);
      setDistributionSelection((current) => {
        const next = new Set(current);
        selectedRows.forEach((row) => next.delete(rowKey(row)));
        return next;
      });
      setNotice(
        ticketInstanceId
          ? `${data.movedCount ?? applicationIds.length}명을 세부 티켓에 배정했습니다.`
          : `${data.movedCount ?? applicationIds.length}명을 미배정으로 되돌렸습니다.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "선택한 신청자를 이동하지 못했습니다.",
      );
    } finally {
      setBulkSavingGroupId(null);
    }
  };

  const confirmSelectedRows = async (
    group: WaitlistGroup,
    ticketInstanceId: string,
  ) => {
    if (bulkSavingGroupId) return;

    const selectedRows = group.rows.filter(
      (row) =>
        distributionSelection.has(rowKey(row)) &&
        row.source === "date_application" &&
        row.status === "waitlisted" &&
        row.ticket_instance_id === ticketInstanceId,
    );
    const applicationIds = selectedRows
      .map((row) => row.source_id)
      .filter((id): id is number => typeof id === "number");
    const instance = instances.find((item) => item.id === ticketInstanceId);

    if (!instance || applicationIds.length === 0) {
      setError("확정할 신청자를 해당 티켓 열에서 선택해주세요.");
      return;
    }
    if (
      !window.confirm(
        `${applicationIds.length}명을 '${instance.title}' 참여자로 확정할까요?`,
      )
    ) {
      return;
    }

    setBulkSavingGroupId(group.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_date_applications",
          applicationIds,
          ticketInstanceId,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | (AdminWaitlistData & { assignedCount?: number; error?: string })
        | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? "waitlist-confirmation-failed");
      }

      hydrate(data);
      setDistributionSelection((current) => {
        const next = new Set(current);
        selectedRows.forEach((row) => next.delete(rowKey(row)));
        return next;
      });
      setNotice(
        `${data.assignedCount ?? applicationIds.length}명의 티켓 배정을 확정했습니다.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "선택한 신청자의 티켓 배정을 확정하지 못했습니다.",
      );
    } finally {
      setBulkSavingGroupId(null);
    }
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <section className="grid h-[calc(100dvh-190px)] min-h-[680px] grid-cols-[minmax(0,1fr)_400px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex min-w-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-black/10 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">대기열 관리</h2>
              <p className="mt-1 text-xs leading-5 text-black/45">
                날짜별 초대장과 신청자 상태를 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
            >
              <RefreshCw size={15} aria-hidden />
              새로고침
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[170px_160px_150px_180px_minmax(220px,1fr)]">
            <FilterField label="날짜 선택">
              <input
                type="date"
                value={showingExactDate ? selectedDate : ""}
                onChange={(event) =>
                  setSelectedDate(event.target.value || actionableDatesValue)
                }
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/70 outline-none focus:border-accent"
              />
            </FilterField>

            <FilterField label="상태">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/70 outline-none focus:border-accent"
              >
                <option value="all">상태 전체</option>
                {waitlistStatuses.map((status) => (
                  <option key={status} value={status}>
                    {waitlistStatusLabels[status]}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="성별">
              <select
                value={genderFilter}
                onChange={(event) =>
                  setGenderFilter(event.target.value as GenderFilter)
                }
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/70 outline-none focus:border-accent"
              >
                {genderFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="멤버십">
              <select
                value={membershipFilter}
                onChange={(event) =>
                  setMembershipFilter(event.target.value as MembershipFilter)
                }
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/70 outline-none focus:border-accent"
              >
                <option value="all">멤버십 전체</option>
                {membershipStatuses.map((status) => (
                  <option key={status} value={status}>
                    {membershipStatusLabels[status]}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="검색">
              <div className="relative">
                <Search
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름 또는 전화번호"
                  className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm font-semibold text-black/70 outline-none placeholder:text-black/30 focus:border-accent"
                />
              </div>
            </FilterField>
          </div>

          {(notice || error) && (
            <p
              className={cn(
                "mt-3 rounded-xl px-4 py-2 text-sm font-semibold",
                error ? "bg-red-50 text-red-600" : "bg-accent/12 text-black/65",
              )}
            >
              {error ?? notice}
            </p>
          )}
        </header>

        {rows.length > 0 && (
          <div className="shrink-0 overflow-x-auto border-b border-black/10 px-5 py-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(actionableDatesValue)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
                  showingActionableDates
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/55 hover:border-black/25 hover:text-black",
                )}
              >
                처리 필요
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    showingActionableDates
                      ? "bg-white/15 text-white"
                      : "bg-black/5 text-black/45",
                  )}
                >
                  {actionableCount}
                </span>
              </button>
              {dateOptions.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
                    selectedDate === date
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/55 hover:border-black/25 hover:text-black",
                  )}
                >
                  {formatShortDateLabel(date)}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      selectedDate === date
                        ? "bg-white/15 text-white"
                        : "bg-black/5 text-black/45",
                    )}
                  >
                    {dateCounts.get(date) ?? 0}
                  </span>
                </button>
              ))}
              {pastCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(pastDatesValue)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
                    showingPastDates
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-black/55 hover:border-black/25 hover:text-black",
                  )}
                >
                  지난 일정
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      showingPastDates
                        ? "bg-white/15 text-white"
                        : "bg-black/5 text-black/45",
                    )}
                  >
                    {pastCount}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDate(allDatesValue)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
                  showingAllDates
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/55 hover:border-black/25 hover:text-black",
                )}
              >
                전체
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    showingAllDates
                      ? "bg-white/15 text-white"
                      : "bg-black/5 text-black/45",
                  )}
                >
                  {rows.length}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfbfa] px-5 py-4">
          {loading ? (
            <StateMessage message="대기열 정보를 불러오는 중입니다." />
          ) : error && rows.length === 0 ? (
            <StateMessage tone="error" message={error} />
          ) : rows.length === 0 ? (
            <StateMessage message="아직 대기열 등록 내역이 없습니다." />
          ) : !showingAllDates && dateScopedRows.length === 0 ? (
            <StateMessage
              message={
                showingActionableDates
                  ? "현재 처리할 신청자가 없습니다."
                  : showingPastDates
                    ? "지난 일정이 없습니다."
                    : "이 날짜에 신청한 대기열이 없습니다."
              }
            />
          ) : filteredRows.length === 0 ? (
            <StateMessage message="필터 조건에 맞는 신청자가 없습니다." />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent">
                    {showingActionableDates
                      ? "action required"
                      : showingPastDates
                        ? "past dates"
                        : showingAllDates
                          ? "all dates"
                          : "selected date"}
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    {showingActionableDates
                      ? "처리 필요"
                      : showingPastDates
                        ? "지난 일정"
                        : showingAllDates
                          ? "전체 날짜"
                          : formatDateLabel(selectedDate)}
                  </h3>
                </div>
                <p className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black/50 ring-1 ring-black/10">
                  표시 {filteredRows.length}명 · 전체 {dateScopedRows.length}명
                </p>
              </div>

              <div className="space-y-3">
                {groups.map((group) => (
                  <WaitlistAccordion
                    key={group.id}
                    group={group}
                    instances={instances}
                    templateMap={templateMap}
                    selectedId={selectedId}
                    savingId={savingId}
                    bulkSaving={bulkSavingGroupId === group.id}
                    distributionSelection={distributionSelection}
                    open={openGroupIds.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    onSelect={(row) => setSelectedId(rowKey(row))}
                    onDistributionToggle={(row) =>
                      setDistributionSelection((current) => {
                        const next = new Set(current);
                        const key = rowKey(row);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    onDistributionSelectMany={(rows, selected) =>
                      setDistributionSelection((current) => {
                        const next = new Set(current);
                        rows.forEach((row) => {
                          const key = rowKey(row);
                          if (selected) next.add(key);
                          else next.delete(key);
                        });
                        return next;
                      })
                    }
                    onDistribute={(ticketInstanceId) =>
                      void distributeSelectedRows(group, ticketInstanceId)
                    }
                    onConfirm={(ticketInstanceId) =>
                      void confirmSelectedRows(group, ticketInstanceId)
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <WaitlistDetailPanel
        row={selectedRow}
        instances={instances}
        templateMap={templateMap}
        saving={selectedRow ? savingId === rowKey(selectedRow) : false}
        noteDraft={selectedRow ? noteDrafts[rowKey(selectedRow)] ?? "" : ""}
        onNoteChange={(value) => {
          if (!selectedRow) return;
          const key = rowKey(selectedRow);
          setNoteDrafts((current) => ({ ...current, [key]: value }));
        }}
        onPatch={(row, patch, message) => void patchRow(row, patch, message)}
        onSaveNote={(row) => void saveNote(row)}
      />
    </section>
  );
}

function WaitlistAccordion({
  group,
  instances,
  templateMap,
  open,
  selectedId,
  savingId,
  bulkSaving,
  distributionSelection,
  onToggle,
  onSelect,
  onDistributionToggle,
  onDistributionSelectMany,
  onDistribute,
  onConfirm,
}: {
  group: WaitlistGroup;
  instances: WaitlistTicketInstance[];
  templateMap: Map<string, WaitlistTicketTemplate>;
  open: boolean;
  selectedId: string | null;
  savingId: string | null;
  bulkSaving: boolean;
  distributionSelection: Set<string>;
  onToggle: () => void;
  onSelect: (row: AdminWaitlistRow) => void;
  onDistributionToggle: (row: AdminWaitlistRow) => void;
  onDistributionSelectMany: (
    rows: AdminWaitlistRow[],
    selected: boolean,
  ) => void;
  onDistribute: (ticketInstanceId: string | null) => void;
  onConfirm: (ticketInstanceId: string) => void;
}) {
  const distributableRows = group.rows.filter(
    (row) =>
      row.source === "date_application" &&
      row.status === "waitlisted",
  );
  const instanceOptions = distributableRows[0]
    ? instancesForRow(distributableRows[0], instances)
    : [];
  const selectedCount = distributableRows.filter((row) =>
    distributionSelection.has(rowKey(row)),
  ).length;
  const columns = [
    { instance: null, rows: distributableRows.filter((row) => !row.ticket_instance_id) },
    ...instanceOptions.map((instance) => ({
      instance,
      rows: distributableRows.filter(
        (row) => row.ticket_instance_id === instance.id,
      ),
    })),
  ];
  const handledRowKeys = new Set(distributableRows.map(rowKey));
  const remainingRows = group.rows.filter(
    (row) => !handledRowKeys.has(rowKey(row)),
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-black/[0.02]"
      >
        <div className="min-w-0">
          <h4 className="truncate text-base font-black text-black">
            {group.title}
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MetricPill label="신청" value={group.total} />
            {waitlistStatuses.map((status) => (
              <MetricPill
                key={status}
                label={statusMetricLabels[status]}
                value={group.counts[status]}
              />
            ))}
          </div>
        </div>
        <ChevronDown
          size={18}
          aria-hidden
          className={cn(
            "mt-1 shrink-0 text-black/35 transition",
            open && "rotate-180 text-black",
          )}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-black/10 bg-[#fcfcfb] p-3">
          {distributableRows.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-black/10 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                <div>
                  <p className="text-sm font-black">세부 티켓 작업 분배</p>
                  <p className="mt-1 text-xs font-semibold text-black/45">
                    신청자를 선택한 뒤 원하는 열로 배정하거나 다시 이동하세요.
                  </p>
                </div>
                <span className="rounded-full bg-black px-3 py-1.5 text-xs font-black text-white">
                  {selectedCount}명 선택
                </span>
              </div>

              <div className="overflow-x-auto p-3">
                <div
                  className="grid min-w-max gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${columns.length}, minmax(250px, 280px))`,
                  }}
                >
                  {columns.map(({ instance, rows: columnRows }) => {
                    const allSelected =
                      columnRows.length > 0 &&
                      columnRows.every((row) =>
                        distributionSelection.has(rowKey(row)),
                      );
                    const destinationId = instance?.id ?? null;
                    const movableSelectedCount = distributableRows.filter(
                      (row) =>
                        distributionSelection.has(rowKey(row)) &&
                        row.ticket_instance_id !== destinationId,
                    ).length;
                    const confirmableSelectedCount = instance
                      ? columnRows.filter((row) =>
                          distributionSelection.has(rowKey(row)),
                        ).length
                      : 0;

                    return (
                      <section
                        key={instance?.id ?? "unassigned"}
                        className="flex max-h-[470px] min-h-[240px] flex-col overflow-hidden rounded-xl border border-black/10 bg-[#f7f6f2]"
                      >
                        <div className="border-b border-black/10 bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-sm font-black">
                                {instance ? (
                                  <UsersRound size={14} aria-hidden />
                                ) : (
                                  <LockKeyhole size={14} aria-hidden />
                                )}
                                {instance
                                  ? instance.operation_code || instance.title
                                  : "미배정"}
                              </p>
                              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-black/45">
                                {instance
                                  ? instanceOptionLabel(instance, templateMap)
                                  : "아직 세부 티켓이 정해지지 않은 신청자"}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[10px] font-black text-black/55">
                              {columnRows.length}명
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={columnRows.length === 0 || bulkSaving}
                              onClick={() =>
                                onDistributionSelectMany(columnRows, !allSelected)
                              }
                              className="h-8 rounded-lg border border-black/10 bg-white text-[11px] font-black text-black/55 transition hover:border-black/25 disabled:opacity-35"
                            >
                              {allSelected ? "선택 해제" : "열 전체 선택"}
                            </button>
                            <button
                              type="button"
                              disabled={movableSelectedCount === 0 || bulkSaving}
                              onClick={() => onDistribute(destinationId)}
                              className="h-8 rounded-lg bg-black px-2 text-[11px] font-black text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-black/15"
                            >
                              {bulkSaving
                                ? "이동 중..."
                                : instance
                                  ? `여기로 배정 (${movableSelectedCount})`
                                  : `미배정 복귀 (${movableSelectedCount})`}
                            </button>
                          </div>
                          {instance && (
                            <button
                              type="button"
                              disabled={confirmableSelectedCount === 0 || bulkSaving}
                              onClick={() => onConfirm(instance.id)}
                              className="mt-2 h-8 w-full rounded-lg border border-black bg-white px-2 text-[11px] font-black text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25"
                            >
                              선택 인원 티켓 확정 ({confirmableSelectedCount})
                            </button>
                          )}
                        </div>
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                          {columnRows.length === 0 ? (
                            <p className="px-3 py-8 text-center text-xs font-semibold text-black/30">
                              배정된 신청자가 없습니다.
                            </p>
                          ) : (
                            columnRows.map((row) => (
                              <DistributionApplicantCard
                                key={rowKey(row)}
                                row={row}
                                checked={distributionSelection.has(rowKey(row))}
                                active={selectedId === rowKey(row)}
                                saving={savingId === rowKey(row)}
                                disabled={bulkSaving}
                                onToggle={() => onDistributionToggle(row)}
                                onOpen={() => onSelect(row)}
                              />
                            ))
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>

              {instanceOptions.length === 0 && (
                <p className="border-t border-black/10 px-4 py-3 text-xs font-bold text-rose-600">
                  같은 날짜의 세부 티켓이 없습니다. 티켓 관리에서 일정을 먼저 저장해주세요.
                </p>
              )}
            </div>
          )}
          {remainingRows.map((row) => (
            <ApplicantRow
              key={rowKey(row)}
              row={row}
              selected={rowKey(row) === selectedId}
              saving={rowKey(row) === savingId}
              onSelect={() => onSelect(row)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function DistributionApplicantCard({
  row,
  checked,
  active,
  saving,
  disabled,
  onToggle,
  onOpen,
}: {
  row: AdminWaitlistRow;
  checked: boolean;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const profile = row.profile;

  return (
    <div
      className={cn(
        "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-white px-2 py-2 transition",
        checked
          ? "border-accent bg-accent/[0.06] ring-1 ring-accent/20"
          : active
            ? "border-black/25"
            : "border-black/8",
      )}
    >
      <button
        type="button"
        aria-label={`${profile?.name ?? "신청자"} 선택`}
        aria-pressed={checked}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border transition",
          checked
            ? "border-black bg-black text-white"
            : "border-black/15 bg-white text-transparent hover:border-black/35",
        )}
      >
        <Check size={14} strokeWidth={3} aria-hidden />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <p className="truncate text-xs font-black">
          {profile ? <AdminMemberName profile={profile} /> : "신청자 미확인"}
        </p>
        <p className="mt-1 truncate text-[10px] font-semibold text-black/40">
          {[profile?.gender, profile?.birth_year, profile?.mbti]
            .filter(Boolean)
            .join(" · ") || "기본 정보 미입력"}
        </p>
      </button>
      {saving && (
        <span className="text-[9px] font-bold text-black/35">저장 중</span>
      )}
    </div>
  );
}

function ApplicantRow({
  row,
  selected,
  saving,
  onSelect,
}: {
  row: AdminWaitlistRow;
  selected: boolean;
  saving: boolean;
  onSelect: () => void;
}) {
  const profile = row.profile;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition",
        selected
          ? "border-accent ring-2 ring-accent/20"
          : "border-black/8 hover:border-black/18",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {profile ? <AdminMemberName profile={profile} /> : "신청자 미확인"}
          {saving && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-black/45">
              저장 중
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-black/45">
          {[
            profile?.gender,
            profile?.birth_year,
            profile?.mbti,
            compactPhone(profile?.phone),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <StatusBadge status={row.status} />
    </button>
  );
}

function WaitlistDetailPanel({
  row,
  instances,
  templateMap,
  saving,
  noteDraft,
  onNoteChange,
  onPatch,
  onSaveNote,
}: {
  row: AdminWaitlistRow | null;
  instances: WaitlistTicketInstance[];
  templateMap: Map<string, WaitlistTicketTemplate>;
  saving: boolean;
  noteDraft: string;
  onNoteChange: (value: string) => void;
  onPatch: (
    row: AdminWaitlistRow,
    patch: WaitlistPatch,
    message: string,
  ) => void;
  onSaveNote: (row: AdminWaitlistRow) => void;
}) {
  if (!row) {
    return (
      <aside className="flex min-h-0 flex-col items-center justify-center border-l border-black/10 bg-white px-6 text-center text-sm font-semibold text-black/45">
        <UserRound size={32} aria-hidden className="mb-3 text-black/25" />
        신청자를 선택하면 상세 정보가 표시됩니다.
      </aside>
    );
  }

  const profile = row.profile;
  const instanceOptions = instancesForRow(row, instances);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-black/10 bg-white">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          waitlist detail
        </p>
        <h3 className="mt-1 text-xl font-bold">
          {profile ? <AdminMemberName profile={profile} /> : "신청자 미확인"}
        </h3>
        <p className="mt-1 text-xs font-semibold text-black/45">
          {[profile?.gender, profile?.birth_year, profile?.mbti]
            .filter(Boolean)
            .join(" · ") || "기본 정보 미입력"}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <PhotoBox
          src={profile?.photo_url ?? null}
          alt={`${profile?.name ?? "신청자"} 프로필 사진`}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <DetailItem label="전화번호" value={display(profile?.phone)} />
          <DetailItem
            label="멤버십 상태"
            value={profile ? membershipLabel(profile) : "-"}
          />
          <DetailItem
            label="나이"
            value={profile ? formatAgeAndBirthYear(profile) : "-"}
          />
          <DetailItem label="신청일" value={formatCreatedAt(row.created_at)} />
        </div>

        <section className="mt-4 rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
          <h4 className="text-sm font-bold">사용자 소개</h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/65">
            {profile?.public_intro?.trim() || "아직 생성된 자기소개가 없습니다."}
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
          <div className="space-y-3">
            <DetailItem
              label={row.source === "date_application" ? "신청 방식" : "선택한 초대장"}
              value={ticketTitle(row)}
            />
            <DetailItem
              label="현재 세부 티켓"
              value={instanceText(row.ticket_instance)}
            />
            <DetailItem label="도착 상태" value={arrivalStatusText(row)} />
          </div>
        </section>

        <div className="mt-4 space-y-3">
          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-black/35">
              세부 티켓 선택
            </span>
            <select
              value={row.ticket_instance_id ?? ""}
              disabled={saving}
              onChange={(event) =>
                onPatch(
                  row,
                  { ticketInstanceId: event.target.value || null },
                  "세부 티켓을 저장했습니다.",
                )
              }
              className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
            >
              <option value="">미배정</option>
              {instanceOptions.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instanceOptionLabel(instance, templateMap)}
                </option>
              ))}
            </select>
            {instanceOptions.length === 0 && (
              <p className="mt-2 text-xs font-semibold text-black/40">
                같은 날짜에 연결된 세부 티켓이 없습니다.
              </p>
            )}
          </label>

          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-black/35">
              대기열 상태
            </span>
            <select
              value={row.status}
              disabled={saving}
              onChange={(event) =>
                onPatch(
                  row,
                  { status: event.target.value as WaitlistStatus },
                  "대기열 상태를 저장했습니다.",
                )
              }
              className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
            >
              {waitlistStatuses.map((status) => (
                <option key={status} value={status}>
                  {waitlistStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>


          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-black/35">
              운영자 메모
            </span>
            <textarea
              value={noteDraft}
              disabled={saving}
              onChange={(event) => onNoteChange(event.target.value)}
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-black/10 px-3 py-2 text-sm leading-6 outline-none focus:border-accent disabled:bg-black/5"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => onSaveNote(row)}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white disabled:bg-black/25"
            >
              <Save size={15} aria-hidden />
              {saving ? "저장 중" : "메모 저장"}
            </button>
          </label>
        </div>
      </div>
    </aside>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </span>
      {children}
    </label>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex rounded-full bg-black/5 px-2 py-1 text-[11px] font-bold text-black/55">
      {label} {value}
    </span>
  );
}

function StatusBadge({ status }: { status: WaitlistStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-black",
        statusBadgeClasses[status],
      )}
    >
      {waitlistStatusLabels[status]}
    </span>
  );
}

function PhotoBox({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="flex h-[220px] w-full items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#f7f7f5]">
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-xs font-semibold text-black/35">
          <ImageIcon size={28} aria-hidden />
          사진 없음
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-semibold text-black/72">
        {value}
      </div>
    </div>
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
        "flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-black/45",
      )}
    >
      {message}
    </div>
  );
}
