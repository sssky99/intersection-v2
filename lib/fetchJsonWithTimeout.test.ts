import { afterEach, expect, it, vi } from "vitest";
import { fetchJsonWithTimeout } from "./fetchJsonWithTimeout";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["headers", "body"])("unlocks caller finally on stalled %s and permits retry", async (stage) => {
  vi.useFakeTimers();
  const never = () => new Promise<Response>(() => {});
  const fetchMock = vi.fn<typeof fetch>(stage === "headers" ? never : async () => ({
    json: () => new Promise(() => {}),
  } as unknown as Response));
  vi.stubGlobal("fetch", fetchMock);
  let saving = true;
  const operation = fetchJsonWithTimeout("/api/profile/onboarding/import", { method: "POST" })
    .finally(() => { saving = false; });
  const assertion = expect(operation).rejects.toThrow("요청 시간이 초과");
  await vi.advanceTimersByTimeAsync(15000);
  await assertion;
  expect(saving).toBe(false);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  fetchMock.mockImplementation(async () => new Response('{"ok":true}'));
  const retry = await fetchJsonWithTimeout<{ ok: boolean }>("/api/profile/onboarding/import", { method: "POST" });
  expect(retry.body?.ok).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves HTTP errors for caller recovery and clears its timer", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"existing":true}', { status: 409 })));
  const result = await fetchJsonWithTimeout<{ existing: boolean }>("/api/profile/onboarding/import", {});
  expect(result.response.status).toBe(409);
  expect(result.body?.existing).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
