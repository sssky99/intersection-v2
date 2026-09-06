import type { createAdminClient } from "./supabase/admin";

export type TicketGroupRow = {
  id: string;
  event_id: string;
  code: string;
  title: string;
  feedback_scope_key: string | null;
  starts_from_stage_sequence: number;
  legacy_ticket_instance_id: string | null;
};

/** Request-scoped context; never cache member data across authenticated requests. */
export async function fetchTicketGroupContext(
  client: ReturnType<typeof createAdminClient>, instanceIds: string[],
) {
  if (!instanceIds.length) return { currentGroups: [], eventGroups: [] };
  const { data, error } = await client.from("meeting_groups")
    .select("id,event_id,code,title,legacy_ticket_instance_id,feedback_scope_key,starts_from_stage_sequence")
    .in("legacy_ticket_instance_id", [...new Set(instanceIds)])
    .returns<TicketGroupRow[]>();
  if (error) throw error;
  const currentGroups = data ?? [];
  const eventIds = [...new Set(currentGroups.map((group) => group.event_id))];
  if (!eventIds.length) return { currentGroups, eventGroups: [] };
  const { data: eventGroups, error: eventError } = await client.from("meeting_groups")
    .select("id,event_id,code,title,legacy_ticket_instance_id,feedback_scope_key,starts_from_stage_sequence")
    .in("event_id", eventIds).not("legacy_ticket_instance_id", "is", null)
    .returns<TicketGroupRow[]>();
  if (eventError) throw eventError;
  return { currentGroups, eventGroups: eventGroups ?? [] };
}
