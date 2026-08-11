"use client";

import { LockKeyhole, UserRound } from "lucide-react";

export function RecommendationProfileLocked({
  onCompleteProfile,
}: {
  onCompleteProfile: () => void;
}) {
  return (
    <section className="flex min-h-full flex-col bg-[#f7f4ed] px-5 pb-28 pt-8">
      <header>
        <p className="text-[11px] font-black uppercase tracking-[0.17em] text-black/32">
          Recommendation
        </p>
        <h1 className="mt-2 text-[27px] font-black leading-9 tracking-[-0.055em] text-black">
          당신을 위한 여정
        </h1>
      </header>

      <div className="flex flex-1 items-center py-10">
        <section className="w-full rounded-[28px] border border-black/[0.09] bg-[#faf8f2] px-6 pb-7 pt-9 text-center shadow-[0_18px_50px_rgba(18,18,18,0.05)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
            <LockKeyhole size={25} strokeWidth={2} aria-hidden />
          </div>
          <h2 className="mt-7 break-keep text-[23px] font-black leading-[1.35] tracking-[-0.055em] text-black">
            질문을 먼저 완료해주세요
          </h2>
          <p className="mx-auto mt-3 max-w-[280px] break-keep text-[14px] font-semibold leading-6 tracking-[-0.025em] text-black/50">
            질문을 완료하면 답변을 바탕으로 잘 맞는 여정을 추천해드려요.
          </p>

          <button
            type="button"
            onClick={onCompleteProfile}
            className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-[14px] font-black tracking-[-0.025em] text-white transition hover:bg-black/85"
          >
            <UserRound size={17} aria-hidden />
            질문 이어가기
          </button>
        </section>
      </div>
    </section>
  );
}
