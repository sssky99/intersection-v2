"use client";

import { RefreshCw, ShieldBan, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

type LoginBlock = {
  phone_normalized: string;
  display_name: string | null;
  user_id: string | null;
  reason: string | null;
  blocked_at: string;
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatBlockedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LoginBlocklistAdminPanel() {
  const [blocks, setBlocks] = useState<LoginBlock[]>([]);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingPhone, setRemovingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login-blocklist", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | { blocks?: LoginBlock[]; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "차단 목록을 불러오지 못했습니다.");
      setBlocks(data?.blocks ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "차단 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const addBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/login-blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, displayName, reason }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "로그인 차단을 적용하지 못했습니다.");
      setPhone("");
      setDisplayName("");
      setReason("");
      setNotice("번호를 차단했습니다. 기존 로그인 세션도 즉시 종료됩니다.");
      await loadBlocks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "로그인 차단을 적용하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (block: LoginBlock) => {
    if (removingPhone) return;
    const label = block.display_name?.trim() || formatPhone(block.phone_normalized);
    if (!window.confirm(`${label}의 로그인 차단을 해제할까요?`)) return;

    setRemovingPhone(block.phone_normalized);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/login-blocklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: block.phone_normalized }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "로그인 차단을 해제하지 못했습니다.");
      setNotice("로그인 차단을 해제했습니다.");
      await loadBlocks();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "로그인 차단을 해제하지 못했습니다.");
    } finally {
      setRemovingPhone(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldBan size={20} aria-hidden />
              <h2 className="text-lg font-bold">로그인 차단</h2>
            </div>
            <p className="mt-2 text-sm font-medium text-black/50">
              번호를 등록하면 신규 로그인과 현재 로그인 중인 계정의 접근을 즉시 차단합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBlocks()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 px-3 text-sm font-semibold text-black/60 disabled:opacity-40"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />
            새로고침
          </button>
        </div>

        <form onSubmit={addBlock} className="mt-5 grid gap-3 md:grid-cols-[1.2fr_1fr_1.5fr_auto]">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="010-0000-0000"
            aria-label="차단할 전화번호"
            required
            className="h-11 rounded-xl border border-black/10 bg-[#f7f7f5] px-4 text-sm outline-none focus:border-black/30"
          />
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="이름 (선택)"
            aria-label="이름"
            className="h-11 rounded-xl border border-black/10 bg-[#f7f7f5] px-4 text-sm outline-none focus:border-black/30"
          />
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="차단 사유 (선택)"
            aria-label="차단 사유"
            className="h-11 rounded-xl border border-black/10 bg-[#f7f7f5] px-4 text-sm outline-none focus:border-black/30"
          />
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-black px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? "차단 중..." : "즉시 차단"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        {notice && <p className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 px-5 py-4">
          <h3 className="font-bold">차단 목록 · {blocks.length}명</h3>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-sm font-medium text-black/45">불러오는 중...</p>
        ) : blocks.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm font-medium text-black/45">차단된 번호가 없습니다.</p>
        ) : (
          <div className="divide-y divide-black/5">
            {blocks.map((block) => (
              <div key={block.phone_normalized} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{block.display_name?.trim() || "이름 미입력"}</p>
                    <p className="text-sm font-semibold text-black/55">{formatPhone(block.phone_normalized)}</p>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">
                      {block.user_id ? "기존 계정 차단" : "번호 차단"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-black/45">
                    {block.reason?.trim() || "사유 미입력"} · {formatBlockedAt(block.blocked_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeBlock(block)}
                  disabled={removingPhone === block.phone_normalized}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-40"
                >
                  <Trash2 size={14} aria-hidden />
                  {removingPhone === block.phone_normalized ? "해제 중..." : "차단 해제"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
