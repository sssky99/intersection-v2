import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminSessionTokenValid,
  verifyAdminAccessKey,
} from "@/lib/adminAuth";
import { isSameOriginRequest, requestActorKey } from "@/lib/requestGuards";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const maxFailedLoginAttempts = 5;
const loginAttemptWindowMs = 15 * 60 * 1000;
const loginLockMs = 15 * 60 * 1000;
const maxLoginAttemptEntries = 5000;

const loginAttempts = new Map<
  string,
  {
    count: number;
    resetAt: number;
    lockedUntil: number | null;
  }
>();

function loginLockRemainingMs(key: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt) return 0;

  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return attempt.lockedUntil - now;
  }

  if (attempt.resetAt <= now || (attempt.lockedUntil && attempt.lockedUntil <= now)) {
    loginAttempts.delete(key);
  }

  return 0;
}

function registerFailedLogin(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  const attempt =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + loginAttemptWindowMs, lockedUntil: null };

  attempt.count += 1;

  if (attempt.count >= maxFailedLoginAttempts) {
    attempt.lockedUntil = now + loginLockMs;
    attempt.resetAt = attempt.lockedUntil;
  }

  loginAttempts.set(key, attempt);
  if (loginAttempts.size > maxLoginAttemptEntries) {
    for (const [entryKey, entry] of loginAttempts) {
      if (entry.resetAt <= now && (!entry.lockedUntil || entry.lockedUntil <= now)) {
        loginAttempts.delete(entryKey);
      }
    }
  }

  return loginLockRemainingMs(key);
}

function tooManyAttemptsResponse(remainingMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

  return NextResponse.json(
    { error: "Too many admin login attempts. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: isAdminSessionTokenValid(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    ),
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const loginKey = requestActorKey(request);
  const lockRemainingMs = loginLockRemainingMs(loginKey);

  if (lockRemainingMs > 0) {
    return tooManyAttemptsResponse(lockRemainingMs);
  }

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
    const failedLockRemainingMs = registerFailedLogin(loginKey);

    if (failedLockRemainingMs > 0) {
      return tooManyAttemptsResponse(failedLockRemainingMs);
    }

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
  loginAttempts.delete(loginKey);
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
