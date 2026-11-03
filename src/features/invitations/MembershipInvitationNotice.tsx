"use client";

import { X } from "lucide-react";

export function MembershipInvitationNotice({ message, failed = false, busy = false, onClose, onRetry }: {
  message: string;
  failed?: boolean;
  busy?: boolean;
  onClose: () => void;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <aside aria-live="polite" className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-[398px] rounded-2xl border border-black/10 bg-[#FCFAF6] p-4 text-sm leading-6 text-black shadow-lg">
      <div className="flex items-start justify-between gap-3"><p>{message}</p><button type="button" aria-label="초대 혜택 알림 닫기" className="shrink-0 p-1" onClick={onClose}><X size={17} /></button></div>
      {failed && onRetry && <button type="button" disabled={busy} onClick={onRetry} className="mt-2 underline underline-offset-4 disabled:opacity-40">{busy ? "적용 중…" : "다시 시도하기"}</button>}
    </aside>
  );
}
