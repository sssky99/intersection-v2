import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAdminSessionTokenValid,
} from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { programPayload } from "@/features/admin/programDraft";

export const dynamic = "force-dynamic";
const fields =
  "id,title,course_steps,stage_copy,activity_type,updated_at";
function authorized(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}
const unauthorized = () =>
  NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const { data, error } = await createAdminClient()
    .from("ticket_templates")
    .select(fields)
    .eq("template_kind", "experience")
    .eq("lifecycle_status", "active")
    .order("updated_at", { ascending: false });
  if (error)
    return NextResponse.json(
      { error: "프로그램을 불러오지 못했습니다." },
      { status: 500 },
    );
  return NextResponse.json({ programs: data });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  let payload;
  try {
    payload = programPayload(body?.draft);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
  const admin = createAdminClient();
  // Always create a revision. Existing events and legacy tickets keep their source.
  // Retain recommendation/detail settings that are not exposed in this editor.
  let inherited = {};
  if (body?.sourceId) {
    const { data, error } = await admin
      .from("ticket_templates")
      .select(
        "detail_activities,detail_flow,detail_good_for,mood_tags,recommendation_copy,recommendation_preferred_activities,recommendation_recent_interests,atmosphere_gender_mood,atmosphere_age_band_id",
      )
      .eq("id", body.sourceId)
      .eq("template_kind", "experience")
      .single();
    if (error || !data)
      return NextResponse.json(
        { error: "원본 프로그램을 확인해주세요." },
        { status: 400 },
      );
    inherited = data;
  }
  const { data, error } = await admin
    .from("ticket_templates")
    .insert({ ...inherited, ...payload })
    .select(fields)
    .single();
  if (error) {
    console.error("Program revision save failed:", error);
    return NextResponse.json(
      { error: "프로그램을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
  return NextResponse.json({ program: data });
}
