import type { createAdminClient } from "@/lib/supabase/admin";
import "server-only";

const operationalFields = [
  "title",
  "event_date",
  "event_time",
  "region",
  "place_name",
  "address",
  "place_payload",
  "operation_code",
  "operation_note",
] as const;

/** Editing an image or visibility is still allowed. Operational values must
 * be edited at their owning event so a legacy screen cannot split the truth. */
export async function changesOperationalFields(
  client: ReturnType<typeof createAdminClient>,
  instanceId: string,
  payload: Record<string, unknown>,
) {
  const { data: group, error } = await client
    .from("meeting_groups")
    .select("id")
    .eq("legacy_ticket_instance_id", instanceId)
    .maybeSingle();
  if (error) throw error;
  if (!group) return false;
  const { data, error: instanceError } = await client
    .from("ticket_instances")
    .select(operationalFields.join(","))
    .eq("id", instanceId)
    .single();
  if (instanceError) throw instanceError;
  const current = data as unknown as Record<string, unknown>;
  const normalize = (key: string, value: unknown) => {
    if (value == null || value === "") return null;
    if (key === "event_time" && typeof value === "string")
      return value.slice(0, 5);
    return value;
  };
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, stable(item)]),
          )
        : value;
  return operationalFields.some(
    (key) =>
      key in payload &&
      JSON.stringify(stable(normalize(key, payload[key]))) !==
        JSON.stringify(stable(normalize(key, current[key]))),
  );
}
