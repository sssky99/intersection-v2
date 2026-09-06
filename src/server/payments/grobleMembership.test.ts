import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  status: vi.fn(),
  meta: vi.fn(),
}));
vi.mock("./grobleContext", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("./groblePaymentDetails", () => ({
  eventStatus: mocks.status,
  objectParts: vi.fn(),
}));
vi.mock("@/lib/metaConversions", () => ({ reportMetaPurchase: mocks.meta }));
import { processMembershipPayment } from "./grobleMembership";
import type { WebhookEnvelope } from "./grobleVerification";
const args = {
  envelope: {
    id: "event",
    occurredAt: "2026-09-06T03:00:00Z",
  } as WebhookEnvelope,
  idempotencyKey: "claim",
  details: {
    merchantUid: "charge",
    finalAmount: 10000,
    purchasedAt: null,
    buyerName: "Buyer",
    sellerReference: null,
    buyerPhone: null,
    cancelRequestedAt: null,
    cancelledAt: null,
  },
  match: {
    status: "matched" as const,
    userId: "member",
    intentId: 10,
    plan: "one_month" as const,
    creditAmount: 0,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.status.mockResolvedValue(undefined);
  mocks.meta.mockResolvedValue(undefined);
});
describe("membership webhook adapter", () => {
  it("acknowledges only after the atomic write succeeds", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        outcome: "applied",
        transaction_id: 1,
        payment_kind: "membership_initial",
      },
      error: null,
    });
    expect(await processMembershipPayment(args)).toBe("processed");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_membership_payment",
      expect.objectContaining({
        p_intent_id: 10,
        p_event_id: "event",
        p_amount: 10000,
        p_buyer_name: "Buyer",
      }),
    );
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.status.mock.invocationCallOrder[0],
    );
  });
  it("does not acknowledge a failed transaction", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("rollback") });
    await expect(processMembershipPayment(args)).rejects.toThrow("rollback");
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("can acknowledge an already-applied payment after acknowledgement failed", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          outcome: "applied",
          transaction_id: 1,
          payment_kind: "membership_initial",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          outcome: "already_applied",
          transaction_id: 1,
          payment_kind: "membership_initial",
        },
        error: null,
      });
    mocks.status.mockRejectedValueOnce(new Error("ack failed"));
    await expect(processMembershipPayment(args)).rejects.toThrow("ack failed");
    expect(await processMembershipPayment(args)).toBe("processed");
    expect(mocks.meta).toHaveBeenCalledTimes(1);
  });
  it("does not report a refunded callback as a new purchase", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        outcome: "cancelled",
        transaction_id: 1,
        payment_kind: "membership_initial",
      },
      error: null,
    });
    expect(await processMembershipPayment(args)).toBe("processed");
    expect(mocks.meta).not.toHaveBeenCalled();
  });
});
