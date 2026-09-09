import { afterEach, describe, expect, it, vi } from "vitest";
import { CS_MODEL, CS_MANUAL_TOPIC_REPLY, generateCsReply, validCallback } from "./kakaoCsAi";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("CS AI boundaries", () => {
  it.each(["http://bot-api.kakao.com/cb", "https://bot-api.kakao.com.evil.test/cb", "https://127.0.0.1/cb", "https://user:pass@bot-api.kakao.com/cb", "https://bot-api.kakao.com:444/cb", "file:///etc/passwd"])("rejects untrusted callback %s", (url) => {
    expect(validCallback(url)).toBe(false);
  });
  it("accepts the Kakao callback host", () => expect(validCallback("https://bot-api.kakao.com/v1/bots/test/callback/token")).toBe(true));
  it("uses 5.6 and only supplied conversation context with no provider storage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [{content:[{type:"output_text",text:JSON.stringify({reply:"구매 내역 확인하기를 확인해주세요.",needs_operator:false,manual_topic:false})}]}] }));
    vi.stubGlobal("fetch", fetcher);
    const history = [{role:"user" as const,content:"자동결제 해지는요?"}];
    expect((await generateCsReply(history, new AbortController().signal)).reply).toContain("구매 내역 확인하기");
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.model).toBe(CS_MODEL);
    expect(payload.model).toBe("gpt-5.6-sol");
    expect(payload.store).toBe(false);
    expect(payload.input).toEqual(history);
    expect(payload.tools).toBeUndefined();
  });
  it("blocks a fabricated processing confirmation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({reply:"환불 처리되었습니다.",needs_operator:false,manual_topic:false})}]}]})));
    const result = await generateCsReply([], new AbortController().signal);
    expect(result.needs_operator).toBe(true);
    expect(result.reply).not.toContain("처리되었습니다");
  });
  it("rejects truncated model output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({status:"incomplete"})));
    await expect(generateCsReply([],new AbortController().signal)).rejects.toThrow("openai_incomplete");
  });
  it.each(["신청은 언제 확정되나요?", "이번 모임 연령대와 성비는요?"])("replaces excluded-topic content with a manual handoff: %s", async (question) => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ reply: "제공하면 안 되는 구성 또는 확정 안내", needs_operator: false, manual_topic: true }) }] }] })));
    expect(await generateCsReply([{ role: "user", content: question }], new AbortController().signal)).toEqual({ reply: CS_MANUAL_TOPIC_REPLY, needs_operator: true });
  });
});
