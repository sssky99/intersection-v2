import { describe, expect, it, vi } from "vitest";
import { createAdminClient, webhookScope } from "./grobleContext";
const client = vi.hoisted(() => vi.fn((options) => options));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: client }));
vi.mock("server-only", () => ({}));
describe("payment request isolation", () => {
  it("keeps cancellation and claim ownership separate for overlapping deliveries", async () => {
    const a = new AbortController(),
      b = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = webhookScope.run(
      { token: "a", signal: a.signal },
      async () => {
        await gate;
        expect(webhookScope.getStore()?.token).toBe("a");
        createAdminClient();
        expect(client).toHaveBeenLastCalledWith({
          timeoutMs: 10000,
          signal: a.signal,
        });
      },
    );
    await webhookScope.run({ token: "b", signal: b.signal }, async () => {
      await Promise.resolve();
      a.abort();
      createAdminClient();
      expect(client).toHaveBeenLastCalledWith({
        timeoutMs: 10000,
        signal: b.signal,
      });
      expect(b.signal.aborted).toBe(false);
    });
    release();
    await first;
    expect(webhookScope.getStore()).toBeUndefined();
  });
});
