import { NextRequest, NextResponse } from "next/server";
import { normalizeLoginPhone } from "@/lib/loginBlocklist";
import { isSameOriginRequest, requestActorKey } from "@/lib/requestGuards";

export const dynamic = "force-dynamic";

const rateLimitWindowMs = 10 * 60 * 1000;
const maxRequestsPerWindow = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isLocalDevelopmentAlias(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return false;

  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;

  try {
    const requestUrl = new URL(request.url);
    const sourceUrl = new URL(source);
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

    return (
      localHosts.has(requestUrl.hostname) &&
      localHosts.has(sourceUrl.hostname) &&
      requestUrl.port === sourceUrl.port
    );
  } catch {
    return false;
  }
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) && !isLocalDevelopmentAlias(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(requestActorKey(request))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  const body = (await request.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = normalizeLoginPhone(body?.phone);
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
