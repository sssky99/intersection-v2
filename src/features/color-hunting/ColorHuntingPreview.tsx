"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, ImagePlus, Plus, X } from "lucide-react";

import { hasColorHuntingStarted } from "./availability";
import { useColorHuntingStarted } from "./useColorHuntingStarted";

export type Photo = { src: string; x: number; y: number; zoom: number };
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("사진을 읽지 못했어요.")); image.src = src; });
}
export function ColorHuntingPreview({ startsAt, onBack, onPhotosChange }: { startsAt: string; onBack?: () => void; onPhotosChange?: (photos: Array<Photo | null>) => void }) {
  const [photos, setPhotos] = useState<Array<Photo | null>>(Array(9).fill(null));
  const [samplePhotos, setSamplePhotos] = useState<Array<Photo | null> | null>(null);
  const showingSample = samplePhotos !== null;
  const displayedPhotos = samplePhotos ?? photos;
  const setDisplayedPhotos = showingSample ? setSamplePhotos : setPhotos;
  const stopSample = () => { setSamplePhotos(null); setSelected(null); setNotice(""); };
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState({ x: 50, y: 50, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => { onPhotosChange?.(photos); }, [photos, onPhotosChange]);
  const started = useColorHuntingStarted(startsAt);
  const allowRegistration = () => {
    if (showingSample) return false;
    if (hasColorHuntingStarted(startsAt, Date.now())) return true;
    setNotice("모임 시작 이후에 사진을 등록할 수 있어요."); return false;
  };
  const count = displayedPhotos.filter(Boolean).length;
  const choose = (index: number | null) => { if (!allowRegistration()) return; target.current = index; if (input.current) { input.current.multiple = index === null; input.current.click(); } };
  const addFiles = async (files: File[]) => {
    if (!files.length || !allowRegistration()) return;
    const index = target.current;
    const available = index === null ? photos.flatMap((p, i) => p ? [] : [i]) : [index];
    setBusy(true); setNotice("");
    const next = [...photos]; let failed = 0;
    for (const [i, file] of files.slice(0, available.length).entries()) {
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) { failed++; continue; }
      const src = URL.createObjectURL(file);
      try { await loadImage(src); urls.current.push(src); next[available[i]] = { src, x: 50, y: 50, zoom: 1 }; }
      catch { URL.revokeObjectURL(src); failed++; }
    }
    setPhotos(next); setSelected(null); setBusy(false);
    setNotice(failed ? "일부 사진을 열지 못했어요. 20MB 이하 JPG, PNG, WEBP 등 브라우저에서 열리는 사진을 골라주세요." : files.length > available.length ? "빈칸 수만큼 사진을 넣었어요. 최대 9장까지 등록할 수 있어요." : "");
  };
  const sample = async () => {
    if (busy) return;
    setSelected(null);
    setBusy(true); setNotice("");
    const next = Array.from({ length: 9 }, (_, i) => ({ src: `/dev/color-hunting-preview/sample?index=${i}`, x: 50, y: 50, zoom: 1 }));
    try { await Promise.all(next.map(p => loadImage(p.src))); setSamplePhotos(next); }
    catch { setNotice("예시 사진을 찾지 못했어요. 직접 사진을 등록해주세요."); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (showingSample || count !== 9 || busy || !allowRegistration()) return;
    setBusy(true); setNotice("");
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error();
      for (let i = 0; i < 9; i++) {
        const p = photos[i]!; const image = await loadImage(p.src);
        const scale = Math.max(360 / image.naturalWidth, 450 / image.naturalHeight) * p.zoom;
        const sw = 360 / scale, sh = 450 / scale;
        ctx.drawImage(image, (image.naturalWidth - sw) * p.x / 100, (image.naturalHeight - sh) * p.y / 100, sw, sh, i % 3 * 360, Math.floor(i / 3) * 450, 360, 450);
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error()), "image/jpeg", 0.95));
      const url = URL.createObjectURL(blob); urls.current.push(url);
      const a = document.createElement("a"); a.href = url; a.download = "color-hunting-1080x1350.jpg"; a.click();
      setNotice("콜라주 이미지를 저장했어요.");
    } catch { setNotice("이미지 저장에 실패했어요. 사진을 확인한 뒤 다시 시도해주세요."); }
    finally { setBusy(false); }
  };
  return <main className="min-h-dvh bg-[#e7e2d9] sm:py-7 text-[#24211d]">
    <section className="relative mx-auto min-h-dvh max-w-[440px] bg-[#f2eee6] px-6 pb-8 pt-8 sm:min-h-0 sm:rounded-[32px] sm:shadow-xl">
      {onBack && <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs text-[#82796d]"><ArrowLeft size={16} />티켓으로 돌아가기</button>}
      <p className="text-[9px] tracking-[0.2em] text-[#938b80]">오늘의 기록</p>
      <h1 className="mt-3 text-2xl">오늘 발견한 순간을<br />아홉장의 사진으로 남겨보세요.</h1>
      {!started && <p role="status" className="mt-4 rounded-xl border border-[#cfc5b5] px-4 py-3 text-xs text-[#82796d]">모임 시작 이후에 사진을 등록할 수 있어요.</p>}
      <div className="mb-4 mt-6 flex items-center justify-between text-[11px] text-[#82796d]"><span>사진을 누르면 구도를 조절할 수 있어요</span><span>{showingSample ? "예시 · " : ""}{count} / 9</span></div>
      <div aria-label="4대5 콜라주" className="grid aspect-[4/5] grid-cols-3 grid-rows-3 overflow-hidden bg-[#e8e1d5]">
        {displayedPhotos.map((p, i) => <button key={i} disabled={busy || (!started && !showingSample)} aria-label={p ? `${i + 1}번 사진 조절` : `${i + 1}번 사진 추가`} onClick={() => { setNotice(""); if (p) { setDraft({ x: p.x, y: p.y, zoom: p.zoom }); setSelected(i); } else choose(i); }} className={`relative min-h-0 min-w-0 overflow-hidden ${p ? "" : "border border-[#cfc5b5]/50"}`}>
          {p ? <img src={p.src} alt={`${i + 1}번 사진`} className="h-full w-full object-cover" style={{ objectPosition: `${p.x}% ${p.y}%`, transform: `scale(${p.zoom})`, transformOrigin: `${p.x}% ${p.y}%` }} /> : <span className="flex h-full flex-col items-center justify-center gap-2 text-[#aa9b84]"><Plus size={20} strokeWidth={1} /><span className="text-[10px]">{i + 1}</span></span>}
        </button>)}
      </div>
      <p className="mt-3 text-center text-[10px] text-[#938b80]">4:5 · 1080 × 1350</p>
      <input disabled={!started || busy || showingSample} ref={input} aria-label="사진 파일 선택" type="file" accept="image/*" className="hidden" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void addFiles(files); }} />
      <div className="mt-5 flex gap-2"><button disabled={busy || !started || showingSample || count === 9} onClick={() => choose(null)} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#cfc5b5] py-3 text-xs disabled:opacity-35"><ImagePlus size={15} />사진 등록</button>{showingSample ? <button disabled={busy} onClick={stopSample} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#24211d] py-3 text-xs text-[#faf8f3] disabled:opacity-35"><X size={15} />예시 그만 보기</button> : <button disabled={busy || !started || count !== 9} onClick={() => void download()} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#24211d] py-3 text-xs text-[#faf8f3] disabled:opacity-35"><Download size={15} />{busy ? "처리 중" : "콜라주 저장"}</button>}</div>
      <p role="status" className="mt-3 text-xs leading-5 text-[#82796d]">{notice}</p>
      <div className="mt-5 border-t border-[#cfc5b5]/50 pt-4"><p className="text-[10px] text-[#938b80]">로컬 미리보기 · 새로고침하면 사진이 초기화돼요.</p><button disabled={busy || showingSample} onClick={() => void sample()} className="mt-3 text-xs underline underline-offset-4">노란 사진 9장으로 예시 보기</button></div>
    </section>
    {selected !== null && displayedPhotos[selected] && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35" onClick={() => { if (!busy) setSelected(null); }}><section role="dialog" aria-modal="true" aria-label="사진 위치 조절" className="w-full max-w-[440px] rounded-t-[28px] bg-[#faf8f3] px-6 pb-8 pt-4" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape" && !busy) setSelected(null); }}>
      <div className="flex items-center justify-between"><p className="text-xs text-[#82796d]">{selected + 1} / 9</p><button autoFocus disabled={busy} aria-label="닫기" className="rounded-full border border-[#cfc5b5]/50 p-2" onClick={() => setSelected(null)}><X size={16} /></button></div>
      <div className="mt-5 flex items-center gap-6"><div className="aspect-[4/5] w-[43%] shrink-0 overflow-hidden"><img alt="사진 구도 미리보기" src={displayedPhotos[selected]!.src} className="h-full w-full object-cover" style={{ objectPosition: `${draft.x}% ${draft.y}%`, transform: `scale(${draft.zoom})`, transformOrigin: `${draft.x}% ${draft.y}%` }} /></div><div className="min-w-0 flex-1"><label className="mb-5 block text-[11px] text-[#7c7469]"><span className="flex justify-between"><span>확대·축소</span><span>{Math.round(draft.zoom * 100)}%</span></span><input aria-label="확대·축소" type="range" min={1} max={3} step={0.01} value={draft.zoom} onChange={e => setDraft(d => ({ ...d, zoom: Number(e.target.value) }))} className="mt-3 block w-full accent-[#24211d]" /></label>{([['x', '가로 위치'], ['y', '세로 위치']] as const).map(([key, label]) => <label key={key} className="mb-5 block text-[11px] text-[#7c7469]">{label}<input aria-label={label} type="range" min={0} max={100} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))} className="mt-3 block w-full accent-[#24211d]" /></label>)}<p className="text-[10px] leading-5 text-[#938b80]">사진 크기와 위치를 조절해요. 100%는 프레임을 채우는 기본 크기예요.</p></div></div>
      <div className="mt-6 flex gap-2"><button disabled={busy || showingSample || !started} onClick={() => choose(selected)} className="flex-1 rounded-full border border-[#cfc5b5] py-3 text-xs">사진 바꾸기</button><button disabled={busy} onClick={() => { setDisplayedPhotos((ps: Array<Photo | null> | null) => (ps ?? []).map((p, i) => i === selected && p ? { ...p, ...draft } : p)); setSelected(null); }} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#24211d] py-3 text-xs text-white"><Check size={14} />적용</button></div>
      <button disabled={busy || showingSample || !started} onClick={() => { if (!allowRegistration()) return; setPhotos(ps => ps.map((p, i) => i === selected ? null : p)); setSelected(null); }} className="mt-4 w-full text-[11px] text-[#938b80] underline">사진 삭제</button>
    </section></div>}
  </main>;
}
