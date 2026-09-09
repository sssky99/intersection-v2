import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), auth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.auth }));
vi.mock("@/lib/funnelAnalytics", () => ({ safelyRecordServerFunnelEvent: vi.fn(async () => {}) }));

describe("application resubmission", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T00:00:00Z")); vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "user" } } }) } });
  });
  afterEach(() => vi.useRealTimers());

  function setup(status: string, membershipStartDate = "2026-08-01") {
    const updates: unknown[] = [];
    const filters: unknown[] = [];
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    mocks.admin.mockReturnValue({ rpc, from: (table: string) => {
      let writing = false;
      const q = {
        select: () => q, eq: () => q, in: (...args: unknown[]) => { filters.push(args); return q; },
        update: (value: unknown) => { writing = true; updates.push(value); return q; },
        insert: () => { throw Error("must not insert existing application"); },
        maybeSingle: async () => ({ error: null, data: table === "profiles"
          ? { membership_status: "active", membership_start_date: membershipStartDate, membership_end_date: "2026-12-31" }
          : { id: table === "meeting_events" ? "event" : "ticket", event_date: "2026-09-12", event_time: "18:00", starts_at: "18:00", visibility: "public" } }),
        returns: async () => ({ error: null, data: writing ? [] : [{ id: 10, status,
          event_id: "event", meeting_date: "2026-09-12", meeting_time: "18:00", assigned_ticket_instance_id: "ticket" }] }),
      };
      return q;
    } });
    return { rpc, updates, filters };
  }
  const request = () => new NextRequest("http://localhost/api/meeting-date-applications", {
    method: "POST", body: JSON.stringify({ dates: ["2026-09-12"], eventId: "event", ticketInstanceId: "ticket" }),
  });
  it("does not downgrade a previously approved application or participation", async () => {
    const { rpc, updates } = setup("approved");
    const { POST } = await import("./route");
    expect((await POST(request())).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled(); expect(updates).toEqual([]);
  });
  it("does not prepare another checkout before a paid membership starts when the meeting is covered", async () => {
    const { rpc } = setup("approved", "2026-09-11");
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/meeting-date-applications", {
      method: "POST", body: JSON.stringify({ dates: ["2026-09-12"], eventId: "event", ticketInstanceId: "ticket", prepareCheckout: true }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ membershipCovered: true });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns conflict when approval races a payment-pending resubmission", async () => {
    const { rpc, filters } = setup("payment_pending");
    const { POST } = await import("./route");
    expect((await POST(request())).status).toBe(409);
    expect(filters).toContainEqual(["status", ["payment_pending", "cancelled"]]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
