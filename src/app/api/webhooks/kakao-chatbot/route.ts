import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxBodyBytes = 64 * 1024;

type JsonRecord = Record<string, unknown>;

type KakaoSkillRequest = {
  userRequest?: {
    utterance?: unknown;
    params?: unknown;
    user?: {
      id?: unknown;
      type?: unknown;
      properties?: unknown;
    };
  };
};

type ProfileMatch = {
  user_id: string;
  name: string | null;
  phone_normalized: string | null;
};

type KakaoLink = {
  profile_id: string;
  kakao_bot_user_key: string;
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function secureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function skillResponse(message: string) {
  return NextResponse.json({
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text: message,
          },
        },
      ],
    },
  });
}

function helpResponse() {
  return skillResponse(
    [
      "안녕하세요, 교집합입니다.",
      "신청 정보를 연결하려면 이름과 휴대폰 번호 뒤 4자리를 보내주세요.",
      "예: 김서연 1234",
    ].join("\n"),
  );
}

function parseIdentity(utterance: unknown) {
  const normalized = text(utterance).normalize("NFKC").replace(/\s+/g, " ");
  const match = normalized.match(/^(.{2,40}?)\s+([0-9]{4})$/u);
  if (!match) return null;

  const name = match[1].trim();
  if (!/^[가-힣A-Za-z][가-힣A-Za-z .'-]{1,39}$/u.test(name)) return null;

  return { name, phoneLast4: match[2] };
}

function isBuilderTest(body: KakaoSkillRequest) {
  const params = record(body.userRequest?.params);
  return params?.surface === "BuilderBotTest" || params?.ignoreMe === "true";
}

async function recordAttempt({
  botUserKey,
  plusfriendUserKey,
  name,
  phoneLast4,
  result,
  profileId,
}: {
  botUserKey: string;
  plusfriendUserKey: string | null;
  name: string;
  phoneLast4: string;
  result: "matched" | "already_linked" | "not_found" | "ambiguous" | "conflict";
  profileId?: string | null;
}) {
  const { error } = await createAdminClient()
    .from("kakao_channel_link_attempts")
    .insert({
      kakao_bot_user_key: botUserKey,
      kakao_plusfriend_user_key: plusfriendUserKey,
      submitted_name: name,
      phone_last4: phoneLast4,
      result,
      matched_profile_id: profileId ?? null,
    });

  if (error) {
    console.error("[kakao-chatbot] link attempt could not be stored", {
      code: error.code,
      message: error.message,
    });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "kakao-chatbot-skill" });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.KAKAO_CHATBOT_SKILL_SECRET?.trim();
  if (!expectedSecret) {
    console.error("[kakao-chatbot] KAKAO_CHATBOT_SKILL_SECRET is not configured");
    return NextResponse.json({ error: "Skill is not configured." }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-kakao-skill-secret")?.trim() ?? "";
  if (!providedSecret || !secureEqual(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const rawBody = await request.text().catch(() => "");
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  let body: KakaoSkillRequest;
  try {
    body = JSON.parse(rawBody) as KakaoSkillRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const identity = parseIdentity(body.userRequest?.utterance);
  if (!identity) return helpResponse();

  const user = body.userRequest?.user;
  const botUserKey = text(user?.id);
  const userType = text(user?.type) || "botUserKey";
  const properties = record(user?.properties);
  const plusfriendUserKey = text(properties?.plusfriendUserKey) || null;

  if (!botUserKey || botUserKey.length > 70) {
    return skillResponse(
      "카카오 사용자 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
    );
  }

  if (isBuilderTest(body)) {
    return skillResponse(
      `${identity.name} ${identity.phoneLast4} 형식을 확인했어요. 테스트 환경에서는 연결 정보를 저장하지 않습니다.`,
    );
  }

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("user_id,name,phone_normalized")
    .eq("name", identity.name)
    .like("phone_normalized", `%${identity.phoneLast4}`)
    .eq("profile_completed", true)
    .limit(3)
    .returns<ProfileMatch[]>();

  if (profileError) {
    console.error("[kakao-chatbot] profile lookup failed", {
      code: profileError.code,
      message: profileError.message,
    });
    return skillResponse(
      "지금은 신청 정보를 확인하기 어려워요. 잠시 후 다시 시도해주세요.",
    );
  }

  if (!profiles || profiles.length === 0) {
    await recordAttempt({
      botUserKey,
      plusfriendUserKey,
      ...identity,
      result: "not_found",
    });
    return skillResponse(
      "일치하는 신청 정보를 찾지 못했어요. 신청할 때 입력한 이름과 휴대폰 번호 뒤 4자리를 다시 확인해주세요.",
    );
  }

  if (profiles.length > 1) {
    await recordAttempt({
      botUserKey,
      plusfriendUserKey,
      ...identity,
      result: "ambiguous",
    });
    return skillResponse(
      "같은 정보의 신청이 여러 건 확인됐어요. 운영자가 확인할 수 있도록 문의를 남겨주세요.",
    );
  }

  const profile = profiles[0];
  const [{ data: linkByKakao, error: kakaoLookupError }, { data: linkByProfile, error: profileLookupError }] =
    await Promise.all([
      admin
        .from("kakao_channel_links")
        .select("profile_id,kakao_bot_user_key")
        .eq("kakao_bot_user_key", botUserKey)
        .maybeSingle<KakaoLink>(),
      admin
        .from("kakao_channel_links")
        .select("profile_id,kakao_bot_user_key")
        .eq("profile_id", profile.user_id)
        .maybeSingle<KakaoLink>(),
    ]);

  if (kakaoLookupError || profileLookupError) {
    console.error("[kakao-chatbot] existing link lookup failed", {
      kakao: kakaoLookupError?.message,
      profile: profileLookupError?.message,
    });
    return skillResponse(
      "지금은 연결 상태를 확인하기 어려워요. 잠시 후 다시 시도해주세요.",
    );
  }

  if (
    (linkByKakao && linkByKakao.profile_id !== profile.user_id) ||
    (linkByProfile && linkByProfile.kakao_bot_user_key !== botUserKey)
  ) {
    await recordAttempt({
      botUserKey,
      plusfriendUserKey,
      ...identity,
      result: "conflict",
      profileId: profile.user_id,
    });
    return skillResponse(
      "이미 다른 카카오 계정과 연결된 신청 정보예요. 운영자에게 문의해주세요.",
    );
  }

  const now = new Date().toISOString();
  if (linkByKakao && linkByProfile) {
    const { error: updateError } = await admin
      .from("kakao_channel_links")
      .update({
        kakao_plusfriend_user_key: plusfriendUserKey,
        kakao_user_type: userType,
        display_name: identity.name,
        phone_last4: identity.phoneLast4,
        status: "active",
        last_seen_at: now,
        updated_at: now,
      })
      .eq("profile_id", profile.user_id)
      .eq("kakao_bot_user_key", botUserKey);

    if (updateError) {
      console.error("[kakao-chatbot] existing link update failed", {
        code: updateError.code,
        message: updateError.message,
      });
      return skillResponse(
        "지금은 연결 상태를 갱신하기 어려워요. 잠시 후 다시 시도해주세요.",
      );
    }

    await recordAttempt({
      botUserKey,
      plusfriendUserKey,
      ...identity,
      result: "already_linked",
      profileId: profile.user_id,
    });
    return skillResponse(`${identity.name}님, 이미 교집합 신청 정보와 연결되어 있어요.`);
  }

  const { error: insertError } = await admin.from("kakao_channel_links").insert({
    profile_id: profile.user_id,
    kakao_bot_user_key: botUserKey,
    kakao_plusfriend_user_key: plusfriendUserKey,
    kakao_user_type: userType,
    display_name: identity.name,
    phone_last4: identity.phoneLast4,
    status: "active",
    verified_at: now,
    last_seen_at: now,
    updated_at: now,
  });

  if (insertError) {
    console.error("[kakao-chatbot] link insert failed", {
      code: insertError.code,
      message: insertError.message,
    });
    await recordAttempt({
      botUserKey,
      plusfriendUserKey,
      ...identity,
      result: "conflict",
      profileId: profile.user_id,
    });
    return skillResponse(
      "연결 상태를 확인하지 못했어요. 운영자에게 문의해주세요.",
    );
  }

  await recordAttempt({
    botUserKey,
    plusfriendUserKey,
    ...identity,
    result: "matched",
    profileId: profile.user_id,
  });

  return skillResponse(
    `${identity.name}님, 교집합 신청 정보가 연결됐어요.\n문의 내용을 남겨주시면 운영자가 확인할게요.`,
  );
}
