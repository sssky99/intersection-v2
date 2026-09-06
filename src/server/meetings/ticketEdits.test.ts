import { describe, expect, it, vi } from "vitest";
import { changesOperationalFields } from "./ticketEdits";
vi.mock("server-only", () => ({}));

function client(linked = true) {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({
      data: linked ? { id: "group" } : null,
      error: null,
    }),
    single: async () => ({
      data: {
        title: "Dinner",
        event_time: "18:00:00",
        place_payload: { name: "Place", address: "Street" },
      },
      error: null,
    }),
  };
  return { from: () => q };
}
describe("editing event-linked tickets", () => {
  it("allows unrelated image/visibility edits and equivalent JSON/time values", async () => {
    expect(
      await changesOperationalFields(client() as never, "instance", {
        visibility: "public",
        image_url: "new",
      }),
    ).toBe(false);
    expect(
      await changesOperationalFields(client() as never, "instance", {
        event_time: "18:00",
        place_payload: { address: "Street", name: "Place" },
      }),
    ).toBe(false);
  });
  it("requires operational changes to go through the event editor", async () => {
    expect(
      await changesOperationalFields(client() as never, "instance", {
        title: "Other",
      }),
    ).toBe(true);
    expect(
      await changesOperationalFields(client(false) as never, "instance", {
        title: "Other",
      }),
    ).toBe(false);
  });
});
