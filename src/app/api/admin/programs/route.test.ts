import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { programDraft, programPayload } from "@/features/admin/programDraft";
const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({
  ADMIN_SESSION_COOKIE: "admin",
  isAdminSessionTokenValid: mocks.authorized,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
import { GET, POST } from "./route";
const req = (body?: unknown) =>
  new NextRequest(
    "http://localhost/api/admin/programs",
    body ? { method: "POST", body: JSON.stringify(body) } : {},
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized.mockReturnValue(true);
  const q: Record<string, unknown> = {};
  for (const key of ["select", "eq", "order"]) q[key] = vi.fn(() => q);
  q.insert = mocks.insert.mockReturnValue(q);
  q.single = vi.fn(async () => ({ data: { id: "new-program" }, error: null }));
  mocks.from.mockReturnValue(q);
});
describe("program revisions", () => {
  it("requires administrator authorization before querying or saving", async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await GET(req())).status).toBe(401);
    expect((await POST(req({}))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("creates only a new template; never changes events, tickets or the source", async () => {
    const draft = { ...programDraft(), title: "New program" };
    const result = await POST(
      req({ draft, eventDate: "2026-09-09", instanceId: "old-ticket" }),
    );
    expect(result.status).toBe(200);
    expect(mocks.from.mock.calls).toEqual([["ticket_templates"]]);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New program",
        template_kind: "experience",
      }),
    );
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("event_date");
  });
  it("rejects incomplete drafts without writes", async () => {
    expect(
      (await POST(req({ draft: { title: "Valid", steps: [] } }))).status,
    ).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("retains source recommendation settings while inserting an independent revision", async () => {
    const q = mocks.from();
    q.single.mockResolvedValueOnce({ data: { mood_tags: ["대화"], recommendation_preferred_activities: ["여행"] }, error: null });
    mocks.from.mockClear();
    expect((await POST(req({ sourceId: "original-program", draft: { ...programDraft(), title: "Revision" } }))).status).toBe(200);
    expect(mocks.from.mock.calls).toEqual([["ticket_templates"], ["ticket_templates"]]);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ title: "Revision", mood_tags: ["대화"], recommendation_preferred_activities: ["여행"] }));
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("id");
  });
  it("strips venue, timing, reservation and identity fields even when supplied", () => {
    const draft = { ...programDraft(), title: "Dinner" };
    const payload = programPayload({
      ...draft,
      id: "old",
      visibility: "public",
      event_date: "2026-09-09",
      steps: draft.steps.map((s) => ({
        ...s,
        placeName: "Old venue",
        reservationName: "Private",
        openOffsetMinutes: 999,
      })),
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload.visibility).toBe("draft");
    expect(payload.course_steps[0]).toMatchObject({
      placeName: null,
      reservationName: null,
      openOffsetMinutes: 0,
    });
  });
});
