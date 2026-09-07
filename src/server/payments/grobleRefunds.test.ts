import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), status: vi.fn() }));
vi.mock("./grobleContext", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./groblePaymentDetails", () => ({ eventStatus: mocks.status }));
import { processPaymentRefunded } from "./grobleRefunds";
import type { WebhookEnvelope } from "./grobleVerification";
beforeEach(() => { vi.resetAllMocks(); });
it("applies the stored event before acknowledging the refund", async () => {
  mocks.rpc.mockResolvedValue({ data: { user_id: "user", payment_kind: "membership_initial", amount: 20000 }, error: null });
  await processPaymentRefunded({ id: "refund" } as WebhookEnvelope, "key");
  expect(mocks.rpc).toHaveBeenCalledWith("apply_groble_refund", { p_event_id: "refund" });
  expect(mocks.status).toHaveBeenCalledWith("key", expect.objectContaining({ processing_status: "processed", payment_amount: 20000 }));
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.status.mock.invocationCallOrder[0]);
});
it("does not acknowledge a partial or invalid refund rejected by the database", async () => {
  mocks.rpc.mockResolvedValue({ error: new Error("Partial refund requires review") });
  await expect(processPaymentRefunded({ id: "refund" } as WebhookEnvelope, "key")).rejects.toThrow("Partial refund");
  expect(mocks.status).not.toHaveBeenCalled();
});
