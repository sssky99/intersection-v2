"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

export function AccountDeletionButton({
  variant = "default",
}: {
  variant?: "default" | "menu-row";
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleting, open]);

  const deleteAccount = async () => {
    if (deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "회원 탈퇴를 완료하지 못했어요.");
      }

      await createClient().auth.signOut({ scope: "local" }).catch(() => null);
      window.location.replace("/");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "회원 탈퇴를 완료하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={
          variant === "menu-row"
            ? "flex min-h-16 w-full items-center py-4 text-left text-[14px] font-black text-red-500 transition hover:text-red-600"
            : "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#faf8f2] text-xs font-semibold text-black/38 transition hover:border-red-200 hover:bg-red-50/40 hover:text-red-500"
        }
      >
        {variant === "menu-row" ? (
          <>
            <span>회원 탈퇴</span>
            <ChevronRight size={18} aria-hidden className="ml-auto text-black/32" />
          </>
        ) : (
          <>
            <Trash2 size={14} aria-hidden />
            회원 탈퇴
          </>
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-4 pb-4 backdrop-blur-[2px] sm:items-center sm:pb-0"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deleting) setOpen(false);
            }}
              >
                <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-deletion-title"
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full max-w-[390px] rounded-[28px] bg-[#faf8f2] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black tracking-[-0.02em] text-red-500">
                    계정 관리
                  </p>
                  <h2
                    id="account-deletion-title"
                    className="mt-1 text-[22px] font-black tracking-[-0.045em] text-black"
                  >
                    정말 탈퇴하시겠어요?
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="회원 탈퇴 안내 닫기"
                  disabled={deleting}
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-black/45 transition hover:bg-black/10 disabled:opacity-40"
                >
                  <X size={17} aria-hidden />
                </button>
              </div>

              <p className="mt-4 break-keep text-[13px] font-semibold leading-6 text-black/52">
                프로필과 질문 답변, 신청·초대 및 채팅 참여 정보가 삭제되며 복구할 수 없어요.
                예정된 모임과 블라인드 데이트 신청도 함께 취소됩니다.
              </p>

              <div className="mt-5 rounded-[18px] bg-red-50 px-4 py-3 text-[12px] font-bold leading-5 text-red-600">
                결제 취소나 환불이 필요한 내역이 있다면 탈퇴 전에 문의해주세요.
              </div>

              {error && (
                <p className="mt-3 rounded-[16px] bg-red-50 px-4 py-3 text-[11px] font-bold leading-5 text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setOpen(false)}
                  className="h-12 rounded-full border border-black/10 bg-white text-[13px] font-black text-black/55 transition hover:bg-black/[0.03] disabled:opacity-40"
                >
                  계속 이용하기
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void deleteAccount()}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-500 text-[13px] font-black text-white transition hover:bg-red-600 disabled:cursor-wait disabled:opacity-60"
                >
                  {deleting && <Loader2 size={15} className="animate-spin" aria-hidden />}
                  {deleting ? "탈퇴 처리 중..." : "회원 탈퇴하기"}
                </button>
              </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
