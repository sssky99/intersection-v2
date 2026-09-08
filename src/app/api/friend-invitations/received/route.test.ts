import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.auth }));
vi.mock("@/lib/solapi", async (original) => ({ ...await original<typeof import("@/lib/solapi")>(), readFriendSms: mocks.read }));
import { GET } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-08T00:00:00Z"));
  mocks.auth.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "recipient" } } }) } });
});
afterEach(() => vi.useRealTimers());
function setup({ phone = "01000000001", status = "sent", applicationStatus = "waitlisted", date = "2026-09-18" } = {}) {
  const viewedProfileIds: string[] = [];
  mocks.admin.mockReturnValue({ from: (table: string) => {
    let profileId = "";
    const q = {
      select: () => q, is: () => q,
      eq: (key: string, value: string) => { if (table === "profiles" && key === "user_id") { profileId = value; viewedProfileIds.push(value); } return q; },
      maybeSingle: async () => ({ data: table === "friend_sms_invitations"
        ? { id, inviter_id: "inviter", application_id: 1, event_id: "event", friend_phone: "01000000001", status, message_id: "message" }
        : table === "meeting_date_applications" ? { status: applicationStatus }
        : table === "meeting_events" ? { event_date: date, starts_at: "19:00:00" }
        : profileId === "recipient" ? { phone_normalized: phone } : { photo_url: "https://example.com/inviter.jpg" }, error: null }),
    }; return q;
  } });
  return viewedProfileIds;
}
const request = () => new NextRequest(`http://localhost/api/friend-invitations/received?id=${id}`);
describe("recipient invitation link", () => {
  it("returns the inviter photo and the original event to the matching recipient", async () => {
    setup();
    const response = await GET(request());
    expect(await response.json()).toEqual({ id, eventId: "event", status: "sent", photoUrl: "https://example.com/inviter.jpg" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not reveal inviter photos to another phone number", async () => {
    const viewed = setup({ phone: "01000000003" });
    expect((await GET(request())).status).toBe(403);
    expect(viewed).not.toContain("inviter");
  });
  it("does not reveal a photo before delivery", async () => {
    const viewed = setup({ status: "submitted" });
    mocks.read.mockResolvedValue({ statusCode: "2000" });
    expect((await GET(request())).status).toBe(409);
    expect(viewed).not.toContain("inviter");
  });
  it.each([{ applicationStatus: "cancelled" }, { date: "2026-09-08" }])("rejects unavailable invitations", async (options) => {
    const viewed = setup(options);
    expect((await GET(request())).status).toBe(410);
    expect(viewed).not.toContain("inviter");
  });
  it("requires sign-in before reading invitation data", async () => {
    mocks.auth.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    expect((await GET(request())).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
