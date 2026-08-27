"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FeedbackAccountSwitchButton({
  returnPath,
}: {
  returnPath: string;
}) {
  const [switching, setSwitching] = useState(false);

  const switchAccount = async () => {
    if (switching) return;
    setSwitching(true);

    const { error } = await createClient().auth.signOut();
    if (error) {
      setSwitching(false);
      return;
    }

    window.location.replace(returnPath);
  };

  return (
    <button
      type="button"
      disabled={switching}
      onClick={() => void switchAccount()}
      className="mt-3 inline-flex h-11 items-center justify-center rounded-full border border-black/12 px-5 text-sm font-black text-[#24211d] disabled:opacity-45"
    >
      {switching ? "로그아웃 중이에요" : "다른 전화번호로 로그인"}
    </button>
  );
}
