"use client";
import { SafeImage } from "@/components/SafeImage";
import { fallbackNickname } from "@/lib/memberDisplayName";
import type { TicketArrivalStatus, UserTicket } from "@/types/ticket";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

export const arrivalOptions: Array<{
  value: TicketArrivalStatus;
  label: string;
}> = [
  { value: "on_time", label: "정상 도착 예정이에요" },
  { value: "late_10", label: "조금 늦어요 · 10분 정도" },
  { value: "late_20", label: "조금 늦어요 · 20분 정도" },
  { value: "late_30_plus", label: "조금 늦어요 · 30분 이상" },
];

export function arrivalStatusLabel(status: TicketArrivalStatus | null) {
  if (status === "no_show") return "불참";
  return (
    arrivalOptions.find((option) => option.value === status)?.label ??
    "아직 선택 전"
  );
}

export function arrivalStatusToneClass(status: TicketArrivalStatus | null) {
  if (status === "on_time") {
    return "border-[#aaa294] bg-[#e2dccf] text-[#24211d]";
  }
  if (status) {
    return "border-[#b8aa92] bg-[#e8decd] text-[#4a4032]";
  }
  return "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/48";
}

export function arrivalOptionActiveClass(_status: TicketArrivalStatus) {
  return "border-[#24211d] bg-[#24211d] text-[#faf8f3] shadow-[0_8px_18px_rgba(36,33,29,0.14)]";
}

export function arrivalCheckClass(_status: TicketArrivalStatus) {
  return "text-[#faf8f3]";
}

export function ArrivalStatusPanel({
  userTicket,
  reservationName,
  selectedArrivalStatus,
  onArrivalStatusChange,
  previewMode = false,
}: {
  userTicket: UserTicket;
  reservationName?: string | null;
  selectedArrivalStatus?: TicketArrivalStatus | null;
  onArrivalStatusChange?: (arrivalStatus: TicketArrivalStatus) => void;
  previewMode?: boolean;
}) {
  const [selected, setSelected] = useState<TicketArrivalStatus | null>(
    selectedArrivalStatus ?? userTicket.arrivalStatus,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(selectedArrivalStatus ?? userTicket.arrivalStatus);
  }, [selectedArrivalStatus, userTicket.arrivalStatus, userTicket.waitlistId]);

  const saveArrivalStatus = async (arrivalStatus: TicketArrivalStatus) => {
    if (saving || !userTicket.canSetArrival) return;
    if (previewMode) {
      setSelected(arrivalStatus);
      onArrivalStatusChange?.(arrivalStatus);
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/meetings/my-tickets/arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waitlistId: userTicket.waitlistId,
        arrivalStatus,
      }),
    });

    if (!response.ok) {
      setError("도착 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    setSelected(arrivalStatus);
    onArrivalStatusChange?.(arrivalStatus);
    setSaving(false);
  };

  return (
    <section className="border-t border-black/8 py-5">
      {reservationName && (
        <div className="mb-5 rounded-2xl border border-[#d8d1c3]/80 bg-[#eee9df] px-4 py-3.5">
          <div className="flex min-h-7 items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-bold text-black/52">
              <UserRound size={15} className="text-black/38" aria-hidden />
              예약자명
            </span>
            <strong
              aria-label={selected ? reservationName : "도착 상태 선택 후 공개"}
              className={cn(
                "text-[15px] font-black tracking-[-0.02em] text-black transition-[filter,opacity] duration-300",
                selected
                  ? "blur-0 opacity-100"
                  : "select-none blur-[5px] opacity-55",
              )}
            >
              {reservationName}
            </strong>
          </div>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-black/42">
            하단 도착상태를 표시하고, 예약자명을 확인하세요.
          </p>
        </div>
      )}
      <h2 className="text-[15px] font-black text-black">도착 상태</h2>
      {!userTicket.canSetArrival ? (
        <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
          도착 상태는 모임 시작 3시간 전부터 선택할 수 있어요.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {arrivalOptions.map((option) => {
            const active = selected === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => void saveArrivalStatus(option.value)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:opacity-45",
                  active
                    ? arrivalOptionActiveClass(option.value)
                    : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/58 hover:border-[#aaa294] hover:text-[#24211d]",
                )}
              >
                <span>{option.label}</span>
                {active && (
                  <Check
                    size={16}
                    className={arrivalCheckClass(option.value)}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
      <MemberArrivalStatusAccordion members={userTicket.members} />
    </section>
  );
}

export function MemberArrivalStatusAccordion({
  members,
}: {
  members: UserTicket["members"];
}) {
  const [open, setOpen] = useState(false);
  const otherMembers = members.filter((member) => !member.isSelf);
  const ArrowIcon = open ? ChevronUp : ChevronDown;

  if (otherMembers.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#d8d1c3]/90 bg-[#eee9df]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-black text-black">
            다른 멤버 도착 상태
          </span>
          <span className="mt-0.5 block text-[11px] font-bold text-black/38">
            {otherMembers.length}명
          </span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/45">
          <ArrowIcon size={16} aria-hidden />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="member-arrival-statuses"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 border-t border-black/8 px-3 py-3">
              {otherMembers.map((member) => (
                <div
                  key={member.id}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5",
                    arrivalStatusToneClass(member.arrivalStatus),
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-black text-black">
                      <span className="truncate">
                        {member.nickname?.trim() || member.name || "멤버"}
                      </span>
                      <span
                        aria-hidden
                        className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/8 bg-[#eee9df] text-[8px] font-black text-black/45"
                      >
                        {fallbackNickname(member.nickname || member.name)}
                        <SafeImage
                          src={member.photoUrl}
                          alt=""
                          draggable={false}
                          className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] scale-125 object-cover blur-[5px]"
                        />
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-black">
                    {arrivalStatusLabel(member.arrivalStatus)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { cn } from "@/lib/cn";
