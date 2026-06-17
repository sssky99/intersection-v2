import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  displayMembershipStatus,
  isMembershipPlan,
  isMembershipStatus,
  type MembershipPlan,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";

export const dynamic = "force-dynamic";

type AdminMembershipRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  membership_status: MembershipStatus | null;
  membership_plan: MembershipPlan | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
  membership_purchase_clicked_at: string | null;
  membership_updated_at: string | null;
};

const membershipSelect = [
  "user_id",
  "name",
  "phone",
  "membership_status",
  "membership_plan",
  "membership_start_date",
  "membership_end_date",
  "membership_purchase_clicked_at",
  "membership_updated_at",
].join(",");

const statusPriority: Record<MembershipStatus, number> = {
  none: 4,
  pending: 0,
  active: 1,
  expired: 2,
  cancelled: 3,
};

function unauthorized() {
  return NextResponse.json(
    { error: "관리자 인증이 필요합니다." },
    { status: 401 },
  );
}

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function normalizeMembership(row: AdminMembershipRow) {
  const displayStatus =
    displayMembershipStatus({
      status: row.membership_status,
      endDate: row.membership_end_date,
    }) ?? row.membership_status;

  return {
    ...row,
    display_status: displayStatus,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(membershipSelect)
      .in("membership_status", ["active", "expired", "pending"])
      .order("membership_updated_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) throw error;

    const memberships = ((data ?? []) as unknown as AdminMembershipRow[])
      .map(normalizeMembership)
      .sort((left, right) => {
        const leftPriority = left.display_status
          ? statusPriority[left.display_status]
          : 99;
        const rightPriority = right.display_status
          ? statusPriority[right.display_status]
          : 99;

        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        return (
          new Date(right.membership_updated_at ?? 0).getTime() -
          new Date(left.membership_updated_at ?? 0).getTime()
        );
      });

    return NextResponse.json({ memberships });
  } catch (error) {
    console.error("[admin memberships]", error);
    return NextResponse.json(
      { error: "멤버십 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    status?: unknown;
    plan?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  } | null;

  const userId = typeof body?.userId === "string" ? body.userId : "";
  const status = body?.status;
  const plan = body?.plan;
  const startDate =
    typeof body?.startDate === "string" && body.startDate.trim()
      ? body.startDate
      : null;
  const endDate =
    typeof body?.endDate === "string" && body.endDate.trim()
      ? body.endDate
      : null;

  if (!userId) {
    return NextResponse.json(
      { error: "사용자 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!isMembershipStatus(status)) {
    return NextResponse.json(
      { error: "멤버십 상태가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (plan !== null && plan !== undefined && !isMembershipPlan(plan)) {
    return NextResponse.json(
      { error: "멤버십 플랜이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (status === "active" && (!isMembershipPlan(plan) || !startDate || !endDate)) {
    return NextResponse.json(
      {
        error:
          "멤버십 적용중으로 변경하려면 플랜과 기간을 먼저 설정해주세요.",
      },
      { status: 400 },
    );
  }

  try {
    const now = new Date().toISOString();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        membership_status: status,
        membership_plan: isMembershipPlan(plan) ? plan : null,
        membership_start_date: startDate,
        membership_end_date: endDate,
        membership_updated_at: now,
      })
      .eq("user_id", userId)
      .select(membershipSelect)
      .single();

    if (error) throw error;

    return NextResponse.json({
      membership: normalizeMembership(data as unknown as AdminMembershipRow),
    });
  } catch (error) {
    console.error("[admin memberships]", error);
    return NextResponse.json(
      { error: "멤버십 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
