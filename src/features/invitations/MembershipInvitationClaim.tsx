"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MembershipInvitationNotice } from "./MembershipInvitationNotice";

export function MembershipInvitationClaim({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const claim = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/membership/invitation/claim", { method: "POST", signal });
      const body = await response.json();
      if (!response.ok) throw new Error("Claim failed");
      if (body.outcome === "granted") {
        setMessage(body.extended ? "초대 혜택으로 멤버십이 1개월 연장됐어요." : "초대 혜택으로 1개월 무료 멤버십이 시작됐어요.");
      } else if (body.outcome === "invalid_invitation" || body.outcome === "invitation_full") {
        setMessage("이 초대장의 혜택이 종료됐어요.");
      }
      if (body.outcome !== "profile_incomplete") router.refresh();
    } catch {
      if (signal?.aborted) return;
      setFailed(true);
      setMessage("초대 혜택을 적용하지 못했어요. 다시 시도해주세요.");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    void claim(controller.signal);
    return () => controller.abort();
  }, [pending, claim]);

  return (
    <MembershipInvitationNotice message={message} failed={failed} busy={busy} onClose={() => setMessage("")} onRetry={() => void claim()} />
  );
}
