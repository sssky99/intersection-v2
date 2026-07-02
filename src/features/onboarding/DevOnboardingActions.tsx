"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DevOnboardingActions({
  enabled,
}: {
  enabled: boolean;
}) {
  const router = useRouter();
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLocalHost(window.location.hostname === "localhost");
  }, []);

  const isLocal = enabled || isLocalHost;

  if (!isLocal) return null;

  const resetQuestions = async (startQuestion?: number) => {
    if (resetting) return;

    setResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/dev/reset-onboarding", {
        method: "POST",
      });
      if (!response.ok) throw new Error("reset-failed");

      router.replace(
        startQuestion
          ? `/onboarding/questions?start=${startQuestion}`
          : "/onboarding/questions",
      );
      router.refresh();
    } catch {
      setError("온보딩 상태를 초기화하지 못했어요.");
      setResetting(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-black/30">
        local test
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="h-10 rounded-xl border border-black/10 bg-white text-xs font-semibold text-black/55"
        >
          랜딩 다시보기
        </button>
        <button
          type="button"
          disabled={resetting}
          onClick={() => void resetQuestions()}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white text-xs font-semibold text-black/55 disabled:opacity-40"
        >
          <RotateCcw
            size={13}
            aria-hidden
            className={resetting ? "animate-spin" : ""}
          />
          {resetting ? "초기화 중..." : "질문 다시보기"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-center text-[11px] font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
