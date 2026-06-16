"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { samplePublicProfiles } from "@/data/samplePublicProfiles";
import { createClient } from "@/lib/supabase/client";

export function BrowseClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startProfile = async () => {
    if (saving) return;

    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient()
      .from("profiles")
      .update({ browse_seen_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      setError(
        "둘러보기 완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setSaving(false);
      return;
    }

    router.replace("/onboarding/questions");
    router.refresh();
  };

  return (
    <section className="min-h-dvh px-5 pb-32 pt-7 md:min-h-[calc(100dvh-32px)]">
      <header className="pr-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          people in intersection
        </p>
        <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-black">
          이런 식으로 서로를
          <br />
          먼저 알아볼 수 있어요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/48">
          교집합에서는 이름과 얼굴보다,
          <br />
          대화의 결이 먼저 보이도록 프로필을 만들어요.
        </p>
      </header>

      <div className="mt-7 space-y-4">
        {samplePublicProfiles.map((profile, index) => (
          <motion.article
            key={profile.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: Math.min(index, 5) * 0.05,
              duration: 0.28,
            }}
            className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-bold text-accent">
                {profile.displayName.slice(0, 2)}
              </span>
              <div>
                <p className="text-sm font-bold text-black">
                  {profile.displayName}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-black/35">
                  공개 프로필
                </p>
              </div>
            </div>

            <p className="mt-5 whitespace-pre-line text-[13px] leading-[1.85] text-black/68">
              {profile.intro}
            </p>
          </motion.article>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] bg-gradient-to-t from-white via-white to-white/0 px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-8 md:bottom-4 md:rounded-b-[32px]">
        <motion.button
          type="button"
          whileTap={!saving ? { scale: 0.98 } : undefined}
          disabled={saving}
          onClick={() => void startProfile()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white disabled:bg-black/20"
        >
          {saving ? "준비 중..." : "내 프로필 만들기"}
          {!saving && <ArrowRight size={17} aria-hidden />}
        </motion.button>
      </div>
    </section>
  );
}
