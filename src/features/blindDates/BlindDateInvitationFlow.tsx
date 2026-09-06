"use client";


import { NaverMapPreview } from "@/components/NaverMapPreview";
import {
  RouletteDeadlineCountdown,
  TicketCoursePanel
} from "@/features/meetings/TicketDetailContent";
import { ticketFadeTransition } from "@/features/meetings/TicketDetailHero";
import { blindDateStartAtFromParts } from "@/lib/blindDateTiming";
import type { BlindDateUserOffer } from "@/types/blindDate";
import type { NaverPlace } from "@/types/place";
import type {
  GatheringTicket
} from "@/types/ticket";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  UserRound,
  X
} from "lucide-react";
import {
  useEffect,
  useState
} from "react";

import { TicketDetailRevealHeader } from "@/features/meetings/TicketDetailRevealHeader";

function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

export function blindDateDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (!Number.isFinite(date.getTime())) return value;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${weekday}`;
}

export function blindDateCandidateDateLabel(dates: string[]) {
  if (dates.length === 0) return "날짜 선택 전";
  const sortedDates = [...dates].sort();
  if (sortedDates.length === 1) return blindDateDateLabel(sortedDates[0]);
  return `${blindDateDateLabel(sortedDates[0])} – ${blindDateDateLabel(sortedDates[sortedDates.length - 1])}`;
}

function blindDateListStatusLabel(offer: BlindDateUserOffer) {
  if (offer.ownResponse === "pending") return "응답 필요";
  if (offer.status === "scheduled") return "일정 확정";
  if (offer.status === "needs_reschedule") return "일정 조율 중";
  return "응답 대기";
}

export function BlindDateOfferList({
  offers,
  embedded,
  onClose,
  onSelect,
}: {
  offers: BlindDateUserOffer[];
  embedded: boolean;
  onClose: () => void;
  onSelect: (offer: BlindDateUserOffer) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative bg-transparent px-5 pb-10 pt-[calc(72px+env(safe-area-inset-top))] text-[#24211d]",
        embedded ? "min-h-full" : "min-h-dvh md:min-h-[calc(100dvh-32px)]",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="블라인드 데이트 일정 목록 닫기"
        className="absolute left-4 top-[calc(14px+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/55 shadow-sm backdrop-blur-md"
      >
        <X size={18} strokeWidth={1.9} aria-hidden />
      </button>

      <div className="mx-auto w-full max-w-[390px]">
        <p className="font-ticket-latin text-[11px] font-bold uppercase tracking-[0.14em] text-black/35">
          Blind Date
        </p>
        <h1 className="font-ticket-display mt-2 text-[28px] font-bold tracking-[-0.045em] text-black">
          예정된 일정을 선택해주세요.
        </h1>
        <p className="mt-3 break-keep text-[13px] font-semibold leading-6 text-black/46">
          일정을 선택하면 해당 블라인드 데이트 티켓을 열 수 있어요.
        </p>

        <div className="mt-8 space-y-3">
          {offers.map((offer, index) => {
            const dateLabel = offer.scheduledDate
              ? blindDateDateLabel(offer.scheduledDate)
              : blindDateCandidateDateLabel(offer.candidateDates);
            const statusLabel = blindDateListStatusLabel(offer);

            return (
              <motion.button
                key={offer.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index * 0.06, 0.24),
                  duration: 0.34,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelect(offer)}
                aria-label={`${dateLabel} ${offer.timeLabel} ${offer.region} 블라인드 데이트 티켓 열기`}
                className="group w-full rounded-[24px] border border-black/10 bg-white/72 px-5 py-5 text-left shadow-[0_12px_34px_rgba(35,31,24,0.06)] backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black tracking-[0.04em] text-white">
                        {statusLabel}
                      </span>
                      <span className="text-[11px] font-bold text-black/38">
                        {dateLabel}
                      </span>
                    </div>

                    <p className="font-ticket-display mt-4 text-[21px] font-bold tracking-[-0.04em] text-black">
                      {offer.template.title}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-black/48">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} strokeWidth={1.8} aria-hidden />
                        {offer.timeLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} strokeWidth={1.8} aria-hidden />
                        {offer.region}
                      </span>
                    </div>

                    {offer.actualPlaceName && (
                      <p className="mt-3 truncate text-[12px] font-bold text-black/62">
                        {offer.actualPlaceName}
                      </p>
                    )}
                  </div>

                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#f7f4ed] text-black/42 transition group-hover:text-black/65">
                    <ChevronRight size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

export function shouldPlayBlindDateUnlock(offer: BlindDateUserOffer) {
  return offer.ownResponse === "pending" || offer.status === "scheduled";
}

function blindDateStartAt(offer: BlindDateUserOffer) {
  return blindDateStartAtFromParts(offer.scheduledDate, offer.timeLabel);
}

const blindDateCalendarWeekdays = ["일", "월", "화", "수", "목", "금", "토"];

function isoDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function remainingTimeText(expiresAt: string, nowMs = Date.now()) {
  const target = new Date(expiresAt);
  const remainingMs = target.getTime() - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const timeText = days > 0
    ? `${days}일 ${hours}시간 ${minutes}분`
    : hours > 0
      ? `${hours}시간 ${minutes}분`
      : `${minutes}분`;

  return `응답 마감까지 ${timeText} 남았어요.`;
}

function useBlindDateRemainingText(expiresAt: string) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return remainingTimeText(expiresAt, nowMs);
}

export function BlindDateInvitationFlow({
  offer,
  bundledOffers,
  userName,
  profilePhotoUrl,
  ticketDetailMode = false,
  onClose,
  onOffersChange,
}: {
  offer: BlindDateUserOffer;
  bundledOffers: BlindDateUserOffer[];
  userName?: string | null;
  profilePhotoUrl?: string | null;
  ticketDetailMode?: boolean;
  onClose: () => void;
  onOffersChange?: (offers: BlindDateUserOffer[]) => void;
}) {
  const [currentOffer, setCurrentOffer] = useState(offer);
  const [step, setStep] = useState<"invite" | "result">(
    offer.ownResponse === "pending" && !offer.isExpired ? "invite" : "result",
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [desiredMeetingCount, setDesiredMeetingCount] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayUserName = Array.from(userName?.trim() || "회원")
    .slice(-2)
    .join("");
  const remainingText = useBlindDateRemainingText(currentOffer.expiresAt);
  const responseWindowClosed =
    currentOffer.isExpired ||
    (!remainingText &&
      ["offered", "waiting_response"].includes(currentOffer.status));

  useEffect(() => {
    setCurrentOffer(offer);
    setStep(offer.ownResponse === "pending" && !offer.isExpired ? "invite" : "result");
    setSelectedDates([]);
    setDesiredMeetingCount(null);
    setError(null);
  }, [offer]);

  const respond = async (action: "yes" | "no", availableDates: string[] = []) => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const offersToRespond = bundledOffers.length
        ? bundledOffers
        : [currentOffer];
      let updatedCurrentOffer: BlindDateUserOffer | null = null;
      let updatedOffers: BlindDateUserOffer[] | null = null;

      for (const targetOffer of offersToRespond) {
        const response = await fetch("/api/meetings/blind-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerId: targetOffer.id,
            action,
            availableDates,
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | {
              offer?: BlindDateUserOffer;
              offers?: BlindDateUserOffer[];
              error?: string;
            }
          | null;

        if (!response.ok || !data?.offer) {
          throw new Error(data?.error ?? "blind-date-response-failed");
        }

        if (targetOffer.id === currentOffer.id) updatedCurrentOffer = data.offer;
        updatedOffers = data.offers ?? updatedOffers;
      }

      const resultOffer =
        updatedCurrentOffer ??
        updatedOffers?.find((item) => item.id === currentOffer.id) ??
        currentOffer;
      setCurrentOffer(resultOffer);
      if (updatedOffers) onOffersChange?.(updatedOffers);
      setStep("result");
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "응답을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleDate = (date: string) => {
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((item) => item !== date)
        : [...current, date].sort(),
    );
  };

  return (
    <motion.div
      key="blind-date-invitation"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={ticketFadeTransition}
      className="relative pb-5 pt-[calc(54px+env(safe-area-inset-top))]"
    >
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        aria-label={ticketDetailMode ? "티켓 상세 닫기" : "블라인드 데이트 초대장 닫기"}
        className={cn(
          "absolute z-30 flex h-10 w-10 shrink-0 items-center justify-center text-black/55 transition hover:text-black disabled:opacity-40",
          ticketDetailMode
            ? "-left-1 top-[calc(-14px+env(safe-area-inset-top))]"
            : "left-0 top-[calc(6px+env(safe-area-inset-top))] rounded-full border border-black/10 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md",
        )}
      >
        <X size={18} aria-hidden />
      </button>

      {step !== "result" && responseWindowClosed ? (
        <BlindDateResultMessage
          tone="muted"
          title="응답 시간이 지나 초대장이 만료되었어요."
          body="만료된 초대장은 추천탭 알림에서 제외돼요."
        />
      ) : step === "result" ? (
        <BlindDateResponseResult
          offer={currentOffer}
          remainingText={remainingText}
          profilePhotoUrl={profilePhotoUrl}
          onOfferChange={setCurrentOffer}
        />
      ) : (
        <section>
          <TicketDetailRevealHeader
            title={currentOffer.template.title}
            meta={`${blindDateCandidateDateLabel(currentOffer.candidateDates)} · ${currentOffer.timeLabel} · ${currentOffer.region}`}
          />

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
            className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] pt-5 text-[#24211d]"
          >
            <p className="break-keep px-1 text-[13px] font-semibold leading-6 text-black/52">
              <span>
                지난 모임에서 {displayUserName}님이 단 둘이 만나고 싶다고 선택한 사람도, {displayUserName}님을 선택했어요.
              </span>
              <span className="mt-2 block">
                교집합이 블라인드 데이트 자리를 마련해드립니다.
              </span>
            </p>

            <BlindDateDateCalendar
              dates={currentOffer.candidateDates}
              selectedDates={selectedDates}
              saving={saving}
              onToggle={toggleDate}
            />

            <section className="mt-5 rounded-[22px] border border-[#d0cbbc]/70 bg-[#f8f5ee]/80 p-4">
              <h2 className="text-sm font-black text-black">
                참여 여부
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "YES", value: 1 },
                  { label: "NO", value: 0 },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={desiredMeetingCount === value}
                    onClick={() => setDesiredMeetingCount(value)}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-[14px] border text-sm font-black transition",
                      desiredMeetingCount === value
                        ? "border-black bg-black text-white shadow-sm"
                        : "border-black/10 bg-[#f7f4ed] text-black/45 hover:border-black/25 hover:text-black",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 min-h-[18px]">
                <p className="text-[11px] font-semibold leading-[18px] text-black/42">
                  서로 YES를 누른 경우에만 블라인드 데이트가 진행돼요.
                </p>
              </div>
            </section>

            <RouletteDeadlineCountdown
              deadlineAt={new Date(currentOffer.expiresAt)}
              activeLabel="응답 마감까지 남은 시간"
              closedLabel="응답이 마감됐어요"
            />

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
                {error}
              </p>
            )}

            <motion.button
              whileTap={
                !saving &&
                desiredMeetingCount !== null &&
                (desiredMeetingCount === 0 || selectedDates.length > 0)
                  ? { scale: 0.985 }
                  : undefined
              }
              type="button"
              disabled={
                saving ||
                desiredMeetingCount === null ||
                (desiredMeetingCount > 0 && selectedDates.length === 0)
              }
              onClick={() =>
                void respond(
                  desiredMeetingCount === 0 ? "no" : "yes",
                  desiredMeetingCount === 0 ? [] : selectedDates,
                )
              }
              className="mt-5 h-[56px] w-full rounded-full bg-black text-sm font-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.12)] transition disabled:bg-black/15 disabled:text-white/35 disabled:shadow-none"
            >
              {saving ? "저장 중..." : "응답 제출하기"}
            </motion.button>
          </motion.div>
        </section>
      )}
    </motion.div>
  );
}

function BlindDateDateCalendar({
  dates,
  selectedDates,
  saving,
  onToggle,
}: {
  dates: string[];
  selectedDates: string[];
  saving: boolean;
  onToggle: (date: string) => void;
}) {
  const enabledDates = new Set(dates);
  const selectedDateSet = new Set(selectedDates);
  const sortedDates = [...dates].sort();
  const firstDate = sortedDates[0];
  const firstDateParts = firstDate ? isoDateParts(firstDate) : null;

  if (!firstDateParts) {
    return (
      <p className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm font-semibold text-black/45">
        선택 가능한 날짜가 아직 열리지 않았어요.
      </p>
    );
  }

  const visibleDates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(
      Date.UTC(
        firstDateParts.year,
        firstDateParts.month - 1,
        firstDateParts.day + index,
      ),
    );
    return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  });
  const lastDate = visibleDates[visibleDates.length - 1];
  const weekdayHeaders = visibleDates.slice(0, 7).map((date) => {
    const parts = isoDateParts(date);
    if (!parts) return "";
    return blindDateCalendarWeekdays[
      new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    ];
  });

  return (
    <section className="mt-5 rounded-[24px] border border-[#d0cbbc]/70 bg-[#f8f5ee]/80 p-4">
      <div>
        <h2 className="text-sm font-black text-black">가능한 날짜를 모두 선택해주세요.</h2>
        <p className="mt-1 text-[11px] font-semibold text-black/42">
          {blindDateDateLabel(firstDate)} – {blindDateDateLabel(lastDate)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-black/32">
        {weekdayHeaders.map((weekday, index) => (
          <span key={`${weekday}-${index}`} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {visibleDates.map((date) => {
          const parts = isoDateParts(date);
          const enabled = enabledDates.has(date);
          const selected = selectedDateSet.has(date);

          return (
            <button
              key={date}
              type="button"
              disabled={!enabled || saving}
              aria-label={blindDateDateLabel(date)}
              aria-pressed={selected}
              onClick={() => onToggle(date)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-full border text-xs font-black transition disabled:cursor-not-allowed",
                selected
                  ? "border-black bg-black text-white shadow-sm"
                  : enabled
                    ? "border-black/10 bg-[#f7f4ed] text-black hover:border-black/25"
                    : "border-transparent text-black/15",
                saving && enabled && "opacity-45",
              )}
            >
              <span>{parts?.day ?? ""}</span>
              {enabled && !selected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-black/35" />
              )}
              {selected && (
                <Check
                  size={10}
                  className="absolute right-1.5 top-1.5"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BlindDateResponseResult({
  offer,
  remainingText,
  profilePhotoUrl,
  onOfferChange,
}: {
  offer: BlindDateUserOffer;
  remainingText: string | null;
  profilePhotoUrl?: string | null;
  onOfferChange: (offer: BlindDateUserOffer) => void;
}) {
  const stage = blindDateDisplayStage(offer);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const startAt = blindDateStartAt(offer);
  const feedbackAt = offer.feedbackOpensAt
    ? new Date(offer.feedbackOpensAt)
    : startAt
      ? new Date(startAt.getTime() + 3 * 60 * 60 * 1000)
      : null;
  const arrivalAt = offer.arrivalOpensAt
    ? new Date(offer.arrivalOpensAt)
    : startAt
      ? new Date(startAt.getTime() - 3 * 60 * 60 * 1000)
      : null;
  const progressStage: BlindDateProgressStage = offer.feedbackCompleted
    ? "done"
    : offer.canSubmitFeedback ||
        (feedbackAt && nowMs >= feedbackAt.getTime())
      ? "feedback"
      : offer.canSetArrival || (arrivalAt && nowMs >= arrivalAt.getTime())
        ? "arrival"
        : "confirmed";
  const activeProgressStage = progressStage === "done" ? "feedback" : progressStage;
  const [selectedProgressStage, setSelectedProgressStage] =
    useState<BlindDateSelectableProgressStage>("confirmed");

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedProgressStage(activeProgressStage);
  }, [activeProgressStage, offer.id]);

  if (stage === "scheduled" || stage === "guidance" || stage === "completed") {
    const isCompleted = stage === "completed";
    const placeName = offer.actualPlaceName || "장소 확인 중";
    const address = offer.actualPlaceAddress || "주소 확인 중";

    return (
      <section>
        <TicketDetailRevealHeader
          title={offer.template.title}
          meta={`${offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : "날짜 확인 중"} · ${offer.timeLabel} · ${offer.region}`}
        />

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          className="ticket-detail-stone mt-8 border-t border-[#d0cbbc] px-1 pb-5 pt-1 text-[#24211d]"
        >
          <BlindDateTicketStatusOverview
            offer={offer}
            progressStage={progressStage}
            selectedStage={selectedProgressStage}
            onSelectStage={setSelectedProgressStage}
            nowMs={nowMs}
            startAt={startAt}
            arrivalAt={arrivalAt}
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedProgressStage}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {selectedProgressStage === "confirmed" && (
                <BlindDateJourneySections
                  offer={offer}
                  placeName={placeName}
                  address={address}
                  profilePhotoUrl={profilePhotoUrl}
                />
              )}

              {selectedProgressStage === "arrival" && (
                <>
                  <BlindDateArrivalPanel
                    offer={offer}
                    enabled={progressStage === "arrival"}
                    onOfferChange={onOfferChange}
                  />
                  <BlindDateJourneySections
                    offer={offer}
                    placeName={placeName}
                    address={address}
                    profilePhotoUrl={profilePhotoUrl}
                  />
                </>
              )}

              {selectedProgressStage === "feedback" && (
                <BlindDateFeedbackForm offer={offer} onOfferChange={onOfferChange} />
              )}
            </motion.div>
          </AnimatePresence>

          {isCompleted && progressStage === "confirmed" && (
            <p className="mt-4 text-xs font-semibold text-black/40">
              만남 시간이 확인되면 다음 안내가 자동으로 열려요.
            </p>
          )}
        </motion.div>
      </section>
    );
  }

  if (stage === "needs_reschedule") {
    return (
      <BlindDateResultMessage
        tone="muted"
        title="가능한 날짜가 서로 맞지 않았어요."
        body="운영진이 다른 일정을 확인해볼게요."
      />
    );
  }

  if (stage === "declined") {
    return (
      <BlindDateResultMessage
        tone="muted"
        title="이번 블라인드 데이트 제안은 지나갔어요."
        body="다음 교집합에서 더 잘 맞는 자리를 제안드릴게요."
      />
    );
  }

  if (stage === "expired") {
    return (
      <BlindDateResultMessage
        tone="muted"
        title="응답 시간이 지나 초대장이 만료되었어요."
        body="만료된 초대장은 추천탭 알림에서 제외돼요."
      />
    );
  }

  return (
    <section>
      <h1 className="text-[24px] font-bold leading-8 tracking-tight text-black">
        상대방의 응답을
        <br />
        기다리는 중이에요.
      </h1>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-black/48">
        {blindDateStageCopy(
          offer,
          "waiting",
          "상대방도 참여 의사를 남기고 가능한 날짜가 겹치면 블라인드 데이트 일정이 확정돼요.",
        )}
      </p>

      <BlindDateDetailList
        items={[
          ["선택한 날짜", offer.ownAvailableDates.map(blindDateDateLabel).join(", ") || "-"],
          ["시간", offer.timeLabel],
          ["지역", offer.region],
          ["마감", remainingText ?? "응답 마감 시간이 곧 도착해요."],
          ["상대", "현장에서 공개"],
        ]}
      />
    </section>
  );
}

type BlindDateProgressStage = "confirmed" | "arrival" | "feedback" | "done";
type BlindDateSelectableProgressStage = Exclude<BlindDateProgressStage, "done">;

const blindDateProgressSteps: Array<{
  key: BlindDateSelectableProgressStage;
  label: string;
}> = [
    { key: "confirmed", label: "참여 확정" },
    { key: "arrival", label: "도착 안내" },
    { key: "feedback", label: "피드백" },
];

function blindDateProgressIndex(stage: BlindDateProgressStage) {
  const key = stage === "done" ? "feedback" : stage;
  return Math.max(
    blindDateProgressSteps.findIndex((step) => step.key === key),
    0,
  );
}

function blindDateProgressStatusLabel(stage: BlindDateProgressStage) {
  if (stage === "done") return "피드백을 완료했어요";
  if (stage === "feedback") return "피드백을 남겨주세요";
  if (stage === "arrival") return "도착 예정 시간을 알려주세요";
  return "참여가 확정됐어요";
}

function blindDateCountdownLabel({
  progressStage,
  nowMs,
  startAt,
  arrivalAt,
}: {
  progressStage: BlindDateProgressStage;
  nowMs: number;
  startAt: Date | null;
  arrivalAt: Date | null;
}) {
  const target = progressStage === "confirmed" ? arrivalAt : startAt;
  if (!target || target.getTime() <= nowMs) return null;
  const totalMinutes = Math.ceil((target.getTime() - nowMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const remaining = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  return progressStage === "confirmed"
    ? `도착 안내까지 ${remaining}`
    : `만남 시작까지 ${remaining}`;
}

function BlindDateTicketStatusOverview({
  offer,
  progressStage,
  selectedStage,
  onSelectStage,
  nowMs,
  startAt,
  arrivalAt,
}: {
  offer: BlindDateUserOffer;
  progressStage: BlindDateProgressStage;
  selectedStage: BlindDateSelectableProgressStage;
  onSelectStage: (stage: BlindDateSelectableProgressStage) => void;
  nowMs: number;
  startAt: Date | null;
  arrivalAt: Date | null;
}) {
  const activeIndex = blindDateProgressIndex(progressStage);
  const countdown = blindDateCountdownLabel({
    progressStage,
    nowMs,
    startAt,
    arrivalAt,
  });

  return (
    <section className="border-b border-black/8 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-black/42">
            current status
          </p>
          <h2 className="mt-1 text-[17px] font-black text-black">
            {blindDateProgressStatusLabel(progressStage)}
          </h2>
        </div>
        {countdown && (
          <p className="mt-1 shrink-0 rounded-full border border-[#d0cbbc] bg-[#f7f4ed] px-3 py-1.5 text-right text-[11px] font-black leading-4 text-black/62 shadow-[0_8px_18px_rgba(66,57,44,0.08)]">
            {countdown}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-black text-black">
          <CalendarDays size={14} className="text-black/35" aria-hidden />
          {offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : "날짜 확인 중"}{" "}
          {offer.timeLabel}
        </p>
        <p className="flex items-center gap-2 text-sm font-black text-black">
          <MapPin size={14} className="text-black/35" aria-hidden />
          {offer.region}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {blindDateProgressSteps.map((step, index) => {
          const reached = index <= activeIndex;
          const selected = step.key === selectedStage;
          const disabled = index > activeIndex;
          return (
            <div key={step.key} className="text-center">
              <div
                className={cn(
                  "h-1.5 rounded-full transition",
                  reached ? "bg-[#8f877a]" : "bg-black/8",
                )}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectStage(step.key)}
                aria-pressed={selected}
                className={cn(
                  "mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black transition",
                  selected
                    ? "bg-[#24211d] text-white ring-2 ring-[#d0cbbc] ring-offset-2 ring-offset-[#f7f4ed]"
                    : reached
                      ? "bg-black text-white"
                      : "bg-black/[0.05] text-black/30",
                )}
              >
                {reached ? <Check size={13} aria-hidden /> : index + 1}
              </button>
              <span
                className={cn(
                  "mt-2 block text-[10px] font-black",
                  selected ? "text-black" : reached ? "text-black/52" : "text-black/25",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const blindDateArrivalOptions = [
  { value: "on_time", label: "정상 도착 예정이에요" },
  { value: "late_10", label: "10분 정도 늦어요" },
  { value: "late_20", label: "20분 정도 늦어요" },
  { value: "late_30_plus", label: "30분 이상 늦어요" },
] as const;

function BlindDateArrivalPanel({
  offer,
  enabled,
  onOfferChange,
}: {
  offer: BlindDateUserOffer;
  enabled: boolean;
  onOfferChange: (offer: BlindDateUserOffer) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reservationName = offer.reservationName || "이소윤";
  const selectedArrivalLabel = blindDateArrivalOptions.find(
    (option) => option.value === offer.arrivalStatus,
  )?.label;

  const saveArrival = async (
    arrivalStatus: (typeof blindDateArrivalOptions)[number]["value"],
  ) => {
    if (!enabled || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/meetings/blind-dates/${encodeURIComponent(offer.id)}/arrival`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arrivalStatus }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { arrivalStatus?: BlindDateUserOffer["arrivalStatus"]; reservationName?: string | null }
        | null;
      if (!response.ok || !result?.arrivalStatus) throw new Error("arrival-save-failed");
      onOfferChange({
        ...offer,
        arrivalStatus: result.arrivalStatus,
        reservationName: result.reservationName ?? null,
      });
    } catch {
      setError("도착 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">
        도착 안내
      </h2>

      <div className="mt-4 rounded-2xl border border-[#d8d1c3]/80 bg-[#eee9df] px-4 py-3.5">
        <div className="flex min-h-7 items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-sm font-bold text-black/52">
            <UserRound size={15} className="text-black/38" aria-hidden />
            예약자명
          </span>
          <strong
            aria-label={offer.arrivalStatus ? reservationName : "도착 상태 선택 후 공개"}
            className={cn(
              "text-[15px] font-black tracking-[-0.02em] text-black transition-[filter,opacity] duration-300",
              offer.arrivalStatus
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

      <div className="mt-3 grid gap-2">
        {blindDateArrivalOptions.map((option) => {
          const active = offer.arrivalStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving || !enabled}
              onClick={() => void saveArrival(option.value)}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-default",
                active
                  ? "border-black bg-black text-white"
                  : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/58",
                !enabled && !active && "opacity-55",
              )}
            >
              <span>{option.label}</span>
              {active && <Check size={16} aria-hidden />}
            </button>
          );
        })}
      </div>
      {!enabled && (
        <p className="mt-3 text-xs font-semibold leading-5 text-black/40">
          {selectedArrivalLabel
            ? "선택한 도착 상태예요."
            : "도착 상태 입력 시간이 종료됐어요."}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

function BlindDateRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (rating: number) => void;
}) {
  return (
    <div>
      <h3 className="text-[15px] font-black text-black">{label}</h3>
      <div className="mt-3 grid grid-cols-5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;
          return (
            <motion.button
              key={rating}
              type="button"
              whileTap={{ scale: 0.96 }}
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${rating}점`}
              onClick={() => onChange(rating)}
              className={cn(
                "relative flex h-12 min-w-0 items-center justify-center bg-transparent text-[22px] font-medium tabular-nums transition",
                selected
                  ? "scale-125 font-black text-black"
                  : "text-black/18 hover:text-black/50",
              )}
            >
              <span>{rating}</span>
              {selected && (
                <motion.span
                  layoutId={`blind-date-rating-${label}`}
                  className="absolute bottom-0 h-0.5 w-5 rounded-full bg-black"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold text-black/35">
        <span>나쁨</span>
        <span>좋음</span>
      </div>
    </div>
  );
}

function BlindDateFeedbackForm({
  offer,
  onOfferChange,
}: {
  offer: BlindDateUserOffer;
  onOfferChange: (offer: BlindDateUserOffer) => void;
}) {
  const [counterpartRating, setCounterpartRating] = useState<number | null>(null);
  const [placeRating, setPlaceRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (offer.feedbackCompleted) {
    return (
      <section className="border-t border-black/8 py-5">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600">
            <Check size={20} aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-black text-emerald-950">
            피드백 작성을 완료했어요.
          </h2>
          <p className="mt-2 text-sm font-semibold text-emerald-800/70">
            다음 블라인드 데이트를 더 잘 준비하는 데 반영할게요.
          </p>
        </div>
      </section>
    );
  }

  const submit = async () => {
    if (!counterpartRating || !placeRating || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/meetings/blind-dates/${encodeURIComponent(offer.id)}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            counterpartRating,
            placeRating,
            comment: feedbackComment,
          }),
        },
      );
      if (!response.ok) throw new Error("feedback-save-failed");
      onOfferChange({ ...offer, feedbackCompleted: true, canSubmitFeedback: false });
    } catch {
      setError("피드백을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-black/8 py-5">
      <h2 className="font-ticket-display text-[19px] font-bold tracking-[-0.04em] text-black">
        블라인드 데이트는 어떠셨나요?
      </h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-black/45">
        상대방과 식당에 대한 피드백만 간단히 남겨주세요.
      </p>
      <div className="mt-6 grid gap-7">
        <BlindDateRating
          label="상대방과의 만남"
          value={counterpartRating}
          onChange={setCounterpartRating}
        />
        <BlindDateRating
          label={`식당 피드백${offer.actualPlaceName ? ` · ${offer.actualPlaceName}` : ""}`}
          value={placeRating}
          onChange={setPlaceRating}
        />
        <textarea
          value={feedbackComment}
          maxLength={500}
          rows={5}
          placeholder="교집합에 남기고 싶은 말을 적어주세요."
          aria-label="교집합에 남기고 싶은 말"
          onChange={(event) => setFeedbackComment(event.target.value)}
          className="w-full resize-none rounded-2xl border border-[#d8d1c3]/90 bg-[#eee9df] px-4 py-3 text-sm font-semibold leading-6 outline-none placeholder:text-black/28"
        />
      </div>
      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!counterpartRating || !placeRating || saving}
        onClick={() => void submit()}
        className="mt-6 h-14 w-full rounded-full bg-black text-sm font-black text-white disabled:bg-black/15 disabled:text-white/40"
      >
        {saving ? "저장 중..." : "피드백 제출하기"}
      </button>
    </section>
  );
}

function BlindDateJourneySections({
  offer,
  placeName,
  address,
  profilePhotoUrl,
}: {
  offer: BlindDateUserOffer;
  placeName: string;
  address: string;
  profilePhotoUrl?: string | null;
}) {
  const dateTimeLabel = [
    offer.scheduledDate ? blindDateDateLabel(offer.scheduledDate) : null,
    offer.timeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const counterpartPhotoUrl = `/api/meetings/blind-dates/${encodeURIComponent(offer.id)}/counterpart-photo`;
  const startAt = blindDateStartAt(offer);
  const journeyTime = startAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(startAt)
    : offer.timeLabel;
  const journeyPlace = {
    name: offer.actualPlaceName,
    address: offer.actualPlaceAddress,
  };
  const journeySteps: NonNullable<GatheringTicket["courseSteps"]> = [
    {
      id: `blind-date-${offer.id}`,
      order: 1,
      title: "블라인드 데이트",
      activityType: "만남",
      placeName,
      address,
      place: journeyPlace,
      openOffsetMinutes: 0,
      isMainActivity: true,
    },
  ];
  const journeyTicket: GatheringTicket = {
    id: `blind-date-${offer.id}`,
    templateId: offer.template.id,
    title: offer.template.title,
    subtitle: "",
    date: offer.scheduledDate ?? "",
    time: journeyTime,
    area: offer.region,
    moodTags: [],
    peopleHint: "",
    reason: "",
    courseSteps: journeySteps,
    place: journeyPlace,
  };

  return (
    <div className="mt-5">
      <section className="py-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">
            여정
          </h2>
          <p className="font-ticket-latin text-[10px] italic tracking-[0.12em] text-black/36">
            {dateTimeLabel}
          </p>
        </div>

        <div className="mt-4">
          <TicketCoursePanel
            ticket={journeyTicket}
            steps={journeySteps}
            participantPhotoUrl={profilePhotoUrl}
            participantArrivalStatus={offer.arrivalStatus}
            counterpartArrivalStatus={offer.counterpartArrivalStatus}
            previewMatchPhotoUrls={[counterpartPhotoUrl]}
            previewOtherMemberPhotoUrls={[]}
            matchMemberCount={1}
            variant="blind-date"
            showFeedbackTime={false}
            showJoinCountdown={false}
          />
        </div>
      </section>

      <section className="border-t border-black/8 py-5">
        <h2 className="font-ticket-display text-[17px] font-bold tracking-[-0.04em] text-black">
          장소
        </h2>
        <div className="mt-4 rounded-3xl border border-black/8 bg-white px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/48">
              <MapPin size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-base font-black leading-6 text-black">{placeName}</p>
              <p className="mt-1 text-[11px] font-bold text-black/40">{offer.region}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-black/62">
                {address}
              </p>
            </div>
          </div>
          {offer.actualPlaceName && (
            <BlindDateNaverMap
              placeName={offer.actualPlaceName}
              region={offer.region}
              address={offer.actualPlaceAddress}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function normalizeBlindDatePlaceText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]/gu, "");
}

function selectBlindDateNaverPlace(
  places: NaverPlace[],
  placeName: string,
  region: string,
) {
  const targetName = normalizeBlindDatePlaceText(placeName);
  const targetRegion = normalizeBlindDatePlaceText(region.replace(/^서울\s*/, ""));

  return (
    [...places].sort((left, right) => {
      const score = (place: NaverPlace) => {
        const resultName = normalizeBlindDatePlaceText(place.name);
        const address = normalizeBlindDatePlaceText(
          `${place.roadAddress ?? ""} ${place.jibunAddress ?? ""}`,
        );
        let value = 0;
        if (resultName === targetName) value += 100;
        else if (
          resultName.includes(targetName) ||
          targetName.includes(resultName)
        ) {
          value += 60;
        }
        if (targetRegion && address.includes(targetRegion)) value += 10;
        return value;
      };

      return score(right) - score(left);
    })[0] ?? null
  );
}

function BlindDateNaverMap({
  placeName,
  region,
  address,
}: {
  placeName: string;
  region: string;
  address?: string | null;
}) {
  const [place, setPlace] = useState<NaverPlace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = placeName;

    setPlace(null);
    setFailed(false);
    setIsLoading(true);

    fetch(`/api/places/search?query=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("blind-date-place-search-failed");
        return (await response.json()) as { places?: NaverPlace[] };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const nextPlace = selectBlindDateNaverPlace(
          data.places ?? [],
          placeName,
          region,
        );
        setPlace(nextPlace);
        setFailed(!nextPlace);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [placeName, region]);

  if (isLoading) {
    return (
      <div
        className="mt-3 h-[190px] animate-pulse rounded-2xl border border-black/8 bg-black/[0.035]"
        aria-label="네이버 지도 불러오는 중"
      />
    );
  }

  if (failed || !place) {
    if (address) {
      return (
        <NaverMapPreview
          place={{ name: placeName, address }}
          className="mt-3"
          heightClassName="h-[190px]"
        />
      );
    }

    return (
      <div className="mt-3 flex h-[96px] items-center justify-center rounded-2xl border border-black/8 bg-black/[0.025] px-5 text-center text-xs font-bold text-black/42">
        네이버 지도를 불러오지 못했어요.
      </div>
    );
  }

  return (
    <NaverMapPreview
      place={place}
      className="mt-3"
      heightClassName="h-[190px]"
    />
  );
}

type BlindDateStageKey =
  | "invite"
  | "waiting"
  | "scheduled"
  | "guidance"
  | "completed";

function koreaTodayDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  return `${partMap.get("year")}-${partMap.get("month")}-${partMap.get("day")}`;
}

function blindDateDisplayStage(offer: BlindDateUserOffer) {
  if (offer.isExpired || offer.status === "expired") return "expired";
  if (offer.status === "declined" || offer.ownResponse === "no") return "declined";
  if (offer.status === "needs_reschedule") return "needs_reschedule";
  if (offer.status === "completed") return "completed";
  if (offer.scheduledDate) {
    const today = koreaTodayDateKey();
    if (offer.scheduledDate < today) return "completed";
    if (offer.scheduledDate === today) return "guidance";
    return "scheduled";
  }
  return "waiting";
}

function blindDateStageCopy(
  offer: BlindDateUserOffer,
  key: BlindDateStageKey,
  fallback: string,
) {
  return offer.template.stageCopy?.[key]?.trim() || fallback;
}

function BlindDateDetailList({
  items,
}: {
  items: Array<[label: string, value: string]>;
}) {
  return (
    <div className="mt-5 grid gap-2 rounded-2xl bg-black/[0.03] px-4 py-4 text-xs font-bold text-black/58">
      {items.map(([label, value]) => (
        <p key={label} className="grid grid-cols-[74px_minmax(0,1fr)] gap-2">
          <span className="text-black/35">{label}</span>
          <span className="min-w-0 whitespace-pre-line break-words text-black/62">
            {value}
          </span>
        </p>
      ))}
    </div>
  );
}

function BlindDateResultMessage({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "default" | "success" | "muted";
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border px-5 py-7 text-center",
        tone === "success"
          ? "border-emerald-100 bg-emerald-50 text-emerald-950"
          : tone === "muted"
            ? "border-black/10 bg-black/[0.03] text-black"
            : "border-accent/20 bg-accent/[0.08] text-black",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white",
          tone === "success" ? "text-emerald-600" : "text-accent",
        )}
      >
        <Check size={20} aria-hidden />
      </div>
      <h1 className="mt-5 whitespace-pre-line text-xl font-black leading-7">
        {title}
      </h1>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-black/58">
        {body}
      </p>
    </section>
  );
}
