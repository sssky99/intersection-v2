"use client";
import { useEffect, useState } from "react";
import { hasColorHuntingStarted } from "./availability";
export function useColorHuntingStarted(startsAt: string) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [startsAt]);
  return hasColorHuntingStarted(startsAt, now);
}
