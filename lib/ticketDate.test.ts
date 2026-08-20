import { describe, expect, it } from "vitest";
import {
  isTicketApplicationClosed,
  ticketApplicationClosesAt,
} from "./ticketDate";

describe("ticket application deadline", () => {
  it("defaults to 24 hours before the ticket starts", () => {
    expect(
      ticketApplicationClosesAt("2026-08-21", "19:00")?.toISOString(),
    ).toBe("2026-08-20T10:00:00.000Z");
  });

  it("uses an explicitly configured deadline when present", () => {
    expect(
      ticketApplicationClosesAt(
        "2026-08-21",
        "19:00",
        "2026-08-19T09:00:00.000Z",
      )?.toISOString(),
    ).toBe("2026-08-19T09:00:00.000Z");
  });

  it("closes at the exact automatic deadline", () => {
    expect(
      isTicketApplicationClosed(
        "2026-08-21",
        "19:00",
        null,
        new Date("2026-08-20T10:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
