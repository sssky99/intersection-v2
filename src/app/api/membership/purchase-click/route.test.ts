import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  concurrentPayment: false,
  filter: "",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "member" } } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: [{ intent_id: 1 }], error: null }),
    from: (table: string) => {
      let patch: Record<string, unknown> | undefined;
      let filter = "";
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        returns: async () => ({ data: [], error: null }),
        update: (value: Record<string, unknown>) => { patch = value; return query; },
        or: (value: string) => { filter = value; state.filter = value; return query; },
        then: (resolve: (value: unknown) => unknown) => {
          if (table === "profiles" && patch) {
            if (state.concurrentPayment) state.profile.membership_status = "active";
            if (!filter || state.profile.membership_status !== "active") Object.assign(state.profile, patch);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

import { POST } from "./route";

async function purchase(plan = "one_month") {
  return POST(new NextRequest("http://localhost/api/membership/purchase-click", {
    method: "POST", body: JSON.stringify({ plan }),
    headers: { "content-type": "application/json" },
  }));
}

describe("membership checkout preserves paid access", () => {
  beforeEach(() => {
    state.profile = {
      membership_status: "active", membership_plan: "one_month",
      membership_start_date: "2099-09-09", membership_end_date: "2099-10-08",
      membership_updated_at: "paid-at",
    };
    state.concurrentPayment = false;
    state.filter = "";
  });

  it.each(["one_month", "three_months", "six_months"])("preserves paid future-start membership on %s checkout", async (plan) => {
    const before = { ...state.profile };
    expect((await purchase(plan)).status).toBe(200);
    expect(state.profile).toEqual(before);
    expect(state.filter).toBe("membership_status.is.null,membership_status.neq.active");
  });

  it.each([null, "none", "pending", "expired", "cancelled"])("still records pending checkout for %s", async (status) => {
    state.profile.membership_status = status;
    expect((await purchase()).status).toBe(200);
    expect(state.profile.membership_status).toBe("pending");
  });

  it("does not overwrite a payment completed concurrently", async () => {
    state.profile.membership_status = "pending";
    state.concurrentPayment = true;
    expect((await purchase()).status).toBe(200);
    expect(state.profile.membership_status).toBe("active");
  });
});
