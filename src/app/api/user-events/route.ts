import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, requestActorKey } from "@/lib/requestGuards";
import { createClient } from "@/lib/supabase/server";
import { recordUserEvent, type UserEventMetadata } from "@/lib/userEvents";

export const dynamic = "force-dynamic";

type UserEventBody = {
  anonymousSessionId?: unknown;
  applicationId?: unknown;
  eventName?: unknown;
  path?: unknown;
  referrer?: unknown;
  metadata?: unknown;
};

const allowedEventNames = new Set([
  "landing_view",
  "kakao_login_click",
  "kakao_auth_return",
  "login_success",
  "question_start",
  "question_answered",
  "ticket_test_complete",
  "choice_questions_complete",
  "text_questions_complete",
  "questions_complete",
  "basic_info_start",
  "basic_info_complete",
  "profile_generated",
  "recommendation_view",
  "ticket_detail_view",
  "application_submit_click",
  "application_created",
  "membership_purchase_click",
]);

const maxBodyBytes = 12 * 1024;
const maxMetadataBytes = 6 * 1024;
const maxEventNameLength = 80;
const maxSessionIdLength = 120;
const maxApplicationIdLength = 80;
const maxPathLength = 500;
const maxReferrerLength = 500;
const rateLimitWindowMs = 60 * 1000;
const maxEventsPerWindow = 80;
const eventRateLimits = new Map<string, { count: number; resetAt: number }>();
const encoder = new TextEncoder();

function byteLength(value: string) {
  return encoder.encode(value).length;
}

function text(value: unknown, maxLength: number) {
  if (typeof value !== "string") return { ok: true, value: "" };

  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { ok: false, value: "" };
  return { ok: true, value: trimmed };
}

function metadata(value: unknown): UserEventMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as UserEventMetadata;
}

function metadataWithinLimit(value: UserEventMetadata) {
  return byteLength(JSON.stringify(value)) <= maxMetadataBytes;
}

function rateLimited(key: string) {
  const now = Date.now();
  const current = eventRateLimits.get(key);

  if (current && current.resetAt > now) {
    if (current.count >= maxEventsPerWindow) return true;
    current.count += 1;
    return false;
  }

  eventRateLimits.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
  if (eventRateLimits.size > 5000) {
    for (const [entryKey, entry] of eventRateLimits) {
      if (entry.resetAt <= now) eventRateLimits.delete(entryKey);
    }
  }
  return false;
}

function rateLimitResponse() {
  return NextResponse.json(
    { error: "Too many event requests." },
    {
      status: 429,
      headers: { "Retry-After": `${Math.ceil(rateLimitWindowMs / 1000)}` },
    },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await request.text().catch(() => "");
  if (byteLength(rawBody) > maxBodyBytes) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const parsedBody = rawBody
    ? await Promise.resolve()
        .then(() => JSON.parse(rawBody) as unknown)
        .catch(() => null)
    : null;
  const body =
    parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? (parsedBody as UserEventBody)
      : null;
  const eventNameResult = text(body?.eventName, maxEventNameLength);
  const eventName = eventNameResult.value;

  if (!eventNameResult.ok || !eventName) {
    return NextResponse.json({ error: "eventName is required." }, { status: 400 });
  }

  if (!allowedEventNames.has(eventName)) {
    return NextResponse.json({ error: "eventName is not allowed." }, { status: 400 });
  }

  const anonymousSessionId = text(
    body?.anonymousSessionId,
    maxSessionIdLength,
  );
  const applicationId = text(body?.applicationId, maxApplicationIdLength);
  const path = text(body?.path, maxPathLength);
  const referrer = text(body?.referrer, maxReferrerLength);
  const eventMetadata = metadata(body?.metadata);

  if (
    !anonymousSessionId.ok ||
    !applicationId.ok ||
    !path.ok ||
    !referrer.ok ||
    !metadataWithinLimit(eventMetadata)
  ) {
    return NextResponse.json({ error: "Event payload is too large." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rateLimitKey = user?.id
    ? `user:${user.id}`
    : `anon:${anonymousSessionId.value || requestActorKey(request)}`;

  if (rateLimited(rateLimitKey)) return rateLimitResponse();

  try {
    await recordUserEvent({
      anonymousSessionId: anonymousSessionId.value,
      profileId: user?.id ?? null,
      applicationId: applicationId.value,
      eventName,
      path: path.value,
      referrer: referrer.value,
      userAgent: request.headers.get("user-agent"),
      metadata: eventMetadata,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[user-events]", error);
    return NextResponse.json(
      { error: "Event could not be recorded." },
      { status: 500 },
    );
  }
}
