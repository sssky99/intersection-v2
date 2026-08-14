import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAdminProfile,
  type AdminProfile,
  type AdminProfileAnswer,
} from "@/features/admin/adminProfile";
import { isMembershipStatus } from "@/features/membership/membershipTypes";

export const dynamic = "force-dynamic";

const baseProfileFields = [
  "user_id",
  "name",
  "nickname",
  "gender",
  "birth_year",
  "mbti",
  "phone",
  "photo_url",
  "public_intro",
  "public_emoji",
  "public_intro_model",
  "conversation_result_code",
  "conversation_result_version",
  "conversation_result_calculated_at",
  "conversation_result_source",
  "conversation_result_confidence",
  "created_at",
  "profile_completed",
  "questions_completed",
  "questions_completed_at",
  "basic_info_completed_at",
  "profile_completed_at",
  "profile_experience_version",
  "profile_archetype_id",
  "profile_archetype_version",
  "profile_archetype_assigned_at",
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

const PROFILE_PAGE_SIZE = 1000;
const USER_ANSWERS_PAGE_SIZE = 1000;
const USER_ID_BATCH_SIZE = 100;

async function attachProfileAnswers(
  supabase: ReturnType<typeof createAdminClient>,
  profiles: AdminProfile[],
) {
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  if (userIds.length === 0) return profiles;

  const answers: AdminProfileAnswer[] = [];

  for (
    let batchStart = 0;
    batchStart < userIds.length;
    batchStart += USER_ID_BATCH_SIZE
  ) {
    const userIdBatch = userIds.slice(
      batchStart,
      batchStart + USER_ID_BATCH_SIZE,
    );

    for (let from = 0; ; from += USER_ANSWERS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("user_answers")
        .select(
          "user_id,question_order,category,question_type,answer_value,answer_values,answer_text,other_text,updated_at",
        )
        .in("user_id", userIdBatch)
        .order("user_id", { ascending: true })
        .order("question_order", { ascending: true })
        .range(from, from + USER_ANSWERS_PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as unknown as AdminProfileAnswer[];
      answers.push(...page);

      if (page.length < USER_ANSWERS_PAGE_SIZE) break;
    }
  }

  const answersByUserId = new Map<string, AdminProfileAnswer[]>();
  for (const answer of answers) {
    const current = answersByUserId.get(answer.user_id) ?? [];
    current.push(answer);
    answersByUserId.set(answer.user_id, current);
  }

  return profiles.map((profile) => ({
    ...profile,
    answers: answersByUserId.get(profile.user_id) ?? [],
  }));
}

async function attachOperatorRatings(
  supabase: ReturnType<typeof createAdminClient>,
  profiles: AdminProfile[],
) {
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  if (userIds.length === 0) return profiles;

  const ratings = new Map<
    string,
    { rating: number; updated_at: string | null }
  >();

  const rememberRatings = (
    rows: Array<{ user_id: string; rating: number; updated_at: string | null }>,
  ) => {
    for (const row of rows) {
      ratings.set(row.user_id, {
        rating: Number(row.rating),
        updated_at: row.updated_at,
      });
    }
  };

  if (userIds.length <= USER_ID_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("profile_operator_ratings")
      .select("user_id,rating,updated_at")
      .in("user_id", userIds);
    if (error) throw error;
    rememberRatings(data ?? []);
  } else {
    for (let from = 0; ; from += PROFILE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("profile_operator_ratings")
        .select("user_id,rating,updated_at")
        .range(from, from + PROFILE_PAGE_SIZE - 1);
      if (error) throw error;
      const page = data ?? [];
      rememberRatings(page);
      if (page.length < PROFILE_PAGE_SIZE) break;
    }
  }

  return profiles.map((profile) => {
    const rating = ratings.get(profile.user_id);
    return {
      ...profile,
      operator_rating: rating?.rating ?? null,
      operator_rating_updated_at: rating?.updated_at ?? null,
    };
  });
}

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

function precisionBonusValue(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(5, Math.max(0, Math.round(value)));
}

function operatorRatingValue(value: unknown) {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0.5 ||
    value > 5 ||
    !Number.isInteger(value * 2)
  ) {
    return undefined;
  }
  return value;
}

function trimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

async function fetchProfiles(supabase: ReturnType<typeof createAdminClient>) {
  const errors: string[] = [];

  for (const [index, select] of profileSelects.entries()) {
    const profiles: AdminProfile[] = [];
    let selectError: { message: string; hint?: string | null } | null = null;

    for (let from = 0; ; from += PROFILE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("profiles")
        .select(select)
        .order("created_at", { ascending: false })
        .order("user_id", { ascending: true })
        .range(from, from + PROFILE_PAGE_SIZE - 1);

      if (error) {
        selectError = error;
        break;
      }

      const page = (data ?? []) as unknown as AdminProfile[];
      profiles.push(...page);
      if (page.length < PROFILE_PAGE_SIZE) return profiles;
    }

    if (selectError) {
      errors.push(
        queryErrorMessage(`profile query ${index + 1}`, selectError),
      );
    }
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
    const profilesWithRatings = await attachOperatorRatings(
      supabase,
      profiles,
    );
    const profilesWithAnswers = await attachProfileAnswers(
      supabase,
      profilesWithRatings,
    );

    return NextResponse.json({
      profiles: normalizeProfiles(profilesWithAnswers),
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
    publicIntro?: unknown;
    publicEmoji?: unknown;
    isTestParticipant?: unknown;
    matchingPrecisionBonus?: unknown;
    operatorRating?: unknown;
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const status = body?.status;
  const updates: Record<string, unknown> = {};
  let operatorRating: number | null | undefined;

  if (isMembershipStatus(status)) {
    updates.membership_status = status;
    updates.membership_updated_at = new Date().toISOString();
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

  if (body && "operatorRating" in body) {
    const nextRating = operatorRatingValue(body.operatorRating);
    if (nextRating === undefined) {
      return NextResponse.json(
        { error: "운영자 평점은 0.5부터 5까지 0.5 단위로 입력해주세요." },
        { status: 400 },
      );
    }
    operatorRating = nextRating;
  }

  if (Object.keys(updates).length === 0 && operatorRating === undefined) {
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
    const operatorUpdate =
      typeof body?.isTestParticipant === "boolean"
        ? await supabase
            .from("profiles")
            .select("provider,is_test_participant")
            .eq("user_id", userId)
            .single<{
              provider: string | null;
              is_test_participant: boolean | null;
            }>()
        : null;
    if (operatorUpdate?.error) throw operatorUpdate.error;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);

      if (error) throw error;
    }

    if (operatorRating !== undefined) {
      if (operatorRating === null) {
        const { error } = await supabase
          .from("profile_operator_ratings")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_operator_ratings")
          .upsert({
            user_id: userId,
            rating: operatorRating,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    }

    if (operatorUpdate?.data) {
      const { data: authUserData, error: authUserError } =
        await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUserData.user) {
        await supabase
          .from("profiles")
          .update({
            is_test_participant:
              operatorUpdate.data.is_test_participant === true,
          })
          .eq("user_id", userId);
        throw authUserError ?? new Error("auth-user-not-found");
      }

      const { error: metadataError } =
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: {
            ...authUserData.user.app_metadata,
            operator_profile:
              body?.isTestParticipant === true &&
              operatorUpdate.data.provider === "kakao",
          },
        });
      if (metadataError) {
        await supabase
          .from("profiles")
          .update({
            is_test_participant:
              operatorUpdate.data.is_test_participant === true,
          })
          .eq("user_id", userId);
        throw metadataError;
      }
    }

    return NextResponse.json({
      profile: normalizeAdminProfile(
        (
          await attachProfileAnswers(
            supabase,
            await attachOperatorRatings(supabase, [
              await fetchProfile(supabase, userId),
            ]),
          )
        )[0],
      ),
    });
  } catch (error) {
    console.error("Admin profile membership save failed:", error);
    return NextResponse.json(
      { error: "멤버십 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
