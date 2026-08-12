import { describe, expect, it } from "vitest";
import { requestedMeetingApplicationDates } from "./meetingDateApplications";

describe("requestedMeetingApplicationDates", () => {
  it("accepts an upcoming issued-ticket date after the generic week rolls over", () => {
    expect(
      requestedMeetingApplicationDates(["2026-08-15"], "2026-08-13", {
        ticketInstanceProvided: true,
      }),
    ).toEqual(["2026-08-15"]);
  });

  it("does not expose the same stale date through the generic date picker", () => {
    expect(
      requestedMeetingApplicationDates(["2026-08-15"], "2026-08-13"),
    ).toEqual([]);
  });

  it("rejects past and unsupported weekdays even with a ticket id", () => {
    expect(
      requestedMeetingApplicationDates(
        ["2026-08-12", "2026-08-16"],
        "2026-08-13",
        { ticketInstanceProvided: true },
      ),
    ).toEqual([]);
  });
});
