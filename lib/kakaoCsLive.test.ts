import { it, expect } from "vitest";
import { loadEnv } from "vite";
import { prepareCsConversation } from "./kakaoCsConversation";
it.skipIf(process.env.CS_LIVE_TEST !== "true")("verifies the real model and database with synthetic conversation", async () => {
  Object.assign(process.env, loadEnv("development", process.cwd(), ""));
  process.env.KAKAO_CS_SKILL_SECRET = "local-synthetic-test-only";
  const user = `synthetic-${Date.now()}`;
  for (const utterance of ["구독 해지는 어디서 해요?", "그럼 탈퇴만 하면요?"]) {
    const prepared = await prepareCsConversation({ bot: "synthetic-bot", user, utterance, test: true });
    const result = prepared.response ?? await prepared.run!();
    const text = result.template.outputs[0].simpleText?.text;
    expect(text).toBeDefined();
    expect(text).not.toContain("지금은 자동 답변을 준비하기 어려워요");
    expect(text?.replaceAll(" ", "")).toContain("구매내역확인하기");
  }
}, 90000);
