import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { membershipInvitationCookie } from "@/lib/membershipInvitationToken";
const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/membershipInvitation", () => ({ findMembershipInvitation: lookup }));
import { GET } from "./route";
const token = "A".repeat(43);
beforeEach(() => { lookup.mockReset(); lookup.mockImplementation(async (value) => value === token ? { id: "same-invitation" } : null); vi.stubEnv("MEMBERSHIP_INVITATION_SHORT_LINK_TOKEN", token); });
afterEach(() => vi.unstubAllEnvs());

it("uses the same invitation token and cookie as the full link, without exposing it in the redirect URL", async () => {
  const response = await GET(new NextRequest("https://example.com/gift?token=attacker-value"));
  expect(lookup).toHaveBeenCalledWith(token);
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://example.com/special-invitation");
  expect(response.cookies.get(membershipInvitationCookie)).toMatchObject({ value: token, httpOnly: true, sameSite: "lax", secure: true });
});
it("fails closed if the short link is not configured", async () => {
  vi.stubEnv("MEMBERSHIP_INVITATION_SHORT_LINK_TOKEN", "");
  const response = await GET(new NextRequest("https://example.com/gift"));
  expect(response.status).toBe(404);
  expect(response.cookies.has(membershipInvitationCookie)).toBe(false);
});
it("cannot bypass expiration, revocation or the invitation capacity", async () => {
  lookup.mockResolvedValue(null);
  const response = await GET(new NextRequest("https://example.com/gift"));
  expect(response.status).toBe(404);
  expect(response.cookies.has(membershipInvitationCookie)).toBe(false);
});
