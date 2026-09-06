import {
  resolveOperationalStage,
  type GroupStageLocation,
  type GroupStageLocationOverride,
  type OperationalStage,
} from "@/lib/meetingOperations";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { TicketGroupRow } from "@/lib/ticketGroupContext";
import "server-only";

export async function fetchGroupStageLocationsByInstance(
  client: ReturnType<typeof createAdminClient>,
  groups: TicketGroupRow[],
) {
  const result = new Map<string, GroupStageLocationOverride[]>();
  if (!groups.length) return result;
  const { data: stages, error } = await client
    .from("meeting_event_stages")
    .select(
      "id,event_id,sequence,title,stage_type,starts_at,location_mode,place_name,address,place_payload,event:meeting_events(starts_at)",
    )
    .in("event_id", [...new Set(groups.map((g) => g.event_id))])
    .returns<Array<OperationalStage & { event: { starts_at: string } }>>();
  if (error) throw error;
  const ids = (stages ?? [])
    .filter((s) => s.location_mode === "group_specific")
    .map((s) => s.id);
  const locations = ids.length
    ? await client
        .from("meeting_group_stage_locations")
        .select("group_id,stage_id,place_name,address,place_payload")
        .in(
          "group_id",
          groups.map((g) => g.id),
        )
        .in("stage_id", ids)
        .returns<GroupStageLocation[]>()
    : { data: [], error: null };
  if (locations.error) throw locations.error;
  const byKey = new Map(
    (locations.data ?? []).map((l) => [`${l.group_id}:${l.stage_id}`, l]),
  );
  for (const group of groups) {
    if (!group.legacy_ticket_instance_id) continue;
    result.set(
      group.legacy_ticket_instance_id,
      (stages ?? [])
        .filter((s) => s.event_id === group.event_id)
        .map((s) =>
          resolveOperationalStage(
            s,
            s.event.starts_at,
            byKey.get(`${group.id}:${s.id}`),
          ),
        )
        .sort((a, b) => a.sequence - b.sequence),
    );
  }
  return result;
}
