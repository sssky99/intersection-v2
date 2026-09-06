import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({
  ADMIN_SESSION_COOKIE: "admin_session",
  isAdminSessionTokenValid: mocks.authorized,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
import { GET, POST, PATCH } from "./route";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const req = (method: string, body?: object) =>
  new NextRequest("http://localhost/api/admin/blind-dates", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized.mockReturnValue(true);
  mocks.from.mockImplementation(() => {
    const q: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "lt", "in", "or", "eq"])
      q[method] = vi.fn(() => q);
    q.insert = mocks.insert.mockReturnValue(q);
    q.update = mocks.update.mockReturnValue(q);
    q.returns = vi.fn(async () => ({ data: [], error: null }));
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return q;
  });
});
describe("manual blind date administration", () => {
  it("requires admin authorization for reads and writes", async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await GET(req("GET"))).status).toBe(401);
    expect((await POST(req("POST", {}))).status).toBe(401);
    expect((await PATCH(req("PATCH", {}))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("creates a real invitation without a template or feedback pair", async () => {
    const result = await POST(
      req("POST", {
        action: "create_offer",
        participantAId: a,
        participantBId: b,
        timeLabel: "오후 7시",
        region: "을지로",
        reservationName: "교집합",
      }),
    );
    expect(result.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: null,
        participant_a_id: a,
        participant_b_id: b,
        status: "offered",
        reservation_name: "교집합",
        source_type: "test",
      }),
    );
    expect(mocks.from.mock.calls.flat()).not.toContain("meeting_feedback");
  });
  it("rejects selecting the same person twice", async () => {
    expect(
      (
        await POST(
          req("POST", {
            action: "create_offer",
            participantAId: a,
            participantBId: a,
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("retired template actions cannot write", async () => {
    for (const action of [
      "create_template",
      "duplicate_template",
      "delete_template",
    ])
      expect((await POST(req("POST", { action }))).status).toBe(400);
    expect(
      (await PATCH(req("PATCH", { entity: "template", id: a, title: "old" })))
        .status,
    ).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("saves the entered reservation name without changing an existing status", async () => {
    expect(
      (
        await PATCH(
          req("PATCH", {
            entity: "offer",
            id: a,
            reservationName: "교집합",
            actualPlaceName: "파스타 마켓",
          }),
        )
      ).status,
    ).toBe(200);
    const patch = mocks.update.mock.calls[0][0];
    expect(patch).toMatchObject({
      reservation_name: "교집합",
      actual_place_name: "파스타 마켓",
    });
    expect(patch).not.toHaveProperty("status");
  });
  it("does not fetch old feedback and candidate event data", async () => {
    const response = await GET(req("GET"));
    expect(await response.json()).toEqual({ offers: [], profiles: [] });
    expect(mocks.from.mock.calls.flat()).not.toEqual(
      expect.arrayContaining(["meeting_feedback"]),
    );
    expect(mocks.from.mock.calls.flat()).not.toContain("ticket_instances");
  });
});
