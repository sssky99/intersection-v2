import { NextRequest, NextResponse } from "next/server";
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metadata(value: unknown): UserEventMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as UserEventMetadata;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as UserEventBody | null;
  const eventName = text(body?.eventName);

  if (!eventName) {
    return NextResponse.json({ error: "eventName is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    await recordUserEvent({
      anonymousSessionId: text(body?.anonymousSessionId),
      profileId: user?.id ?? null,
      applicationId: text(body?.applicationId),
      eventName,
      path: text(body?.path),
      referrer: text(body?.referrer),
      userAgent: request.headers.get("user-agent"),
      metadata: metadata(body?.metadata),
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
