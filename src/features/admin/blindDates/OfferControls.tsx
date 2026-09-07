"use client";
import { useEffect, useState } from "react";
import type { BlindDateAdminOffer } from "@/types/blindDate";
function responseLabel(value: string) {
  return value === "yes" ? "참여" : value === "no" ? "거절" : "응답 대기";
}
export function ResponseCell({
  value,
  disabled,
  onReset,
}: {
  value: string;
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex min-w-[88px] flex-col items-start gap-1.5">
      <span>{responseLabel(value)}</span>
      <button
        type="button"
        disabled={disabled || value === "pending"}
        onClick={onReset}
        className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[10px] font-bold text-black/45 disabled:cursor-not-allowed disabled:opacity-30"
      >
        응답 초기화
      </button>
    </div>
  );
}

export function OfferPlaceEditor({
  offer,
  saving,
  onSave,
}: {
  offer: BlindDateAdminOffer;
  saving: boolean;
  onSave: (
    offer: BlindDateAdminOffer,
    actualPlaceName: string,
    actualPlaceAddress: string,
    reservationName: string,
    scheduledDate: string,
  ) => void;
}) {
  const [actualPlaceName, setActualPlaceName] = useState(
    offer.actual_place_name ?? "",
  );
  const [actualPlaceAddress, setActualPlaceAddress] = useState(
    offer.actual_place_address ?? "",
  );
  const [reservationName, setReservationName] = useState(
    offer.reservation_name ?? "",
  );
  const [scheduledDate, setScheduledDate] = useState(
    offer.scheduled_date ?? "",
  );

  useEffect(() => {
    setActualPlaceName(offer.actual_place_name ?? "");
    setActualPlaceAddress(offer.actual_place_address ?? "");
    setReservationName(offer.reservation_name ?? "");
    setScheduledDate(offer.scheduled_date ?? "");
  }, [
    offer.id,
    offer.actual_place_name,
    offer.actual_place_address,
    offer.reservation_name,
    offer.scheduled_date,
  ]);

  const dirty =
    actualPlaceName !== (offer.actual_place_name ?? "") ||
    actualPlaceAddress !== (offer.actual_place_address ?? "") ||
    reservationName !== (offer.reservation_name ?? "") ||
    scheduledDate !== (offer.scheduled_date ?? "");

  const otherDates = new Set(offer.b_available_dates);
  const commonDates = [...new Set(offer.a_available_dates)]
    .filter((date) => otherDates.has(date))
    .sort();
  const awaitingDates =
    offer.a_available_dates.length === 0 || offer.b_available_dates.length === 0;

  return (
    <div className="grid min-w-0 content-start gap-2">
      <input
        value={actualPlaceName}
        disabled={saving}
        placeholder="장소명"
        onChange={(event) => setActualPlaceName(event.target.value)}
        className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold outline-none focus:border-accent disabled:opacity-45"
      />
      <input
        value={actualPlaceAddress}
        disabled={saving}
        placeholder="주소"
        onChange={(event) => setActualPlaceAddress(event.target.value)}
        className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold outline-none focus:border-accent disabled:opacity-45"
      />
      <input
        value={reservationName}
        disabled={saving}
        onChange={(event) => setReservationName(event.target.value)}
        placeholder="예약자명"
        aria-label="블라인드 데이트 예약자명"
        className="h-8 rounded-lg border border-black/10 bg-black/[0.035] px-2 text-xs font-semibold text-black/55 outline-none"
      />
      <input
        type="date"
        value={scheduledDate}
        disabled={saving}
        aria-label="확정 날짜"
        onChange={(event) => setScheduledDate(event.target.value)}
        className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs font-semibold outline-none focus:border-accent disabled:opacity-45"
      />
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() =>
          onSave(
            offer,
            actualPlaceName,
            actualPlaceAddress,
            reservationName,
            scheduledDate,
          )
        }
        className="h-8 rounded-lg bg-black px-3 text-[11px] font-bold text-white disabled:bg-black/20"
      >
        일정·장소 저장
      </button>
      <div className="mt-2 rounded-xl bg-black/[0.025] p-3">
        <p className="text-xs font-bold">두 사람의 공통 가능 날짜</p>
        {commonDates.length > 0 ? (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {commonDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  disabled={saving}
                  aria-label={`확정 날짜로 ${date} 선택`}
                  aria-pressed={scheduledDate === date}
                  onClick={() => setScheduledDate(date)}
                  className={
                    "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 " +
                    (scheduledDate === date
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white hover:border-black/40")
                  }
                >
                  {date.slice(5).replace("-", "/")} ({new Date(
                    `${date}T00:00:00Z`,
                  ).toLocaleDateString("ko-KR", {
                    weekday: "short",
                    timeZone: "UTC",
                  })})
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-black/50">
              날짜를 선택한 뒤 일정·장소 저장을 눌러주세요.
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-black/50">
            {awaitingDates
              ? "두 사람이 가능 날짜를 선택하면 여기에 표시됩니다."
              : "두 사람이 선택한 날짜 중 겹치는 날짜가 없습니다."}
          </p>
        )}
      </div>
    </div>
  );
}
