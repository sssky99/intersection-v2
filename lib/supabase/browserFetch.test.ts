import { afterEach, expect, it, vi } from "vitest";
import { createBrowserSupabaseFetch } from "./browserFetch";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("keeps token refresh alive past an analytics timeout while still limiting data requests", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")));
  })));
  const fetcher = createBrowserSupabaseFetch(2000);
  let authAborted = false, dataAborted = false;
  const auth = fetcher("https://example.supabase.co/auth/v1/token").catch(() => { authAborted = true; });
  const data = fetcher("https://example.supabase.co/rest/v1/rpc/analytics").catch(() => { dataAborted = true; });
  await vi.advanceTimersByTimeAsync(2100);
  expect(dataAborted).toBe(true);
  expect(authAborted).toBe(false);
  await vi.advanceTimersByTimeAsync(12900);
  await Promise.all([auth, data]);
  expect(authAborted).toBe(true);
});
