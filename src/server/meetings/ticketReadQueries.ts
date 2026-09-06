import { createAdminClient } from "@/lib/supabase/admin";
import "server-only";
import { InstanceRow, TemplateRow } from "./ticketPresentation";

export type AtmosphereWaitlistRow = {
  user_id: string;
  ticket_id: string | null;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string | null;
};

export const templateSelect = [
  "id",
  "title",
  "short_description",
  "detail_summary",
  "detail_activities",
  "detail_flow",
  "detail_good_for",
  "detail_notice",
  "stage_copy",
  "image_url",
  "course_steps",
  "mood_tags",
  "activity_type",
  "recommendation_copy",
  "default_region",
  "default_time",
  "atmosphere_gender_mood",
  "atmosphere_age_band_id",
].join(",");

export const instanceSelect = [
  "id",
  "template_id",
  "title",
  "event_date",
  "event_time",
  "region",
  "place_name",
  "address",
  "place_visibility",
  "place_payload",
  "ticket_reveal_override_at",
  "remaining_seat_label_count",
  "minimum_participant_count",
  "max_participant_count",
  "visibility",
].join(",");

export const instanceSelectWithoutPlacePayload = instanceSelect.replace(
  ",place_payload",
  "",
);

export function isMissingPlacePayloadColumn(error: unknown) {
  const databaseError = error as { code?: string; message?: string } | null;
  return (
    databaseError?.code === "42703" &&
    (databaseError.message ?? "").includes("place_payload")
  );
}

export async function fetchInstanceRows(
  supabase: ReturnType<typeof createAdminClient>,
  instanceIds: string[],
) {
  const { data, error } = await supabase
    .from("ticket_instances")
    .select(instanceSelect)
    .in("id", instanceIds);

  if (isMissingPlacePayloadColumn(error)) {
    const fallback = await supabase
      .from("ticket_instances")
      .select(instanceSelectWithoutPlacePayload)
      .in("id", instanceIds);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as unknown as InstanceRow[];
  }

  if (error) throw error;
  return (data ?? []) as unknown as InstanceRow[];
}

export async function fetchTemplateRows(
  supabase: ReturnType<typeof createAdminClient>,
  templateIds: string[],
) {
  const { data, error } = await supabase
    .from("ticket_templates")
    .select(templateSelect)
    .in("id", templateIds);

  if (error) throw error;
  return (data ?? []) as unknown as TemplateRow[];
}

export const atmosphereWaitlistStatuses = [
  "payment_pending",
  "waitlisted",
  "approved",
  "on_hold",
];

export function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export async function fetchAtmosphereWaitlistRows(
  supabase: ReturnType<typeof createAdminClient>,
  instances: InstanceRow[],
) {
  const instanceIds = unique(instances.map((instance) => instance.id));
  if (instanceIds.length === 0) return [];

  const templateIds = unique(instances.map((instance) => instance.template_id));
  const waitlistSelect =
    "user_id,ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status";
  const queries = [
    supabase
      .from("ticket_participations")
      .select(waitlistSelect)
      .in("ticket_instance_id", instanceIds)
      .in("status", atmosphereWaitlistStatuses)
      .returns<AtmosphereWaitlistRow[]>(),
    supabase
      .from("ticket_participations")
      .select(waitlistSelect)
      .in("ticket_id", instanceIds)
      .in("status", atmosphereWaitlistStatuses)
      .returns<AtmosphereWaitlistRow[]>(),
  ];

  if (templateIds.length > 0) {
    queries.push(
      supabase
        .from("ticket_participations")
        .select(waitlistSelect)
        .in("ticket_template_id", templateIds)
        .in("status", atmosphereWaitlistStatuses)
        .returns<AtmosphereWaitlistRow[]>(),
    );
  }

  const [byInstanceResult, byTicketResult, byTemplateResult] =
    await Promise.all(queries);
  const { data: byInstanceId, error: byInstanceIdError } = byInstanceResult;
  if (byInstanceIdError) throw byInstanceIdError;
  const { data: byTicketId, error: byTicketIdError } = byTicketResult;
  if (byTicketIdError) throw byTicketIdError;
  if (byTemplateResult?.error) {
    const byTemplateIdError = byTemplateResult.error;
    if (byTemplateIdError) throw byTemplateIdError;
  }

  return [
    ...(byInstanceId ?? []),
    ...(byTicketId ?? []),
    ...(byTemplateResult?.data ?? []),
  ];
}
