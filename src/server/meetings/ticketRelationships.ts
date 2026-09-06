import { feedbackVenueGroup } from "@/lib/feedbackScope";
import { meetingAtmosphereDefaultsFromProfiles } from "@/lib/meetingAtmosphere";
import { type TicketGroupRow } from "@/lib/ticketGroupContext";
import { InstanceRow } from "./ticketPresentation";
import { AtmosphereWaitlistRow, unique } from "./ticketReadQueries";

export type ProfileIntroRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  photo_url: string | null;
  gender: string | null;
  birth_year: string | number | null;
  public_intro: string | null;
};

export function participationStartStages(groups: TicketGroupRow[]) {
  const result = new Map<string, number>();
  for (const group of groups) {
    if (!group.legacy_ticket_instance_id) continue;
    result.set(
      group.legacy_ticket_instance_id,
      group.starts_from_stage_sequence,
    );
  }

  return result;
}

export function eventInstanceIdsByInstanceFromContext({
  currentGroups,
  eventGroups,
}: {
  currentGroups: TicketGroupRow[];
  eventGroups: TicketGroupRow[];
}) {
  const result = new Map<string, string[]>();
  const instanceIdsByEvent = new Map<string, string[]>();
  for (const group of eventGroups ?? []) {
    if (!group.legacy_ticket_instance_id) continue;
    const current = instanceIdsByEvent.get(group.event_id) ?? [];
    current.push(group.legacy_ticket_instance_id);
    instanceIdsByEvent.set(group.event_id, current);
  }

  for (const group of currentGroups ?? []) {
    if (!group.legacy_ticket_instance_id) continue;
    result.set(
      group.legacy_ticket_instance_id,
      unique(instanceIdsByEvent.get(group.event_id) ?? []),
    );
  }

  return result;
}

export function feedbackGroupsByInstance(eventGroups: TicketGroupRow[]) {
  return new Map(
    eventGroups.flatMap((group) =>
      group.legacy_ticket_instance_id
        ? [
            [
              group.legacy_ticket_instance_id,
              feedbackVenueGroup(group),
            ] as const,
          ]
        : [],
    ),
  );
}

export function atmosphereInstanceId(
  row: AtmosphereWaitlistRow,
  instanceMap: Map<string, InstanceRow>,
  templateDateMap: Map<string, string>,
) {
  if (row.ticket_instance_id && instanceMap.has(row.ticket_instance_id)) {
    return row.ticket_instance_id;
  }
  if (row.ticket_id && instanceMap.has(row.ticket_id)) {
    return row.ticket_id;
  }
  if (row.ticket_template_id && row.meeting_date) {
    return (
      templateDateMap.get(`${row.ticket_template_id}|${row.meeting_date}`) ??
      null
    );
  }
  return null;
}

export function atmosphereDefaultsByInstance(
  rows: AtmosphereWaitlistRow[],
  instances: InstanceRow[],
  profileMap: Map<string, ProfileIntroRow>,
) {
  const instanceMap = new Map(
    instances.map((instance) => [instance.id, instance]),
  );
  const templateDateMap = new Map(
    instances
      .filter((instance) => instance.event_date)
      .map((instance) => [
        `${instance.template_id}|${instance.event_date}`,
        instance.id,
      ]),
  );
  const userIdsByInstance = new Map<string, Set<string>>();

  for (const row of rows) {
    const instanceId = atmosphereInstanceId(row, instanceMap, templateDateMap);
    if (!instanceId || !row.user_id) continue;
    const current = userIdsByInstance.get(instanceId) ?? new Set<string>();
    current.add(row.user_id);
    userIdsByInstance.set(instanceId, current);
  }

  return new Map(
    [...userIdsByInstance.entries()].map(([instanceId, userIds]) => [
      instanceId,
      meetingAtmosphereDefaultsFromProfiles(
        [...userIds]
          .map((userId) => profileMap.get(userId))
          .filter((profile): profile is ProfileIntroRow => Boolean(profile)),
      ),
    ]),
  );
}
