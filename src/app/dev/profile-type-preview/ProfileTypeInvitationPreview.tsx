"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock3, LockKeyhole, Navigation, Plus, UserRound, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import { type ProfileArchetypeId } from "@/data/profileArchetypes";
import { ProfileArchetypeResult } from "@/features/onboarding/ProfileArchetypeResult";

type PreviewScreen = "type" | "invitation" | "passed";

const seats = Array.from({ length: 6 }, (_, index) => index);

function InvitationAvatarStack({
  count = 3,
  showPlus = false,
}: {
  count?: number;
  showPlus?: boolean;
}) {
  return (
    <span className="relative flex shrink-0 items-center" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-[#eee8dc] text-black/32 ${
            index > 0 ? "-ml-4" : ""
          }`}
        >
          <UserRound size={11} strokeWidth={1.8} aria-hidden />
        </span>
      ))}
      {showPlus && (
        <span className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-black/12 bg-[#dfd9cd] text-black/58 shadow-[0_2px_5px_rgba(31,29,24,0.12)]">
          <Plus size={9} strokeWidth={2.2} aria-hidden />
        </span>
      )}
    </span>
  );
}

type InvitationMapStop = {
  title: string;
  time: string;
};

const invitationMapPlace = {
  name: "을지로입구역",
  mapx: 1269826180,
  mapy: 375660140,
};

function InvitationMapSheet({
  stop,
  onClose,
}: {
  stop: InvitationMapStop;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex justify-center bg-black/25"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="presentation"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={`${stop.title} 지도`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#f1ede4] shadow-[0_-24px_80px_rgba(0,0,0,0.22)]"
      >
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-black/[0.08] bg-[#f1ede4]/95 px-5 pb-4 pt-[calc(14px+env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-black/40">{stop.time}</p>
            <h2 className="mt-1 truncate text-[18px] font-black tracking-[-0.03em] text-black">
              {stop.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="지도 닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#f8f4eb] text-black/58 shadow-sm"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#e1ded6]">
          <NaverMapPreview
            place={invitationMapPlace}
            heightClassName="h-full"
            className="pointer-events-none absolute inset-[-8px] scale-[1.03] rounded-none border-0 saturate-[0.72] sepia-[0.08] blur-[1.5px]"
          />
          <div className="absolute inset-0 bg-[#e9e3d7]/15" />

          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div className="flex max-w-[280px] flex-col items-center rounded-[28px] border border-white/55 bg-[#f1ede4]/92 px-7 py-7 text-center shadow-[0_22px_60px_rgba(36,45,38,0.18)] backdrop-blur-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#171713] text-white shadow-lg">
                <LockKeyhole size={20} strokeWidth={2} aria-hidden />
              </span>
              <p className="mt-4 break-keep text-[14px] font-black leading-6 tracking-[-0.025em] text-black">
                정확한 장소는 모임 시작 24시간 전에 공개돼요.
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function InvitationJourney() {
  const [mapStop, setMapStop] = useState<InvitationMapStop | null>(null);

  return (
    <section className="border-t border-black/[0.08] pt-5" aria-labelledby="invitation-journey-title">
      <div className="flex items-end justify-between">
        <h2
          id="invitation-journey-title"
          className="text-[15px] font-black tracking-[-0.04em]"
        >
          여정
        </h2>
        <p className="font-serif text-[9px] italic tracking-[0.14em] text-black/36">
          08.15 SATURDAY
        </p>
      </div>

      <div className="relative mt-4 pl-5 before:absolute before:bottom-8 before:left-[5px] before:top-[6px] before:w-px before:bg-black/[0.13] before:content-['']">
        <ol className="space-y-3">
          <li className="relative rounded-[12px] border border-black/[0.07] bg-[#f1ebe0] px-4 py-4">
            <span
              aria-hidden
              className="absolute -left-[20px] top-5 h-[11px] w-[11px] rounded-full border-[3px] border-[#f8f4eb] bg-[#171713] shadow-[0_0_0_1px_rgba(23,23,19,0.16)]"
            />
            <p className="text-[10px] font-black tracking-[0.04em] text-black/40">
              오후 6:00
            </p>
            <h3 className="mt-1.5 pr-11 text-[17px] font-black tracking-[-0.04em]">
              저녁 식사
            </h3>
            <button
              type="button"
              onClick={() => setMapStop({ title: "저녁 식사", time: "오후 6:00" })}
              aria-label="저녁 식사 지도 보기"
              className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-[#f8f4eb]/80 text-black/58 shadow-[0_5px_14px_rgba(0,0,0,0.07)] transition active:scale-95"
            >
              <Navigation size={15} fill="currentColor" strokeWidth={1.8} aria-hidden />
            </button>

            <div className="mt-3 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
              <div className="flex min-h-12 items-center justify-between gap-3 px-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-[#eee8dc] text-black/48">
                    <UserRound size={13} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-[11px] font-black text-black/68">나</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-black/38">
                  응답 대기
                  <Clock3 size={12} strokeWidth={1.9} aria-hidden />
                </span>
              </div>
              <div className="flex min-h-12 items-center gap-2.5 border-t border-black/[0.06] px-3.5">
                <InvitationAvatarStack count={5} />
                <p className="text-[10px] font-bold text-black/44">
                  나와 <strong className="font-black text-black/72">잘 맞는 5명</strong>
                </p>
              </div>
            </div>
          </li>

          <li className="relative rounded-[12px] border border-black/[0.07] bg-[#f1ebe0] px-4 py-4">
            <span
              aria-hidden
              className="absolute -left-[20px] top-5 h-[11px] w-[11px] rounded-full border-[3px] border-[#f8f4eb] bg-[#8f8778] shadow-[0_0_0_1px_rgba(23,23,19,0.12)]"
            />
            <p className="text-[10px] font-black tracking-[0.04em] text-black/40">
              오후 7:30
            </p>
            <h3 className="mt-1.5 pr-11 text-[17px] font-black tracking-[-0.04em]">
              한옥 수제 맥주
            </h3>
            <button
              type="button"
              onClick={() => setMapStop({ title: "한옥 수제 맥주", time: "오후 7:30" })}
              aria-label="한옥 수제 맥주 지도 보기"
              className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-[#f8f4eb]/80 text-black/58 shadow-[0_5px_14px_rgba(0,0,0,0.07)] transition active:scale-95"
            >
              <Navigation size={15} fill="currentColor" strokeWidth={1.8} aria-hidden />
            </button>

            <div className="mt-3 overflow-hidden rounded-[10px] border border-black/[0.06] bg-[#f8f4eb]/70">
              <div className="flex min-h-12 items-center gap-2.5 px-3.5">
                <InvitationAvatarStack count={5} />
                <p className="text-[10px] font-bold text-black/44">
                  <strong className="font-black text-black/72">저녁을 함께한 멤버</strong>
                </p>
              </div>
              <div className="flex min-h-12 items-center gap-2.5 border-t border-black/[0.06] px-3.5">
                <InvitationAvatarStack count={5} showPlus />
                <p className="text-[10px] font-bold text-black/44">
                  다른 <strong className="font-black text-black/72">교집합 멤버들</strong>도 함께해요
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>

      <AnimatePresence>
        {mapStop && (
          <InvitationMapSheet stop={mapStop} onClose={() => setMapStop(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}

function InvitationAtmosphere() {
  return (
    <section aria-labelledby="invitation-atmosphere-title">
      <div className="flex items-end justify-between">
        <h2
          id="invitation-atmosphere-title"
          className="text-[15px] font-black tracking-[-0.04em]"
        >
          자리 분위기
        </h2>
        <p className="font-serif text-[9px] italic tracking-[0.14em] text-black/36">
          CURRENT MOOD
        </p>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[12px] border border-black/[0.07] bg-[#f1ebe0] px-5 pb-5 pt-5">
        <div className="relative flex items-center gap-4 border-b border-black/[0.07] pb-5">
          <div className="grid w-[74px] shrink-0 grid-cols-3 gap-1.5" aria-hidden="true">
            {seats.map((seat) => (
              <motion.span
                key={seat}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.72 + seat * 0.08, duration: 0.35 }}
                className={`h-[18px] w-[18px] rounded-full border ${
                  seat === 4
                    ? "border-black bg-black"
                    : "border-black bg-[#e5dfd3]"
                }`}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="break-keep text-[15px] font-black leading-[1.35] tracking-[-0.05em]">
              어떤 사람들이 함께하나요?
            </h3>
            <p className="mt-2 break-keep text-[11px] font-semibold leading-[1.65] text-black/45">
              제출해주신 답변을 운영자가 꼼꼼하게 확인하고
              <br />
              잘 어울릴 것 같은 분들을 큐레이션 해드립니다.
              <span className="mt-1 block">나와 결이 잘 맞는 4~6명이 함께합니다.</span>
            </p>
          </div>
        </div>

        <div
          className="relative mt-4 flex items-center justify-between text-[9px] font-bold text-black/42"
          aria-label="성별 관심도 색상 안내"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#91a6b5]" aria-hidden />
            남성 선호
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#5f6952]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#a8b596]" aria-hidden />
            모두 선호
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#bea0a9]" aria-hidden />
            여성 선호
          </span>
        </div>

        <div
          className="relative mx-auto mb-5 mt-7 w-full"
          role="img"
          aria-label="현재 남녀 모두 고르게 관심을 보이고 있어요."
        >
          <div className="relative flex h-[13px] overflow-hidden rounded-full border border-black/[0.045] bg-black/[0.035] p-[2px] shadow-[inset_0_1px_3px_rgba(23,23,19,0.08)]">
            <span
              className="h-full w-[38%] rounded-l-full"
              style={{ backgroundColor: "#91a6b5" }}
            />
            <span
              className="h-full w-[24%]"
              style={{ backgroundColor: "#a8b596" }}
            />
            <span
              className="h-full w-[38%] rounded-r-full"
              style={{ backgroundColor: "#bea0a9" }}
            />
          </div>
          <motion.span
            initial={{ left: "18%", opacity: 0 }}
            animate={{ left: "50%", opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-1/2 h-[27px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#171713] shadow-[0_3px_8px_rgba(23,23,19,0.2)]"
          />

          <div className="pointer-events-none absolute inset-x-0 top-[19px] flex justify-between px-0.5" aria-hidden>
            {Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                className={`w-px bg-black/12 ${index === 4 ? "h-2" : "h-1"}`}
              />
            ))}
          </div>
        </div>

        <div className="relative border-t border-black/[0.07] pt-4 text-[11px] font-semibold leading-[1.65] text-black/55">
          <p>성비는 최대한 비슷하게 조정돼요.</p>
          <p className="mt-0.5">현재 남녀 모두 고르게 관심을 보이고 있어요.</p>
        </div>
      </div>
    </section>
  );
}

function pulseInvitation() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(18);
  }
}

function InvitationPassResult({ onReset }: { onReset: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-h-dvh flex-col items-center justify-center bg-[#171713] px-7 text-center text-[#f5f1e8] md:min-h-[calc(100dvh-32px)]"
    >
      <p className="font-serif text-[11px] italic tracking-[0.18em] text-white/45">
        SATURDAY INVITATION
      </p>
      <h1 className="mt-7 whitespace-pre-line text-[28px] font-black leading-[1.32] tracking-[-0.055em]">
        {"이번 주는\n천천히 지나갈게요."}
      </h1>
      <p className="mt-5 whitespace-pre-line text-[14px] font-medium leading-6 text-white/58">
        {"다음 토요일,\n새로운 자리가 준비되면 다시 알려드릴게요."}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-10 rounded-full border border-white/20 px-5 py-3 text-[12px] font-bold text-white/68 transition active:scale-[0.98]"
      >
        초대 다시 보기
      </button>
    </motion.section>
  );
}

function FirstInvitation({ onPass }: { onPass: () => void }) {
  const invitationTitle = "이번 주 토요일\n나와 잘 어울리는 자리가 준비됐어요.";
  const [typedTitle, setTypedTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let characterIndex = 0;
    let typingTimer: number | null = null;
    let openTimer: number | null = null;

    const startTimer = window.setTimeout(() => {
      typingTimer = window.setInterval(() => {
        characterIndex += 1;
        setTypedTitle(invitationTitle.slice(0, characterIndex));

        if (characterIndex >= invitationTitle.length) {
          if (typingTimer !== null) window.clearInterval(typingTimer);
          openTimer = window.setTimeout(() => setModalOpen(true), 720);
        }
      }, 58);
    }, 620);

    return () => {
      window.clearTimeout(startTimer);
      if (typingTimer !== null) window.clearInterval(typingTimer);
      if (openTimer !== null) window.clearTimeout(openTimer);
    };
  }, [invitationTitle]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.95, ease: "easeInOut" }}
          className="absolute inset-0 z-10 flex min-h-dvh touch-pan-y flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#eee9df] text-[#171713] [-webkit-overflow-scrolling:touch] md:min-h-[calc(100dvh-32px)]"
    >
      <header className="relative z-10 px-6 pb-5 pt-[calc(27px+env(safe-area-inset-top))] text-center text-[#171713]">
        <motion.p
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="font-serif text-[11px] italic tracking-[0.2em] text-black/42"
        >
          FIRST INVITATION
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.58 }}
          className="mt-3 whitespace-pre-line text-[24px] font-black leading-[1.3] tracking-[-0.055em]"
        >
          {typedTitle}
          {!modalOpen && <span className="ml-1 animate-pulse">|</span>}
        </motion.h1>
      </header>

      <AnimatePresence>
      {modalOpen && (
      <motion.article
        initial={{ opacity: 0, y: "72vh", scale: 0.985 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 48 }}
        transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-3 shrink-0 overflow-hidden border border-black/[0.11] bg-[#f8f4eb] shadow-[0_24px_70px_rgba(39,34,24,0.12)]"
      >
        <div className="pointer-events-none absolute inset-2 z-30 border border-black/[0.055]" />

        <div className="relative mx-4 mt-4 h-[230px] overflow-hidden border border-black/[0.08] shadow-[0_8px_22px_rgba(48,39,27,0.12)]">
          <Image
            src="/images/details/invitation-dinner-beer.jpg"
            alt="여러 사람이 잔을 나누는 토요일 저녁의 분위기"
            fill
            priority
            sizes="(max-width: 430px) 100vw, 390px"
            className="object-cover object-[center_42%] saturate-[0.82]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75" />
          <div className="absolute inset-x-5 top-5 flex items-center justify-between text-white">
            <span className="rounded-full border border-white/25 bg-black/20 px-3 py-1.5 font-serif text-[10px] italic tracking-[0.12em] backdrop-blur-md">
              08.15 SAT
            </span>
            <span className="text-[10px] font-bold tracking-[-0.02em] text-white/75">
              SEOUL · EULJIRO &amp; JONGNO
            </span>
          </div>
          <p className="absolute inset-x-5 bottom-5 whitespace-pre-line text-[22px] font-black leading-[1.27] tracking-[-0.055em] text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.35)]">
            {"디너 & 수제맥주"}
          </p>
        </div>

        <div className="px-5 pb-6 pt-5">
          <div>
            <InvitationJourney />
          </div>

          <div className="mt-5">
            <InvitationAtmosphere />
          </div>

        </div>
      </motion.article>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {modalOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.3, duration: 0.45 }}
        className="relative z-10 mx-4 mb-[calc(10px+env(safe-area-inset-bottom))] mt-5 grid h-[68px] shrink-0 grid-cols-[0.72fr_2.1fr] items-center gap-2 rounded-full border border-black/12 bg-[#f7f4ed]/96 p-1.5 shadow-[0_16px_38px_rgba(24,24,20,0.2)]"
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onPass}
          className="flex h-[56px] items-center justify-center rounded-full bg-transparent text-[15px] font-black tracking-[0.04em] text-black/42"
        >
          NO
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="flex h-[56px] items-center justify-center rounded-full bg-black text-[15px] font-black tracking-[0.04em] text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)]"
        >
          YES
        </motion.button>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.section>
  );
}

export function ProfileTypeInvitationPreview({
  archetypeId,
}: {
  archetypeId: ProfileArchetypeId;
}) {
  const [screen, setScreen] = useState<PreviewScreen>("type");

  return (
    <div className="relative min-h-dvh md:min-h-[calc(100dvh-32px)]">
    <AnimatePresence mode="sync">
      {screen === "type" ? (
        <motion.div
          key="type"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-0 z-20"
        >
          <ProfileArchetypeResult
            archetypeId={archetypeId}
            onContinue={() => {
              pulseInvitation();
              setScreen("invitation");
            }}
          />
        </motion.div>
      ) : screen === "invitation" ? (
        <FirstInvitation
          key="invitation"
          onPass={() => setScreen("passed")}
        />
      ) : (
        <InvitationPassResult
          key={screen}
          onReset={() => setScreen("invitation")}
        />
      )}
    </AnimatePresence>
    </div>
  );
}
