import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  status: vi.fn(),
  existing: vi.fn(),
  recurring: vi.fn(),
  pending: vi.fn(),
  apply: vi.fn(),
  meta: vi.fn(),
}));
vi.mock("./grobleContext", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("./grobleMatching", () => ({
  existingMembershipMatch: mocks.existing,
  recurringMembershipMatch: mocks.recurring,
  pendingMembershipMatch: mocks.pending,
  existingApplicationMatch: vi.fn(),
  pendingApplicationMatch: vi.fn(),
}));
vi.mock("./grobleMembership", () => ({
  processMembershipPayment: mocks.apply,
  syncProfileNameFromPayment: vi.fn(),
}));
vi.mock("./groblePaymentDetails", () => ({
  eventStatus: mocks.status,
  objectParts: () => ({
    merchantUid: "charge",
    purchasedAt: "2026-09-22T00:00:00Z",
  }),
}));
vi.mock("@/lib/metaConversions", () => ({ reportMetaPurchase: mocks.meta }));
import { processPaymentCompleted } from "./groblePayments";
import type { WebhookEnvelope } from "./grobleVerification";
const event = {
  id: "completion",
  type: "subscription_payment.completed",
  object: {},
} as WebhookEnvelope;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
it("acknowledges a reconciled refund without granting access or advertising a purchase", async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      user_id: "member",
      amount: 20000,
      payment_kind: "membership_renewal",
    },
    error: null,
  });
  expect(await processPaymentCompleted(event, "claim")).toBe("processed");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "reconcile_groble_refunded_completion",
    { p_event_id: "completion" },
  );
  expect(mocks.status).toHaveBeenCalledWith(
    "claim",
    expect.objectContaining({
      processing_status: "processed",
      last_error: null,
    }),
  );
  expect(mocks.existing).not.toHaveBeenCalled();
  expect(mocks.apply).not.toHaveBeenCalled();
  expect(mocks.meta).not.toHaveBeenCalled();
});
it("does not bypass a rejected refund with normal completion", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: new Error("identity mismatch"),
  });
  await expect(processPaymentCompleted(event, "claim")).rejects.toThrow(
    "identity mismatch",
  );
  expect(mocks.apply).not.toHaveBeenCalled();
  expect(mocks.status).not.toHaveBeenCalled();
});
it("never matches an unlinked renewal to a newly opened initial checkout", async () => {
  mocks.existing.mockResolvedValue(null);
  mocks.recurring.mockResolvedValue({
    status: "unmatched",
    userId: null,
    intentId: null,
    plan: null,
  });
  expect(await processPaymentCompleted(event, "claim")).toBe("unmatched");
  expect(mocks.pending).not.toHaveBeenCalled();
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("preserves normal initial checkout matching", async () => {
  mocks.existing.mockResolvedValue(null);
  mocks.recurring.mockResolvedValue(null);
  mocks.pending.mockResolvedValue({
    status: "matched",
    userId: "member",
    intentId: 1,
    plan: "one_month",
    creditAmount: 0,
  });
  mocks.apply.mockResolvedValue("processed");
  expect(await processPaymentCompleted(event, "claim")).toBe("processed");
  expect(mocks.apply).toHaveBeenCalled();
});
