import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import { isMembershipStatus } from "@/features/membership/membershipTypes";

export const dynamic = "force-dynamic";

const baseProfileFields = [
  "user_id",
  "name",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "public_emoji",
  "public_intro_model",
  "created_at",
  "profile_completed",
  "questions_completed",
];

const precisionProfileFields = ["matching_precision_bonus"];
const basePrecisionProfileFields = [
  ...baseProfileFields,
  ...precisionProfileFields,
];
const testPrecisionProfileFields = [
  ...basePrecisionProfileFields,
  "is_test_participant",
];
const testProfileFields = [...baseProfileFields, "is_test_participant"];

const scoreProfileFields = [
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
];

const membershipProfileFields = [
  "membership_status",
  "membership_plan",
  "membership_start_date",
  "membership_end_date",
  "membership_purchase_clicked_at",
  "membership_updated_at",
];

const membershipPrecisionProfileSelect = [
  ...testPrecisionProfileFields,
  ...membershipProfileFields,
  ...scoreProfileFields,
].join(",");
const membershipPrecisionProfileSelectWithoutTest = [
  ...basePrecisionProfileFields,
  ...membershipProfileFields,
  ...scoreProfileFields,
].join(",");
const membershipPrecisionWithoutScoresProfileSelect = [
  ...testPrecisionProfileFields,
  ...membershipProfileFields,
].join(",");
const membershipPrecisionWithoutScoresProfileSelectWithoutTest = [
  ...basePrecisionProfileFields,
  ...membershipProfileFields,
].join(",");
const scorePrecisionProfileSelect = [
  ...testPrecisionProfileFields,
  ...scoreProfileFields,
].join(",");
const scorePrecisionProfileSelectWithoutTest = [
  ...basePrecisionProfileFields,
  ...scoreProfileFields,
].join(",");
const basePrecisionProfileSelect = testPrecisionProfileFields.join(",");
const basePrecisionProfileSelectWithoutTest =
  basePrecisionProfileFields.join(",");
const membershipProfileSelect = [
  ...testProfileFields,
  ...membershipProfileFields,
  ...scoreProfileFields,
].join(",");
const membershipProfileSelectWithoutTest = [
  ...baseProfileFields,
  ...membershipProfileFields,
  ...scoreProfileFields,
].join(",");
const membershipWithoutScoresProfileSelect = [
  ...testProfileFields,
  ...membershipProfileFields,
].join(",");
const membershipWithoutScoresProfileSelectWithoutTest = [
  ...baseProfileFields,
  ...membershipProfileFields,
].join(",");
const scoreProfileSelect = [...testProfileFields, ...scoreProfileFields].join(
  ",",
);
const scoreProfileSelectWithoutTest = [
  ...baseProfileFields,
  ...scoreProfileFields,
].join(",");
const baseProfileSelect = testProfileFields.join(",");
const baseProfileSelectWithoutTest = baseProfileFields.join(",");

const profileSelects = [
  membershipPrecisionProfileSelect,
  membershipPrecisionProfileSelectWithoutTest,
  membershipPrecisionWithoutScoresProfileSelect,
  membershipPrecisionWithoutScoresProfileSelectWithoutTest,
  scorePrecisionProfileSelect,
  scorePrecisionProfileSelectWithoutTest,
  basePrecisionProfileSelect,
  basePrecisionProfileSelectWithoutTest,
  membershipProfileSelect,
  membershipProfileSelectWithoutTest,
  membershipWithoutScoresProfileSelect,
  membershipWithoutScoresProfileSelectWithoutTest,
  scoreProfileSelect,
  scoreProfileSelectWithoutTest,
  baseProfileSelect,
  baseProfileSelectWithoutTest,
];

function normalizeProfiles(profiles: AdminProfile[]) {
  return profiles.map(normalizeAdminProfile);
}

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function queryErrorMessage(
  label: string,
  error: { message: string; hint?: string | null },
) {
  return [`${label}: ${error.message}`, error.hint].filter(Boolean).join(" | ");
}

function clampScore(value: number) {
  return Math.min(100, Math.max(-100, Math.round(value)));
}

function scoreValue(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clampScore(value);
}

function precisionBonusValue(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(5, Math.max(0, Math.round(value)));
}

function trimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

async function fetchProfiles(supabase: ReturnType<typeof createAdminClient>) {
  const errors: string[] = [];

  for (const [index, select] of profileSelects.entries()) {
    const { data, error } = await supabase
      .from("profiles")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error) {
      return (data ?? []) as unknown as AdminProfile[];
    }

    errors.push(queryErrorMessage(`profile query ${index + 1}`, error));
  }

  throw new Error(errors.join(" | "));
}

async function fetchProfile(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const errors: string[] = [];

  for (const [index, select] of profileSelects.entries()) {
    const { data, error } = await supabase
      .from("profiles")
      .select(select)
      .eq("user_id", userId)
      .single();

    if (!error) {
      return data as unknown as AdminProfile;
    }

    errors.push(queryErrorMessage(`profile query ${index + 1}`, error));
  }

  throw new Error(errors.join(" | "));
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    const supabase = createAdminClient();
    const profiles = await fetchProfiles(supabase);

    return NextResponse.json({
      profiles: normalizeProfiles(profiles),
    });
  } catch (error) {
    console.error("Admin profiles load failed:", error);
    return NextResponse.json(
      { error: "신청자 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    status?: unknown;
    scores?: Partial<Record<(typeof scoreProfileFields)[number], unknown>>;
    publicIntro?: unknown;
    publicEmoji?: unknown;
    isTestParticipant?: unknown;
    matchingPrecisionBonus?: unknown;
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const status = body?.status;
  const updates: Record<string, unknown> = {};

  if (isMembershipStatus(status)) {
    updates.membership_status = status;
    updates.membership_updated_at = new Date().toISOString();
  }

  if (body?.scores && typeof body.scores === "object") {
    for (const field of scoreProfileFields) {
      if (!(field in body.scores)) continue;
      const nextScore = scoreValue(body.scores[field]);
      if (nextScore === undefined) {
        return NextResponse.json(
          { error: "사람 지표 점수는 -100부터 100 사이 숫자여야 합니다." },
          { status: 400 },
        );
      }
      updates[field] = nextScore;
    }
  }

  if (body && "publicIntro" in body) {
    const publicIntro = trimmedText(body.publicIntro);
    if (publicIntro === undefined) {
      return NextResponse.json(
        { error: "GPT 자기소개는 문자열이어야 합니다." },
        { status: 400 },
      );
    }
    updates.public_intro = publicIntro || null;
    updates.public_intro_generated_at = new Date().toISOString();
    updates.public_intro_model = "admin";
  }

  if (body && "publicEmoji" in body) {
    const publicEmoji = trimmedText(body.publicEmoji);
    if (publicEmoji === undefined || publicEmoji.length > 16) {
      return NextResponse.json(
        { error: "이모지는 1~16자 이내로 입력해주세요." },
        { status: 400 },
      );
    }
    updates.public_emoji = publicEmoji || null;
  }

  if (body && "isTestParticipant" in body) {
    if (typeof body.isTestParticipant !== "boolean") {
      return NextResponse.json(
        { error: "운영자 값이 올바르지 않습니다." },
        { status: 400 },
      );
    }
    updates.is_test_participant = body.isTestParticipant;
  }

  if (body && "matchingPrecisionBonus" in body) {
    const nextBonus = precisionBonusValue(body.matchingPrecisionBonus);
    if (nextBonus === undefined) {
      return NextResponse.json(
        { error: "추천 정교화 보정값은 0부터 5 사이 숫자여야 합니다." },
        { status: 400 },
      );
    }
    updates.matching_precision_bonus = nextBonus;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "저장할 프로필 변경 사항이 없습니다." },
      { status: 400 },
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "멤버십 상태 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({
      profile: normalizeAdminProfile(await fetchProfile(supabase, userId)),
    });
  } catch (error) {
    console.error("Admin profile membership save failed:", error);
    return NextResponse.json(
      { error: "멤버십 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
