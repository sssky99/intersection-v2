import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/adminUserView", () => ({ requestUserId: mocks.identity }));
vi.mock("@/server/meetings/readUserTickets", () => ({
  loadUserTickets: mocks.read,
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("my tickets access boundary", () => {
  it("does not query tickets for an unauthenticated request", async () => {
    mocks.identity.mockResolvedValue(null);
    expect(
      (await GET(new Request("http://localhost/api/meetings/my-tickets")))
        .status,
    ).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("treats identity service failure as retryable instead of an empty ticket list", async () => {
    mocks.identity.mockResolvedValue(undefined);
    const response = await GET(
      new Request("http://localhost/api/meetings/my-tickets"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses the verified identity even if a different user is in the query", async () => {
    mocks.identity.mockResolvedValue({ userId: "verified" });
    mocks.read.mockResolvedValue(Response.json({ tickets: [] }));
    const request = new Request(
      "http://localhost/api/meetings/my-tickets?userId=someone-else&limit=3",
    );
    expect((await GET(request)).status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(request, "verified");
  });
});
