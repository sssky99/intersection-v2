import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { authorized, command, read } = vi.hoisted(() => ({ authorized: vi.fn(), command: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ ADMIN_SESSION_COOKIE: "admin_session", isAdminSessionTokenValid: authorized }));
vi.mock("@/server/waitlist/commands", () => ({ executeWaitlistCommand: command, waitlistCommandError: () => ({ status: 409, message: "conflict" }) }));
vi.mock("@/server/waitlist/readWaitlist", () => ({ loadWaitlistData: read }));
import { GET, PATCH } from "./route";
describe("admin waitlist authorization", () => {
  it("blocks both reads and writes before accessing the data layer", async () => {
    authorized.mockReturnValue(false);
    expect((await GET(new NextRequest("http://localhost/api/admin/waitlist"))).status).toBe(401);
    expect((await PATCH(new NextRequest("http://localhost/api/admin/waitlist", { method: "PATCH", body: "{}" }))).status).toBe(401);
    expect(command).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  });
  it("returns the updated list and existing count fields after command completion", async () => {
    authorized.mockReturnValue(true); command.mockResolvedValue({ assignedCount: 2 }); read.mockResolvedValue({ rows: [] });
    const response = await PATCH(new NextRequest("http://localhost/api/admin/waitlist", { method: "PATCH", body: '{"action":"assign_date_applications"}' }));
    expect(await response.json()).toEqual({ rows: [], assignedCount: 2 });
  });
});
