import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validAnalyticsSessionId(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

export async function recordServerFunnelEvent(options: {
  sessionId?: unknown;
  profileId: string;
  eventName: "questions_complete" | "otp_verified" | "application_created";
  eventKey?: string | number | null;
  path: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt?: string;
}) {
  const metadata = options.metadata ?? {};
  if (JSON.stringify(metadata).length > 1800) return;

  const { error } = await createAdminClient({ timeoutMs: 1500 }).rpc(
    "record_funnel_event",
    {
      p_session_id: validAnalyticsSessionId(options.sessionId),
      p_profile_id: options.profileId,
      p_event_name: options.eventName,
      p_event_key: options.eventKey == null ? "" : String(options.eventKey).slice(0, 160),
      p_path: options.path.slice(0, 240),
      p_metadata: metadata,
      p_created_at: options.createdAt ?? new Date().toISOString(),
    },
  );
  if (error) throw error;
}

export async function safelyRecordServerFunnelEvent(
  options: Parameters<typeof recordServerFunnelEvent>[0],
) {
  try {
    await recordServerFunnelEvent(options);
  } catch (error) {
    console.error("[funnel] server event was not recorded", {
      eventName: options.eventName,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
