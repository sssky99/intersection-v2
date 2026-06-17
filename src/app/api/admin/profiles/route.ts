import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import { isMembershipStatus } from "@/features/membership/membershipTypes";

export const dynamic = "force-dynamic";

const baseProfileSelect = [
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
].join(",");

const membershipProfileSelect = [
  baseProfileSelect,
  "membership_status",
  "membership_plan",
  "membership_start_date",
  "membership_end_date",
  "membership_purchase_clicked_at",
  "membership_updated_at",
].join(",");

function normalizeProfiles(profiles: AdminProfile[]) {
  return profiles.map(normalizeAdminProfile);
}

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
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
    const withMembership = await supabase
      .from("profiles")
      .select(membershipProfileSelect)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!withMembership.error) {
      return NextResponse.json({
        profiles: normalizeProfiles(
          (withMembership.data ?? []) as unknown as AdminProfile[],
        ),
      });
    }

    const fallback = await supabase
      .from("profiles")
      .select(baseProfileSelect)
      .order("created_at", { ascending: false })
      .limit(500);

    if (fallback.error) {
      throw new Error(
        [
          `membership query: ${withMembership.error.message}`,
          `base query: ${fallback.error.message}`,
          fallback.error.hint,
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }

    return NextResponse.json({
      profiles: normalizeProfiles(
        (fallback.data ?? []) as unknown as AdminProfile[],
      ),
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
    const { data, error } = await supabase
      .from("profiles")
      .update({
        membership_status: status,
        membership_updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select(membershipProfileSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({
      profile: normalizeAdminProfile(data as unknown as AdminProfile),
    });
  } catch (error) {
    console.error("Admin profile membership save failed:", error);
    return NextResponse.json(
      { error: "멤버십 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
