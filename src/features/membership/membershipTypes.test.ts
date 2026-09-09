import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasCurrentMembershipAccess, hasMembershipAccessOnDate } from "./membershipTypes";

describe("advance membership applications", () => {
  it.each([
    ["2026-09-10", false], ["2026-09-11", true],
    ["2026-10-10", true], ["2026-10-11", false], ["2026-09-31", false],
  ])("checks the meeting date %s against the paid period", (date, expected) => {
    expect(hasMembershipAccessOnDate({ status: "active", startDate: "2026-09-11", endDate: "2026-10-10", date })).toBe(expected);
  });
  it.each(["pending", "cancelled", "expired", "none"])("rejects %s memberships even within the period", status => {
    expect(hasMembershipAccessOnDate({ status, startDate: "2026-09-11", endDate: "2026-10-10", date: "2026-09-12" })).toBe(false);
  });
});

describe("hasCurrentMembershipAccess", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [null, null, false],
    ["2026-09-07", "2026-10-06", false],
    ["2026-08-01", "2026-09-05", false],
    ["2026-09-06", "2026-09-06", true],
    ["2026-02-30", "2026-10-01", false],
    ["2026-09-06", "2026-09-32", false],
  ])("checks complete, valid KST dates (%s, %s)", (startDate, endDate, expected) => {
    expect(hasCurrentMembershipAccess({ status: "active", startDate, endDate })).toBe(expected);
  });
  it("does not grant access while payment is pending even when dates remain", () => {
    expect(
      hasCurrentMembershipAccess({
        status: "pending",
        startDate: "2026-06-18",
        endDate: "2026-12-17",
      }),
    ).toBe(false);
  });

  it("grants access only to a non-expired active membership", () => {
    expect(
      hasCurrentMembershipAccess({
        status: "active",
        startDate: "2026-06-18",
        endDate: "2099-12-17",
      }),
    ).toBe(true);
  });
});
