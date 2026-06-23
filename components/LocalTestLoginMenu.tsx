"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function canUseLocalTestLogin() {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function LocalTestLoginMenu({ nextPath }: { nextPath: string }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailable(canUseLocalTestLogin());
  }, []);

  const login = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    const response = await fetch("/api/dev/test-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextPath }),
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as
          | {
              accessToken?: string;
              refreshToken?: string;
              nextPath?: string;
              error?: string;
            }
          | null)
      : null;

    if (!response?.ok || !data?.accessToken || !data.refreshToken) {
      setError(data?.error ?? "테스트 로그인에 실패했습니다.");
      setLoading(false);
      return;
    }

    const { error: sessionError } = await createClient().auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });
    if (sessionError) {
      setError("테스트 세션을 시작하지 못했습니다.");
      setLoading(false);
      return;
    }

    window.location.assign(data.nextPath ?? "/meetings?tab=recommend");
  };

  if (!available) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="테스트 로그인 메뉴"
        aria-expanded={open}
        className="flex h-14 w-12 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-[0_12px_36px_rgba(0,0,0,0.08)] transition hover:text-black"
      >
        <ChevronDown
          size={18}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+8px)] right-0 w-44 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_16px_42px_rgba(0,0,0,0.16)]">
          <button
            type="button"
            disabled={loading}
            onClick={() => void login()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-xs font-bold text-white transition hover:bg-black/85 disabled:opacity-55"
          >
            {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
            테스트 로그인
          </button>
          {error && <p className="px-1 pt-2 text-[11px] font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
