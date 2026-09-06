"use client";
import { useState } from "react";
import {
  ticketVisibilityLabels,
  ticketVisibilities,
  type AdminTicketInstance,
} from "@/features/admin/ticketAdminTypes";

export function TicketPublicationSettings({
  instance,
  saving,
  onSave,
}: {
  instance: AdminTicketInstance;
  saving: boolean;
  onSave: (visibility: string) => Promise<unknown>;
}) {
  const [visibility, setVisibility] = useState(instance.visibility);
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <h3 className="font-bold">티켓 공개 상태</h3>
      <p className="mt-2 text-xs text-black/50">
        일정·장소를 변경하지 않고 티켓의 노출 상태를 조정합니다.
      </p>
      <div className="mt-3 flex gap-3">
        <select
          aria-label="티켓 공개 상태"
          disabled={saving}
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as typeof visibility)
          }
          className="min-w-0 flex-1 rounded-xl border p-2"
        >
          {ticketVisibilities.map((value) => (
            <option key={value} value={value}>
              {ticketVisibilityLabels[value]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || visibility === instance.visibility}
          onClick={() => void onSave(visibility)}
          className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-30"
        >
          저장
        </button>
      </div>
    </section>
  );
}
