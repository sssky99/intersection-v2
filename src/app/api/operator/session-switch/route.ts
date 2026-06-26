import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import {
  decryptOperatorReturnSession,
  encryptOperatorReturnSession,
  isOperatorAccount,
  OPERATOR_RETURN_SESSION_COOKIE,
  operatorReturnSessionCookieOptions,
} from "@/lib/operatorSessionSwitch";
import {
  operatorTestAccountByUserId,
} from "@/lib/operatorTestAccounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type OperatorProfile = {
  user_id: string;
  provider: string | null;
  is_test_participant: boolean | null;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function sessionClient() {
  return createAuthClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function profileForUser(userId: string) {
  return createAdminClient()
    .from("profiles")
    .select("user_id,provider,is_test_participant")
    .eq("user_id", userId)
    .maybeSingle<OperatorProfile>();
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "허용되지 않은 요청입니다." }, 403);
  }

  const body = (await request.json().catch(() => null)) as {
    targetUserId?: unknown;
  } | null;
  const targetUserId =
    typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const target = operatorTestAccountByUserId(targetUserId);

  if (!target) {
    return noStoreJson({ error: "전환할 테스트 계정이 올바르지 않습니다." }, 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return noStoreJson({ error: "로그인이 필요합니다." }, 401);
  }

  const { data: operatorProfile, error: profileError } =
    await profileForUser(user.id);
  const admin = createAdminClient();
  const { data: authoritativeUserData, error: authoritativeUserError } =
    await admin.auth.admin.getUserById(user.id);
  if (
    profileError ||
    authoritativeUserError ||
    !authoritativeUserData.user ||
    !operatorProfile ||
    !isOperatorAccount(authoritativeUserData.user, operatorProfile)
  ) {
    return noStoreJson({ error: "운영자 계정만 사용할 수 있습니다." }, 403);
  }

  const {
    data: { session: operatorSession },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !operatorSession) {
    return noStoreJson({ error: "운영자 세션을 확인하지 못했습니다." }, 401);
  }

  try {
    const { data: targetUserData, error: targetUserError } =
      await admin.auth.admin.getUserById(target.userId);
    const targetUser = targetUserData.user;

    if (
      targetUserError ||
      !targetUser ||
      targetUser.email !== target.email ||
      targetUser.user_metadata?.local_test_user !== true
    ) {
      return noStoreJson(
        { error: `${target.name} 테스트 계정을 확인하지 못했습니다.` },
        404,
      );
    }

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
      });
    if (linkError || !linkData.properties.hashed_token) {
      throw linkError ?? new Error("test-account-link-failed");
    }

    const { data: verified, error: verifyError } =
      await sessionClient().auth.verifyOtp({
        type: "email",
        token_hash: linkData.properties.hashed_token,
      });
    if (
      verifyError ||
      !verified.session ||
      verified.user?.id !== target.userId
    ) {
      throw verifyError ?? new Error("test-account-session-failed");
    }

    const returnSession = encryptOperatorReturnSession({
      operatorUserId: user.id,
      targetUserId: target.userId,
      accessToken: operatorSession.access_token,
      refreshToken: operatorSession.refresh_token,
    });
    const response = noStoreJson({
      account: { userId: target.userId, name: target.name },
      accessToken: verified.session.access_token,
      refreshToken: verified.session.refresh_token,
    });
    response.cookies.set(
      OPERATOR_RETURN_SESSION_COOKIE,
      returnSession,
      operatorReturnSessionCookieOptions,
    );
    return response;
  } catch (error) {
    console.error("[operator session switch]", error);
    return noStoreJson(
      { error: `${target.name} 계정으로 전환하지 못했습니다.` },
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "허용되지 않은 요청입니다." }, 403);
  }

  const returnSession = decryptOperatorReturnSession(
    request.cookies.get(OPERATOR_RETURN_SESSION_COOKIE)?.value,
  );
  if (!returnSession) {
    const response = noStoreJson(
      { error: "복귀할 운영자 세션이 없거나 만료됐습니다." },
      401,
    );
    response.cookies.set(OPERATOR_RETURN_SESSION_COOKIE, "", {
      ...operatorReturnSessionCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const target = currentUser
    ? operatorTestAccountByUserId(currentUser.id)
    : null;
  if (!target || currentUser?.id !== returnSession.targetUserId) {
    return noStoreJson({ error: "테스트 계정 세션을 확인하지 못했습니다." }, 403);
  }

  try {
    const auth = sessionClient();
    const { data: restored, error: restoreError } =
      await auth.auth.setSession({
        access_token: returnSession.accessToken,
        refresh_token: returnSession.refreshToken,
      });
    if (
      restoreError ||
      !restored.session ||
      restored.user?.id !== returnSession.operatorUserId
    ) {
      throw restoreError ?? new Error("operator-session-restore-failed");
    }

    const { data: operatorProfile, error: profileError } =
      await profileForUser(restored.user.id);
    const admin = createAdminClient();
    const { data: authoritativeUserData, error: authoritativeUserError } =
      await admin.auth.admin.getUserById(restored.user.id);
    if (
      profileError ||
      authoritativeUserError ||
      !authoritativeUserData.user ||
      !operatorProfile ||
      !isOperatorAccount(authoritativeUserData.user, operatorProfile)
    ) {
      return noStoreJson(
        { error: "운영자 권한이 더 이상 유효하지 않습니다." },
        403,
      );
    }

    const response = noStoreJson({
      accessToken: restored.session.access_token,
      refreshToken: restored.session.refresh_token,
    });
    response.cookies.set(OPERATOR_RETURN_SESSION_COOKIE, "", {
      ...operatorReturnSessionCookieOptions,
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("[operator session restore]", error);
    return noStoreJson(
      { error: "운영자 계정으로 돌아가지 못했습니다." },
      500,
    );
  }
}
