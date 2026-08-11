"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { onboardingGuides } from "@/data/onboardingGuides";

function useTypedGuide(text: string, interval = 32) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue("");
    let length = 0;
    const timer = window.setInterval(() => {
      length += 1;
      setValue(text.slice(0, length));
      if (length >= text.length) window.clearInterval(timer);
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, text]);

  return value;
}

export function OnboardingGuidePreview({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [page, setPage] = useState<0 | 1>(0);
  const guide = onboardingGuides[page];
  const typedGuide = useTypedGuide(guide);
  const typingComplete = typedGuide.length === guide.length;

  return (
    <section className="flex min-h-full items-center bg-[#F5F1E8] px-8 py-[calc(76px+env(safe-area-inset-top))] text-[#171714]">
      <div key={page} className="mx-auto flex w-full max-w-[340px] flex-col">
        <div className={page === 0 ? "min-h-[190px]" : "min-h-[390px]"}>
          <p className="whitespace-pre-line break-keep text-[16px] font-medium leading-[1.9] tracking-[-0.035em]">
            {typedGuide}
            {!typingComplete && (
              <span className="ml-1 inline-block h-[0.9em] w-px animate-pulse bg-black/55 align-[-0.05em]" />
            )}
          </p>
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-black/15 pt-5">
          <span className="text-[12px] font-semibold tracking-[0.16em] text-black/35">
            0{page + 1} / 02
          </span>
          <button
            type="button"
            disabled={!typingComplete}
            aria-label={page === 0 ? "다음 안내 보기" : "안내 다시보기 마치기"}
            onClick={() => {
              if (page === 0) {
                setPage(1);
                return;
              }
              onComplete();
            }}
            className={`flex h-12 w-12 items-center justify-center transition-all duration-300 ${
              typingComplete
                ? "text-black active:translate-x-0.5"
                : "cursor-not-allowed text-black/20"
            }`}
          >
            <ArrowRight size={28} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </section>
  );
}
