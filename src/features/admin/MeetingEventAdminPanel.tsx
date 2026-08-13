"use client";

import { CalendarPlus, Plus, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminMeetingEventsData,
  MeetingEventVisibility,
} from "@/features/admin/meetingEventAdminTypes";

const visibilityLabels: Record<MeetingEventVisibility, string> = {
  draft: "미공개",
  test_only: "운영자 공개",
  public: "전체 공개",
  closed: "마감",
  archived: "보관",
};

const visibilityOptions = Object.keys(visibilityLabels) as MeetingEventVisibility[];

function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function MeetingEventAdminPanel() {
  const [data, setData] = useState<AdminMeetingEventsData>({ programs: [], events: [], groups: [] });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [programId, setProgramId] = useState("");
  const [eventDate, setEventDate] = useState(today());
  const [startsAt, setStartsAt] = useState("18:00");
  const [capacity, setCapacity] = useState("30");
  const [groupCode, setGroupCode] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupCapacity, setGroupCapacity] = useState("6");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback((next: AdminMeetingEventsData) => {
    setData(next);
    setProgramId((current) => current || next.programs[0]?.id || "");
    setSelectedEventId((current) =>
      current && next.events.some((event) => event.id === current)
        ? current
        : next.events[0]?.id ?? null,
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/meeting-events", { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as
        | (AdminMeetingEventsData & { error?: string })
        | null;
      if (!response.ok || !result) throw new Error(result?.error ?? "load-failed");
      hydrate(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "행사 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => void load(), [load]);

  const selectedEvent = data.events.find((event) => event.id === selectedEventId) ?? null;
  const selectedGroups = useMemo(
    () => data.groups.filter((group) => group.event_id === selectedEventId),
    [data.groups, selectedEventId],
  );

  const request = async (method: "POST" | "PATCH", body: Record<string, unknown>, success: string) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/meeting-events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as
        | (AdminMeetingEventsData & { error?: string })
        | null;
      if (!response.ok || !result) throw new Error(result?.error ?? "save-failed");
      hydrate(result);
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid min-h-[680px] grid-cols-[360px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <aside className="border-r border-black/10 bg-[#fbfbfa] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">행사 관리</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
              공개 모집 단위와 내부 그룹을 분리해서 관리합니다.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black/55">
            <RefreshCw size={15} aria-hidden />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading && data.events.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-black/35">불러오는 중...</p>
          ) : data.events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm font-semibold text-black/40">아직 생성된 행사가 없습니다.</p>
          ) : (
            data.events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedEventId === event.id ? "border-black bg-black text-white" : "border-black/10 bg-white hover:border-black/25"}`}
              >
                <p className="truncate text-sm font-black">{event.title}</p>
                <p className={`mt-1 text-xs font-semibold ${selectedEventId === event.id ? "text-white/60" : "text-black/42"}`}>
                  {event.event_date} · {event.starts_at.slice(0, 5)} · {visibilityLabels[event.visibility]}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-black"><CalendarPlus size={16} />새 행사</p>
          <select value={programId} onChange={(event) => setProgramId(event.target.value)} className="mt-3 h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-bold">
            <option value="">프로그램 선택</option>
            {data.programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="h-10 rounded-xl border border-black/10 px-3 text-sm font-bold" />
            <input type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="h-10 rounded-xl border border-black/10 px-3 text-sm font-bold" />
          </div>
          <input type="number" min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="전체 정원" className="mt-2 h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-bold" />
          <button disabled={!programId || saving} onClick={() => void request("POST", { action: "create_event", programId, eventDate, startsAt, capacity: Number(capacity) }, "행사를 생성했습니다.")} className="mt-3 h-10 w-full rounded-xl bg-black text-sm font-black text-white disabled:bg-black/15">행사 생성</button>
        </div>
      </aside>

      <div className="p-5">
        {(message || error) && <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</p>}
        {!selectedEvent ? (
          <div className="flex min-h-[600px] items-center justify-center text-sm font-semibold text-black/35">행사를 만들거나 선택해주세요.</div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">meeting event</p>
                <h3 className="mt-2 text-2xl font-black">{selectedEvent.title}</h3>
                <p className="mt-2 text-sm font-semibold text-black/45">{selectedEvent.event_date} · {selectedEvent.starts_at.slice(0, 5)} · {selectedEvent.region} · 정원 {selectedEvent.capacity}명</p>
              </div>
              <select value={selectedEvent.visibility} disabled={saving} onChange={(event) => void request("PATCH", { eventId: selectedEvent.id, visibility: event.target.value }, "공개 상태를 변경했습니다.")} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-black">
                {visibilityOptions.map((visibility) => <option key={visibility} value={visibility}>{visibilityLabels[visibility]}</option>)}
              </select>
            </header>

            <div className="mt-6 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black">운영 그룹</h4>
                <p className="mt-1 text-xs font-semibold text-black/45">그룹은 사용자 신청 목록에 노출되지 않습니다.</p>
              </div>
              <span className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-black text-black/50">{selectedGroups.length}개 그룹</span>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              {selectedGroups.map((group) => (
                <article key={group.id} className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-accent">{group.code}</p><h5 className="mt-1 text-base font-black">{group.title}</h5></div><UsersRound size={18} className="text-black/30" /></div>
                  <p className="mt-4 text-sm font-bold text-black/55">배정 {group.assigned_count}명 / 정원 {group.capacity}명</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/8"><div className="h-full rounded-full bg-black" style={{ width: `${Math.min(100, (group.assigned_count / group.capacity) * 100)}%` }} /></div>
                </article>
              ))}
              <article className="rounded-2xl border border-dashed border-black/15 bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-black"><Plus size={15} />그룹 추가</p>
                <div className="mt-3 grid grid-cols-[90px_minmax(0,1fr)] gap-2"><input value={groupCode} onChange={(event) => setGroupCode(event.target.value)} placeholder="A" className="h-10 rounded-xl border border-black/10 px-3 text-sm font-bold" /><input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="저녁 그룹 A" className="h-10 rounded-xl border border-black/10 px-3 text-sm font-bold" /></div>
                <input type="number" min="1" value={groupCapacity} onChange={(event) => setGroupCapacity(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-bold" />
                <button disabled={!groupCode.trim() || saving} onClick={() => void request("POST", { action: "create_group", eventId: selectedEvent.id, code: groupCode, title: groupTitle, capacity: Number(groupCapacity) }, "그룹을 추가했습니다.")} className="mt-2 h-10 w-full rounded-xl border border-black bg-white text-sm font-black transition hover:bg-black hover:text-white disabled:border-black/10 disabled:text-black/25">그룹 추가</button>
              </article>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
