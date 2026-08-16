import { describe, expect, it } from "vitest";
import { grobleCompletedPaymentKind } from "./groblePaymentEvent";

describe("grobleCompletedPaymentKind", () => {
  it("routes one-time payment completion events to meeting applications", () => {
    expect(grobleCompletedPaymentKind("payment.completed")).toBe("one_time");
  });

  it("routes subscription payment completion events to memberships", () => {
    expect(grobleCompletedPaymentKind("subscription_payment.completed")).toBe(
      "membership",
    );
  });

  it("rejects unrelated event types", () => {
    expect(grobleCompletedPaymentKind("payment.failed")).toBeNull();
  });
});
