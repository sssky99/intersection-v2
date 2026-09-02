import { describe, expect, it } from "vitest";
import {
  grobleCancelledPaymentKind,
  grobleCompletedPaymentKind,
} from "./groblePaymentEvent";

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

describe("grobleCancelledPaymentKind", () => {
  it("routes one-time payment cancellation events to meeting applications", () => {
    expect(grobleCancelledPaymentKind("payment.cancelled")).toBe("one_time");
  });

  it("routes subscription payment cancellation events to memberships", () => {
    expect(grobleCancelledPaymentKind("subscription_payment.cancelled")).toBe(
      "membership",
    );
  });

  it("does not treat a cancellation request as a completed cancellation", () => {
    expect(
      grobleCancelledPaymentKind("subscription_payment.cancel_requested"),
    ).toBeNull();
  });

  it("rejects unrelated event types", () => {
    expect(grobleCancelledPaymentKind("payment.failed")).toBeNull();
  });
});
