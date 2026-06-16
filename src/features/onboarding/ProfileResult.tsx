"use client";

import { motion } from "framer-motion";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DevOnboardingActions } from "@/features/onboarding/DevOnboardingActions";

type GenerateResponse = {
  intro?: string;
  notice?: string;
  error?: string;
};

export function ProfileResult({
  displayName,
  initialIntro,
  generateOnLoad,
  isDevelopment,
}: {
  displayName: string;
  initialIntro: string | null;
  generateOnLoad: boolean;
  isDevelopment: boolean;
}) {
  const router = useRouter();
  const [intro, setIntro] = useState(initialIntro);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(generateOnLoad);

  const generateIntro = (force = false) => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    return fetch("/api/profile/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    })
      .then(async (response) => {
        const body = (await response.json()) as GenerateResponse;
        if (!response.ok) throw new Error(body.error || "생성에 실패했어요.");
        return body;
      })
      .then((body) => {
        setIntro(body.intro ?? null);
        setNotice(body.notice ?? null);
      })
      .catch(() => {
        setError("프로필을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => setGenerating(false));
  };

  useEffect(() => {
    if (!generateOnLoad) return;
    void generateIntro();
    // The initial generation should run once for this result screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateOnLoad]);

  return (
    <section className="flex min-h-dvh flex-col px-5 pb-6 pt-8 md:min-h-[calc(100dvh-32px)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
        <Sparkles size={21} aria-hidden />
      </div>
      <h1 className="mt-5 text-[28px] font-bold leading-9 tracking-tight text-black">
        {displayName}님의 프로필이
        <br />
        만들어졌어요!
      </h1>
      <p className="mt-3 text-sm leading-6 text-black/48">
        이제 나에게 맞는 날짜와 자리를 확인할 수 있어요. 마음에 드는
        초대장이 있으면 Yes를 눌러 대기열에 등록해주세요.
      </p>

      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-[26px] border border-black/10 bg-white p-6 shadow-[0_16px_46px_rgba(0,0,0,0.06)]"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          public profile
        </p>
        {intro ? (
          <p className="mt-4 whitespace-pre-line text-[14px] leading-7 text-black/72">
            {intro}
          </p>
        ) : error ? (
          <p className="mt-4 text-sm leading-6 text-red-600">{error}</p>
        ) : (
          <div className="mt-5 space-y-3">
            {[100, 92, 78, 96, 84, 70].map((width, index) => (
              <motion.div
                key={width}
                animate={{ opacity: [0.25, 0.65, 0.25] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: index * 0.08,
                }}
                className="h-3 rounded-full bg-black/8"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        )}
      </motion.article>

      {notice && (
        <p className="mt-3 rounded-2xl bg-accent/[0.08] px-4 py-3 text-[11px] leading-5 text-black/48">
          {notice}
        </p>
      )}

      {isDevelopment && (
        <button
          type="button"
          disabled={generating}
          onClick={() => void generateIntro(true)}
          className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full border border-black/10 text-xs font-semibold text-black/50 transition hover:border-black/20 hover:text-black disabled:opacity-40"
        >
          <RotateCcw
            size={14}
            aria-hidden
            className={generating ? "animate-spin" : ""}
          />
          {generating ? "프로필 다시 만드는 중..." : "개발용 프로필 재생성"}
        </button>
      )}

      <motion.button
        type="button"
        whileTap={intro ? { scale: 0.98 } : undefined}
        disabled={!intro}
        onClick={() => router.push("/meetings")}
        className="mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-semibold text-white disabled:bg-black/[0.08] disabled:text-black/30"
      >
        나에게 맞는 자리 확인하기
        <ArrowRight size={17} aria-hidden />
      </motion.button>

      <DevOnboardingActions enabled={isDevelopment} />
    </section>
  );
}
