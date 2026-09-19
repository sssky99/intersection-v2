import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(), rpc: vi.fn(), generate: vi.fn(),
}));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({
  rpc: mocks.rpc, from: () => ({ update: mocks.update }),
}) }));
vi.mock("./kakaoCsAi", async (original) => ({
  ...await original<typeof import("./kakaoCsAi")>(), generateCsReply: mocks.generate,
}));
import { prepareCsConversation } from "./kakaoCsConversation";

beforeEach(() => {
  vi.stubEnv("KAKAO_CS_SKILL_SECRET", "synthetic-secret");
  mocks.rpc.mockResolvedValue({ data: { status: "claimed", messages: [] } });
  mocks.update.mockImplementation(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
  mocks.generate.mockResolvedValue({ reply: "운영진 상담을 이용해주세요.", needs_operator: true });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("incoming CS message retention", () => {
  it.each([false, true])("retains the incoming message when callback success is %s", async (success) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: success ? "SUCCESS" : "FAIL" })));
    const prepared = await prepareCsConversation({
      bot: "test", user: "test", utterance: "테스트 010-1234-5678",
      callback: "https://bot-api.kakao.com/test", test: true,
    });
    const incoming = { role: "user", content: "테스트 [전화번호]" };
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][0].messages).toEqual([incoming]);
    await prepared.run!();
    const final = mocks.update.mock.calls.at(-1)![0];
    expect(final.messages).toEqual(success
      ? [incoming, { role: "assistant", content: "운영진 상담을 이용해주세요." }]
      : [incoming]);
    expect(final.paused).toBe(true);
    expect(final.lease_token).toBeNull();
  });

  it("does not start AI work if the incoming message cannot be persisted", async () => {
    mocks.update.mockImplementationOnce(() => ({ eq: () => ({ eq: async () => ({ error: { message: "unavailable" } }) }) }));
    await expect(prepareCsConversation({ bot: "test", user: "test", utterance: "테스트", test: true }))
      .rejects.toThrow("cs_incoming_message_save_failed");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
