"use client";

import { useState } from "react";
import type { BlindDateAdminProfile } from "@/types/blindDate";
import { blindDateSelectableDateWindowFrom } from "@/lib/blindDateDates";

export function CreateBlindDateForm({
  profiles,
  saving,
  onCreate,
}: {
  profiles: BlindDateAdminProfile[];
  saving: boolean;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [draft, setDraft] = useState({
    timeLabel: "저녁 7시",
    region: "",
    actualPlaceName: "",
    actualPlaceAddress: "",
    reservationName: "",
  });
  const dateWindow = blindDateSelectableDateWindowFrom(new Date());
  const options = profiles.filter(
    (p) =>
      p.user_id === a ||
      p.user_id === b ||
      [p.name, p.nickname, p.phone].some((v) => v?.includes(search.trim())),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!saving && a && b && a !== b)
          void onCreate({ participantAId: a, participantBId: b, ...draft });
      }}
      className="rounded-2xl border border-black/10 bg-white p-5"
    >
      <h3 className="font-bold">새 데이트 만들기</h3>
      <p className="mt-1 text-sm text-black/50">
        생성하면 두 사람에게 사이트 내 초대장이 표시됩니다.
      </p>
      <fieldset
        disabled={saving}
        className="mt-4 space-y-4 disabled:opacity-50"
      >
        <label className="block text-sm">
          참가자 검색
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호"
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "첫 번째 참가자", value: a, other: b, set: setA },
            { label: "두 번째 참가자", value: b, other: a, set: setB },
          ].map((item) => (
            <label key={item.label} className="text-sm">
              {item.label}
              <select
                required
                value={item.value}
                onChange={(e) => item.set(e.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="">선택해주세요</option>
                {options
                  .filter((p) => p.user_id !== item.other)
                  .map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.name || p.nickname || "이름 없음"} ·{" "}
                      {p.phone || "전화번호 없음"}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "timeLabel", label: "시간" },
              { key: "region", label: "지역" },
              { key: "actualPlaceName", label: "장소명" },
              { key: "actualPlaceAddress", label: "주소" },
              { key: "reservationName", label: "예약자명" },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="text-sm">
              {label}
              <input
                required={key === "timeLabel" || key === "region"}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
          ))}
        </div>
        <p className="text-xs leading-5 text-black/50">
          응답 기한은 생성 후 24시간입니다. 참가자가 가능한 날짜를 선택하면
          일정을 조율합니다. 장소와 예약자명은 나중에 입력해도 됩니다.
        </p>
        <p className="text-xs text-black/50">
          선택 가능한 날짜: {dateWindow.start} ~ {dateWindow.end}
        </p>
        <button
          type="submit"
          disabled={saving || !a || !b || a === b}
          className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-30"
        >
          {saving ? "생성 중…" : "두 사람에게 초대장 생성"}
        </button>
      </fieldset>
    </form>
  );
}
