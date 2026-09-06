import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/metaConversions", () => ({ reportMetaPurchase: vi.fn(async () => {}) }));

function request(type = "unsupported.event", object: object = {}) {
  const body = JSON.stringify({ id: "event-1", type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return new Request("http://localhost/api/webhooks/groble", {
    method: "POST", body, headers: {
      "x-groble-timestamp": timestamp, "x-groble-idempotency-key": "redelivery-key",
      "x-groble-signature": createHmac("sha256", "test-secret").update(`${timestamp}.${body}`).digest("hex"),
    },
  });
}

describe("webhook redelivery", () => {
  beforeEach(() => { vi.stubEnv("GROBLE_WEBHOOK_SECRET", "test-secret"); vi.clearAllMocks(); });
  afterEach(() => vi.unstubAllEnvs());

  function client(outcome: string, statusWriteFails = false) {
    const q = {
      insert: vi.fn(async () => ({ error: { code: "23505" } })),
      update: vi.fn(() => q), eq: vi.fn(() => q),
      select: vi.fn(async () => ({ data: statusWriteFails ? null : [{ id: 1 }], error: statusWriteFails ? { message: "DB unavailable" } : null })),
    };
    const rpc = vi.fn(async () => ({ data: [{ outcome, event_key: "stored-key" }], error: null }));
    createAdminClientMock.mockReturnValue({ from: vi.fn(() => q), rpc });
    return { q, rpc };
  }

  it.each([["busy", 503], ["conflict", 409], ["done", 200]])("returns %s without acknowledging unfinished work", async (outcome, status) => {
    const { q } = client(outcome as string);
    const { POST } = await import("./route");
    expect((await POST(request())).status).toBe(status);
    expect(q.update).not.toHaveBeenCalled();
  });
  it("resumes a received event under the original key and fences status updates", async () => {
    const { q, rpc } = client("claimed");
    const { POST } = await import("./route");
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("claim_groble_webhook_event", expect.objectContaining({ p_event_id: "event-1" }));
    expect(q.eq).toHaveBeenCalledWith("idempotency_key", "stored-key");
    expect(q.eq).toHaveBeenCalledWith("processing_token", expect.any(String));
    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ processing_status: "ignored" }));
  });
  it("returns failure when the resumed operation cannot be saved", async () => {
    client("claimed", true);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { POST } = await import("./route");
      expect((await POST(request())).status).toBe(500);
    } finally { errorLog.mockRestore(); }
  });
  it("recovers a partly recorded one-time payment without rematching a pending checkout", async () => {
    const applicationWrites: Array<{ value: Record<string, unknown>; filters: unknown[][] }> = [];
    const rpc = vi.fn(async () => ({ data: [{ outcome: "claimed", event_key: "stored-key" }], error: null }));
    mocksForRecovery();
    function mocksForRecovery() {
      createAdminClientMock.mockReturnValue({ rpc, from: (table: string) => {
        const filters: unknown[][] = [];
        const result = { data: table === "groble_webhook_events" ? [{ id: 1 }] : [], error: null };
        const q = {
          insert: async () => ({ error: { code: "23505" } }),
          select: () => q, eq: (...args: unknown[]) => { filters.push(args); return q; },
          in: (...args: unknown[]) => { filters.push(args); return q; },
          not: () => q, order: () => q, limit: () => q,
          maybeSingle: async () => ({ error: null, data: table === "payment_transactions"
            ? { user_id: "user-1", application_group_id: "group-1" } : null }),
          upsert: () => q,
          update: (value: Record<string, unknown>) => {
            if (table === "meeting_date_applications") applicationWrites.push({ value, filters });
            return q;
          },
          returns: async () => result,
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        return q;
      } });
    }
    const { POST } = await import("./route");
    const response = await POST(request("payment.completed", { pricing: { finalAmount: 20000 } }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(applicationWrites[0].value).not.toHaveProperty("status");
    expect(applicationWrites[1].filters).toContainEqual(["status", "payment_pending"]);
  });
});
