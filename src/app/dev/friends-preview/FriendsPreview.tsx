"use client";
import { useState } from "react";
import { FriendsTab, type FriendPreviewPerson } from "@/features/app/FriendsTab";
import { Sparkles, UsersRound, Ticket, MessageCircle } from "lucide-react";

const tabs = [{ label: "친구", Icon: UsersRound }, { label: "신청", Icon: Sparkles }, { label: "티켓", Icon: Ticket }, { label: "채팅", Icon: MessageCircle }];
export function FriendsPreview({ initialFriends = [], ownerName }: { initialFriends?: FriendPreviewPerson[]; ownerName?: string }) {
  const [active, setActive] = useState("친구");
  return <main className="min-h-dvh bg-[#e7e2d9] sm:py-7">
    <div className="relative mx-auto h-dvh max-w-[420px] overflow-hidden bg-[#f2eee6] shadow-2xl sm:h-[860px] sm:max-h-[calc(100dvh-56px)] sm:rounded-[32px]">
      <div className="h-full overflow-y-auto" hidden={active !== "친구"}><FriendsTab preview initialFriends={initialFriends} ownerName={ownerName} /></div>
      {active !== "친구" && <div className="flex h-full flex-col items-center justify-center px-8 text-center text-[#24211d]"><h1 className="text-xl">{active}</h1><p className="mt-4 text-sm leading-7 text-black/45">친구 화면을 확인하는 로컬 미리보기예요.<br />아래 친구 탭으로 돌아가 주세요.</p></div>}
      <nav aria-label="하단 메뉴" className="absolute inset-x-5 bottom-4 grid grid-cols-4 gap-1 rounded-full bg-black/65 p-1.5 text-white backdrop-blur-xl">{tabs.map(({ label, Icon }) => <button key={label} onClick={() => setActive(label)} aria-current={active === label ? "page" : undefined} className={`flex h-12 flex-col items-center justify-center gap-1 rounded-full text-[10px] ${active === label ? 'bg-[#f7f4ed] text-black' : 'text-white/60'}`}><Icon size={19} /><span>{label}</span></button>)}</nav>
    </div>
  </main>;
}
