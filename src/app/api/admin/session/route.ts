import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminSessionTokenValid,
  verifyAdminAccessKey,
} from "@/lib/adminAuth";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: isAdminSessionTokenValid(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    ),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    accessKey?: unknown;
  } | null;
  const accessKey = typeof body?.accessKey === "string" ? body.accessKey : "";
  const result = verifyAdminAccessKey(accessKey);

  if (result.reason === "missing-key") {
    return NextResponse.json(
      { error: "관리자 키가 서버에 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: "관리자 키가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "관리자 세션을 만들지 못했습니다." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, cookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
  return response;
}
