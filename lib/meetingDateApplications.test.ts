import { describe, expect, it } from "vitest";
import {
  canCancelMeetingDateApplication,
  canResubmitMeetingDateApplication,
  requestedMeetingApplicationDates,
} from "./meetingDateApplications";

describe("canCancelMeetingDateApplication", () => {
  it("allows only completed applications that are still awaiting assignment", () => {
    expect(canCancelMeetingDateApplication("waitlisted")).toBe(true);
    expect(canCancelMeetingDateApplication("on_hold")).toBe(true);
  });

  it("does not treat payment or confirmed participation as cancellable applications", () => {
    expect(canCancelMeetingDateApplication("payment_pending")).toBe(false);
    expect(canCancelMeetingDateApplication("approved")).toBe(false);
    expect(canCancelMeetingDateApplication("cancelled")).toBe(false);
  });
});

describe("canResubmitMeetingDateApplication", () => {
  it("allows an admin-cancelled application to be submitted again", () => {
    expect(canResubmitMeetingDateApplication("cancelled")).toBe(true);
  });

  it("keeps active and completed applications protected", () => {
    expect(canResubmitMeetingDateApplication("waitlisted")).toBe(false);
    expect(canResubmitMeetingDateApplication("approved")).toBe(false);
    expect(canResubmitMeetingDateApplication("completed")).toBe(false);
  });
});

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

  it("accepts any valid upcoming weekday for a configured event", () => {
    expect(
      requestedMeetingApplicationDates(["2026-08-23"], "2026-08-13", {
        eventProvided: true,
      }),
    ).toEqual(["2026-08-23"]);
  });
});
