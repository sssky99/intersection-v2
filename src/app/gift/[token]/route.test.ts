import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { membershipInvitationCookie } from "@/lib/membershipInvitationToken";
const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/membershipInvitation", () => ({ findMembershipInvitation: lookup }));
import { GET } from "./route";
const token = "A".repeat(43);
beforeEach(() => { lookup.mockReset(); lookup.mockResolvedValue({ id: "invitation" }); });

it("retains anonymous invitation context in an HttpOnly cookie across signup and OAuth", async () => {
  const response = await GET(new NextRequest(`https://example.com/gift/${token}?next=https://unrelated.example`), { params: Promise.resolve({ token }) });
  expect(response.headers.get("location")).toBe("https://example.com/special-invitation");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.cookies.get(membershipInvitationCookie)).toMatchObject({ value: token, httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 2592000 });
});
it("does not persist unknown or expired invitation links", async () => {
  lookup.mockResolvedValue(null);
  const response = await GET(new NextRequest(`https://example.com/gift/${token}`), { params: Promise.resolve({ token }) });
  expect(response.status).toBe(404);
  expect(response.cookies.has(membershipInvitationCookie)).toBe(false);
});
