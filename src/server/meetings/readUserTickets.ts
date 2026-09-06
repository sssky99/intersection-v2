import { feedbackInstanceIdsForViewer } from "@/lib/feedbackScope";
import { normalizeProfileGender } from "@/lib/meetingAtmosphere";
import { visibleMeetingDateApplicationInstanceId } from "@/lib/meetingDateApplications";
import { meetingFeedbackWindow } from "@/lib/meetingOperations";
import { getMeetingTicketsByEventIds } from "@/lib/publicTicketPreview";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTicketGroupContext } from "@/lib/ticketGroupContext";
import { fetchGroupStageLocationsByInstance } from "@/server/meetings/operations";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  type TicketArrivalStatus,
  type TicketMemberIntro,
  type UserTicket,
  type UserTicketStatus,
} from "@/types/ticket";
import { NextResponse } from "next/server";
import "server-only";
import {
  addHours,
  addMinutes,
  confirmedStatuses,
  deriveStatus,
  forceFeedbackPreview,
  InstanceRow,
  sortUserTickets,
  statusPriority,
  TemplateRow,
  TicketSourceRow,
  toStartAt,
  toTicket,
  WaitlistRow,
} from "./ticketPresentation";
import {
  fetchAtmosphereWaitlistRows,
  fetchInstanceRows,
  fetchTemplateRows,
  unique,
} from "./ticketReadQueries";
import {
  atmosphereDefaultsByInstance,
  eventInstanceIdsByInstanceFromContext,
  feedbackGroupsByInstance,
  participationStartStages,
  type ProfileIntroRow,
} from "./ticketRelationships";

export type ParticipantRow = {
  ticket_instance_id: string;
  user_id: string;
};

export type MemberArrivalRow = {
  user_id: string;
  ticket_instance_id: string | null;
  ticket_id: string | null;
  status: string;
  arrival_status: TicketArrivalStatus | null;
  arrival_status_updated_at: string | null;
};

export type DateApplicationTicketRow = {
  id: number | string;
  user_id: string;
  event_id: string | null;
  meeting_date: string;
  meeting_time: string | null;
  region: string | null;
  status: string;
  assigned_ticket_instance_id: string | null;
  confirmed_at: string | null;
  ticket_participation_id: number | string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProfileAccessRow = {
  is_test_participant: boolean | null;
  name: string | null;
  nickname: string | null;
  photo_url: string | null;
  gender: string | null;
  birth_year: string | number | null;
  public_intro: string | null;
};

export function isoOrNull(date: Date | null) {
  return date ? date.toISOString() : null;
}

export function ticketRevealAt(
  startAt: Date,
  revealOverrideAt: string | null | undefined,
) {
  const scheduledRevealAt = addHours(startAt, -24);
  if (!revealOverrideAt) return scheduledRevealAt;

  const override = new Date(revealOverrideAt);
  if (!Number.isFinite(override.getTime())) return scheduledRevealAt;
  return override < scheduledRevealAt ? override : scheduledRevealAt;
}

export function placeOpenForConfirmedStatus(
  status: string,
  startAt: Date | null,
  now: Date,
  placeVisibility: string | null | undefined,
) {
  return Boolean(
    confirmedStatuses.has(status) &&
      (placeVisibility === "confirmed_only" || placeVisibility === "public") &&
      startAt &&
      now >= addHours(startAt, -24),
  );
}

export type UserTicketsPagination = {
  offset: number;
  limit: number | null;
};

export type UserTicketsPageMeta = {
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type SourceTicketCandidate = {
  kind: "source";
  row: TicketSourceRow;
  instanceId: string | null;
  sortStatus: UserTicketStatus;
  sortStart: string;
  sortTitle: string;
};

export type UserTicketCandidate = SourceTicketCandidate;

export const maxUserTicketsPageLimit = 50;

export function integerSearchParam(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function userTicketsPagination(request: Request): UserTicketsPagination {
  const url = new URL(request.url);
  const offset = Math.max(
    0,
    integerSearchParam(url.searchParams.get("offset")) ?? 0,
  );
  const rawLimit = integerSearchParam(url.searchParams.get("limit"));
  const limit =
    rawLimit === null
      ? null
      : Math.min(maxUserTicketsPageLimit, Math.max(1, rawLimit));

  return { offset, limit };
}

export function paginateItems<T>(
  items: T[],
  pagination: UserTicketsPagination,
): { items: T[]; meta: UserTicketsPageMeta } {
  const totalCount = items.length;
  const start = Math.min(pagination.offset, totalCount);
  const end =
    pagination.limit === null
      ? totalCount
      : Math.min(start + pagination.limit, totalCount);
  const nextOffset = end < totalCount ? end : null;

  return {
    items: items.slice(start, end),
    meta: {
      totalCount,
      hasMore: nextOffset !== null,
      nextOffset,
    },
  };
}

export function sourceRowInstanceId(row: TicketSourceRow) {
  return (
    row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id ?? null
  );
}

export function sourceRowAssigned(
  row: TicketSourceRow,
  instanceId: string | null,
  userAssignedInstanceIds: Set<string>,
) {
  return Boolean(instanceId && userAssignedInstanceIds.has(instanceId));
}

export function effectiveSourceStatus(
  row: TicketSourceRow,
  instanceId: string | null,
  userAssignedInstanceIds: Set<string>,
  previewFeedback = false,
) {
  if (previewFeedback) return "approved";

  if (row.status === "approved" && instanceId) {
    return sourceRowAssigned(row, instanceId, userAssignedInstanceIds)
      ? row.status
      : "waitlisted";
  }

  return row.status;
}

export function ticketDisplayNow(
  now: Date,
  startAt: Date | null,
  previewReveal: boolean,
) {
  if (!previewReveal || !startAt) return now;
  const revealAt = addHours(startAt, -24);
  return now < revealAt ? revealAt : now;
}

export function sourceTicketCandidate(
  row: TicketSourceRow,
  instanceMap: Map<string, InstanceRow>,
  userAssignedInstanceIds: Set<string>,
  now: Date,
  previewReveal = false,
  previewFeedbackUserId?: string,
): SourceTicketCandidate | null {
  const instanceId = sourceRowInstanceId(row);
  const instance = instanceId ? (instanceMap.get(instanceId) ?? null) : null;
  const date =
    instance?.event_date ?? row.meeting_date ?? row.ticket_snapshot?.date;
  const time = instance?.event_time ?? row.ticket_snapshot?.time;
  const startAt = toStartAt(date, time);
  const effectiveStatus = effectiveSourceStatus(
    row,
    instanceId,
    userAssignedInstanceIds,
    previewFeedbackUserId
      ? forceFeedbackPreview(previewFeedbackUserId, row, instance)
      : false,
  );
  const displayNow = ticketDisplayNow(now, startAt, previewReveal);

  if (
    confirmedStatuses.has(effectiveStatus) &&
    startAt &&
    displayNow < ticketRevealAt(startAt, instance?.ticket_reveal_override_at)
  ) {
    return null;
  }

  const derived = deriveStatus(effectiveStatus, startAt, displayNow);

  if (!derived.status) return null;

  return {
    kind: "source",
    row,
    instanceId,
    sortStatus: derived.status,
    sortStart: isoOrNull(startAt) ?? `${date ?? ""}T${time ?? ""}`,
    sortTitle: instance?.title ?? row.ticket_snapshot?.title ?? "",
  };
}

export function compareTicketCandidates(
  left: UserTicketCandidate,
  right: UserTicketCandidate,
) {
  const priority =
    statusPriority[left.sortStatus] - statusPriority[right.sortStatus];
  if (priority !== 0) return priority;

  const dateCompare = left.sortStart.localeCompare(right.sortStart);
  if (dateCompare !== 0) return dateCompare;

  return left.sortTitle.localeCompare(right.sortTitle, "ko");
}

export function fallbackNickname(name: string | null | undefined) {
  const korean = (name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || null;
}

export function displayNickname(profile: ProfileIntroRow | undefined) {
  return profile?.nickname?.trim() || fallbackNickname(profile?.name);
}

export function ticketsResponse(
  tickets: UserTicket[],
  participationCount: number,
  pageMeta?: UserTicketsPageMeta,
) {
  const totalCount = pageMeta?.totalCount ?? tickets.length;
  const hasMore = pageMeta?.hasMore ?? false;
  const nextOffset = pageMeta?.nextOffset ?? null;

  return NextResponse.json(
    {
      tickets,
      participationCount,
      totalCount,
      hasMore,
      nextOffset,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
      },
    },
  );
}

export async function loadUserTickets(request: Request, userId: string) {
  const pagination = userTicketsPagination(request);
  const previewRevealRequested =
    new URL(request.url).searchParams.get("previewReveal") === "1";
  try {
    const supabase = createAdminClient({ timeoutMs: 5000 });
    const { data: profileAccess, error: profileAccessError } = await supabase
      .from("profiles")
      .select(
        "is_test_participant,name,nickname,photo_url,gender,birth_year,public_intro",
      )
      .eq("user_id", userId)
      .maybeSingle<ProfileAccessRow>();
    if (profileAccessError) throw profileAccessError;
    const canSeeTestTickets = profileAccess?.is_test_participant === true;
    const previewReveal = previewRevealRequested && canSeeTestTickets;

    const [waitlistResult, applicationResult] = await Promise.all([
      supabase
        .from("ticket_participations")
        .select(
          "id,user_id,ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status,ticket_snapshot,arrival_status,arrival_status_updated_at,created_at,updated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("meeting_date_applications")
        .select(
          "id,user_id,event_id,meeting_date,meeting_time,region,status,assigned_ticket_instance_id,confirmed_at,ticket_participation_id,created_at,updated_at",
        )
        .eq("user_id", userId)
        .in("status", ["waitlisted", "approved", "on_hold"])
        .order("created_at", { ascending: false }),
    ]);
    const { data: waitlistData, error: waitlistError } = waitlistResult;
    if (waitlistError) throw waitlistError;
    if (applicationResult.error) throw applicationResult.error;

    const persistedWaitlistRows = (waitlistData ??
      []) as unknown as WaitlistRow[];
    const applicationRows = (applicationResult.data ??
      []) as unknown as DateApplicationTicketRow[];
    const persistedParticipationIds = new Set(
      persistedWaitlistRows.map((row) => String(row.id)),
    );
    const persistedInstanceIds = new Set(
      unique(persistedWaitlistRows.map((row) => sourceRowInstanceId(row))),
    );
    const pendingApplicationRows = applicationRows.filter((application) => {
      if (
        application.ticket_participation_id !== null &&
        persistedParticipationIds.has(
          String(application.ticket_participation_id),
        )
      ) {
        return false;
      }
      if (
        application.assigned_ticket_instance_id &&
        persistedInstanceIds.has(application.assigned_ticket_instance_id)
      ) {
        return false;
      }
      return Boolean(
        application.event_id || application.assigned_ticket_instance_id,
      );
    });
    const applicationEventTickets = await getMeetingTicketsByEventIds(
      unique(pendingApplicationRows.map((application) => application.event_id)),
    );
    const applicationEventTicketMap = new Map(
      applicationEventTickets.map((ticket) => [ticket.id, ticket]),
    );
    const applicationWaitlistRows: WaitlistRow[] = pendingApplicationRows
      .map((application): WaitlistRow | null => {
        const eventTicket = application.event_id
          ? (applicationEventTicketMap.get(application.event_id) ?? null)
          : null;
        const visibleInstanceId = visibleMeetingDateApplicationInstanceId({
          status: application.status,
          confirmedAt: application.confirmed_at,
          assignedTicketInstanceId: application.assigned_ticket_instance_id,
        });
        const sourceId =
          visibleInstanceId ?? application.event_id ?? eventTicket?.id ?? null;
        if (!sourceId) return null;

        return {
          id: `application:${application.id}`,
          user_id: application.user_id,
          ticket_id: sourceId,
          ticket_template_id: eventTicket?.templateId ?? null,
          // Draft group placement is intentionally private. Until the whole
          // group is confirmed, the member keeps seeing the parent date ticket.
          ticket_instance_id: visibleInstanceId,
          meeting_date: application.meeting_date,
          status: application.status,
          ticket_snapshot: eventTicket,
          arrival_status: null,
          arrival_status_updated_at: null,
          created_at: application.created_at,
          updated_at: application.updated_at,
        };
      })
      .filter((row): row is WaitlistRow => Boolean(row));
    const waitlistRows = [...persistedWaitlistRows, ...applicationWaitlistRows];
    const participationCount = waitlistRows.filter((row) =>
      ["completed", "feedback_done"].includes(row.status),
    ).length;
    const userAssignedInstanceIds = new Set(
      waitlistRows
        .filter(
          (participation) =>
            participation.ticket_instance_id &&
            confirmedStatuses.has(participation.status),
        )
        .map((participation) => participation.ticket_instance_id!),
    );

    if (waitlistRows.length === 0) {
      return ticketsResponse(
        [],
        participationCount,
        pagination
          ? { totalCount: 0, hasMore: false, nextOffset: null }
          : undefined,
      );
    }

    const instanceIds = unique([
      ...waitlistRows.map(
        (row) =>
          row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id,
      ),
    ]);
    let instances: InstanceRow[] = [];
    if (instanceIds.length > 0) {
      instances = await fetchInstanceRows(supabase, instanceIds);
    }

    const instanceMap = new Map(
      instances.map((instance) => [instance.id, instance]),
    );
    const userAssignedTemplateIds = new Set(
      waitlistRows
        .filter(
          (participation) =>
            participation.ticket_instance_id &&
            confirmedStatuses.has(participation.status),
        )
        .map((participation) => {
          const instanceId = participation.ticket_instance_id!;
          return (
            participation.ticket_template_id ??
            instanceMap.get(instanceId)?.template_id ??
            null
          );
        })
        .filter((templateId): templateId is string => Boolean(templateId)),
    );
    const ticketSourceRows: TicketSourceRow[] = waitlistRows.filter((row) => {
      const instanceId =
        row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
      const instance = instanceId ? instanceMap.get(instanceId) : null;
      const templateId =
        row.ticket_template_id ?? instance?.template_id ?? null;
      const isAssignedRow = Boolean(
        instanceId &&
          userAssignedInstanceIds.has(instanceId) &&
          confirmedStatuses.has(row.status),
      );
      if (
        templateId &&
        userAssignedTemplateIds.has(templateId) &&
        !isAssignedRow
      ) {
        return false;
      }
      return instance?.visibility !== "test_only" || canSeeTestTickets;
    });

    if (ticketSourceRows.length === 0) {
      return ticketsResponse([], participationCount, {
        totalCount: 0,
        hasMore: false,
        nextOffset: null,
      });
    }

    const now = new Date();
    const candidatePage = paginateItems(
      [
        ...ticketSourceRows
          .map((row) =>
            sourceTicketCandidate(
              row,
              instanceMap,
              userAssignedInstanceIds,
              now,
              previewReveal,
              userId,
            ),
          )
          .filter((candidate): candidate is SourceTicketCandidate =>
            Boolean(candidate),
          ),
      ].sort(compareTicketCandidates),
      pagination,
    );
    const pagedTicketSourceRows = candidatePage.items
      .filter(
        (candidate): candidate is SourceTicketCandidate =>
          candidate.kind === "source",
      )
      .map((candidate) => candidate.row);
    const pagedInstanceIds = unique(
      pagedTicketSourceRows.map((row) => sourceRowInstanceId(row)),
    );
    const pagedInstanceIdSet = new Set(pagedInstanceIds);
    const pagedInstances = instances.filter((instance) =>
      pagedInstanceIdSet.has(instance.id),
    );

    if (candidatePage.items.length === 0) {
      return ticketsResponse([], participationCount, candidatePage.meta);
    }

    const feedbackPreviewSourceInstanceIds = unique(
      pagedTicketSourceRows.map(
        (row) => row.ticket_snapshot?.feedbackPreviewSourceInstanceId,
      ),
    );
    const relationshipIds = unique([
      ...pagedInstanceIds,
      ...feedbackPreviewSourceInstanceIds,
    ]);
    const groupContext = await fetchTicketGroupContext(
      supabase,
      relationshipIds,
    );
    const pageGroups = groupContext.currentGroups.filter(
      (group) =>
        group.legacy_ticket_instance_id &&
        pagedInstanceIdSet.has(group.legacy_ticket_instance_id),
    );
    const groupStageLocationsByInstance =
      await fetchGroupStageLocationsByInstance(supabase, pageGroups);
    const participationStartStageByInstance =
      participationStartStages(pageGroups);
    const eventInstanceIdsByInstance =
      eventInstanceIdsByInstanceFromContext(groupContext);
    const feedbackGroupByInstance = feedbackGroupsByInstance(
      groupContext.eventGroups,
    );

    const templateIds = unique([
      ...pagedTicketSourceRows.map((row) => row.ticket_template_id),
      ...pagedInstances.map((instance) => instance.template_id),
      ...pagedTicketSourceRows.map((row) => row.ticket_snapshot?.templateId),
    ]);

    let templates: TemplateRow[] = [];
    if (templateIds.length > 0) {
      templates = await fetchTemplateRows(supabase, templateIds);
    }

    const templateMap = new Map(
      templates.map((template) => [template.id, template]),
    );
    const memberSourceByInstance = new Map<string, string>();
    for (const row of pagedTicketSourceRows) {
      const instanceId = sourceRowInstanceId(row);
      const previewSourceInstanceId =
        row.ticket_snapshot?.previewSourceInstanceId?.trim();
      const instance = instanceId ? instanceMap.get(instanceId) : null;
      if (
        instanceId &&
        previewSourceInstanceId &&
        instance?.visibility === "test_only" &&
        canSeeTestTickets
      ) {
        memberSourceByInstance.set(instanceId, previewSourceInstanceId);
      }
    }
    const memberInstanceIds = unique([
      ...pagedInstanceIds,
      ...memberSourceByInstance.values(),
      ...feedbackPreviewSourceInstanceIds,
      ...pagedInstanceIds.flatMap(
        (instanceId) => eventInstanceIdsByInstance.get(instanceId) ?? [],
      ),
      ...feedbackPreviewSourceInstanceIds.flatMap(
        (instanceId) => eventInstanceIdsByInstance.get(instanceId) ?? [],
      ),
    ]);
    let assignments: ParticipantRow[] = [];
    if (memberInstanceIds.length > 0) {
      const { data, error } = await supabase
        .from("ticket_participations")
        .select("ticket_instance_id,user_id")
        .in("ticket_instance_id", memberInstanceIds)
        .in("status", Array.from(confirmedStatuses));
      if (error) throw error;
      assignments = (data ?? []) as unknown as ParticipantRow[];
    }

    let memberArrivalRows: MemberArrivalRow[] = [];
    if (memberInstanceIds.length > 0) {
      const [byInstanceResult, byTicketResult] = await Promise.all([
        supabase
          .from("ticket_participations")
          .select(
            "user_id,ticket_instance_id,ticket_id,status,arrival_status,arrival_status_updated_at",
          )
          .in("ticket_instance_id", memberInstanceIds)
          .in("status", Array.from(confirmedStatuses))
          .returns<MemberArrivalRow[]>(),
        supabase
          .from("ticket_participations")
          .select(
            "user_id,ticket_instance_id,ticket_id,status,arrival_status,arrival_status_updated_at",
          )
          .in("ticket_id", memberInstanceIds)
          .in("status", Array.from(confirmedStatuses))
          .returns<MemberArrivalRow[]>(),
      ]);
      const { data: byInstanceId, error: byInstanceIdError } = byInstanceResult;
      if (byInstanceIdError) throw byInstanceIdError;
      const { data: byTicketId, error: byTicketIdError } = byTicketResult;
      if (byTicketIdError) throw byTicketIdError;

      memberArrivalRows = [...(byInstanceId ?? []), ...(byTicketId ?? [])];
    }

    const atmosphereWaitlistRows = await fetchAtmosphereWaitlistRows(
      supabase,
      pagedInstances,
    );
    const profileIds = unique([
      userId,
      ...assignments.map((assignment) => assignment.user_id),
      ...memberArrivalRows.map((arrivalRow) => arrivalRow.user_id),
      ...atmosphereWaitlistRows.map((row) => row.user_id),
    ]);

    let profileRows: ProfileIntroRow[] = [];
    if (profileIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id,name,nickname,photo_url,gender,birth_year,public_intro",
        )
        .in("user_id", profileIds);
      if (error) throw error;
      profileRows = (data ?? []) as unknown as ProfileIntroRow[];
    }

    const profileMap = new Map(
      profileRows.map((profile) => [profile.user_id, profile]),
    );
    const atmosphereDefaultsMap = atmosphereDefaultsByInstance(
      atmosphereWaitlistRows,
      pagedInstances,
      profileMap,
    );
    const assignmentsByInstance = assignments.reduce((map, assignment) => {
      const current = map.get(assignment.ticket_instance_id) ?? [];
      current.push(assignment.user_id);
      map.set(assignment.ticket_instance_id, current);
      return map;
    }, new Map<string, string[]>());
    const arrivalByMember = memberArrivalRows.reduce((map, arrivalRow) => {
      const arrivalInstanceId =
        arrivalRow.ticket_instance_id ?? arrivalRow.ticket_id;
      if (arrivalInstanceId) {
        map.set(`${arrivalInstanceId}:${arrivalRow.user_id}`, arrivalRow);
      }
      return map;
    }, new Map<string, MemberArrivalRow>());

    const participantIdsByInstance = new Map<string, Set<string>>();
    const addParticipant = (
      instanceId: string | null | undefined,
      userId: string,
    ) => {
      if (!instanceId) return;
      const current =
        participantIdsByInstance.get(instanceId) ?? new Set<string>();
      current.add(userId);
      participantIdsByInstance.set(instanceId, current);
    };

    for (const assignment of assignments) {
      addParticipant(assignment.ticket_instance_id, assignment.user_id);
    }
    for (const arrivalRow of memberArrivalRows) {
      addParticipant(
        arrivalRow.ticket_instance_id ?? arrivalRow.ticket_id,
        arrivalRow.user_id,
      );
    }

    const autoCancelledInstanceIds = new Set(
      pagedInstances
        .filter((instance) => {
          const startAt = toStartAt(instance.event_date, instance.event_time);
          if (!startAt || now < startAt) return false;
          const participantSourceId =
            memberSourceByInstance.get(instance.id) ?? instance.id;
          const participantCount =
            participantIdsByInstance.get(participantSourceId)?.size ?? 0;
          return (
            participantCount <
            (instance.minimum_participant_count ??
              MEETING_DEFAULT_MIN_PARTICIPANT_COUNT)
          );
        })
        .map((instance) => instance.id),
    );

    const tickets = pagedTicketSourceRows
      .map((row): UserTicket | null => {
        const instanceId =
          row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
        if (instanceId && autoCancelledInstanceIds.has(instanceId)) return null;
        const instance = instanceId
          ? (instanceMap.get(instanceId) ?? null)
          : null;
        const templateId =
          row.ticket_template_id ??
          instance?.template_id ??
          row.ticket_snapshot?.templateId ??
          null;
        const template = templateId
          ? (templateMap.get(templateId) ?? null)
          : null;
        const effectiveStatus = effectiveSourceStatus(
          row,
          instanceId,
          userAssignedInstanceIds,
          forceFeedbackPreview(userId, row, instance),
        );
        const sourceDate =
          instance?.event_date ?? row.meeting_date ?? row.ticket_snapshot?.date;
        const sourceTime = instance?.event_time ?? row.ticket_snapshot?.time;
        const startAt = toStartAt(sourceDate, sourceTime);
        const displayNow = ticketDisplayNow(now, startAt, previewReveal);
        const placeVisible = placeOpenForConfirmedStatus(
          effectiveStatus,
          startAt,
          displayNow,
          instance?.place_visibility,
        );
        const ticket = toTicket(
          row,
          instance,
          template,
          instanceId ? (atmosphereDefaultsMap.get(instanceId) ?? null) : null,
          placeVisible,
          displayNow,
          instanceId
            ? groupStageLocationsByInstance.get(instanceId)
            : undefined,
          instanceId
            ? (participationStartStageByInstance.get(instanceId) ??
                row.ticket_snapshot?.startsFromStageSequence ??
                1)
            : (row.ticket_snapshot?.startsFromStageSequence ?? 1),
        );
        if (!ticket) return null;

        const participationStartAt = startAt
          ? addMinutes(startAt, ticket.participationStartOffsetMinutes ?? 0)
          : null;
        const feedbackOpenAt = startAt
          ? meetingFeedbackWindow(
              startAt,
              instanceId
                ? groupStageLocationsByInstance.get(instanceId)
                : undefined,
            ).opensAt
          : null;
        const derived = deriveStatus(effectiveStatus, startAt, displayNow, {
          activityStartAt: participationStartAt,
          feedbackOpenAt,
        });
        if (!derived.status) return null;

        const confirmed = confirmedStatuses.has(effectiveStatus);
        const memberInfoVisible = confirmed;
        const memberInstanceId = instanceId
          ? (memberSourceByInstance.get(instanceId) ?? instanceId)
          : "";
        const assignedIds = memberInfoVisible
          ? (assignmentsByInstance.get(memberInstanceId) ?? [])
          : [];
        const memberIds = memberInfoVisible
          ? unique([...assignedIds, userId])
          : [];
        const members: TicketMemberIntro[] = memberIds.map((id) => {
          const memberProfile = profileMap.get(id);
          const memberArrival = memberInstanceId
            ? arrivalByMember.get(`${memberInstanceId}:${id}`)
            : null;
          const arrivalStatus =
            id === userId
              ? (row.arrival_status ?? memberArrival?.arrival_status ?? null)
              : (memberArrival?.arrival_status ?? null);
          const arrivalStatusUpdatedAt =
            id === userId
              ? (row.arrival_status_updated_at ??
                memberArrival?.arrival_status_updated_at ??
                null)
              : (memberArrival?.arrival_status_updated_at ?? null);

          return {
            id,
            name: memberProfile?.name ?? null,
            nickname: displayNickname(memberProfile),
            photoUrl: memberProfile?.photo_url?.trim() || null,
            gender: normalizeProfileGender(memberProfile?.gender),
            publicIntro: memberProfile?.public_intro ?? null,
            arrivalStatus,
            arrivalStatusUpdatedAt,
            isSelf: id === userId,
          };
        });
        const feedbackPreviewSourceInstanceId =
          row.ticket_snapshot?.feedbackPreviewSourceInstanceId?.trim();
        const feedbackReferenceInstanceId =
          feedbackPreviewSourceInstanceId && instance?.visibility !== "public"
            ? feedbackPreviewSourceInstanceId
            : memberInstanceId;
        const feedbackRelatedInstanceIds = memberInfoVisible
          ? feedbackInstanceIdsForViewer(
              groupContext.eventGroups,
              feedbackReferenceInstanceId,
            )
          : [];
        const feedbackGroupByMemberId = new Map<string, string>();
        for (const relatedInstanceId of feedbackRelatedInstanceIds) {
          const feedbackGroup = feedbackGroupByInstance.get(relatedInstanceId);
          if (!feedbackGroup) continue;
          for (const memberId of assignmentsByInstance.get(relatedInstanceId) ??
            []) {
            feedbackGroupByMemberId.set(memberId, feedbackGroup);
          }
        }
        const feedbackMemberIds = unique(
          feedbackRelatedInstanceIds.flatMap(
            (relatedInstanceId) =>
              assignmentsByInstance.get(relatedInstanceId) ?? [],
          ),
        );
        const feedbackMembers: TicketMemberIntro[] = feedbackMemberIds.map(
          (id) => {
            const memberProfile = profileMap.get(id);
            return {
              id,
              name: memberProfile?.name ?? null,
              nickname: displayNickname(memberProfile),
              photoUrl: memberProfile?.photo_url?.trim() || null,
              gender: normalizeProfileGender(memberProfile?.gender),
              publicIntro: memberProfile?.public_intro ?? null,
              arrivalStatus: null,
              arrivalStatusUpdatedAt: null,
              isSelf: id === userId,
              feedbackGroup: feedbackGroupByMemberId.get(id) ?? null,
            };
          },
        );

        return {
          id: String(row.id),
          waitlistId: String(row.id),
          ticket,
          rawStatus: effectiveStatus,
          status: derived.status,
          statusLabel: derived.statusLabel,
          progressStep: derived.progressStep,
          progressIndex: derived.progressIndex,
          meetingStartAt: isoOrNull(participationStartAt),
          arrivalOpensAt: isoOrNull(
            participationStartAt ? addHours(participationStartAt, -3) : null,
          ),
          feedbackOpensAt: isoOrNull(feedbackOpenAt),
          canSetArrival: confirmed && derived.canSetArrival,
          arrivalStatus: row.arrival_status ?? null,
          arrivalStatusUpdatedAt: row.arrival_status_updated_at ?? null,
          updatedAt: row.updated_at ?? row.created_at ?? null,
          place:
            placeVisible &&
            ((ticket.startsFromStageSequence ?? 1) <= 1 || ticket.place)
              ? {
                  name: ticket.place?.name ?? instance?.place_name ?? null,
                  address: ticket.place?.address ?? instance?.address ?? null,
                  category: ticket.place?.category ?? null,
                  roadAddress: ticket.place?.roadAddress ?? null,
                  jibunAddress: ticket.place?.jibunAddress ?? null,
                  mapx: ticket.place?.mapx ?? null,
                  mapy: ticket.place?.mapy ?? null,
                  link: ticket.place?.link ?? null,
                  source: ticket.place?.source ?? null,
                }
              : null,
          members,
          feedbackMembers: feedbackMembers.length ? feedbackMembers : members,
        };
      })
      .filter((ticket): ticket is UserTicket => Boolean(ticket));

    const visibleTickets = [...tickets].sort(sortUserTickets);

    return ticketsResponse(
      visibleTickets,
      participationCount,
      candidatePage.meta,
    );
  } catch (error) {
    console.error("[meetings my-tickets]", error);
    return NextResponse.json(
      { error: "내 티켓 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
}
