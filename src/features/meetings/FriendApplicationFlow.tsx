"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { GatheringTicket } from "@/types/ticket";
import { FriendJourneyPreview } from "./TicketDetailContent";

export type FriendInvitationDraft = {
  friendPhone: string;
  eventId: string;
  meetingDate: string;
};

export function normalizeFriendPhone(value: string) {
  return value.replace(/\D/g, "");
}

function phoneLabel(value: string) {
  return normalizeFriendPhone(value).slice(0, 11).replace(/^(\d{3})(\d{1,4})?(\d{1,4})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join("-"));
}

const primary = "mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#24211d] px-5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-black/15";

export function ApplicationPathChoice({ onSolo, onFriend }: { onSolo: () => void; onFriend: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center px-1">
      <div className="w-full overflow-hidden rounded-[25px] border border-[#d0cbbc]/70 bg-[linear-gradient(145deg,#fbf9f4_0%,#f5f1e9_100%)] shadow-[0_14px_32px_rgba(66,57,44,0.08)]">
        <div className="h-[40px]" aria-hidden />
        <div role="group" aria-label="만남 방식" className="mx-1.5 mb-1.5 overflow-hidden rounded-[21px] border border-[#d0cbbc]/45 bg-[#eee9df]/70 shadow-[inset_0_1px_3px_rgba(66,57,44,0.035)]">
        {[
          { label: "새로운 사람들 만나기", onClick: onSolo },
          { label: "친구와 교집합 함께하기", onClick: onFriend },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group relative w-full overflow-hidden border-b border-[#c9c1b2]/70 px-5 py-[18px] text-left transition last:border-b-0 hover:bg-black/[0.025] active:scale-[0.985]"
          >
            <span className="flex min-h-[47px] items-center justify-between gap-4">
              <span className="min-w-0 flex-1 text-[17px] font-black leading-6 tracking-[-0.04em] text-black">{label}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-black/42 transition group-hover:translate-x-0.5 group-hover:text-black">
                <ChevronRight size={18} strokeWidth={1.8} aria-hidden />
              </span>
            </span>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}

/** Collects a draft phone number only; no SMS or application is submitted. */
export function FriendApplicationFlow({ onBack, onContinue, previewTicket, participantPhotoUrl }: {
  previewTicket?: GatheringTicket;
  participantPhotoUrl?: string | null;
  onBack: () => void;
  onContinue: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const validPhone = /^010\d{8}$/.test(normalizeFriendPhone(phone));
  const canContinue = validPhone && consent;
  const normalizedPhone = normalizeFriendPhone(phone);
  return <div className="pb-24 pt-5 text-[#24211d]">
    <button type="button" onClick={onBack} className="relative top-3 mb-7 flex min-h-11 items-center gap-2 text-xs text-black/55"><ArrowLeft size={17} />이전으로</button>
      <h1 className="text-[28px] font-bold leading-[1.4] tracking-[-0.055em]">함께할 친구를<br />초대해 주세요.</h1>
      <p className="mt-3 text-[13px] leading-6 text-black/50">친구와 같은 테이블에서 시작해요.<br />두 분과 어울리는 새로운 멤버 네 명을 만나요.</p>
      {previewTicket && <FriendJourneyPreview ticket={previewTicket} participantPhotoUrl={participantPhotoUrl} />}
      <label htmlFor="friend-phone" className="text-xs font-bold">초대할 친구의 번호</label>
      <input id="friend-phone" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(phoneLabel(e.target.value))} placeholder="010-0000-0000" aria-describedby="friend-phone-help" className="mt-3 h-14 w-full rounded-2xl border border-[#d6d0c5] bg-white px-4 text-lg tracking-wide outline-none focus:border-[#494e3c]" />
      <p id="friend-phone-help" className="mt-3 text-xs leading-5 text-black/45">내 신청을 완료하면 이 번호로 초대 문자가 전송돼요.<br />친구도 같은 날짜에 신청을 완료해야 함께할 수 있어요.</p>
      {phone.length >= 13 && !validPhone && <p role="alert" className="mt-2 text-xs text-red-700">010으로 시작하는 휴대폰 번호를 확인해 주세요.</p>}
      <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-5 text-black/65"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#24211d]" />초대 문자를 보내는데 동의합니다.</label>
      <button type="button" disabled={!canContinue} onClick={() => onContinue(normalizedPhone)} className={primary}>함께할 날짜 고르기<ChevronRight size={16} /></button>
  </div>;
}
