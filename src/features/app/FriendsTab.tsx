"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowUpRight, Check, Images, Plus, UsersRound, X } from "lucide-react";

export type FriendPreviewPerson = { id: string; name: string; met: string; image: string };
type Person = FriendPreviewPerson;
type Friend = Person & { x: number; y: number };
const samples: Person[] = [
  { id: "sample-1", name: "김준서", met: "9월 26일 토요일에 함께했어요", image: "/images/profile-archetypes/adventurer.jpg" },
  { id: "sample-2", name: "이도윤", met: "9월 26일 토요일에 함께했어요", image: "/images/profile-archetypes/sentimental.jpg" },
  { id: "sample-3", name: "박현우", met: "9월 19일 토요일에 함께했어요", image: "/images/profile-archetypes/stoic.jpg" },
  { id: "sample-4", name: "정민재", met: "9월 19일 토요일에 함께했어요", image: "/images/profile-archetypes/visionary.jpg" },
];
const previewMeetings = [
  { id: "preview-oct3", label: "10월 3일 토요일 · 오후 6시", place: "을지로 · 예시 모임" },
  { id: "preview-oct10", label: "10월 10일 토요일 · 오후 6시", place: "을지로 · 예시 모임" },
];
function invitationName(fullName: string) {
  const name = fullName.trim();
  if (!/^[가-힣]{2,4}$/.test(name)) return name;
  const compoundSurname = /^(남궁|황보|제갈|선우|독고|서문|사공|동방)/.test(name);
  return name.slice(compoundSurname && name.length >= 3 ? 2 : 1);
}
const serif = { fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif' };

export function FriendsTab({ preview = false, initialFriends = [], ownerName }: { preview?: boolean; initialFriends?: Person[]; ownerName?: string }) {
  const [view, setView] = useState<"friends" | "memories">("friends");
  const [slots, setSlots] = useState<Array<Friend | null>>(() => Array.from({ length: 9 }, (_, i) => initialFriends[i] ? { ...initialFriends[i], x: 50, y: 50 } : null));
  const [sheet, setSheet] = useState<"add" | "requests" | "edit" | "meeting" | "confirm" | null>(null);
  const [selected, setSelected] = useState(0);
  const [sent, setSent] = useState<string[]>([]);
  const [requests, setRequests] = useState<Array<{ person: Person; meeting: typeof previewMeetings[number] }>>([]);
  const [meetingId, setMeetingId] = useState("");
  const [demo, setDemo] = useState(preview);
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ x: 50, y: 50 });
  const friends = slots.filter(Boolean);
  const candidates = [...initialFriends, ...(demo ? samples : [])].filter((p, i, all) => all.findIndex(other => other.id === p.id) === i && !slots.some(f => f?.id === p.id));
  const selectedFriend = slots[selected];
  const meeting = previewMeetings.find(item => item.id === meetingId);
  const invitationKey = selectedFriend && meeting ? `${selectedFriend.id}:${meeting.id}` : "";
  const title = sheet === "add" ? "함께한 멤버" : sheet === "requests" ? "받은 모임 초대" : sheet === "meeting" ? "모임 함께하기" : sheet === "confirm" ? "초대 내용 확인" : "친구 사진과 모임 초대";
  const openSlot = (index: number) => {
    if (moving) {
      setSlots(current => { const next = [...current]; [next[selected], next[index]] = [next[index], next[selected]]; return next; });
      setMoving(false); setNotice(""); return;
    }
    setSelected(index); setNotice("");
    const friend = slots[index];
    if (friend) { setDraft({ x: friend.x, y: friend.y }); setSheet("edit"); }
    else setSheet("add");
  };
  const add = (person: Person) => {
    const index = slots[selected] ? slots.findIndex(f => !f) : selected;
    if (index < 0) { setNotice("최대 9명까지 저장할 수 있어요."); return; }
    setSlots(current => current.map((f, i) => i === index ? { ...person, x: 50, y: 50 } : f));
    setSheet(null);
    setNotice(`${person.name}님을 내 보드에 담았어요. 상대에게는 알려지지 않아요.`);
  };

  return <section className="relative min-h-full bg-[#f2eee6] px-6 pb-28 pt-10 text-[#24211d]">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="친구와 추억" className="inline-flex rounded-full border border-[#24211d]/10 bg-[#e8e1d5]/60 p-1">
      {([{ id: "friends", label: "친구들" }, { id: "memories", label: "추억들" }] as const).map(tab => <button key={tab.id} role="tab" id={`friends-tab-${tab.id}`} aria-selected={view === tab.id} aria-controls={`friends-panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onClick={() => { setView(tab.id); setMoving(false); setSheet(null); setNotice(""); }} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "friends" : event.key === "End" ? "memories" : view === "friends" ? "memories" : "friends"; setView(next); setMoving(false); setSheet(null); setNotice(""); document.getElementById(`friends-tab-${next}`)?.focus(); } }} className={`min-w-0 rounded-full px-4 py-2 text-xs transition ${view === tab.id ? "bg-[#faf8f3] text-[#24211d] shadow-sm" : "text-[#938b80] hover:text-[#24211d]"}`}>{tab.label}</button>)}
    </div>
      <button onClick={() => { setSheet("requests"); setNotice(""); }} className="flex min-h-10 items-center gap-2 rounded-full border border-[#24211d]/15 px-3 text-[11px]" aria-label={`받은 모임 초대 ${requests.length}개`}>
        받은 모임 초대 <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8e1d5] text-[10px]">{requests.length}</span>
      </button>
    </header>
    <div role="tabpanel" id="friends-panel-friends" aria-labelledby="friends-tab-friends" hidden={view !== "friends"}>
    <p className="mt-5 whitespace-nowrap text-[12px] leading-6 text-[#7c7469]">교집합에서 만난 친구와 다음 모임도 함께해 보세요.</p>
    <p className="mt-3 text-[10px] leading-5 text-[#938b80]">나만 볼 수 있는 친구 보드예요.<br />추가하거나 삭제해도 상대에게 알려지지 않아요.</p>
    <div className="mb-5 mt-7 flex items-center justify-between border-t border-[#24211d]/10 pt-4">
      <p className="text-[10px] tracking-[0.03em] text-[#82796d]">{moving ? "옮길 자리를 선택해주세요" : "+를 눌러 함께했던 친구를 찾아보세요"}</p>
      <span style={serif} className="text-[12px] text-[#82796d]">{friends.length} / 9</span>
    </div>
    <div className="grid grid-cols-3 gap-x-3 gap-y-3" aria-label="친구 폴라로이드 보드">
      {slots.map((friend, i) => <button key={i} onClick={() => openSlot(i)} aria-label={moving ? `${i + 1}번째 자리로 이동${friend ? `, ${friend.name}님과 자리 바꾸기` : ""}` : friend ? `${friend.name}님 사진 편집` : `빈 사진틀 ${i + 1}, 친구 추가`} className={`group min-w-0 p-[6px] pb-2 text-center transition duration-300 hover:-translate-y-1 ${moving ? "friends-slot-moving ring-1 ring-[#a99c88]/60" : ""} ${moving && selected === i ? "ring-2 ring-[#35322d]" : ""} ${friend ? "bg-[#fffdf8] shadow-[0_4px_10px_rgba(36,33,29,0.12)]" : "border border-[#cfc5b5]/45 bg-[#e8e1d5]/35"}`} style={{ transform: friend ? `rotate(${i % 2 ? 2 : -2}deg)` : undefined }}>
        <div className={`relative aspect-[1.05] overflow-hidden ${friend ? "bg-[#e5ddd0]" : "border border-dashed border-[#b7aa94]/45 bg-[#eae3d7]/30"}`}>
          {friend ? <img src={friend.image} alt={`${friend.name}님의 사진`} draggable={false} className="h-full w-full object-cover" style={{ objectPosition: `${friend.x}% ${friend.y}%` }} /> : <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full border border-[#aa9b84]/25 p-1.5"><Plus size={15} strokeWidth={1} className="text-[#a59780]" /></span></span>}
        </div>
        <div className="flex h-7 items-center justify-center text-[11px] text-[#625b50]">{friend?.name ?? <span className="h-px w-5 bg-[#c1b5a1]/35" />}</div>
      </button>)}
    </div>
    {moving && <button className="mx-auto mt-3 block text-xs underline" onClick={() => setMoving(false)}>자리 바꾸기 취소</button>}
    <p role="status" className="mt-3 text-center text-xs text-[#625b50]">{notice}</p>
    {preview && <details className="mt-5 border-t border-[#24211d]/10 pt-3 text-[10px] text-[#82796d]"><summary className="cursor-pointer">미리보기 도구 · 실제 문자는 전송되지 않아요</summary><p className="mt-2">예시 이름과 샘플 이미지로 동작을 확인합니다.</p><div className="mt-3 flex flex-wrap gap-2"><button className="rounded-full border px-3 py-2" onClick={() => { setDemo(true); setNotice("빈 사진틀을 눌러 예시 멤버를 확인하세요."); }}>예시 멤버 보기</button><button className="rounded-full border px-3 py-2" onClick={() => { setDemo(true); setRequests([{ person: samples[0], meeting: previewMeetings[0] }]); }}>받은 모임 초대 시뮬레이션</button><button className="rounded-full border px-3 py-2" onClick={() => { setSlots(Array(9).fill(null)); setRequests([]); setSent([]); setDemo(false); setNotice(""); }}>초기화</button></div></details>}

    </div>
    <div role="tabpanel" id="friends-panel-memories" aria-labelledby="friends-tab-memories" hidden={view !== "memories"}>
      <p className="mt-5 text-[12px] leading-6 text-[#7c7469]">함께한 시간들을 오래 간직해요.</p>
      <div className="mt-7 border-t border-[#24211d]/10 pt-12 text-center">
        <div aria-hidden="true" className="relative mx-auto mb-8 h-40 w-36">
          <div className="absolute inset-0 rotate-[-9deg] border border-[#cfc5b5]/40 bg-[#e8e1d5]" />
          <div className="absolute inset-0 rotate-[5deg] bg-[#fffdf8] p-2 pb-7 shadow-[0_4px_12px_rgba(36,33,29,0.08)]"><div className="flex h-full items-center justify-center bg-[#e8e1d5]/65"><Images size={30} strokeWidth={1} className="text-[#b1a38e]" /></div></div>
        </div>
        <p className="text-sm text-[#625b50]">아직 담긴 추억이 없어요.</p>
        <p className="mt-3 text-xs leading-6 text-[#938b80]">교집합에서 함께한 순간들을<br />이곳에 차곡차곡 모아갈 거예요.</p>
      </div>
    </div>
    {sheet && <div className="fixed inset-0 z-[60] mx-auto flex max-w-[440px] items-end bg-[#24211d]/35" onClick={() => setSheet(null)}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90%] w-full overflow-y-auto rounded-t-[28px] bg-[#faf8f3] px-6 pb-8 pt-3 shadow-xl" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") setSheet(null); }}>
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[#d0c7b9]" />
        <div className={`flex items-center ${sheet === "edit" ? "justify-end" : "justify-between"}`}>{sheet !== "edit" && <h2 style={serif} className="text-[25px]">{title}</h2>}<button autoFocus aria-label="닫기" onClick={() => setSheet(null)} className="rounded-full border border-black/10 p-2"><X size={16} /></button></div>
        {(sheet === "add" || sheet === "requests") && <p className="mt-3 text-xs leading-6 text-[#82796d]">{sheet === "add" ? "함께 했던 동성 친구들만 표시됩니다. 최대 9명까지 자유롭게 담아보세요. 추가·삭제는 상대에게 알려지지 않아요." : "다음 교집합을 함께하고 싶은 분의 초대예요."}</p>}
        {preview && demo && sheet === "add" && <p className="mt-2 text-[10px] text-[#938b80]">화면 확인용 예시 멤버예요. 실제 문자는 전송되지 않아요.</p>}
        {sheet === "add" && (candidates.length ? <div className="mt-5">{candidates.map(person => <div key={person.id} className="flex items-center gap-3 border-t border-black/5 py-4"><img src={person.image} alt="예시 이미지" className="h-12 w-10 object-cover" /><div className="min-w-0 flex-1"><p className="text-sm">{person.name}</p><p className="mt-1 text-[10px] text-[#938b80]">{person.met}</p></div><button className="rounded-full border border-[#a99c88]/30 px-3 py-2 text-[11px]" onClick={() => add(person)}>추가</button></div>)}</div> : <div className="py-14 text-center"><UsersRound size={25} strokeWidth={1} className="mx-auto mb-4 text-[#aa9b84]" /><p className="text-sm">함께한 멤버가 아직 없어요</p><p className="mt-2 text-xs leading-6 text-[#938b80]">모임에서 만난 인연을<br />이곳에서 다시 이어가세요.</p></div>)}
        {sheet === "requests" && (requests.length ? <div className="mt-5">{requests.map(invitation => <div key={invitation.person.id} className="border-t border-black/5 py-4"><p className="text-sm">{invitation.person.name}님의 초대</p><p className="mt-2 text-xs text-[#938b80]">{invitation.meeting.label}<br />{invitation.meeting.place}</p><p className="mt-3 text-xs leading-6">함께 참여하려면 두 분 모두 모임 신청을 완료해야 해요.</p><div className="mt-3 flex gap-2"><button className="rounded-full bg-[#24211d] px-5 py-2 text-xs text-white" onClick={() => { setRequests(current => current.filter(p => p.person.id !== invitation.person.id)); setNotice("초대 수락을 미리 확인했어요. 실제 모임 신청은 진행되지 않았어요."); }}>초대 수락</button><button className="rounded-full border px-5 py-2 text-xs" onClick={() => setRequests(current => current.filter(p => p.person.id !== invitation.person.id))}>거절</button></div></div>)}</div> : <p className="py-16 text-center text-sm text-[#938b80]">새로운 모임 초대가 없어요.</p>)}
        {sheet === "meeting" && selectedFriend && <div className="mt-5"><p className="text-sm leading-6">{selectedFriend.name}님과 함께할 모임을 선택해주세요.</p>{preview ? <><p className="mt-2 text-xs text-[#938b80]">화면 확인용 예시 일정이에요.</p><div className="mt-5 space-y-3">{previewMeetings.map(item => <button key={item.id} disabled={sent.includes(`${selectedFriend.id}:${item.id}`)} onClick={() => { setMeetingId(item.id); setNotice(""); setSheet("confirm"); }} className="w-full rounded-2xl border border-[#a99c88]/30 p-4 text-left disabled:opacity-40"><p className="text-sm">{item.label}</p><p className="mt-2 text-xs text-[#938b80]">{item.place}{sent.includes(`${selectedFriend.id}:${item.id}`) ? " · 초대 미리보기 완료" : ""}</p></button>)}</div></> : <p className="py-10 text-center text-sm text-[#938b80]">초대 가능한 모임을 준비하고 있어요.</p>}</div>}
        {sheet === "confirm" && selectedFriend && meeting && <div className="mt-5"><p className="text-sm">{invitationName(selectedFriend.name)}님에게 보낼 초대예요.</p><div className="mt-4 rounded-2xl bg-[#e8e1d5]/60 p-5 text-sm leading-7"><p>[교집합 | 함께하기 초대]</p><p className="mt-3">{invitationName(selectedFriend.name)}님, {ownerName ? invitationName(ownerName) : "친구"}님이 지난 교집합에서 {invitationName(selectedFriend.name)}님과 즐거운 시간을 보냈어서 다음 교집합도 함께하고 싶어 해요!</p><p className="mt-3">수락하면 두 분이서 같은 조로 다음 교집합에 참여하실 수 있어요 :)</p><p className="mt-3">{meeting.label}<br />{meeting.place}</p><p className="mt-3">웹사이트에서 초대를 확인하고 모임을 신청해주세요.</p></div><p className="mt-4 text-xs leading-6 text-[#938b80]">미리보기에서는 실제 문자를 보내지 않아요. 실제 연결 시 초대 링크가 포함되며, 같은 모임 초대는 중복 전송하지 않아요.</p><button disabled={!preview || sent.includes(invitationKey)} className="mt-5 w-full rounded-full bg-[#24211d] py-3 text-sm text-white disabled:opacity-40" onClick={() => { if (!preview || sent.includes(invitationKey)) return; setSent(current => [...current, invitationKey]); setSheet(null); setNotice("초대 흐름을 확인했어요. 실제 문자는 전송되지 않았어요."); }}>초대 문자 보내기 · 미리보기</button><button className="mt-3 w-full py-2 text-xs" onClick={() => setSheet("meeting")}>다른 모임 선택</button></div>}
        {sheet === "edit" && slots[selected] && <div className="mt-3">
          <div className="flex items-center gap-6">
            <div className="w-[43%] max-w-40 shrink-0 rotate-[-2deg] bg-[#fffdf8] p-2 pb-5 shadow-md"><div className="aspect-[1.05] overflow-hidden"><img src={slots[selected]!.image} alt="사진 구도 미리보기" className="h-full w-full object-cover" style={{ objectPosition: `${draft.x}% ${draft.y}%` }} /></div><p className="mt-3 text-center text-xs">{slots[selected]!.name}</p></div>
            <div className="min-w-0 flex-1">
              {([['x', '가로 위치', 0, 100, 1], ['y', '세로 위치', 0, 100, 1]] as const).map(([key, label, min, max, step]) => <label key={key} className="mb-4 block text-[11px] text-[#7c7469]"><span className="mb-2 block">{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={draft[key]} onChange={e => setDraft(current => ({ ...current, [key]: Number(e.target.value) }))} className="block w-full min-w-0 accent-[#35322d]" /></label>)}
              <p className="text-[10px] leading-5 text-[#938b80]">내 보드의 사진 구도만 바뀌어요.</p>
            </div>
          </div>
          <div className="mt-6 flex gap-2"><button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#a99c88]/25 py-3 text-xs text-[#7c7469]" onClick={() => { setSheet(null); setMoving(true); }}><ArrowLeftRight size={14} />자리 바꾸기</button><button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#a99c88]/25 py-3 text-xs text-[#7c7469]" onClick={() => { setSlots(current => current.map((f, i) => i === selected && f ? { ...f, ...draft } : f)); setSheet(null); }}><Check size={14} />저장</button></div>
          <div className="mt-6 border-t border-[#24211d]/10 pt-6">
            <button className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#24211d] px-5 py-4 text-sm font-medium text-[#fffdf8] shadow-sm transition hover:bg-[#39352f]" onClick={() => { setNotice(""); setMeetingId(""); setSheet("meeting"); }}>다음 모임 함께하기 <ArrowUpRight size={18} /></button>
          </div>
          <button className="mt-3 block w-full py-2 text-[11px] text-[#938b80] underline underline-offset-4" onClick={() => { setSlots(current => current.map((f, i) => i === selected ? null : f)); setSheet(null); setNotice("내 보드에서 삭제했어요. 상대에게는 알려지지 않아요."); }}>내 보드에서 삭제</button>
        </div>}
        <p role="status" className="mt-3 text-center text-xs text-[#625b50]">{notice}</p>
      </div>
    </div>}
  </section>;
}
