import { notFound } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { TicketDetailContent } from "@/features/meetings/TicketDetailContent";
import { TicketDetailHero } from "@/features/meetings/TicketDetailHero";
import type { GatheringTicket } from "@/types/ticket";

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

export default function CoursePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <MobileFrame>
      <main className="min-h-dvh bg-[#f7f4ed] px-5 pb-12 pt-7 text-black">
        <p className="mb-4 text-center text-[11px] font-black tracking-[0.12em] text-black/38">
          여정 미리보기
        </p>
        <div className="relative overflow-hidden border border-black/[0.11] bg-[#f8f4eb] shadow-[0_24px_70px_rgba(39,34,24,0.12)] before:pointer-events-none before:absolute before:inset-2 before:z-30 before:border before:border-black/[0.055]">
          <TicketDetailHero ticket={coursePreviewTicket} backgroundImageUrls={[]} />
          <TicketDetailContent
            ticket={coursePreviewTicket}
            sections={["summary", "course"]}
            className="px-5 pb-5"
          />
        </div>
      </main>
    </MobileFrame>
  );
}
