import { describe, expect, it } from "vitest";
import {
  canCancelMeetingDateApplication,
  canResubmitMeetingDateApplication,
  isMeetingDateApplicationCancellationConfirmed,
  meetingDateApplicationMatchesTicket,
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

describe("isMeetingDateApplicationCancellationConfirmed", () => {
  it("accepts only an explicit confirmation", () => {
    expect(isMeetingDateApplicationCancellationConfirmed(true)).toBe(true);
    expect(isMeetingDateApplicationCancellationConfirmed(false)).toBe(false);
    expect(isMeetingDateApplicationCancellationConfirmed("true")).toBe(false);
    expect(isMeetingDateApplicationCancellationConfirmed(undefined)).toBe(false);
  });
});

describe("meetingDateApplicationMatchesTicket", () => {
  const application = {
    id: 1,
    eventId: "event-id",
    meetingDate: "2026-08-28",
    meetingTime: "19:00",
    region: "서울",
    status: "waitlisted" as const,
    depositAmount: null,
    depositStatus: null,
    assignedTicketInstanceId: null,
    createdAt: null,
  };

  it("matches an unassigned application by event id", () => {
    expect(meetingDateApplicationMatchesTicket(application, "event-id")).toBe(
      true,
    );
  });

  it("matches a synthetic ticket by its application source id", () => {
    expect(
      meetingDateApplicationMatchesTicket(
        application,
        "snapshot-id",
        "application:1",
      ),
    ).toBe(true);
  });

  it("matches an assigned application by ticket instance id", () => {
    expect(
      meetingDateApplicationMatchesTicket(
        { ...application, assignedTicketInstanceId: "instance-id" },
        "instance-id",
      ),
    ).toBe(true);
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
