import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAdminProfile,
  type AdminAlgorithmParameter,
  type AdminPaymentTransaction,
  type AdminProfile,
  type AdminProfileAnswer,
} from "@/features/admin/adminProfile";
import {
  calculateRedFlagAssessment,
  normalizeRedFlagManualFlags,
  normalizeRedFlagManualHistoryCount,
  redFlagManualRules,
  type RedFlagManualFlags,
  type RedFlagParticipation,
} from "@/features/admin/redFlags";
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
  "archived_at",
  "archived_reason",
  "photo_url",
  "public_intro",
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

const USER_ANSWERS_PAGE_SIZE = 1000;
const ALGORITHM_PARAMETERS_PAGE_SIZE = 1000;
const USER_ID_BATCH_SIZE = 100;
const ADMIN_PROFILE_LIMIT = 50;

type AdminProfileListRow = Pick<
  AdminProfile,
  | "user_id"
  | "name"
  | "phone"
  | "gender"
  | "birth_year"
  | "profile_completed"
  | "questions_completed"
  | "membership_status"
  | "membership_plan"
  | "membership_start_date"
  | "membership_end_date"
  | "created_at"
  | "has_payment"
  | "one_time_paid"
> & { total_count: number };

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function allowedParam<T extends string>(
  value: string | null,
  allowed: readonly T[],
) {
  return value && allowed.includes(value as T) ? (value as T) : null;
}

function listProfile(row: AdminProfileListRow): AdminProfile {
  return normalizeAdminProfile({
    user_id: row.user_id,
    name: row.name,
    phone: row.phone,
    gender: row.gender,
    birth_year: row.birth_year,
    profile_completed: row.profile_completed,
    questions_completed: row.questions_completed,
    membership_status: row.membership_status,
    membership_plan: row.membership_plan,
    membership_start_date: row.membership_start_date,
    membership_end_date: row.membership_end_date,
    created_at: row.created_at,
    has_payment: row.has_payment,
    one_time_paid: row.one_time_paid,
    nickname: null,
    mbti: null,
    photo_url: null,
    public_intro: null,
    details_loaded: false,
  });
}

async function fetchProfilePage(
  supabase: ReturnType<typeof createAdminClient>,
  request: NextRequest,
) {
  const params = request.nextUrl.searchParams;
  const page = positiveInteger(params.get("page"), 1);
  const limit = Math.min(
    positiveInteger(params.get("limit"), ADMIN_PROFILE_LIMIT),
    ADMIN_PROFILE_LIMIT,
  );
  const search = params.get("search")?.trim().slice(0, 80) || null;
  const gender = params.get("gender")?.trim().slice(0, 20) || null;
  const membership = allowedParam(params.get("membership"), [
    "active",
    "inactive",
  ] as const);
  const payment = allowedParam(params.get("payment"), [
    "paid",
    "unpaid",
  ] as const);
  const completion = allowedParam(params.get("completion"), [
    "complete",
    "incomplete",
  ] as const);
  const birthSort = allowedParam(params.get("birthSort"), [
    "birth-asc",
    "birth-desc",
  ] as const);

  const { data, error } = await supabase.rpc("admin_list_profiles", {
    p_page: page,
    p_limit: limit,
    p_search: search,
    p_gender: gender,
    p_membership: membership,
    p_payment: payment,
    p_completion: completion,
    p_birth_sort: birthSort,
  });
  if (error) throw error;

  const rows = (data ?? []) as AdminProfileListRow[];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    profiles: rows.map(listProfile),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

async function fetchPaymentHistory(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select(
      "id,payment_kind,product_code,amount,currency,status,occurred_at,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AdminPaymentTransaction[];
}

async function attachOneTimePayments(
  supabase: ReturnType<typeof createAdminClient>,
  profiles: AdminProfile[],
) {
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  if (userIds.length === 0) return profiles;

  const paidUserIds = new Set<string>();

  for (
    let batchStart = 0;
    batchStart < userIds.length;
    batchStart += USER_ID_BATCH_SIZE
  ) {
    const userIdBatch = userIds.slice(
      batchStart,
      batchStart + USER_ID_BATCH_SIZE,
    );
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("user_id")
      .in("user_id", userIdBatch)
      .eq("payment_kind", "one_time")
      .eq("status", "completed");
    if (error) throw error;

    for (const row of data ?? []) {
      if (row.user_id) paidUserIds.add(row.user_id);
    }
  }

  return profiles.map((profile) => ({
    ...profile,
    one_time_paid: paidUserIds.has(profile.user_id),
  }));
}

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

async function attachAlgorithmParameters(
  supabase: ReturnType<typeof createAdminClient>,
  profiles: AdminProfile[],
) {
  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  if (userIds.length === 0) return profiles;

  const parameters: AdminAlgorithmParameter[] = [];
  for (
    let batchStart = 0;
    batchStart < userIds.length;
    batchStart += USER_ID_BATCH_SIZE
  ) {
    const userIdBatch = userIds.slice(
      batchStart,
      batchStart + USER_ID_BATCH_SIZE,
    );

    for (let from = 0; ; from += ALGORITHM_PARAMETERS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("profile_algorithm_parameters")
        .select("user_id,question_order,mode,position,updated_at")
        .in("user_id", userIdBatch)
        .order("user_id", { ascending: true })
        .order("position", { ascending: true })
        .range(from, from + ALGORITHM_PARAMETERS_PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as unknown as AdminAlgorithmParameter[];
      parameters.push(...page);
      if (page.length < ALGORITHM_PARAMETERS_PAGE_SIZE) break;
    }
  }

  const parametersByUserId = new Map<string, AdminAlgorithmParameter[]>();
  for (const parameter of parameters) {
    const current = parametersByUserId.get(parameter.user_id) ?? [];
    current.push(parameter);
    parametersByUserId.set(parameter.user_id, current);
  }

  return profiles.map((profile) => ({
    ...profile,
    algorithm_parameters: parametersByUserId.get(profile.user_id) ?? [],
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

  const { data, error } = await supabase
    .from("profile_operator_ratings")
    .select("user_id,rating,updated_at")
    .in("user_id", userIds);
  if (error) throw error;
  rememberRatings(data ?? []);

  return profiles.map((profile) => {
    const rating = ratings.get(profile.user_id);
    return {
      ...profile,
      operator_rating: rating?.rating ?? null,
      operator_rating_updated_at: rating?.updated_at ?? null,
    };
  });
}

async function attachRedFlagAssessment(
  supabase: ReturnType<typeof createAdminClient>,
  profile: AdminProfile,
) {
  const { data: review, error: reviewError } = await supabase
    .from("profile_red_flag_reviews")
    .select(
      "manual_flags,manual_adjustment,manual_no_show_count,manual_same_day_cancellation_count,updated_at",
    )
    .eq("user_id", profile.user_id)
    .maybeSingle<{
      manual_flags: Record<string, unknown> | null;
      manual_adjustment: number | null;
      manual_no_show_count: number | null;
      manual_same_day_cancellation_count: number | null;
      updated_at: string | null;
    }>();
  if (reviewError) throw reviewError;

  const { data: participations, error: participationsError } = await supabase
    .from("ticket_participations")
    .select("status,arrival_status,cancelled_at,ticket_instance_id")
    .eq("user_id", profile.user_id);
  if (participationsError) throw participationsError;

  const instanceIds = Array.from(
    new Set(
      (participations ?? [])
        .map((participation) => participation.ticket_instance_id)
        .filter((id): id is string => typeof id === "string" && Boolean(id)),
    ),
  );
  const { data: instances, error: instancesError } = instanceIds.length
    ? await supabase
        .from("ticket_instances")
        .select("id,event_date")
        .in("id", instanceIds)
    : { data: [], error: null };
  if (instancesError) throw instancesError;

  const eventDateByInstanceId = new Map(
    (instances ?? []).map((instance) => [instance.id, instance.event_date]),
  );
  const history: RedFlagParticipation[] = (participations ?? []).map(
    (participation) => ({
      status: participation.status ?? null,
      arrival_status: participation.arrival_status ?? null,
      cancelled_at: participation.cancelled_at ?? null,
      event_date:
        eventDateByInstanceId.get(participation.ticket_instance_id) ?? null,
    }),
  );
  const assessment = calculateRedFlagAssessment({
    answers: profile.answers ?? [],
    participations: history,
    manualFlags: normalizeRedFlagManualFlags(review?.manual_flags),
    manualAdjustment: Number(review?.manual_adjustment ?? 0),
    manualNoShowCount: Number(review?.manual_no_show_count ?? 0),
    manualSameDayCancellationCount: Number(
      review?.manual_same_day_cancellation_count ?? 0,
    ),
    reviewedAt: review?.updated_at ?? null,
  });

  return normalizeAdminProfile({
    ...profile,
    red_flag_score: assessment.score,
    red_flag_reasons: assessment.reasons,
    red_flag_manual_flags: assessment.manualFlags,
    red_flag_manual_adjustment: assessment.manualAdjustment,
    red_flag_manual_no_show_count: assessment.manualNoShowCount,
    red_flag_manual_same_day_cancellation_count:
      assessment.manualSameDayCancellationCount,
    red_flag_reviewed_at: assessment.reviewedAt,
  });
}

function mergeProfileAttachments(
  profiles: AdminProfile[],
  attachments: AdminProfile[][],
) {
  const byUserId = attachments.map(
    (rows) => new Map(rows.map((row) => [row.user_id, row])),
  );

  return profiles.map((profile) =>
    byUserId.reduce(
      (merged, lookup) => ({ ...merged, ...(lookup.get(profile.user_id) ?? {}) }),
      profile,
    ),
  );
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
    value < 0.1 ||
    value > 5 ||
    !Number.isInteger(value * 10)
  ) {
    return undefined;
  }
  return Math.round(value * 10) / 10;
}

function trimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
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
    const supabase = createAdminClient({ timeoutMs: 10000 });
    const requestedUserId = request.nextUrl.searchParams.get("userId")?.trim();

    if (requestedUserId) {
      const profile = await fetchProfile(supabase, requestedUserId);
      const [ratings, parameters, answers, oneTimePayments, paymentHistory] =
        await Promise.all([
          attachOperatorRatings(supabase, [profile]),
          attachAlgorithmParameters(supabase, [profile]),
          attachProfileAnswers(supabase, [profile]),
          attachOneTimePayments(supabase, [profile]),
          fetchPaymentHistory(supabase, requestedUserId),
        ]);
      const [profileWithDetails] = mergeProfileAttachments(
        [profile],
        [ratings, parameters, answers, oneTimePayments],
      );
      const profileWithRedFlags = await attachRedFlagAssessment(
        supabase,
        profileWithDetails,
      );

      return NextResponse.json({
        profile: normalizeAdminProfile({
          ...profileWithRedFlags,
          has_payment: paymentHistory.some((item) => item.status === "completed"),
          payment_history: paymentHistory,
          details_loaded: true,
        }),
      });
    }

    return NextResponse.json(await fetchProfilePage(supabase, request));
  } catch (error) {
    console.error("Admin profiles load failed:", error);
    return NextResponse.json(
      { error: "신청자 목록을 불러오지 못했습니다." },
      { status: 503, headers: { "Retry-After": "5" } },
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
    isTestParticipant?: unknown;
    matchingPrecisionBonus?: unknown;
    operatorRating?: unknown;
    redFlagManualFlags?: unknown;
    redFlagManualAdjustment?: unknown;
    redFlagManualNoShowCount?: unknown;
    redFlagManualSameDayCancellationCount?: unknown;
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const status = body?.status;
  const updates: Record<string, unknown> = {};
  let operatorRating: number | null | undefined;
  let redFlagManualFlags: RedFlagManualFlags | undefined;
  let redFlagManualAdjustment: number | undefined;
  let redFlagManualNoShowCount: number | undefined;
  let redFlagManualSameDayCancellationCount: number | undefined;

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
        { error: "운영자 평점은 0.1부터 5까지 0.1 단위로 입력해주세요." },
        { status: 400 },
      );
    }
    operatorRating = nextRating;
  }

  if (body && "redFlagManualFlags" in body) {
    if (
      !body.redFlagManualFlags ||
      typeof body.redFlagManualFlags !== "object" ||
      Array.isArray(body.redFlagManualFlags)
    ) {
      return NextResponse.json(
        { error: "레드 플래그 검토 값이 올바르지 않습니다." },
        { status: 400 },
      );
    }
    const allowedKeys = new Set<string>(
      redFlagManualRules.map((rule) => rule.key),
    );
    const submittedKeys = Object.keys(
      body.redFlagManualFlags as Record<string, unknown>,
    );
    if (submittedKeys.some((key) => !allowedKeys.has(key))) {
      return NextResponse.json(
        { error: "지원하지 않는 레드 플래그 항목이 포함되어 있습니다." },
        { status: 400 },
      );
    }
    redFlagManualFlags = normalizeRedFlagManualFlags(body.redFlagManualFlags);
  }

  if (body && "redFlagManualAdjustment" in body) {
    const value = body.redFlagManualAdjustment;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < -5 ||
      value > 5 ||
      !Number.isInteger(value * 2)
    ) {
      return NextResponse.json(
        { error: "레드 플래그 보정값은 -5부터 5까지 0.5 단위로 입력해주세요." },
        { status: 400 },
      );
    }
    redFlagManualAdjustment = Math.round(value * 2) / 2;
  }

  if (body && "redFlagManualNoShowCount" in body) {
    const value = body.redFlagManualNoShowCount;
    if (
      typeof value !== "number" ||
      normalizeRedFlagManualHistoryCount(value) !== value
    ) {
      return NextResponse.json(
        { error: "추가 노쇼 횟수는 0부터 99까지 정수로 입력해주세요." },
        { status: 400 },
      );
    }
    redFlagManualNoShowCount = value;
  }

  if (body && "redFlagManualSameDayCancellationCount" in body) {
    const value = body.redFlagManualSameDayCancellationCount;
    if (
      typeof value !== "number" ||
      normalizeRedFlagManualHistoryCount(value) !== value
    ) {
      return NextResponse.json(
        { error: "추가 당일 취소 횟수는 0부터 99까지 정수로 입력해주세요." },
        { status: 400 },
      );
    }
    redFlagManualSameDayCancellationCount = value;
  }

  if (
    Object.keys(updates).length === 0 &&
    operatorRating === undefined &&
    redFlagManualFlags === undefined &&
    redFlagManualAdjustment === undefined &&
    redFlagManualNoShowCount === undefined &&
    redFlagManualSameDayCancellationCount === undefined
  ) {
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
    const supabase = createAdminClient({ timeoutMs: 5000 });
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

    if (
      redFlagManualFlags !== undefined ||
      redFlagManualAdjustment !== undefined ||
      redFlagManualNoShowCount !== undefined ||
      redFlagManualSameDayCancellationCount !== undefined
    ) {
      const { data: currentReview, error: currentReviewError } = await supabase
        .from("profile_red_flag_reviews")
        .select(
          "manual_flags,manual_adjustment,manual_no_show_count,manual_same_day_cancellation_count",
        )
        .eq("user_id", userId)
        .maybeSingle<{
          manual_flags: Record<string, unknown> | null;
          manual_adjustment: number | null;
          manual_no_show_count: number | null;
          manual_same_day_cancellation_count: number | null;
        }>();
      if (currentReviewError) throw currentReviewError;

      const nextManualFlags =
        redFlagManualFlags ??
        normalizeRedFlagManualFlags(currentReview?.manual_flags);
      const nextManualAdjustment =
        redFlagManualAdjustment ?? Number(currentReview?.manual_adjustment ?? 0);
      const nextManualNoShowCount =
        redFlagManualNoShowCount ??
        Number(currentReview?.manual_no_show_count ?? 0);
      const nextManualSameDayCancellationCount =
        redFlagManualSameDayCancellationCount ??
        Number(currentReview?.manual_same_day_cancellation_count ?? 0);
      const hasManualFlag = redFlagManualRules.some(
        (rule) => nextManualFlags[rule.key] === true,
      );
      if (
        hasManualFlag ||
        nextManualAdjustment !== 0 ||
        nextManualNoShowCount > 0 ||
        nextManualSameDayCancellationCount > 0
      ) {
        const { error } = await supabase
          .from("profile_red_flag_reviews")
          .upsert({
            user_id: userId,
            manual_flags: nextManualFlags,
            manual_adjustment: nextManualAdjustment,
            manual_no_show_count: nextManualNoShowCount,
            manual_same_day_cancellation_count:
              nextManualSameDayCancellationCount,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_red_flag_reviews")
          .delete()
          .eq("user_id", userId);
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

    const profile = await fetchProfile(supabase, userId);
    const attachments = await Promise.all([
      attachOperatorRatings(supabase, [profile]),
      attachAlgorithmParameters(supabase, [profile]),
      attachProfileAnswers(supabase, [profile]),
      attachOneTimePayments(supabase, [profile]),
    ]);
    const [profileWithDetails] = mergeProfileAttachments(
      [profile],
      attachments,
    );
    const profileWithRedFlags = await attachRedFlagAssessment(
      supabase,
      profileWithDetails,
    );

    return NextResponse.json({
      profile: normalizeAdminProfile({
        ...profileWithRedFlags,
        details_loaded: true,
      }),
    });
  } catch (error) {
    console.error("Admin profile membership save failed:", error);
    return NextResponse.json(
      { error: "멤버십 상태를 저장하지 못했습니다." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
}
