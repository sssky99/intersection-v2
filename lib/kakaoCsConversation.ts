import { createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { CS_FALLBACK, CsMessage, csText, generateCsReply } from "./kakaoCsAi";

type SkillIdentity = { bot: string; user: string; utterance: string; callback?: string; test: boolean };
const handoff = "이 문의는 운영진 확인이 필요해요. 운영진 상담을 이용해주세요. 자동 답변만으로 요청이 접수되거나 처리되지는 않습니다.";

export async function prepareCsConversation(input: SkillIdentity) {
  const secret = process.env.KAKAO_CS_SKILL_SECRET!;
  const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const session = hash(JSON.stringify([input.test ? "test" : "live", input.bot, input.user]));
  const requestKey = input.callback ? hash(input.callback) : randomUUID();
  const token = randomUUID();
  const admin = createAdminClient({ timeoutMs: 5000 });
  const { data, error } = await admin.rpc("claim_kakao_cs_conversation", {
    p_session: session, p_request: requestKey, p_token: token,
  });
  if (error) throw new Error("cs_history_unavailable");
  if (data.status === "duplicate") return { duplicate: true as const };
  if (data.status !== "claimed") return { response: csText(data.status === "busy"
    ? "앞서 보내주신 문의의 답변을 준비 중이에요. 답변 후 이어서 남겨주세요."
    : handoff) };
  const history = data.messages as CsMessage[];
  // Mask phone numbers before sending to the model or storing conversation content.
  const utterance = input.utterance.replace(/01[016789][ -]?\d{3,4}[ -]?\d{4}/g, "[전화번호]");
  const messages: CsMessage[] = [...history, { role: "user", content: utterance }];

  async function finish(reply: string, paused: boolean, delivered: boolean) {
    const { error: updateError } = await admin.from("kakao_cs_conversations").update({
      messages: delivered ? [...messages, { role: "assistant", content: reply }].slice(-12) : history,
      paused, lease_token: null, lease_until: null, updated_at: new Date().toISOString(),
    }).eq("session_key", session).eq("lease_token", token);
    if (updateError) console.error("[kakao-cs] history_finish_failed");
  }

  return {
    run: async () => {
      let answer = { reply: CS_FALLBACK, needs_operator: false };
      try {
        answer = await generateCsReply(messages, AbortSignal.timeout(35000));
      } catch {
        console.error("[kakao-cs] ai_response_failed");
      }
      const response = csText(answer.reply);
      if (!input.callback) {
        await finish(answer.reply, answer.needs_operator, true);
        return response;
      }
      let delivered = false;
      try {
        const result = await fetch(input.callback, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response), redirect: "error", signal: AbortSignal.timeout(8000),
        });
        const resultBody = await result.json();
        delivered = result.ok && resultBody.status === "SUCCESS";
      } catch { /* A one-use callback must not be blindly retried. */ }
      if (!delivered) console.error("[kakao-cs] callback_delivery_unconfirmed");
      await finish(answer.reply, answer.needs_operator || !delivered, delivered);
      return response;
    },
  };
}
