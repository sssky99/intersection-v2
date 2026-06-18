"use client";

import type { ReactNode } from "react";
import { VibeGraph } from "@/components/vibe/VibeGraph";
import type { GatheringTicket } from "@/types/ticket";

const flowSteps = [
  "가볍게 인사하고 자리에 앉아요.",
  "음식이나 음료와 함께 편한 이야기로 시작해요.",
  "중간중간 교집합 질문 카드로 대화를 이어가요.",
  "분위기에 따라 조금 더 솔직한 이야기로 넘어가요.",
  "모임 후에는 다음 큐레이션을 위한 짧은 피드백을 남겨요.",
];

const commonNotices = [
  "상세 장소는 참여 확정 후 안내돼요.",
  "모임은 6명 내외로 진행돼요.",
  "무리한 연락처 교환이나 불편한 행동은 제한돼요.",
  "결제 확인 후 대기열 등록이 완료돼요.",
];

function cleanList(items: string[] | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

export function TicketDetailContent({ ticket }: { ticket: GatheringTicket }) {
  const activities = cleanList(ticket.detailActivities);
  const goodFor = cleanList(ticket.detailGoodFor);
  const customNotice = ticket.detailNotice?.trim();

  return (
    <div className="mt-5 space-y-4">
      {ticket.detailSummary?.trim() && (
        <p className="rounded-[22px] border border-black/8 bg-white px-5 py-4 text-[15px] font-bold leading-7 text-black shadow-[0_10px_28px_rgba(0,0,0,0.03)]">
          {ticket.detailSummary.trim()}
        </p>
      )}

      {activities.length > 0 && (
        <TicketDetailSection title="이 자리에서는 이런 걸 해요">
          <BulletList items={activities} />
        </TicketDetailSection>
      )}

      <VibeGraph
        title="자리 분위기"
        description="이 초대장의 분위기를 가볍게 참고해보세요."
        scores={ticket.vibeScores}
        visibleAxes={[
          "temperature",
          "texture",
          "tone",
          "rhythm",
          "alcohol",
          "romance",
        ]}
      />

      {goodFor.length > 0 && (
        <TicketDetailSection title="이런 결의 분들에게 잘 맞아요">
          <BulletList items={goodFor} />
        </TicketDetailSection>
      )}

      <TicketDetailSection title="이렇게 진행돼요">
        <ol className="space-y-2.5">
          {flowSteps.map((step, index) => (
            <li key={step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-black text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-sm font-semibold leading-6 text-black/62">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </TicketDetailSection>

      <TicketDetailSection title="알아두면 좋아요">
        {customNotice && (
          <p className="mb-3 rounded-2xl bg-accent/[0.08] px-4 py-3 text-sm font-semibold leading-6 text-black/62">
            {customNotice}
          </p>
        )}
        <BulletList items={commonNotices} />
      </TicketDetailSection>
    </div>
  );
}

function TicketDetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-black/8 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.025)]">
      <h2 className="text-[15px] font-black text-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-sm font-semibold leading-6 text-black/62">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
