"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { MembershipPurchaseBottomSheet } from "@/features/meetings/MeetingRecommendation";
import { oneTimeTicketStoreUrl } from "@/lib/paymentStore";
import type { GatheringTicket } from "@/types/ticket";

const previewTicket: GatheringTicket = {
  id: "payment-sheet-preview",
  templateId: "payment-sheet-preview",
  title: "디너 & 시크릿 칵테일 바",
  subtitle: "이번 주 토요일의 초대",
  date: "2026-08-22",
  time: "18:00",
  area: "을지로·종로",
  moodTags: ["저녁식사", "칵테일바", "대화"],
  peopleHint: "나와 잘 맞는 5명",
  reason: "문답을 바탕으로 잘 어울리는 자리를 준비했어요.",
};

export function PaymentSheetPreview() {
  const [open, setOpen] = useState(true);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f7f4ed] px-6 py-12 text-[#24211d]">
      <div className="mx-auto mt-16 max-w-[330px] border border-black/10 bg-[#f1eee6] px-7 py-10 text-center">
        <p className="font-ticket-latin text-[11px] font-bold italic tracking-[0.18em] text-black/45">
          WEEKLY INVITATION
        </p>
        <p className="mt-16 text-[12px] font-black">8월 22일 토요일 · 오후 6:00</p>
        <h1 className="mt-5 text-[27px] font-black leading-[1.25] tracking-[-0.05em]">
          이번 주 토요일
          <br />
          나에게 온 초대가 있어요.
        </h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-14 h-12 w-full rounded-xl bg-[#24211d] text-[13px] font-black text-white"
        >
          결제창 다시 보기
        </button>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <MembershipPurchaseBottomSheet
            ticket={previewTicket}
            saving={false}
            error={null}
            onSingleUseSubmit={() => window.location.assign(oneTimeTicketStoreUrl)}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </main>
  );
}
