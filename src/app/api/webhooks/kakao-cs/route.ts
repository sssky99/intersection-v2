import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { kakaoCsResponse } from "../../../../../lib/kakaoCsSkill";
import { csText, CS_FALLBACK, validCallback } from "../../../../../lib/kakaoCsAi";
import { prepareCsConversation } from "../../../../../lib/kakaoCsConversation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const maxBodyBytes = 16 * 1024;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return json({ ok: true, service: "kakao-cs-skill" });
}

export async function POST(request: Request) {
  const expected = process.env.KAKAO_CS_SKILL_SECRET?.trim();
  if (!expected) return json({ error: "Skill is not configured." }, 503);
  const actual = request.headers.get("x-kakao-skill-secret")?.trim() ?? "";
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (!actual || a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ error: "Unauthorized." }, 401);
  }
  if (Number(request.headers.get("content-length")) > maxBodyBytes) {
    return json({ error: "Payload too large." }, 413);
  }
  // Limit bytes while reading, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Invalid payload." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return json({ error: "Payload too large." }, 413);
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const utterance = body?.userRequest?.utterance;
    if (typeof utterance !== "string" || utterance.length > 1000) {
      return json({ error: "Invalid utterance." }, 400);
    }
    if (process.env.KAKAO_CS_AI_ENABLED !== "true") return json(kakaoCsResponse(utterance));
    const user = body?.userRequest?.user?.id;
    const bot = body?.bot?.id;
    const callback = body?.userRequest?.callbackUrl;
    const directTest = process.env.KAKAO_CS_ALLOW_DIRECT_TEST === "true" && request.headers.get("x-kakao-cs-test") === "true";
    if (typeof user !== "string" || !user || user.length > 200 || typeof bot !== "string" || bot !== process.env.KAKAO_CS_BOT_ID) {
      return json({ error: "Invalid bot or user." }, 400);
    }
    if (!directTest && !validCallback(callback)) {
      // Ordinary skills have a 5s deadline. Never leave a paid model request running
      // when its result cannot be delivered; the bot block must enable callbacks.
      return json(csText("자동 상담 연결을 확인 중이에요. 운영진 상담을 이용해주세요."));
    }
    if (directTest) {
      const prepared = await prepareCsConversation({ user, bot, utterance, test: true });
      return json(prepared.response ?? await prepared.run!());
    }
    after(async () => {
      try {
        const prepared = await prepareCsConversation({ user, bot, utterance, callback, test: false });
        if (prepared.duplicate) return;
        if (prepared.run) { await prepared.run(); return; }
        if (prepared.response) {
          const result = await fetch(callback, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prepared.response), redirect: "error", signal: AbortSignal.timeout(8000),
          });
          if (!result.ok || (await result.json()).status !== "SUCCESS") console.error("[kakao-cs] notice_delivery_unconfirmed");
        }
      } catch { console.error("[kakao-cs] background_processing_failed"); }
    });
    return json({ version: "2.0", useCallback: true });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON payload." }, 400);
    return json(csText(CS_FALLBACK));
  } finally {
    reader.releaseLock();
  }
}
