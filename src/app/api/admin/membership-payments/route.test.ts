import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  handle: vi.fn(),
  audit: vi.fn(),
  updates: vi.fn(),
  event: null as any,
}));
vi.mock("@/lib/adminAuth", () => ({
  ADMIN_SESSION_COOKIE: "admin_session",
  isAdminSessionTokenValid: mocks.auth,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/server/payments/grobleDelivery", () => ({
  handleVerifiedGrobleWebhook: mocks.handle,
}));
import { GET, POST } from "./route";
const request = (body: object) =>
  new NextRequest("http://localhost/api/admin/membership-payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(true);
  mocks.event = {
    event_id: "stored-event",
    event_type: "subscription_payment.completed",
    idempotency_key: "original-key",
    processing_status: "failed",
    payload: {
      id: "stored-event",
      type: "subscription_payment.completed",
      data: { object: { pricing: { finalAmount: 10000 } } },
    },
  };
  mocks.handle.mockImplementation(async () =>
    Response.json({ ok: true, status: "processed" }),
  );
  mocks.from.mockImplementation((table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      insert: (value: unknown) => {
        mocks.audit(value);
        return q;
      },
      update: (value: unknown) => {
        mocks.updates(value);
        return q;
      },
      maybeSingle: async () => ({ data: mocks.event, error: null }),
      single: async () => ({ data: { id: 1 }, error: null }),
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return q;
  });
});
describe("membership payment retry authorization", () => {
  it("blocks unauthenticated reads and reprocessing", async () => {
    mocks.auth.mockReturnValue(false);
    expect((await GET(new NextRequest("http://localhost"))).status).toBe(401);
    expect((await POST(request({ eventId: "stored-event" }))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.handle).not.toHaveBeenCalled();
  });
  it.each(["processed", "unmatched", "ambiguous"])(
    "does not replay %s events",
    async (status) => {
      mocks.event.processing_status = status;
      expect((await POST(request({ eventId: "stored-event" }))).status).toBe(
        409,
      );
      expect(mocks.handle).not.toHaveBeenCalled();
    },
  );
  it("reprocesses only the stored verified payload under its original key and records the attempt", async () => {
    expect(
      (
        await POST(
          request({ eventId: "stored-event", payload: { userId: "injected" } }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.handle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "stored-event",
        object: { pricing: { finalAmount: 10000 } },
      }),
      "original-key",
    );
    expect(mocks.audit).toHaveBeenCalledWith({ event_id: "stored-event" });
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.handle.mock.invocationCallOrder[0],
    );
    expect(mocks.updates).toHaveBeenCalledWith({ response_status: 200 });
  });
  it("records unsuccessful processing attempts too", async () => {
    mocks.handle.mockResolvedValue(
      Response.json({ error: "busy" }, { status: 503 }),
    );
    expect((await POST(request({ eventId: "stored-event" }))).status).toBe(503);
    expect(mocks.updates).toHaveBeenCalledWith({ response_status: 503 });
  });
  it("does not reuse the membership retry path for other payment types", async () => {
    mocks.event.event_type = "payment.completed";
    expect((await POST(request({ eventId: "stored-event" }))).status).toBe(409);
    expect(mocks.handle).not.toHaveBeenCalled();
  });
});
