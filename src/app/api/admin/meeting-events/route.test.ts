import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({
  ADMIN_SESSION_COOKIE: "admin",
  isAdminSessionTokenValid: mocks.auth,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
import { GET, POST, PATCH } from "./route";
const req = (body?: object) =>
  new NextRequest(
    "http://localhost/api/admin/meeting-events",
    body ? { method: "POST", body: JSON.stringify(body) } : {},
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({ data: "event-id", error: null });
  const q: Record<string, unknown> = {};
  for (const k of ["select", "order", "not", "in", "eq"]) q[k] = vi.fn(() => q);
  q.returns = vi.fn(async () => ({ data: [], error: null }));
  mocks.from.mockReturnValue(q);
});
describe("standalone event administration", () => {
  it("requires admin authorization", async () => {
    mocks.auth.mockReturnValue(false);
    expect((await GET(req())).status).toBe(401);
    expect((await POST(req({ action: "create_event" }))).status).toBe(401);
    expect((await PATCH(req({ eventId: "id" }))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("creates an event without asking for or querying programs", async () => {
    const response = await POST(
      req({
        action: "create_event",
        title: "Dinner",
        eventDate: "2026-09-30",
        startsAt: "18:00",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_standalone_meeting_event",
      expect.objectContaining({
        p_title: "Dinner",
        p_snapshot: expect.objectContaining({ courseSteps: expect.any(Array) }),
      }),
    );
    expect(mocks.from.mock.calls.flat()).not.toContain("ticket_templates");
    expect((await response.json()).createdEventId).toBe("event-id");
  });
  it("rejects an incomplete event before creating anything", async () => {
    expect(
      (
        await POST(
          req({
            action: "create_event",
            eventDate: "2026-09-30",
            startsAt: "18:00",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("updates only event copy instead of replacing a stale journey snapshot", async () => {
    expect(
      (
        await PATCH(
          req({
            action: "update_copy",
            eventId: "event-id",
            stageCopy: { applied: "Hello" },
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_event_stage_copy",
      expect.objectContaining({
        p_event_id: "event-id",
        p_copy: expect.objectContaining({ applied: "Hello" }),
      }),
    );
  });
});
