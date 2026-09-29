import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), auth: vi.fn(), read: vi.fn(), send: vi.fn(), eligible: vi.fn() }));
vi.mock("@/lib/friendBoard", async original => ({ ...await original<typeof import("@/lib/friendBoard")>(), eligibleBoardFriend: mocks.eligible }));
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

describe("board invitations", () => {
  const friendId = "22222222-2222-4222-8222-222222222222";
  const sendRequest = () => new NextRequest("http://localhost/api/friend-invitations", { method: "POST", body: JSON.stringify({ friendId, applicationId: "12", consent: true, phone: "01099999999" }) });
  function boardSetup(created = true) {
    mocks.eligible.mockResolvedValue({ user_id: friendId });
    const updates: unknown[] = [];
    const rpc = vi.fn().mockResolvedValue({ data: { created, invitation: { id: "invite", status: "submitted" } }, error: null });
    mocks.admin.mockReturnValue({ rpc, from: (table: string) => {
      let userId: string | undefined;
      const q = {
        select: () => q, is: () => q,
        eq: (key: string, value: string) => { if (key === "user_id") userId = value; return q; },
        single: async () => ({ data: table === "profiles" ? { name: "문하늘", phone_normalized: userId === friendId ? "01000000001" : "01000000002" } : table === "meeting_date_applications" ? { event_id: eventId } : { title: "저녁 모임", event_date: "2099-01-01", starts_at: "18:00", visibility: "public" }, error: null }),
        limit: async () => ({ data: [{ name: "이진현" }], error: null }),
        update: (body: unknown) => { updates.push(body); return q; },
        then: (resolve: (value: unknown) => void) => Promise.resolve({ error: null }).then(resolve),
      }; return q;
    } });
    mocks.send.mockResolvedValue({ messageId: "message", groupId: "group" });
    return { rpc, updates };
  }
  it("rejects a forged friend without sending", async () => {
    boardSetup(); mocks.eligible.mockResolvedValue(null);
    expect((await POST(sendRequest())).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("resolves the recipient server-side and sends the approved board copy", async () => {
    const { rpc } = boardSetup();
    expect((await POST(sendRequest())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("reserve_friend_sms_invitation", { p_user_id: "owner", p_application_id: "12", p_phone: "01000000001" });
    expect(mocks.send).toHaveBeenCalledWith("01000000001", expect.stringContaining("진현님, 하늘님이"), "invite");
    expect(mocks.send.mock.calls[0][1]).toContain("/invite/invite");
  });
  it("does not send twice for an existing reservation", async () => {
    boardSetup(false); await POST(sendRequest()); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("records uncertain sends without retrying", async () => {
    const { updates } = boardSetup(); mocks.send.mockRejectedValue(new Error("timeout"));
    expect((await POST(sendRequest())).status).toBe(202);
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(updates).toContainEqual({ status: "unknown" });
  });
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
