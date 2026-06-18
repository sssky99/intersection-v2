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
  "created_at",
  "profile_completed",
  "questions_completed",
];

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

const baseProfileSelect = baseProfileFields.join(",");
const scoreProfileSelect = [...baseProfileFields, ...scoreProfileFields].join(
  ",",
);
const membershipProfileSelect = [
  ...baseProfileFields,
  ...membershipProfileFields,
  ...scoreProfileFields,
].join(",");
const membershipWithoutScoresProfileSelect = [
  ...baseProfileFields,
  ...membershipProfileFields,
].join(",");

const profileSelects = [
  membershipProfileSelect,
  membershipWithoutScoresProfileSelect,
  scoreProfileSelect,
  baseProfileSelect,
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
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const status = body?.status;

  if (!userId || !isMembershipStatus(status)) {
    return NextResponse.json(
      { error: "멤버십 상태 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        membership_status: status,
        membership_updated_at: new Date().toISOString(),
      })
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
