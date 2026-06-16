"use client";

import { Image as ImageIcon, RefreshCw, Save, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminMemberName,
  GenderBadge,
  formatAgeAndBirthYear,
  membershipLabel,
} from "@/features/admin/adminDisplay";
import {
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

const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

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

function ticketTitle(row: AdminWaitlistRow) {
  return (
    row.ticket_template?.title ??
    row.ticket_snapshot?.title ??
    row.ticket_id ??
    "티켓 미확인"
  );
}

function instanceText(instance: WaitlistTicketInstance | null) {
  if (!instance) return "미배정";
  const schedule = [instance.event_date, instance.event_time?.slice(0, 5)]
    .filter(Boolean)
    .join(" ");
  const area = instance.region ? ` · ${instance.region}` : "";
  return `${instance.title}${schedule ? ` · ${schedule}` : ""}${area}`;
}

function instanceOptionLabel(
  instance: WaitlistTicketInstance,
  templateMap: Map<string, WaitlistTicketTemplate>,
) {
  const template = templateMap.get(instance.template_id);
  const schedule = [instance.event_date, instance.event_time?.slice(0, 5)]
    .filter(Boolean)
    .join(" ");
  return [
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

export function WaitlistAdminPanel() {
  const [rows, setRows] = useState<AdminWaitlistRow[]>([]);
  const [templates, setTemplates] = useState<WaitlistTicketTemplate[]>([]);
  const [instances, setInstances] = useState<WaitlistTicketInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
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

  const selectedRow =
    rows.find((row) => rowKey(row) === selectedId) ?? null;

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

  return (
    <section className="grid h-[calc(100dvh-190px)] min-h-[660px] grid-cols-[minmax(0,1fr)_380px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex min-w-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-black/10 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">대기열 관리</h2>
              <p className="mt-1 text-xs leading-5 text-black/45">
                티켓에 Yes를 누른 신청자와 운영 상태를 확인합니다.
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

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <StateMessage message="대기열 정보를 불러오는 중입니다." />
          ) : error && rows.length === 0 ? (
            <StateMessage tone="error" message={error} />
          ) : rows.length === 0 ? (
            <StateMessage message="아직 대기열 등록 내역이 없습니다." />
          ) : (
            <table className="min-w-[1540px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
                <tr>
                  <TableHead className="w-36">등록일</TableHead>
                  <TableHead className="w-36">이름</TableHead>
                  <TableHead className="w-24">성별</TableHead>
                  <TableHead className="w-24">출생연도</TableHead>
                  <TableHead className="w-24">MBTI</TableHead>
                  <TableHead className="w-36">전화번호</TableHead>
                  <TableHead className="w-40">멤버십 상태</TableHead>
                  <TableHead className="w-52">티켓</TableHead>
                  <TableHead className="w-64">세부 티켓</TableHead>
                  <TableHead className="w-40">상태</TableHead>
                  <TableHead>메모</TableHead>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const profile = row.profile;
                  const key = rowKey(row);
                  const selected = key === selectedId;
                  const saving = savingId === key;

                  return (
                    <tr
                      key={key}
                      onClick={() => setSelectedId(key)}
                      className={cn(
                        "cursor-pointer align-top transition hover:bg-accent/10",
                        selected && "bg-accent/15",
                      )}
                    >
                      <TableCell>{formatCreatedAt(row.created_at)}</TableCell>
                      <TableCell>
                        {profile ? <AdminMemberName profile={profile} /> : "-"}
                      </TableCell>
                      <TableCell>
                        {profile?.gender ? (
                          <GenderBadge gender={profile.gender} />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{display(profile?.birth_year)}</TableCell>
                      <TableCell>{display(profile?.mbti)}</TableCell>
                      <TableCell>{display(profile?.phone)}</TableCell>
                      <TableCell>
                        {profile ? membershipLabel(profile) : "-"}
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 font-semibold text-black/70">
                          {ticketTitle(row)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <select
                          value={row.ticket_instance_id ?? ""}
                          disabled={saving}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            void patchRow(
                              row,
                              {
                                ticketInstanceId: event.target.value || null,
                              },
                              "세부 티켓을 저장했습니다.",
                            )
                          }
                          className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent disabled:bg-black/5"
                        >
                          <option value="">미배정</option>
                          {instances.map((instance) => (
                            <option key={instance.id} value={instance.id}>
                              {instanceOptionLabel(instance, templateMap)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          value={row.status}
                          disabled={saving}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            void patchRow(
                              row,
                              { status: event.target.value as WaitlistStatus },
                              "대기열 상태를 저장했습니다.",
                            )
                          }
                          className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none focus:border-accent disabled:bg-black/5"
                        >
                          {waitlistStatuses.map((status) => (
                            <option key={status} value={status}>
                              {waitlistStatusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex min-w-[220px] items-start gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <textarea
                            value={noteDrafts[key] ?? ""}
                            disabled={saving}
                            onChange={(event) =>
                              setNoteDrafts((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                            className="min-h-10 flex-1 resize-y rounded-xl border border-black/10 px-3 py-2 text-xs leading-5 outline-none focus:border-accent disabled:bg-black/5"
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveNote(row)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white disabled:bg-black/25"
                            aria-label="메모 저장"
                          >
                            <Save size={15} aria-hidden />
                          </button>
                        </div>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        대기열 행을 선택하면 상세 정보가 표시됩니다.
      </aside>
    );
  }

  const profile = row.profile;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-black/10 bg-white">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          waitlist detail
        </p>
        <h3 className="mt-1 text-xl font-bold">
          {profile ? <AdminMemberName profile={profile} /> : "신청자 미확인"}
        </h3>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <PhotoBox
          src={profile?.photo_url ?? null}
          alt={`${profile?.name ?? "신청자"} 프로필 사진`}
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <DetailItem label="이름" value={display(profile?.name)} />
          <DetailItem label="성별" value={display(profile?.gender)} />
          <DetailItem
            label="출생연도"
            value={display(profile?.birth_year)}
          />
          <DetailItem label="MBTI" value={display(profile?.mbti)} />
          <DetailItem label="전화번호" value={display(profile?.phone)} />
          <DetailItem
            label="나이"
            value={profile ? formatAgeAndBirthYear(profile) : "-"}
          />
        </div>

        <section className="mt-4 rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
          <h4 className="text-sm font-bold">public_intro</h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/65">
            {profile?.public_intro?.trim() || "아직 생성된 자기소개가 없습니다."}
          </p>
        </section>

        <div className="mt-4 space-y-3">
          <DetailItem
            label="멤버십 상태"
            value={profile ? membershipLabel(profile) : "-"}
          />
          <DetailItem label="선택한 티켓" value={ticketTitle(row)} />
          <DetailItem
            label="현재 세부 티켓"
            value={instanceText(row.ticket_instance)}
          />

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
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instanceOptionLabel(instance, templateMap)}
                </option>
              ))}
            </select>
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
              className="mt-2 h-10 w-full rounded-xl bg-black text-sm font-bold text-white disabled:bg-black/25"
            >
              {saving ? "저장 중" : "메모 저장"}
            </button>
          </label>
        </div>
      </div>
    </aside>
  );
}

function PhotoBox({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="flex h-[300px] w-full items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#f7f7f5]">
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-black/72">
        {value}
      </p>
    </div>
  );
}

function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("border-b border-black/10 px-4 py-3 font-bold", className)}>
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-black/5 px-4 py-3 text-black/62">{children}</td>;
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
