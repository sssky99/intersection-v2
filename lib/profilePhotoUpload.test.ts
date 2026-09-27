import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({
    upload: async () => ({ error: null }),
  }) } }),
}));

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function startUpload(fetchMock: ReturnType<typeof vi.fn>) {
  vi.useFakeTimers();
  // A small original image is retained when browser decoding is unavailable.
  vi.stubGlobal("Image", class { decode() { return Promise.reject(new Error("decode unavailable")); } });
  vi.stubGlobal("fetch", fetchMock);
  const { uploadProfilePhoto } = await import("./profilePhoto");
  let state = "pending";
  const result = uploadProfilePhoto("diagnostic-user", new File(["photo"], "photo.jpg", { type: "image/jpeg" }))
    .then(() => { state = "success"; }, () => { state = "error"; });
  await vi.advanceTimersByTimeAsync(60_000);
  return { state: () => state, result };
}

it("completes when storage and finalization return", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ photoUrl: "https://example.test/photo.jpg" })));
  const operation = await startUpload(fetchMock);
  await operation.result;
  expect(operation.state()).toBe("success");
});

it("releases the upload after bounded retries when finalization never responds", async () => {
  const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
  const operation = await startUpload(fetchMock);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(operation.state()).toBe("error");
});

it("releases the upload when finalization response body never finishes", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }));
  const operation = await startUpload(fetchMock);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(operation.state()).toBe("error");
});
