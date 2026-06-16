import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMembershipPlan } from "@/features/membership/membershipTypes";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    plan?: unknown;
  } | null;

  if (!isMembershipPlan(body?.plan)) {
    return NextResponse.json(
      { error: "멤버십 플랜이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      membership_status: "pending",
      membership_plan: body.plan,
      membership_purchase_clicked_at: now,
      membership_updated_at: now,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("Membership purchase click save failed:", error.message);
    return NextResponse.json(
      { error: "멤버십 신청 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
