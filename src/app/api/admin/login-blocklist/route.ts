import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import {
  addLoginBlock,
  normalizeLoginPhone,
  removeLoginBlock,
} from "@/lib/loginBlocklist";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function unauthorized() {
  return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const { data, error } = await createAdminClient()
    .from("login_blocklist")
    .select(
      "phone_normalized,display_name,user_id,reason,blocked_at,created_at,updated_at",
    )
    .order("blocked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "차단 목록을 불러오지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ blocks: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as
    | { phone?: unknown; displayName?: unknown; reason?: unknown }
    | null;
  const phone = normalizeLoginPhone(body?.phone);
  if (!phone) {
    return NextResponse.json({ error: "전화번호가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const block = await addLoginBlock({
      phone,
      displayName:
        typeof body?.displayName === "string" ? body.displayName : null,
      reason: typeof body?.reason === "string" ? body.reason : null,
    });
    return NextResponse.json({ block });
  } catch (error) {
    console.error("[admin login blocklist POST]", error);
    return NextResponse.json({ error: "로그인 차단을 적용하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = normalizeLoginPhone(body?.phone);
  if (!phone) {
    return NextResponse.json({ error: "전화번호가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await removeLoginBlock(phone);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin login blocklist DELETE]", error);
    return NextResponse.json({ error: "로그인 차단을 해제하지 못했습니다." }, { status: 500 });
  }
}
