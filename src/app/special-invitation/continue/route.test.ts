import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { membershipInvitationCookie } from "@/lib/membershipInvitationToken";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), profile: vi.fn(), nextPath: vi.fn() }));
vi.mock("@/lib/membershipInvitation", () => ({ findMembershipInvitation: mocks.lookup }));
vi.mock("@/lib/onboarding", () => ({ getAuthenticatedProfile: mocks.profile, nextOnboardingPath: mocks.nextPath }));
import { GET } from "./route";
function request() { return new NextRequest("https://example.com/special-invitation/continue", { headers: { cookie: `${membershipInvitationCookie}=${"A".repeat(43)}` } }); }
beforeEach(() => { vi.clearAllMocks(); mocks.lookup.mockResolvedValue({ id: "invitation" }); });

it("sends an anonymous invitee through the existing questions and signup flow", async () => {
  mocks.profile.mockResolvedValue({ user: null, profile: null });
  const response = await GET(request());
  expect(response.headers.get("location")).toBe("https://example.com/onboarding/start");
  expect(response.cookies.has(membershipInvitationCookie)).toBe(false); // Existing request cookie is retained, not replaced/deleted.
});
it.each(["/meetings?tab=recommend", "/onboarding/questions"])("resumes authenticated invitees at their existing next step: %s", async (path) => {
  mocks.profile.mockResolvedValue({ user: { id: "member" }, profile: { user_id: "member" } });
  mocks.nextPath.mockReturnValue(path);
  expect((await GET(request())).headers.get("location")).toBe(`https://example.com${path}`);
});
it("rejects a missing or revoked invitation without bootstrapping an account", async () => {
  mocks.lookup.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(404);
  expect(mocks.profile).not.toHaveBeenCalled();
});
