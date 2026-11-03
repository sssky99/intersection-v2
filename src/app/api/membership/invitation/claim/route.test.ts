import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { membershipInvitationCookie, membershipInvitationHash } from "@/lib/membershipInvitationToken";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "./route";

const token = "A".repeat(43);
function request(value: string | null = token, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/membership/invitation/claim", { method: "POST", headers: {
    origin, ...(value ? { cookie: `${membershipInvitationCookie}=${value}` } : {}),
  }, body: JSON.stringify({ userId: "attacker-chosen-user", token: "attacker-chosen-token" }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "session-user" } } });
  mocks.rpc.mockResolvedValue({ data: { outcome: "granted", end_date: "2026-12-02", extended: false }, error: null });
});

describe("membership invitation claim API", () => {
  it("uses the verified session and server cookie, ignoring forged body identity", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_membership_invitation", { p_user_id: "session-user", p_token_hash: membershipInvitationHash(token) });
    expect(response.cookies.get(membershipInvitationCookie)?.value).toBe("");
    expect(await response.json()).toMatchObject({ outcome: "granted" });
  });
  it("does nothing without an invitation cookie", async () => {
    expect(await (await POST(request(null))).json()).toEqual({ outcome: "no_invitation" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("clears malformed cookies without contacting the database", async () => {
    const response = await POST(request("guessable"));
    expect(response.cookies.get(membershipInvitationCookie)?.value).toBe("");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires authentication and keeps the invitation for login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.cookies.has(membershipInvitationCookie)).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin claims", async () => {
    expect((await POST(request(token, "https://unrelated.example"))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps the cookie when signup is unfinished or the grant needs retry", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "profile_incomplete" }, error: null });
    expect((await POST(request())).cookies.has(membershipInvitationCookie)).toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "57014" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.cookies.has(membershipInvitationCookie)).toBe(false);
  });
  it.each(["already_granted", "invalid_invitation", "invitation_full"])("clears terminal invitation state: %s", async (outcome) => {
    mocks.rpc.mockResolvedValue({ data: { outcome }, error: null });
    const response = await POST(request());
    expect(response.cookies.get(membershipInvitationCookie)?.value).toBe("");
  });
});
