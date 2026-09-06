import { describe, expect, it, vi } from "vitest";
import { fetchTicketGroupContext } from "./ticketGroupContext";

describe("ticket group request context", () => {
  it("loads current groups and event peers once each, deduplicating IDs", async () => {
    const groups = [{ id: "g", event_id: "e", code: "A", title: "A", legacy_ticket_instance_id: "i" }];
    const q = { select: vi.fn(() => q), in: vi.fn(() => q), not: vi.fn(() => q),
      returns: vi.fn(async () => ({ data: groups, error: null })) };
    const client = { from: vi.fn(() => q) };
    const result = await fetchTicketGroupContext(client as never, ["i", "i"]);
    expect(client.from).toHaveBeenCalledTimes(2);
    expect(q.in).toHaveBeenNthCalledWith(1, "legacy_ticket_instance_id", ["i"]);
    expect(q.in).toHaveBeenNthCalledWith(2, "event_id", ["e"]);
    expect(result).toEqual({ currentGroups: groups, eventGroups: groups });
  });
  it("makes no requests for an empty page", async () => {
    const client = { from: vi.fn() };
    expect(await fetchTicketGroupContext(client as never, [])).toEqual({ currentGroups: [], eventGroups: [] });
    expect(client.from).not.toHaveBeenCalled();
  });
});
