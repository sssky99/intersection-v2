"use client";

import { ArrowRight, CalendarPlus, MapPin, Plus, RefreshCw, Save, Trash2, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AdminGroupStageLocation,
  AdminMeetingEventStage,
  AdminMeetingGroup,
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
export function MeetingEventAdminPanel({ onOpenWaitlist }: { onOpenWaitlist?: () => void }) {
  const [data, setData] = useState<AdminMeetingEventsData>({ programs: [], events: [], groups: [], stages: [], groupLocations: [] });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [programId, setProgramId] = useState("");
  const [eventDate, setEventDate] = useState(today());
  const [startsAt, setStartsAt] = useState("18:00");
  const [groupCode, setGroupCode] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [eventDraft, setEventDraft] = useState({ title: "", shortDescription: "", eventDate: "", startsAt: "", region: "" });
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
  const selectedStages = useMemo(
    () => data.stages.filter((stage) => stage.event_id === selectedEventId).sort((a, b) => a.sequence - b.sequence),
    [data.stages, selectedEventId],
  );

  useEffect(() => {
    if (!selectedEvent) return;
    setEventDraft({
      title: selectedEvent.title,
      shortDescription: selectedEvent.short_description ?? "",
      eventDate: selectedEvent.event_date,
      startsAt: selectedEvent.starts_at.slice(0, 5),
      region: selectedEvent.region,
    });
  }, [selectedEvent]);

  const request = async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => {
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
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다.");
      return false;
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
          <button disabled={!programId || saving} onClick={() => void request("POST", { action: "create_event", programId, eventDate, startsAt }, "행사를 생성했습니다.")} className="mt-3 h-10 w-full rounded-xl bg-black text-sm font-black text-white disabled:bg-black/15">행사 생성</button>
        </div>
      </aside>

      <div className="min-w-0 overflow-y-auto p-5">
        {(message || error) && <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</p>}
        {!selectedEvent ? (
          <div className="flex min-h-[600px] items-center justify-center text-sm font-semibold text-black/35">행사를 만들거나 선택해주세요.</div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">meeting event</p>
                <h3 className="mt-2 text-2xl font-black">{selectedEvent.title}</h3>
                <p className="mt-2 text-sm font-semibold text-black/45">{selectedEvent.event_date} · {selectedEvent.starts_at.slice(0, 5)} · {selectedEvent.region}</p>
              </div>
              <select value={selectedEvent.visibility} disabled={saving} onChange={(event) => void request("PATCH", { eventId: selectedEvent.id, visibility: event.target.value }, "공개 상태를 변경했습니다.")} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-black">
                {visibilityOptions.map((visibility) => <option key={visibility} value={visibility}>{visibilityLabels[visibility]}</option>)}
              </select>
            </header>

            <section className="mt-5 rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
              <div className="flex items-center justify-between gap-3">
                <div><h4 className="text-base font-black">1. 행사 기본 정보</h4><p className="mt-1 text-xs font-semibold text-black/45">사용자 신청 목록에 표시되는 정보입니다.</p></div>
                <button type="button" disabled={saving || !eventDraft.title.trim()} onClick={() => void request("PATCH", { action: "update_event", eventId: selectedEvent.id, ...eventDraft }, "행사 기본 정보를 저장했습니다.")} className="inline-flex h-9 items-center gap-2 rounded-xl bg-black px-4 text-xs font-black text-white disabled:bg-black/15"><Save size={14} />저장</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <EditField label="행사명"><input value={eventDraft.title} onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))} className={inputClass} /></EditField>
                <EditField label="날짜"><input type="date" value={eventDraft.eventDate} onChange={(e) => setEventDraft((d) => ({ ...d, eventDate: e.target.value }))} className={inputClass} /></EditField>
                <EditField label="시작 시간"><input type="time" value={eventDraft.startsAt} onChange={(e) => setEventDraft((d) => ({ ...d, startsAt: e.target.value }))} className={inputClass} /></EditField>
                <EditField label="대표 지역"><input value={eventDraft.region} onChange={(e) => setEventDraft((d) => ({ ...d, region: e.target.value }))} className={inputClass} /></EditField>
                <EditField label="목록 설명"><input value={eventDraft.shortDescription} onChange={(e) => setEventDraft((d) => ({ ...d, shortDescription: e.target.value }))} className={inputClass} /></EditField>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
              <div><h4 className="text-base font-black">2. 일정과 장소</h4><p className="mt-1 text-xs font-semibold text-black/45">공통 장소는 여기서, 저녁처럼 그룹별 장소는 아래 그룹 카드에서 입력합니다.</p></div>
              <div className="mt-4 space-y-3">
                {selectedStages.map((stage) => (
                  <StageEditor key={stage.id} stage={stage} saving={saving} onSave={(draft) => request("POST", { action: "save_stage", eventId: selectedEvent.id, stageId: stage.id, ...draft }, `${stage.title} 일정을 저장했습니다.`)} />
                ))}
                {selectedStages.length === 0 && <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">일정 기본값을 생성하려면 새로고침해주세요. 계속 보이면 마이그레이션을 확인해야 합니다.</p>}
              </div>
            </section>

            <div className="mt-6 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black">3. 운영 그룹</h4>
                <p className="mt-1 text-xs font-semibold text-black/45">그룹은 사용자 신청 목록에 노출되지 않습니다.</p>
              </div>
              <span className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-black text-black/50">{selectedGroups.length}개 그룹</span>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              {selectedGroups.map((group) => <GroupEditor key={group.id} group={group} mealStage={selectedStages.find((stage) => stage.location_mode === "group_specific") ?? null} location={data.groupLocations.find((location) => location.group_id === group.id) ?? null} saving={saving} onRequest={request} />)}
              <article className="rounded-2xl border border-dashed border-black/15 bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-black"><Plus size={15} />그룹 추가</p>
                <div className="mt-3 grid grid-cols-[90px_minmax(0,1fr)] gap-2"><input value={groupCode} onChange={(event) => setGroupCode(event.target.value)} placeholder="A" className="h-10 rounded-xl border border-black/10 px-3 text-sm font-bold" /><input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="저녁 그룹 A" className="h-10 rounded-xl border border-black/10 px-3 text-sm font-bold" /></div>
                <button disabled={!groupCode.trim() || saving} onClick={() => void request("POST", { action: "create_group", eventId: selectedEvent.id, code: groupCode, title: groupTitle }, "그룹을 추가했습니다.")} className="mt-2 h-10 w-full rounded-xl border border-black bg-white text-sm font-black transition hover:bg-black hover:text-white disabled:border-black/10 disabled:text-black/25">그룹 추가</button>
              </article>
            </div>

            <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black bg-black p-5 text-white">
              <div><h4 className="text-base font-black">4. 신청자 배정</h4><p className="mt-1 text-xs font-semibold text-white/55">결제·대기 인원을 그룹 열로 나누고 최종 확정합니다.</p></div>
              <button type="button" onClick={onOpenWaitlist} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-black">인원 배정 열기 <ArrowRight size={15} /></button>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-black text-black/40">{label}</span>{children}</label>;
}

const inputClass = "h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-black outline-none focus:border-black/35";

function StageEditor({
  stage,
  saving,
  onSave,
}: {
  stage: AdminMeetingEventStage;
  saving: boolean;
  onSave: (draft: Record<string, unknown>) => Promise<boolean | undefined>;
}) {
  const [draft, setDraft] = useState({
    title: stage.title,
    stageType: stage.stage_type,
    sequence: stage.sequence,
    startsAt: stage.starts_at?.slice(0, 5) ?? "",
    locationMode: stage.location_mode,
    placeName: stage.place_name ?? "",
    address: stage.address ?? "",
  });
  useEffect(() => setDraft({
    title: stage.title,
    stageType: stage.stage_type,
    sequence: stage.sequence,
    startsAt: stage.starts_at?.slice(0, 5) ?? "",
    locationMode: stage.location_mode,
    placeName: stage.place_name ?? "",
    address: stage.address ?? "",
  }), [stage]);

  return (
    <article className="rounded-xl border border-black/10 bg-[#fbfbfa] p-3">
      <div className="grid items-end gap-2 md:grid-cols-[44px_minmax(150px,1fr)_120px_150px_1.2fr_1.5fr_auto]">
        <span className="flex h-10 items-center justify-center rounded-xl bg-black text-sm font-black text-white">{stage.sequence}</span>
        <EditField label="일정명"><input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className={inputClass} /></EditField>
        <EditField label="시간"><input type="time" value={draft.startsAt} onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))} className={inputClass} /></EditField>
        <EditField label="장소 방식"><select value={draft.locationMode} onChange={(e) => setDraft((d) => ({ ...d, locationMode: e.target.value as typeof d.locationMode }))} className={inputClass}><option value="group_specific">그룹별 장소</option><option value="shared">전원 공통</option><option value="hidden">장소 없음</option></select></EditField>
        <EditField label="공통 장소명"><input disabled={draft.locationMode !== "shared"} value={draft.placeName} onChange={(e) => setDraft((d) => ({ ...d, placeName: e.target.value }))} placeholder={draft.locationMode === "group_specific" ? "그룹에서 입력" : "장소명"} className={`${inputClass} disabled:bg-black/5 disabled:text-black/30`} /></EditField>
        <EditField label="공통 주소"><input disabled={draft.locationMode !== "shared"} value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="주소" className={`${inputClass} disabled:bg-black/5 disabled:text-black/30`} /></EditField>
        <button type="button" disabled={saving || !draft.title.trim()} onClick={() => void onSave(draft)} className="flex h-10 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-black hover:border-black/30 disabled:opacity-35"><Save size={13} />저장</button>
      </div>
    </article>
  );
}

function GroupEditor({
  group,
  mealStage,
  location,
  saving,
  onRequest,
}: {
  group: AdminMeetingGroup;
  mealStage: AdminMeetingEventStage | null;
  location: AdminGroupStageLocation | null;
  saving: boolean;
  onRequest: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean | undefined>;
}) {
  const [draft, setDraft] = useState({
    code: group.code,
    title: group.title,
    placeName: location?.place_name ?? "",
    address: location?.address ?? "",
  });
  useEffect(() => setDraft({
    code: group.code,
    title: group.title,
    placeName: location?.place_name ?? "",
    address: location?.address ?? "",
  }), [group, location]);

  const save = async () => {
    const groupSaved = await onRequest("POST", {
      action: "save_group",
      groupId: group.id,
      code: draft.code,
      title: draft.title,
    }, `${group.title} 정보를 저장했습니다.`);
    if (groupSaved && mealStage) {
      await onRequest("POST", {
        action: "save_group_location",
        groupId: group.id,
        stageId: mealStage.id,
        placeName: draft.placeName,
        address: draft.address,
      }, `${draft.title}의 장소까지 저장했습니다.`);
    }
  };

  return (
    <article className="rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-black"><UsersRound size={15} />{group.title}</p>
        <button type="button" disabled={saving || group.assigned_count > 0} onClick={() => { if (window.confirm(`${group.title} 그룹을 삭제할까요?`)) void onRequest("DELETE", { groupId: group.id }, "그룹을 삭제했습니다."); }} className="text-black/30 hover:text-red-600 disabled:opacity-20" aria-label="그룹 삭제"><Trash2 size={15} /></button>
      </div>
      <p className="mt-2 text-xs font-bold text-black/48">현재 배정 {group.assigned_count}명</p>
      <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-2">
        <input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} placeholder="A" className={inputClass} />
        <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="저녁 그룹 A" className={inputClass} />
      </div>
      {mealStage && <div className="mt-2 space-y-2"><div className="relative"><MapPin size={14} className="absolute left-3 top-3 text-black/30" /><input value={draft.placeName} onChange={(e) => setDraft((d) => ({ ...d, placeName: e.target.value }))} placeholder="저녁 장소명" className={`${inputClass} pl-9`} /></div><input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="저녁 장소 주소" className={inputClass} /></div>}
      <button type="button" disabled={saving || !draft.code.trim() || !draft.title.trim()} onClick={() => void save()} className="mt-3 h-9 w-full rounded-xl bg-black text-xs font-black text-white disabled:bg-black/15">그룹·장소 저장</button>
    </article>
  );
}
