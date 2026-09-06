import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchUserTickets,
  userTicketsCache,
  userTicketsRequests,
} from "./userTickets";
const fetchMock = vi.fn();
beforeEach(() => {
  userTicketsCache.clear();
  userTicketsRequests.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
const response = (count: number) =>
  Response.json({ tickets: [], participationCount: count });
describe("user ticket requests", () => {
  it("shares a pending refresh and uses its cached result", async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const first = fetchUserTickets({ scope: "member-a", limit: 3 });
    const second = fetchUserTickets({
      scope: "member-a",
      limit: 3,
      force: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(response(7));
    expect(await first).toEqual(await second);
    expect(
      (await fetchUserTickets({ scope: "member-a", limit: 3 }))
        ?.participationCount,
    ).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not reuse another account or page's result", async () => {
    fetchMock.mockImplementation(async () =>
      response(fetchMock.mock.calls.length),
    );
    expect(
      (await fetchUserTickets({ scope: "a", limit: 3 }))?.participationCount,
    ).toBe(1);
    expect(
      (await fetchUserTickets({ scope: "b", limit: 3 }))?.participationCount,
    ).toBe(2);
    expect(
      (await fetchUserTickets({ scope: "a", limit: 3, offset: 3 }))
        ?.participationCount,
    ).toBe(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/meetings/my-tickets?limit=3&offset=3",
      { cache: "no-store" },
    );
  });
  it("does not turn a malformed response into a cached empty list", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: "upstream" }))
      .mockResolvedValueOnce(response(4));
    expect(await fetchUserTickets({ scope: "a" })).toBeNull();
    expect((await fetchUserTickets({ scope: "a" }))?.participationCount).toBe(
      4,
    );
  });
  it("retries after a network failure", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response(2));
    expect(await fetchUserTickets({ scope: "a" })).toBeNull();
    expect((await fetchUserTickets({ scope: "a" }))?.participationCount).toBe(
      2,
    );
  });
});
