import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasCurrentMembershipAccess } from "./membershipTypes";

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
