"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { NaverMapPreview } from "@/components/NaverMapPreview";
import type { NaverPlace } from "@/types/place";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function NaverPlacePicker({
  value,
  onChange,
  title = "어디에서 만날까요?",
  required = false,
  className,
}: {
  value?: NaverPlace | null;
  onChange: (place: NaverPlace | null) => void;
  title?: string;
  required?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<NaverPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  const searchPlaces = async () => {
    const keyword = query.trim();
    if (keyword.length < 2 || searching) return;

    setSearching(true);
    setError(null);

    const response = await fetch(
      `/api/places/search?query=${encodeURIComponent(keyword)}`,
    ).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as
          | { places?: NaverPlace[]; error?: string }
          | null)
      : null;

    if (!response?.ok) {
      setError(data?.error ?? "장소를 검색하지 못했어요.");
      setResults([]);
      setSearching(false);
      return;
    }

    setResults(data?.places ?? []);
    setSearching(false);
  };

  return (
    <section
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-[24px] border border-black/10 bg-white px-5 py-4",
        className,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-black text-black">
        {title}
        {required && (
          <span className="text-[10px] font-bold text-red-500">필수</span>
        )}
      </span>
      <div className="mt-3 flex min-w-0 max-w-full gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchPlaces();
            }
          }}
          placeholder="장소명을 검색해주세요"
          className="h-12 w-0 min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold outline-none transition placeholder:text-black/25 focus:border-accent"
        />
        <button
          type="button"
          disabled={searching || query.trim().length < 2}
          onClick={() => void searchPlaces()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-white transition disabled:bg-black/15 disabled:text-black/35"
          aria-label="장소 검색"
        >
          {searching ? (
            <Loader2 size={17} className="animate-spin" aria-hidden />
          ) : (
            <Search size={17} aria-hidden />
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-600">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 max-h-[292px] min-w-0 max-w-full space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
          {results.map((place) => {
            const selected =
              value?.source === "naver" &&
              value.mapx === place.mapx &&
              value.mapy === place.mapy;

            return (
              <button
                key={`${place.mapx}-${place.mapy}-${place.name}`}
                type="button"
                onClick={() => onChange(place)}
                className={cn(
                  "block h-[92px] w-full min-w-0 max-w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition",
                  selected
                    ? "border-accent bg-accent/[0.08]"
                    : "border-black/10 bg-black/[0.015] hover:border-accent/45",
                )}
              >
                <span className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden">
                  <MapPin
                    size={15}
                    className={cn(
                      "mt-0.5 shrink-0",
                      selected ? "text-accent" : "text-black/35",
                    )}
                    aria-hidden
                  />
                  <span className="w-0 min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-sm font-black text-black">
                      {place.name}
                    </span>
                    {place.category && (
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-accent">
                        {place.category}
                      </span>
                    )}
                    <span className="mt-1 block truncate text-xs font-semibold leading-5 text-black/48">
                      {place.roadAddress ?? place.jibunAddress ?? "주소 정보 없음"}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {value && (
        <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-4">
          <div className="flex min-w-0 max-w-full items-start justify-between gap-3">
            <div className="w-0 min-w-0 flex-1">
              <p className="truncate text-sm font-black text-black">{value.name}</p>
              {value.category && (
                <p className="mt-1 truncate text-[11px] font-bold text-accent">
                  {value.category}
                </p>
              )}
              <p className="mt-1 break-words text-xs font-semibold leading-5 text-black/55">
                {value.roadAddress ?? value.jibunAddress ?? "주소 정보 없음"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-black text-black/45 transition hover:text-black"
            >
              해제
            </button>
          </div>
          <NaverMapPreview
            place={value}
            className="mt-3"
            heightClassName="h-[172px]"
          />
        </div>
      )}
    </section>
  );
}
