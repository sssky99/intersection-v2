"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const communityGuidelines = [
  { icon: "🍷", text: "과한 음주 권유를 하지 않기" },
  { icon: "💬", text: "노골적인 이성 목적의 접근을 하지 않기" },
  { icon: "🛑", text: "상대가 불편해하는 질문을 반복하지 않기" },
  { icon: "⏰", text: "시간 약속을 가볍게 여기지 않기" },
  { icon: "📵", text: "모임 후 원치 않는 연락을 강요하지 않기" },
];

export function GuidelinesAgreement({ userId }: { userId: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    if (!checked || saving) return;

    setSaving(true);
    setError(null);
    const { error: saveError } = await createClient()
      .from("profiles")
      .update({
        meeting_guidelines_agreed: true,
        meeting_guidelines_agreed_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (saveError) {
      setError("동의 상태를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    router.replace("/meetings");
    router.refresh();
  };

  return (
    <section className="flex min-h-dvh flex-col px-5 pb-6 pt-7 md:min-h-[calc(100dvh-32px)]">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          community guide
        </p>
        <h1 className="mt-2 text-[27px] font-bold leading-9 tracking-tight text-black">
          편안한 자리를 위한 약속을
          <br />
          확인해주세요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-black/48">
          교집합은 모두가 편하게 대화할 수 있는 분위기를 중요하게 생각해요.
          아래 원칙에 동의해야 초대장을 추천받을 수 있습니다.
        </p>
      </header>

      <div className="mt-7 space-y-2.5">
        {communityGuidelines.map((guideline) => (
          <div
            key={guideline.text}
            className="flex items-center gap-3 rounded-[18px] border border-black/8 bg-white px-4 py-3.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-base">
              {guideline.icon}
            </span>
            <p className="text-sm font-semibold leading-5 text-black/68">
              {guideline.text}
            </p>
          </div>
        ))}
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[18px] border border-black/10 bg-black/[0.02] px-4 py-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1 h-4 w-4 accent-black"
        />
        <span className="text-xs font-semibold leading-5 text-black/60">
          위 원칙을 확인했고, 교집합의 편안한 분위기를 함께 지키는 데
          동의합니다.
        </span>
      </label>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">
          {error}
        </p>
      )}

      <motion.button
        type="button"
        whileTap={checked && !saving ? { scale: 0.98 } : undefined}
        disabled={!checked || saving}
        onClick={() => void agree()}
        className={`mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
          checked && !saving
            ? "bg-black text-white"
            : "bg-black/[0.06] text-black/30"
        }`}
      >
        <Check size={16} aria-hidden />
        {saving ? "저장 중..." : "동의하고 날짜 선택하기"}
      </motion.button>
    </section>
  );
}
