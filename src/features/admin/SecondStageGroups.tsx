"use client";
import { useEffect, useState } from "react";
type Member = { userId: string; name: string; last4: string; group: string };
export function SecondStageGroups({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoaded(false); setMembers([]); setError("");
    fetch(`/api/admin/meeting-events/second-stage?eventId=${eventId}`, { signal: controller.signal, cache: "no-store" }).then(async res => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      if (!controller.signal.aborted) { setMembers(data.members); setLoaded(true); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId]);
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/meeting-events/second-stage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, members: members.filter(m => m.group.trim()).map(m => ({ userId: m.userId, group: m.group.trim() })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setError("2차 조 기록을 저장했습니다.");
    } catch(e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); } finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-black/10 bg-white p-5">
    <h3 className="font-semibold">2차 조 기록</h3>
    <p className="mt-2 text-xs text-black/50">같은 조의 멤버에게 같은 조 이름을 입력하세요. 빈칸은 2차 미참여로 저장됩니다. 사용자에게 편성표는 노출되지 않으며, 모임 다음 날부터 친구 후보 계산에 반영됩니다.</p>
    {loading ? <p className="py-4">불러오는 중…</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{members.map(member => <label key={member.userId} className="flex items-center gap-3 text-sm"><span className="flex-1">{member.name} · {member.last4}</span><input aria-label={`${member.name} ${member.last4} 2차 조`} disabled={busy} maxLength={80} placeholder="예: RED" className="w-28 rounded-lg border px-3 py-2" value={member.group} onChange={e => setMembers(list => list.map(m => m.userId === member.userId ? { ...m, group: e.target.value } : m))} /></label>)}</div>}
    <button disabled={!loaded || busy || loading} onClick={save} className="mt-4 rounded-full bg-black px-5 py-2 text-sm text-white disabled:opacity-40">{busy ? "저장 중…" : "2차 조 저장"}</button>
    <p role="status" className="mt-3 text-sm">{error}</p>
  </section>;
}
