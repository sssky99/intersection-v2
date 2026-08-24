"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PrivacyBackButton() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goBack = () => {
    if (searchParams.get("from") === "account") {
      router.push("/meetings?tab=profile&account=1");
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/meetings?tab=profile");
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-xs font-bold text-black/55 transition hover:border-black/20 hover:text-black"
    >
      ← 이전으로
    </button>
  );
}
