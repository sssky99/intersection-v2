import { createAdminClient } from "@/lib/supabase/admin";

export type UserEventMetadata = Record<string, unknown>;

export type RecordUserEventInput = {
  anonymousSessionId?: string | null;
  profileId?: string | null;
  applicationId?: string | null;
  eventName: string;
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  metadata?: UserEventMetadata | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && uuidPattern.test(trimmed) ? trimmed : null;
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function recordUserEvent(input: RecordUserEventInput) {
  const eventName = input.eventName.trim();
  if (!eventName) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("user_events").insert({
    anonymous_session_id: textOrNull(input.anonymousSessionId),
    profile_id: uuidOrNull(input.profileId),
    application_id: uuidOrNull(input.applicationId),
    event_name: eventName,
    path: textOrNull(input.path),
    referrer: textOrNull(input.referrer),
    user_agent: textOrNull(input.userAgent),
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}
