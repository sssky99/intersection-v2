import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_USER_VIEW_COOKIE,
  adminUserViewCookieOptions,
  adminUserViewTtlSeconds,
  decryptAdminUserViewSession,
  encryptAdminUserViewSession,
} from "@/lib/adminUserView";
import { ADMIN_SESSION_COOKIE, isAdminSessionTokenValid } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: NextRequest) {
  return isAdminSessionTokenValid(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
}

function clearViewCookie(response: NextResponse) {
  response.cookies.set(ADMIN_USER_VIEW_COOKIE, "", {
    ...adminUserViewCookieOptions,
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "사용자를 선택해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("user_id,name,nickname")
    .eq("user_id", userId)
    .maybeSingle<{
      user_id: string;
      name: string | null;
      nickname: string | null;
    }>();
  if (error) throw error;
  if (!profile) {
    return NextResponse.json({ error: "사용자를 찾지 못했습니다." }, { status: 404 });
  }

  const viewId = randomUUID();
  const targetName =
    profile.name?.trim() || profile.nickname?.trim() || "사용자";
  const expiresAt = new Date(
    Date.now() + adminUserViewTtlSeconds * 1000,
  ).toISOString();
  const { error: auditError } = await admin.from("admin_user_view_audit").insert({
    id: viewId,
    target_user_id: profile.user_id,
    expires_at: expiresAt,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (auditError) throw auditError;

  const response = NextResponse.json({
    view: { userId: profile.user_id, name: targetName, expiresAt },
  });
  response.cookies.set(
    ADMIN_USER_VIEW_COOKIE,
    encryptAdminUserViewSession({
      viewId,
      targetUserId: profile.user_id,
      targetName,
    }),
    adminUserViewCookieOptions,
  );
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const view = decryptAdminUserViewSession(
    request.cookies.get(ADMIN_USER_VIEW_COOKIE)?.value,
  );
  if (view) {
    await createAdminClient()
      .from("admin_user_view_audit")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", view.viewId);
  }

  const response = NextResponse.json({ ended: true });
  clearViewCookie(response);
  return response;
}
