"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BlindDateAdminOffer,
  BlindDateAdminProfile,
} from "@/types/blindDate";
import { CreateBlindDateForm } from "./blindDates/CreateBlindDateForm";
import { BlindDateOfferList } from "./blindDates/BlindDateOfferList";

type AdminData = {
  offers: BlindDateAdminOffer[];
  profiles: BlindDateAdminProfile[];
};

async function request(
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, unknown>,
): Promise<AdminData> {
  const response = await fetch("/api/admin/blind-dates", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data?.error ?? "처리하지 못했습니다. 다시 시도해주세요.");
  return data;
}

export function BlindDateAdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const reload = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      setData(await request("GET"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "불러오지 못했습니다.");
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      setData(await request(method, body));
      setNotice(
        method === "POST"
          ? "초대장을 생성했습니다. 참가자 사이트에서 확인할 수 있습니다."
          : "변경 내용을 저장했습니다.",
      );
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장하지 못했습니다.");
      return false;
    } finally {
      setSaving(false);
      busy.current = false;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">블라인드 데이트</h2>
          <p className="mt-1 text-sm text-black/50">
            두 사람을 선택해 초대하고, 일정과 장소를 관리하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void reload()}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
          >
            새로고침
          </button>
          <button
            type="button"
            disabled={!data || loading || saving}
            onClick={() => setCreating(!creating)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {creating ? "생성 닫기" : "+ 데이트 만들기"}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {creating && data && (
        <CreateBlindDateForm
          profiles={data.profiles}
          saving={saving || loading}
          onCreate={async (body) => {
            if (await save("POST", { action: "create_offer", ...body }))
              setCreating(false);
          }}
        />
      )}
      {loading && !data && (
        <p className="p-6 text-sm text-black/50">불러오는 중입니다.</p>
      )}
      {data && (
        <BlindDateOfferList
          offers={data.offers}
          saving={saving || loading}
          onUpdate={(id, patch) =>
            save("PATCH", { entity: "offer", id, ...patch })
          }
        />
      )}
    </div>
  );
}
