"use client";

import { Info, Loader2, LockKeyhole, LogOut, MessageCircle } from "lucide-react";
import type { ProfileRow } from "@/types/profile";

function profileDisplayName(profile: ProfileRow) {
  return profile.nickname?.trim() || profile.name?.trim() || "회원";
}

export function ProfileUpgradeLockedTab({
  profile,
  questionCount,
  upgrading,
  upgradeError,
  loggingOut,
  logoutError,
  onUpgrade,
  onLogout,
}: {
  profile: ProfileRow;
  questionCount: number;
  upgrading: boolean;
  upgradeError: string | null;
  loggingOut: boolean;
  logoutError: string | null;
  onUpgrade: () => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <section className="min-h-full bg-[#f7f4ed] px-5 pb-28 pt-8">
      <header>
        <h1 className="text-[27px] font-bold leading-9 tracking-[-0.045em] text-black">
          {profileDisplayName(profile)}님의 프로필
        </h1>
      </header>

      <section className="mt-7 overflow-hidden rounded-[28px] border border-black/[0.09] bg-[#faf8f2] px-6 pb-7 pt-9 text-center shadow-[0_18px_50px_rgba(18,18,18,0.05)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
          <LockKeyhole size={25} strokeWidth={2} aria-hidden />
        </div>

        <p className="mt-7 text-[11px] font-black uppercase tracking-[0.18em] text-black/35">
          Profile update
        </p>
        <h2 className="mt-2 break-keep text-[24px] font-black leading-[1.3] tracking-[-0.055em] text-black">
          새로운 프로필을 열어주세요
        </h2>
        <p className="mx-auto mt-3 max-w-[280px] break-keep text-[14px] font-semibold leading-6 tracking-[-0.025em] text-black/50">
          업데이트된 {questionCount}가지 질문에 답하면 새로운 버전의 프로필을 확인할 수 있어요.
        </p>

        <div className="my-7 h-px bg-black/[0.07]" />

        <button
          type="button"
          disabled={upgrading}
          onClick={onUpgrade}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-[14px] font-black tracking-[-0.025em] text-white transition hover:bg-black/85 disabled:cursor-wait disabled:opacity-55"
        >
          {upgrading ? (
            <Loader2 size={17} className="animate-spin" aria-hidden />
          ) : (
            <LockKeyhole size={16} aria-hidden />
          )}
          {upgrading ? "질문을 준비하고 있어요" : "새 프로필 만들기"}
        </button>

        {upgradeError && (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-left text-xs font-bold leading-5 text-red-600">
            {upgradeError}
          </p>
        )}
      </section>

      <p className="mt-4 break-keep px-4 text-center text-[12px] font-semibold leading-5 text-black/38">
        기존 프로필은 새 질문을 완료할 때까지 표시되지 않아요.
      </p>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void onLogout()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-red-200/80 bg-[#faf8f2] text-xs font-semibold text-red-500 transition hover:bg-[#f1eee6] disabled:cursor-wait disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <LogOut size={15} aria-hidden />
          )}
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>

        <a
          href="http://pf.kakao.com/_xnweQn/chat"
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#faf8f2] text-xs font-semibold text-black/55 transition hover:border-black/18 hover:bg-[#f1eee6] hover:text-black/70"
        >
          <MessageCircle size={15} aria-hidden />
          문의하기
        </a>

        <a
          href="/privacy"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#faf8f2] text-xs font-semibold text-black/55 transition hover:border-black/18 hover:bg-[#f1eee6] hover:text-black/70"
        >
          <Info size={15} aria-hidden />
          개인정보 처리방침
        </a>
      </div>

      {logoutError && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-center text-xs font-semibold leading-5 text-red-600">
          {logoutError}
        </p>
      )}
    </section>
  );
}
