import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), auth: vi.fn(), read: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.auth }));
vi.mock("@/lib/solapi", async (original) => ({ ...await original<typeof import("@/lib/solapi")>(), readFriendSms: mocks.read, sendFriendSms: mocks.send, solapiConfigured: () => true }));
import { GET, POST } from "./route";

const eventId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SOLAPI_SENDER_NUMBER", "01000000002");
  mocks.auth.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } });
});
function setup(status: string, applicationStatus = "waitlisted") {
  const tables: string[] = [], filters: unknown[] = [];
  mocks.admin.mockReturnValue({ from: (table: string) => {
    tables.push(table);
    const result = () => ({ error: null, data: table === "friend_sms_invitations"
      ? { id: "invitation", application_id: 1, friend_phone: "01000000001", status, message_id: "message" }
      : table === "profiles" ? [{ photo_url: "https://example.com/friend.jpg" }] : { status: applicationStatus } });
    const q = {
      select: () => q, eq: (...args: unknown[]) => { filters.push(args); return q; }, is: () => q,
      update: () => q, maybeSingle: async () => result(), single: async () => result(),
      limit: async () => result(), then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve),
    }; return q;
  } });
  return { tables, filters };
}
const request = () => new NextRequest(`http://localhost/api/friend-invitations?eventId=${eventId}`);
describe("friend photo authorization", () => {
  it("rejects unauthenticated requests before touching private data", async () => {
    mocks.auth.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
    expect((await GET(request())).status).toBe(401);
    expect((await POST(new NextRequest("http://localhost/api/friend-invitations", { method: "POST" }))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each(["sending", "unknown", "failed"])("hides photos for %s", async (status) => {
    const { tables, filters } = setup(status);
    expect((await (await GET(request())).json()).photoUrl).toBeNull();
    expect(tables).not.toContain("profiles");
    expect(filters).toContainEqual(["inviter_id", "owner"]);
  });
  it("does not unlock on provider acceptance alone", async () => {
    const { tables } = setup("submitted");
    mocks.read.mockResolvedValue({ statusCode: "2000", to: "01000000001", from: "01000000002" });
    expect((await (await GET(request())).json()).photoUrl).toBeNull();
    expect(tables).not.toContain("profiles");
  });
  it("unlocks only after matching delivery confirmation", async () => {
    setup("submitted");
    mocks.read.mockResolvedValue({ statusCode: "4000", to: "01000000001", from: "01000000002" });
    expect(await (await GET(request())).json()).toEqual({ status: "sent", photoUrl: "https://example.com/friend.jpg" });
  });
  it("does not unlock a cancelled application", async () => {
    const { tables } = setup("sent", "cancelled");
    expect((await (await GET(request())).json()).photoUrl).toBeNull();
    expect(tables).not.toContain("profiles");
  });
});
