import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from }) }));
import { executeWaitlistCommand, waitlistCommandError } from "./commands";

const ticket = "00000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: 1, error: null }); });
describe("waitlist command boundary", () => {
  it("sends simultaneous assignment, status and note changes in one atomic call", async () => {
    await executeWaitlistCommand({ id: "date:10", ticketInstanceId: ticket, status: "on_hold", adminNote: " note " });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_update_meeting_application", {
      p_application_id: 10, p_patch: { ticketInstanceId: ticket, status: "on_hold", adminNote: "note" },
    });
    expect(from).not.toHaveBeenCalled();
  });
  it("distinguishes omitted fields from explicitly clearing them", async () => {
    await executeWaitlistCommand({ id: 1, adminNote: null });
    expect(rpc).toHaveBeenCalledWith("admin_update_ticket_participation", { p_participation_id: 1, p_patch: { adminNote: null } });
    rpc.mockClear();
    await executeWaitlistCommand({ id: "date:10", ticketInstanceId: null });
    expect(rpc).toHaveBeenCalledWith("admin_update_meeting_application", { p_application_id: 10, p_patch: { ticketInstanceId: null } });
  });
  it.each([null, {}, { id: "date:NaN", status: "approved" }, { id: -1, status: "approved" },
    { id: 1, status: "unknown" }, { id: 1, adminNote: {} }, { id: 1, ticketInstanceId: "bad" },
    { action: "assign_date_applications", ticketInstanceId: ticket, applicationIds: [10,"bad"] },
    { action: "distribute_date_applications", applicationIds: [] }])("rejects malformed commands before writing: %j", async (input) => {
    await expect(executeWaitlistCommand(input)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("revalidates the observed group membership inside the atomic command", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: [{ id: 10 }], error: null }) };
    from.mockReturnValue(query);
    await executeWaitlistCommand({ action: "confirm_date_application_group", ticketInstanceId: ticket });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_assign_waitlist_applications", {
      p_application_ids: [10], p_ticket_instance_id: ticket, p_confirm: true, p_only_current_group: true,
    });
  });
  it("propagates a conflict without attempting a compensating write", async () => {
    const error = { code: "P0001", message: "배정이 변경되었습니다." };
    rpc.mockResolvedValue({ data: null, error });
    await expect(executeWaitlistCommand({ id: "date:10", status: "approved" })).rejects.toEqual(error);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(waitlistCommandError(error)).toEqual({ status: 409, message: error.message });
    expect(waitlistCommandError({ code: "XX000", message: "private database details" }).message).not.toContain("private");
  });
});
