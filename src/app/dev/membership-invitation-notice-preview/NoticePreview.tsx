"use client";

import { useState } from "react";
import { ProfileInfoPreview } from "@/features/app/ProfileInfoPreview";
import { MembershipInvitationNotice } from "@/features/invitations/MembershipInvitationNotice";

export function NoticePreview() {
  const [mode, setMode] = useState<"new" | "extension">("new");
  const [visible, setVisible] = useState(true);
  return (
    <>
      <ProfileInfoPreview />
      {visible && <MembershipInvitationNotice message={mode === "new" ? "초대 혜택으로 1개월 무료 멤버십이 시작됐어요." : "초대 혜택으로 멤버십이 1개월 연장됐어요."} onClose={() => setVisible(false)} />}
      <div className="fixed inset-x-4 bottom-4 z-[110] mx-auto max-w-[398px] rounded-2xl border border-black/10 bg-[#FCFAF6] p-3 text-center shadow-lg">
        <p className="mb-2 text-[11px] text-black/50">알림 미리보기 · 실제 이용권은 지급되지 않아요.</p>
        <div className="grid grid-cols-2 gap-2">
          {([['new', '신규 지급 안내'], ['extension', '기존 회원 연장 안내']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value && visible} onClick={() => { setMode(value); setVisible(true); }} className={`rounded-full border px-2 py-3 text-xs ${mode === value && visible ? "border-black bg-black text-white" : "border-black/15 text-black/65"}`}>{label}</button>)}
        </div>
      </div>
    </>
  );
}
