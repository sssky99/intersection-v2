"use client";
import { useState } from "react";
import { ArrowRight, Camera } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import type { GatheringTicket } from "@/types/ticket";
import { ColorHuntingPreview, type Photo } from "./ColorHuntingPreview";
import { useColorHuntingStarted } from "./useColorHuntingStarted";

const coursePreviewTicket: GatheringTicket = {
  id: "local-course-preview",
  templateId: "local-course-preview",
  title: "저녁과 미니 골프",
  subtitle: "잘 맞는 사람들과 저녁을 먹고 가볍게 한 게임해요.",
  date: "2026-08-15",
  time: "19:00",
  area: "성수",
  moodTags: ["편안한 대화", "가벼운 활동", "저녁 모임"],
  remainingSeatCount: 3,
  minimumParticipantCount: 4,
  maxParticipantCount: 6,
  peopleHint: "저녁을 함께한 멤버들과 다음 활동까지 이어져요.",
  reason: "대화와 활동을 모두 좋아하는 분들을 위한 여정이에요.",
  detailSummary:
    "먼저 천천히 저녁을 먹으며 서로를 알아가고, 가까운 미니 골프장으로 이동해 자연스럽게 분위기를 이어가요.",
  detailActivities: [
    "식사 자리에서 충분히 대화를 나눈 뒤 같은 멤버들과 미니 골프를 즐겨요.",
  ],
  courseSteps: [
    {
      id: "dinner",
      order: 1,
      title: "저녁 식사",
      activityType: "dinner",
      placeName: "성수의 다이닝 공간",
      openOffsetMinutes: 0,
      isMainActivity: false,
    },
    {
      id: "activity",
      order: 2,
      title: "미니 골프",
      activityType: "sports",
      placeName: "걸어서 이동하는 미니 골프장",
      openOffsetMinutes: 90,
      isMainActivity: true,
    },
  ],
};

export function ColorHuntingTicketPreview() {
  const [startsAt, setStartsAt] = useState(`${coursePreviewTicket.date}T${coursePreviewTicket.time}:00+09:00`);
  const started = useColorHuntingStarted(startsAt);
  const [editor, setEditor] = useState(false);
  const [photos, setPhotos] = useState<Array<Photo | null>>([]);
  const count = photos.filter(Boolean).length;
  return <>
    <div hidden={!editor}><ColorHuntingPreview startsAt={startsAt} onBack={() => setEditor(false)} onPhotosChange={setPhotos} /></div>
    <div hidden={editor}>
      <MobileFrame>
        <main className="min-h-dvh bg-[#f7f4ed] px-5 pb-12 pt-7 text-black">
          <p className="mb-4 text-center text-[11px] font-black tracking-[0.12em] text-black/38">여정 미리보기</p>
          <div className="relative overflow-hidden border border-black/[0.11] bg-[#f8f4eb] shadow-[0_24px_70px_rgba(39,34,24,0.12)] before:pointer-events-none before:absolute before:inset-2 before:z-30 before:border before:border-black/[0.055]">

            <TicketDetailContent ticket={coursePreviewTicket} sections={["summary", "course"]} className="px-5 pb-5" />
            <div className="mx-5 mb-6 border-t border-black/10 pt-5">
              <button onClick={() => setEditor(true)} className="w-full border border-black/10 bg-[#f2eee6] p-4 text-left transition hover:bg-[#eee8dc] disabled:cursor-default disabled:opacity-50" aria-label="콜라주 만들기">
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm"><Camera size={17} strokeWidth={1.5} />콜라주 만들기</span><span className="text-[11px] text-black/45">{count} / 9</span></div>
                <p className="mt-3 text-[11px] leading-6 text-black/50">오늘 발견한 순간을 아홉 장의 사진으로 남겨보세요.</p>
                <div className="mt-3 flex items-center justify-between"><span className="text-[11px]">{!started ? "예시 미리 보기 · 사진 등록은 모임 시작 후" : count === 9 ? "완성한 콜라주 확인하기" : count ? "이어서 사진 등록하기" : "사진 등록하기"}</span><ArrowRight size={15} /></div>
              </button>
            </div>
          </div>
          <details className="mt-5 text-[10px] text-black/40"><summary>로컬 미리보기 · 시작 시점 확인</summary><div className="mt-3 flex gap-3"><button onClick={() => setStartsAt(new Date(Date.now() + 60000).toISOString())}>시작 전 (1분 뒤 열림)</button><button onClick={() => setStartsAt(new Date(Date.now() - 1000).toISOString())}>시작 후</button></div></details>
        </main>
      </MobileFrame>
    </div>
  </>;
}
