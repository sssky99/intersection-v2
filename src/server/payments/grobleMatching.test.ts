import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./grobleContext", () => ({ createAdminClient: () => mocks }));
import { pendingMembershipMatch } from "./grobleMatching";
const args = { sellerReference: "original-reference", buyerPhone: "01012345678", finalAmount: 20000, paidAt: "2026-11-19T12:07:10Z" };
function rows(reference: unknown, profiles: unknown[] = []) {
  mocks.from.mockImplementation((table: string) => {
    const q = { select: () => q, eq: () => q, is: () => q, limit: () => q,
      maybeSingle: async () => ({ data: reference, error: null }),
      returns: async () => ({ data: profiles, error: null }) };
    return q;
  });
}
beforeEach(() => { vi.resetAllMocks(); });
it.each([null, { id: 1, user_id: "original", expected_amount: 30000, credit_amount: 0 }])(
  "never replaces a missing or conflicting supplied reference with a phone match", async (reference) => {
    rows(reference, [{ user_id: "new-account" }]);
    await expect(pendingMembershipMatch(args)).rejects.toThrow("seller reference");
    expect(mocks.from.mock.calls.map(c => c[0])).toEqual(["membership_payment_intents"]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
it("retains an exact reference and matching amount", async () => {
  rows({ id: 1, user_id: "original", expected_amount: 20000, credit_amount: 0, plan: "one_month" });
  expect(await pendingMembershipMatch(args)).toMatchObject({ status: "matched", userId: "original", intentId: 1 });
});
it("rejects a re-created phone account for a payment predating signup", async () => {
  rows(null, [{ user_id: "new-account", created_at: "2026-11-21T09:26:58Z" }]);
  await expect(pendingMembershipMatch({ ...args, sellerReference: null })).rejects.toThrow("postdates payment");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("allows legacy phone matching only with an older unique account and unique intent", async () => {
  rows(null, [{ user_id: "original", created_at: "2026-11-01T00:00:00Z" }]);
  mocks.rpc.mockResolvedValue({ data: [{ intent_id: 1, plan: "one_month", credit_amount: 0 }], error: null });
  expect(await pendingMembershipMatch({ ...args, sellerReference: null })).toMatchObject({ status: "matched", userId: "original" });
});
it("does not guess among duplicate phone accounts", async () => {
  rows(null, [{ user_id: "a" }, { user_id: "b" }]);
  expect(await pendingMembershipMatch({ ...args, sellerReference: null })).toMatchObject({ status: "ambiguous" });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
