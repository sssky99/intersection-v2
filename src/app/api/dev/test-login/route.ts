import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeInternalPath } from "@/lib/authRedirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

const testEmail = "kim-seohyun.local-test@intersection.local";
const testName = "김서현";

function isLocalRequest(request: NextRequest) {
  return ["localhost", "127.0.0.1", "::1"].includes(
    request.nextUrl.hostname,
  );
}

function testPassword() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("missing-service-role-key");

  return createHash("sha256")
    .update(`${serviceRoleKey}:kim-seohyun-local-test-login`)
    .digest("base64url");
}

function testMembershipEndDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

async function ensureTestUser() {
  const admin = createAdminClient();
  const password = testPassword();
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  let user = usersData.users.find((candidate) => candidate.email === testEmail);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password,
      email_confirm: true,
      user_metadata: { name: testName, local_test_user: true },
    });
    if (error || !data.user) throw error ?? new Error("test-user-create-failed");
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, name: testName, local_test_user: true },
    });
    if (error) throw error;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      user_id: user.id,
      provider: "local_test",
      kakao_id: null,
      name: testName,
      nickname: "서현",
      profile_completed: true,
      questions_completed: true,
      public_intro: "새로운 전시와 조용한 대화를 좋아하는 김서현입니다.",
      public_emoji: "🌷",
      meeting_guidelines_agreed: true,
      membership_status: "active",
      membership_plan: "three_months",
      membership_start_date: new Date().toISOString().slice(0, 10),
      membership_end_date: testMembershipEndDate(),
      is_test_participant: true,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  return password;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || !isLocalRequest(request)) {
    return new NextResponse(null, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    nextPath?: unknown;
  } | null;
  const nextPath = safeInternalPath(
    typeof body?.nextPath === "string" ? body.nextPath : null,
    "/meetings?tab=recommend",
  );

  try {
    const password = await ensureTestUser();
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: testEmail,
      password,
    });
    if (error || !data.session) throw error ?? new Error("test-login-failed");

    return NextResponse.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      nextPath,
    });
  } catch (error) {
    console.error("[dev test login]", error);
    return NextResponse.json(
      { error: "테스트 로그인을 준비하지 못했습니다." },
      { status: 500 },
    );
  }
}
