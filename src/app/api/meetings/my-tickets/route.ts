import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  GatheringTicket,
  TicketArrivalStatus,
  TicketMemberIntro,
  TicketProgressStep,
  UserTicket,
  UserTicketStatus,
} from "@/types/ticket";

export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  detail_summary: string | null;
  detail_activities: unknown;
  detail_flow: unknown;
  detail_good_for: unknown;
  detail_notice: string | null;
  image_url: string | null;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
  proposal_id: string | null;
  proposer_user_id: string | null;
  proposer_display_name: string | null;
  proposer_public_intro: string | null;
  proposer_public_emoji: string | null;
};

type InstanceRow = {
  id: string;
  template_id: string;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
  place_visibility: string | null;
  remaining_seat_label_count: number | null;
  visibility: string | null;
};

type WaitlistRow = {
  id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string;
  ticket_snapshot: GatheringTicket | null;
  arrival_status: TicketArrivalStatus | null;
  arrival_status_updated_at: string | null;
  created_at: string | null;
};

type AssignmentRow = {
  ticket_instance_id: string;
  profile_id: string;
};

type UserAssignmentRow = {
  ticket_instance_id: string;
};

type MemberArrivalRow = {
  user_id: string;
  ticket_instance_id: string | null;
  ticket_id: string | null;
  status: string;
  arrival_status: TicketArrivalStatus | null;
  arrival_status_updated_at: string | null;
};

type ProfileIntroRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  gender: string | null;
  public_intro: string | null;
  public_emoji?: string | null;
};

type ProfileAccessRow = {
  is_test_participant: boolean | null;
};

type TicketSourceRow = WaitlistRow & {
  assignment_only?: boolean;
};

const templateSelect = [
  "id",
  "title",
  "short_description",
  "detail_summary",
  "detail_activities",
  "detail_flow",
  "detail_good_for",
  "detail_notice",
  "image_url",
  "mood_tags",
  "activity_type",
  "recommendation_copy",
  "default_region",
  "default_time",
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
  "score_alcohol",
  "score_romance",
  "proposal_id",
  "proposer_user_id",
  "proposer_display_name",
  "proposer_public_intro",
  "proposer_public_emoji",
].join(",");

const instanceSelect = [
  "id",
  "template_id",
  "title",
  "event_date",
  "event_time",
  "region",
  "place_name",
  "address",
  "place_visibility",
  "remaining_seat_label_count",
  "visibility",
].join(",");

const hiddenStatuses = new Set([
  "cancelled",
  "not_selected",
  "completed",
  "feedback_done",
]);

const statusPriority: Record<UserTicketStatus, number> = {
  approved: 0,
  in_progress: 0,
  feedback_open: 0,
  waitlisted: 1,
  payment_pending: 2,
};

const statusLabels: Record<UserTicketStatus, string> = {
  payment_pending: "결제 확인 필요",
  waitlisted: "신청 완료",
  approved: "참여 확정",
  in_progress: "진행 중",
  feedback_open: "피드백 작성 가능",
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function toStartAt(date: string | null | undefined, time: string | null | undefined) {
  if (!date) return null;
  const normalizedTime = time?.slice(0, 5) || "00:00";
  const start = new Date(`${date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(start.getTime()) ? start : null;
}

function isoOrNull(date: Date | null) {
  return date ? date.toISOString() : null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function toTicket(
  row: WaitlistRow,
  instance: InstanceRow | null,
  template: TemplateRow | null,
): GatheringTicket | null {
  const snapshot = row.ticket_snapshot;

  if (!instance || !template) {
    return snapshot?.id ? snapshot : null;
  }

  const date = instance.event_date ?? row.meeting_date ?? snapshot?.date;
  const time =
    instance.event_time?.slice(0, 5) ??
    template.default_time?.slice(0, 5) ??
    snapshot?.time;

  if (!date || !time) return snapshot?.id ? snapshot : null;

  const subtitle =
    template.short_description ??
    template.recommendation_copy ??
    snapshot?.subtitle ??
    "교집합이 준비한 실제 운영 모임";
  const area =
    instance.region ?? template.default_region ?? snapshot?.area ?? "지역 미정";
  const proposerDisplayName =
    template.proposer_display_name?.trim() ??
    snapshot?.proposerProfile?.displayName;
  const proposerLabel = proposerDisplayName
    ? `${proposerDisplayName}님이 제안한 교집합`
    : snapshot?.proposerLabel;

  return {
    id: instance.id,
    templateId: instance.template_id,
    title: instance.title || template.title || snapshot?.title || "티켓",
    subtitle,
    date,
    time,
    area,
    moodTags: template.mood_tags ?? snapshot?.moodTags ?? [],
    imageUrl: template.image_url ?? snapshot?.imageUrl,
    remainingSeatCount:
      instance.remaining_seat_label_count ?? snapshot?.remainingSeatCount ?? 0,
    peopleHint: template.recommendation_copy ?? snapshot?.peopleHint ?? subtitle,
    reason: template.recommendation_copy ?? snapshot?.reason ?? subtitle,
    detailSummary: template.detail_summary?.trim() || snapshot?.detailSummary,
    detailActivities: textList(template.detail_activities).length
      ? textList(template.detail_activities)
      : snapshot?.detailActivities,
    detailFlow: textList(template.detail_flow).length
      ? textList(template.detail_flow)
      : snapshot?.detailFlow,
    detailGoodFor: textList(template.detail_good_for).length
      ? textList(template.detail_good_for)
      : snapshot?.detailGoodFor,
    detailNotice: template.detail_notice?.trim() || snapshot?.detailNotice,
    proposerLabel,
    proposerProfile: proposerDisplayName
      ? {
          userId:
            template.proposer_user_id ?? snapshot?.proposerProfile?.userId,
          displayName: proposerDisplayName,
          publicIntro:
            template.proposer_public_intro ??
            snapshot?.proposerProfile?.publicIntro,
          publicEmoji:
            template.proposer_public_emoji ??
            snapshot?.proposerProfile?.publicEmoji,
        }
      : snapshot?.proposerProfile,
    vibeScores: {
      temperature:
        template.score_temperature ?? snapshot?.vibeScores?.temperature ?? null,
      texture: template.score_texture ?? snapshot?.vibeScores?.texture ?? null,
      tone: template.score_tone ?? snapshot?.vibeScores?.tone ?? null,
      rhythm: template.score_rhythm ?? snapshot?.vibeScores?.rhythm ?? null,
      alcohol: template.score_alcohol ?? snapshot?.vibeScores?.alcohol ?? null,
      romance: template.score_romance ?? snapshot?.vibeScores?.romance ?? null,
    },
  };
}

function deriveStatus(
  rawStatus: string,
  startAt: Date | null,
  now: Date,
): {
  status: UserTicketStatus | null;
  statusLabel: string;
  progressStep: TicketProgressStep;
  progressIndex: number;
  canSetArrival: boolean;
} {
  if (hiddenStatuses.has(rawStatus)) {
    return {
      status: null,
      statusLabel: "",
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (rawStatus === "payment_pending") {
    return {
      status: "payment_pending",
      statusLabel: statusLabels.payment_pending,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (rawStatus !== "approved") {
    return {
      status: "waitlisted",
      statusLabel: statusLabels.waitlisted,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (!startAt) {
    return {
      status: "approved",
      statusLabel: statusLabels.approved,
      progressStep: "approved",
      progressIndex: 1,
      canSetArrival: false,
    };
  }

  const approvalOpenAt = addHours(startAt, -24);
  const arrivalOpenAt = addHours(startAt, -3);
  const feedbackOpenAt = addHours(startAt, 3);
  const canSetArrival = now >= arrivalOpenAt;

  if (now < approvalOpenAt) {
    return {
      status: "approved",
      statusLabel: statusLabels.waitlisted,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (now >= feedbackOpenAt) {
    return {
      status: "feedback_open",
      statusLabel: statusLabels.feedback_open,
      progressStep: "feedback",
      progressIndex: 4,
      canSetArrival,
    };
  }

  if (now >= startAt) {
    return {
      status: "in_progress",
      statusLabel: statusLabels.in_progress,
      progressStep: "in_progress",
      progressIndex: 3,
      canSetArrival,
    };
  }

  if (now >= arrivalOpenAt) {
    return {
      status: "approved",
      statusLabel: "시작 전 안내",
      progressStep: "pre_start",
      progressIndex: 2,
      canSetArrival,
    };
  }

  return {
    status: "approved",
    statusLabel: statusLabels.approved,
    progressStep: "approved",
    progressIndex: 1,
    canSetArrival,
  };
}

function sortUserTickets(left: UserTicket, right: UserTicket) {
  const priority = statusPriority[left.status] - statusPriority[right.status];
  if (priority !== 0) return priority;

  const leftStart = left.meetingStartAt ?? `${left.ticket.date}T${left.ticket.time}`;
  const rightStart = right.meetingStartAt ?? `${right.ticket.date}T${right.ticket.time}`;
  const dateCompare = leftStart.localeCompare(rightStart);
  if (dateCompare !== 0) return dateCompare;

  return left.ticket.title.localeCompare(right.ticket.title, "ko");
}

function profileEmoji(userId: string) {
  const emojis = ["💎", "🌿", "☕", "🎧", "✨", "🫧", "🪩", "🧭"];
  const sum = Array.from(userId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return emojis[sum % emojis.length];
}

function displayProfileEmoji(profile: ProfileIntroRow | undefined, userId: string) {
  return profile?.public_emoji?.trim() || profileEmoji(userId);
}

function fallbackNickname(name: string | null | undefined) {
  const korean = (name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || null;
}

function displayNickname(profile: ProfileIntroRow | undefined) {
  return profile?.nickname?.trim() || fallbackNickname(profile?.name);
}

function ticketsResponse(tickets: UserTicket[], participationCount: number) {
  return NextResponse.json(
    { tickets, participationCount },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
      },
    },
  );
}

export async function GET() {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: profileAccess, error: profileAccessError } = await supabase
      .from("profiles")
      .select("is_test_participant")
      .eq("user_id", user.id)
      .maybeSingle<ProfileAccessRow>();
    if (profileAccessError) throw profileAccessError;
    const canSeeTestTickets = profileAccess?.is_test_participant === true;

    const { data: waitlistData, error: waitlistError } = await supabase
      .from("meeting_waitlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (waitlistError) throw waitlistError;

    const waitlistRows = (waitlistData ?? []) as unknown as WaitlistRow[];
    const participationCount = waitlistRows.filter((row) =>
      ["completed", "feedback_done"].includes(row.status),
    ).length;
    const { data: userAssignmentData, error: userAssignmentError } =
      await supabase
        .from("ticket_assignments")
        .select("ticket_instance_id")
        .eq("profile_id", user.id)
        .returns<UserAssignmentRow[]>();
    if (userAssignmentError) throw userAssignmentError;

    const userAssignments = userAssignmentData ?? [];

    if (waitlistRows.length === 0 && userAssignments.length === 0) {
      return ticketsResponse([], participationCount);
    }

    const instanceIds = unique(
      [
        ...waitlistRows.map(
          (row) =>
            row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id,
        ),
        ...userAssignments.map((assignment) => assignment.ticket_instance_id),
      ],
    );

    let instances: InstanceRow[] = [];
    if (instanceIds.length > 0) {
      const { data, error } = await supabase
        .from("ticket_instances")
        .select(instanceSelect)
        .in("id", instanceIds);
      if (error) throw error;
      instances = (data ?? []) as unknown as InstanceRow[];
    }

    const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
    const waitlistInstanceIds = new Set(
      waitlistRows
        .map((row) => row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id)
        .filter(Boolean),
    );
    const assignmentOnlyRows = userAssignments
      .filter((assignment) => !waitlistInstanceIds.has(assignment.ticket_instance_id))
      .map((assignment): TicketSourceRow | null => {
        const instance = instanceMap.get(assignment.ticket_instance_id);
        if (!instance) return null;

        return {
          id: `assignment:${assignment.ticket_instance_id}`,
          user_id: user.id,
          ticket_id: assignment.ticket_instance_id,
          ticket_template_id: instance.template_id,
          ticket_instance_id: assignment.ticket_instance_id,
          meeting_date: instance.event_date,
          status: "approved",
          ticket_snapshot: null,
          arrival_status: null,
          arrival_status_updated_at: null,
          created_at: null,
          assignment_only: true,
        };
      })
      .filter((row): row is TicketSourceRow => Boolean(row));
    const ticketSourceRows: TicketSourceRow[] = [
      ...waitlistRows,
      ...assignmentOnlyRows,
    ].filter((row) => {
      const instanceId =
        row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
      const instance = instanceId ? instanceMap.get(instanceId) : null;
      return instance?.visibility !== "test_only" || canSeeTestTickets;
    });

    if (ticketSourceRows.length === 0) {
      return ticketsResponse([], participationCount);
    }
    const templateIds = unique([
      ...ticketSourceRows.map((row) => row.ticket_template_id),
      ...instances.map((instance) => instance.template_id),
      ...ticketSourceRows.map((row) => row.ticket_snapshot?.templateId),
    ]);

    let templates: TemplateRow[] = [];
    if (templateIds.length > 0) {
      const { data, error } = await supabase
        .from("ticket_templates")
        .select(templateSelect)
        .in("id", templateIds);
      if (error) throw error;
      templates = (data ?? []) as unknown as TemplateRow[];
    }

    const templateMap = new Map(templates.map((template) => [template.id, template]));
    const approvedInstanceIds = unique(
      ticketSourceRows
        .filter((row) => row.status === "approved")
        .map(
          (row) =>
            row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id,
        ),
    );

    let assignments: AssignmentRow[] = [];
    if (approvedInstanceIds.length > 0) {
      const { data, error } = await supabase
        .from("ticket_assignments")
        .select("ticket_instance_id,profile_id")
        .in("ticket_instance_id", approvedInstanceIds);
      if (error) throw error;
      assignments = (data ?? []) as unknown as AssignmentRow[];
    }

    let memberArrivalRows: MemberArrivalRow[] = [];
    if (approvedInstanceIds.length > 0) {
      const { data: byInstanceId, error: byInstanceIdError } = await supabase
        .from("meeting_waitlist")
        .select(
          "user_id,ticket_instance_id,ticket_id,status,arrival_status,arrival_status_updated_at",
        )
        .in("ticket_instance_id", approvedInstanceIds)
        .eq("status", "approved")
        .returns<MemberArrivalRow[]>();
      if (byInstanceIdError) throw byInstanceIdError;

      const { data: byTicketId, error: byTicketIdError } = await supabase
        .from("meeting_waitlist")
        .select(
          "user_id,ticket_instance_id,ticket_id,status,arrival_status,arrival_status_updated_at",
        )
        .in("ticket_id", approvedInstanceIds)
        .eq("status", "approved")
        .returns<MemberArrivalRow[]>();
      if (byTicketIdError) throw byTicketIdError;

      memberArrivalRows = [...(byInstanceId ?? []), ...(byTicketId ?? [])];
    }

    const profileIds = unique([
      user.id,
      ...assignments.map((assignment) => assignment.profile_id),
    ]);

    let profileRows: ProfileIntroRow[] = [];
    if (profileIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,name,nickname,gender,public_intro,public_emoji")
        .in("user_id", profileIds);
      if (error) throw error;
      profileRows = (data ?? []) as unknown as ProfileIntroRow[];
    }

    const profileMap = new Map(
      profileRows.map((profile) => [profile.user_id, profile]),
    );
    const assignmentsByInstance = assignments.reduce((map, assignment) => {
      const current = map.get(assignment.ticket_instance_id) ?? [];
      current.push(assignment.profile_id);
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

    const now = new Date();
    const tickets = ticketSourceRows
      .map((row): UserTicket | null => {
        const instanceId =
          row.ticket_instance_id ?? row.ticket_snapshot?.id ?? row.ticket_id;
        const instance = instanceId ? instanceMap.get(instanceId) ?? null : null;
        const templateId =
          row.ticket_template_id ??
          instance?.template_id ??
          row.ticket_snapshot?.templateId ??
          null;
        const template = templateId ? templateMap.get(templateId) ?? null : null;
        const ticket = toTicket(row, instance, template);
        if (!ticket) return null;

        const startAt = toStartAt(ticket.date, ticket.time);
        const derived = deriveStatus(row.status, startAt, now);
        if (!derived.status) return null;

        const confirmed = row.status === "approved";
        const memberInfoVisible = confirmed && derived.progressIndex >= 1;
        const placeInfoVisible = confirmed && derived.progressIndex >= 2;
        const assignedIds = memberInfoVisible
          ? assignmentsByInstance.get(instanceId ?? "") ?? []
          : [];
        const memberIds = memberInfoVisible
          ? unique([...assignedIds, user.id])
          : [];
        const members: TicketMemberIntro[] = memberIds.map((id) => {
          const memberProfile = profileMap.get(id);
          const memberArrival = instanceId
            ? arrivalByMember.get(`${instanceId}:${id}`)
            : null;
          const arrivalStatus =
            id === user.id
              ? row.arrival_status ?? memberArrival?.arrival_status ?? null
              : memberArrival?.arrival_status ?? null;
          const arrivalStatusUpdatedAt =
            id === user.id
              ? row.arrival_status_updated_at ??
                memberArrival?.arrival_status_updated_at ??
                null
              : memberArrival?.arrival_status_updated_at ?? null;

          return {
            id,
            name: memberProfile?.name ?? null,
            nickname: displayNickname(memberProfile),
            gender:
              memberProfile?.gender === "남성" || memberProfile?.gender === "여성"
                ? memberProfile.gender
                : null,
            emoji: displayProfileEmoji(memberProfile, id),
            publicIntro: memberProfile?.public_intro ?? null,
            arrivalStatus,
            arrivalStatusUpdatedAt,
            isSelf: id === user.id,
          };
        });

        const placeVisible =
          placeInfoVisible && instance?.place_visibility !== "hidden";

        return {
          id: String(row.id),
          waitlistId: String(row.id),
          ticket,
          rawStatus: row.status,
          status: derived.status,
          statusLabel: derived.statusLabel,
          progressStep: derived.progressStep,
          progressIndex: derived.progressIndex,
          meetingStartAt: isoOrNull(startAt),
          arrivalOpensAt: isoOrNull(startAt ? addHours(startAt, -3) : null),
          feedbackOpensAt: isoOrNull(startAt ? addHours(startAt, 3) : null),
          canSetArrival:
            confirmed && !row.assignment_only && derived.canSetArrival,
          arrivalStatus: row.arrival_status ?? null,
          arrivalStatusUpdatedAt: row.arrival_status_updated_at ?? null,
          place: placeVisible
            ? {
                name: instance?.place_name ?? null,
                address: instance?.address ?? null,
              }
            : null,
          members,
        };
      })
      .filter((ticket): ticket is UserTicket => Boolean(ticket))
      .sort(sortUserTickets);

    return ticketsResponse(tickets, participationCount);
  } catch (error) {
    console.error("[meetings my-tickets]", error);
    return NextResponse.json(
      { error: "내 티켓 정보를 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
