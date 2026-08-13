import { describe, expect, it } from "vitest";
import { hasCurrentMembershipAccess } from "./membershipTypes";

describe("hasCurrentMembershipAccess", () => {
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
