import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  meetingAtmosphereDefaultsFromProfiles,
  normalizeMeetingAtmosphereAgeBandId,
  normalizeMeetingAtmosphereGenderMood,
  type MeetingAtmosphereDefaults,
} from "@/lib/meetingAtmosphere";
import { sanitizeTicketStageCopy } from "@/lib/ticketStageCopy";
import {
  displayTicketCourseSteps,
  ensureMinimumStoredTicketCourseSteps,
  legacyStoredTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
} from "@/lib/ticketCourse";
import {
  recommendTickets,
  type TicketRecommendationAnswer,
  type TicketRecommendationProfile,
} from "@/lib/ticketRecommendation";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type AvailableDate,
  type GatheringTicket,
} from "@/types/ticket";
import { inferTicketCategory } from "@/types/ticketCategory";

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
  stage_copy: unknown;
  image_url: string | null;
  course_steps: unknown;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  atmosphere_gender_mood: string | null;
  atmosphere_age_band_id: string | null;
  visibility: string;
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
  score_alcohol: number | null;
  score_romance: number | null;
};

type InstanceRow = {
  id: string;
  template_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
  place_payload: unknown;
  place_visibility: string | null;
  remaining_seat_label_count: number | null;
  minimum_participant_count: number | null;
  max_participant_count: number | null;
  visibility: string;
};

type WaitlistRow = {
  ticket_id: string | null;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string | null;
};

type AtmosphereWaitlistRow = WaitlistRow & {
  user_id: string;
};

type ParticipationRow = {
  ticket_instance_id: string;
};

type InvitationRow = {
  id: string;
  ticket_instance_id: string;
  status: "sent" | "viewed" | "accepted" | "declined" | "expired" | "cancelled";
  expires_at: string | null;
};

type ProfileAccessRow = {
  is_test_participant: boolean | null;
  name: string | null;
  nickname: string | null;
  birth_year: string | number | null;
  score_temperature: number | null;
  score_texture: number | null;
  score_tone: number | null;
  score_rhythm: number | null;
};


type AtmosphereProfileRow = {
  user_id: string;
  gender: string | null;
  birth_year: string | number | null;
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
  "visibility",
  "score_temperature",
  "score_texture",
  "score_tone",
  "score_rhythm",
  "score_alcohol",
  "score_romance",
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
  "place_payload",
  "place_visibility",
  "remaining_seat_label_count",
  "minimum_participant_count",
  "max_participant_count",
  "visibility",
].join(",");

const atmosphereWaitlistStatuses = [
  "payment_pending",
  "waitlisted",
  "approved",
  "on_hold",
];

async function fetchTemplateRows(
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

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = weekdayLabels[date.getUTCDay()] ?? "";
  return `${month}월 ${day}일 ${weekday}요일`;
}

function recommendationName(profile: ProfileAccessRow | null) {
  const nickname = profile?.nickname?.trim();
  if (nickname) return nickname;

  const korean = (profile?.name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || undefined;
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function atmosphereForTicket(
  template: TemplateRow,
  defaults: MeetingAtmosphereDefaults | null | undefined,
): GatheringTicket["atmosphere"] {
  const ageBandOverride = normalizeMeetingAtmosphereAgeBandId(
    template.atmosphere_age_band_id,
  );
  const genderMoodOverride = normalizeMeetingAtmosphereGenderMood(
    template.atmosphere_gender_mood,
  );

  return {
    ageBandId: ageBandOverride ?? defaults?.ageBandId ?? null,
    genderMood: genderMoodOverride ?? defaults?.genderMood ?? null,
    defaultAgeBandId: defaults?.ageBandId ?? null,
    defaultGenderMood: defaults?.genderMood ?? null,
    ageBandOverrideId: ageBandOverride,
    genderMoodOverride,
  };
}

function courseStepsForTicket(
  template: TemplateRow,
  includePlaceDetails = false,
) {
  const storedSteps = normalizeStoredTicketCourseSteps(template.course_steps);
  const courseSteps = ensureMinimumStoredTicketCourseSteps(
    storedSteps.length
      ? storedSteps
      : legacyStoredTicketCourseSteps({
          title: template.title,
          activityType: template.activity_type,
          imageUrl: template.image_url,
        }),
  );

  return displayTicketCourseSteps(courseSteps, { includePlaceDetails });
}

function atmosphereInstanceId(
  row: WaitlistRow,
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
    return templateDateMap.get(`${row.ticket_template_id}|${row.meeting_date}`) ?? null;
  }
  return null;
}

async function fetchAtmosphereDefaultsByInstance(
  supabase: ReturnType<typeof createAdminClient>,
  instances: InstanceRow[],
) {
  const instanceIds = uniqueStrings(instances.map((instance) => instance.id));
  if (instanceIds.length === 0) {
    return new Map<string, MeetingAtmosphereDefaults>();
  }

  const templateIds = uniqueStrings(
    instances.map((instance) => instance.template_id),
  );
  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
  const templateDateMap = new Map(
    instances
      .filter((instance) => instance.event_date)
      .map((instance) => [
        `${instance.template_id}|${instance.event_date}`,
        instance.id,
      ]),
  );
  const waitlistSelect =
    "user_id,ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status";
  const waitlistRows: AtmosphereWaitlistRow[] = [];

  const { data: byInstanceId, error: byInstanceIdError } = await supabase
    .from("ticket_participations")
    .select(waitlistSelect)
    .in("ticket_instance_id", instanceIds)
    .in("status", atmosphereWaitlistStatuses)
    .returns<AtmosphereWaitlistRow[]>();
  if (byInstanceIdError) throw byInstanceIdError;
  waitlistRows.push(...(byInstanceId ?? []));

  const { data: byTicketId, error: byTicketIdError } = await supabase
    .from("ticket_participations")
    .select(waitlistSelect)
    .in("ticket_id", instanceIds)
    .in("status", atmosphereWaitlistStatuses)
    .returns<AtmosphereWaitlistRow[]>();
  if (byTicketIdError) throw byTicketIdError;
  waitlistRows.push(...(byTicketId ?? []));

  if (templateIds.length > 0) {
    const { data: byTemplateId, error: byTemplateIdError } = await supabase
      .from("ticket_participations")
      .select(waitlistSelect)
      .in("ticket_template_id", templateIds)
      .in("status", atmosphereWaitlistStatuses)
      .returns<AtmosphereWaitlistRow[]>();
    if (byTemplateIdError) throw byTemplateIdError;
    waitlistRows.push(...(byTemplateId ?? []));
  }

  const userIdsByInstance = new Map<string, Set<string>>();
  for (const row of waitlistRows) {
    const instanceId = atmosphereInstanceId(row, instanceMap, templateDateMap);
    if (!instanceId || !row.user_id) continue;
    const current = userIdsByInstance.get(instanceId) ?? new Set<string>();
    current.add(row.user_id);
    userIdsByInstance.set(instanceId, current);
  }

  const profileIds = uniqueStrings(
    [...userIdsByInstance.values()].flatMap((ids) => [...ids]),
  );
  if (profileIds.length === 0) {
    return new Map<string, MeetingAtmosphereDefaults>();
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,gender,birth_year")
    .in("user_id", profileIds)
    .returns<AtmosphereProfileRow[]>();
  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile]),
  );

  return new Map(
    [...userIdsByInstance.entries()].map(([instanceId, userIds]) => [
      instanceId,
      meetingAtmosphereDefaultsFromProfiles(
        [...userIds]
          .map((userId) => profileMap.get(userId))
          .filter((profile): profile is AtmosphereProfileRow => Boolean(profile)),
      ),
    ]),
  );
}

function toTicket(
  instance: InstanceRow,
  template: TemplateRow,
  name?: string,
  atmosphereDefaults?: MeetingAtmosphereDefaults | null,
  invitation?: InvitationRow | null,
): GatheringTicket | null {
  if (!instance.event_date) return null;

  const time =
    instance.event_time?.slice(0, 5) ??
    template.default_time?.slice(0, 5) ??
    "시간 미정";

  const area = instance.region ?? template.default_region ?? "지역 미정";
  const subtitle =
    template.short_description ??
    template.recommendation_copy ??
    "교집합이 준비한 실제 운영 모임";
  const courseSteps = courseStepsForTicket(template);
  const mainCourseStep =
    courseSteps.find((step) => step.isMainActivity) ?? courseSteps[0] ?? null;

  return {
    id: instance.id,
    templateId: instance.template_id,
    invitationId: invitation?.id ?? null,
    invitationStatus:
      invitation?.status === "sent" ||
      invitation?.status === "viewed" ||
      invitation?.status === "accepted"
        ? invitation.status
        : null,
    title: instance.title || template.title,
    subtitle,
    date: instance.event_date,
    time,
    area,
    moodTags: template.mood_tags ?? [],
    activityType: inferTicketCategory({
      activityType: mainCourseStep?.activityType ?? template.activity_type,
      title: instance.title || template.title,
      moodTags: template.mood_tags,
      shortDescription: subtitle,
    }),
    imageUrl: mainCourseStep?.imageUrl ?? template.image_url ?? undefined,
    courseSteps,
    remainingSeatCount: instance.remaining_seat_label_count ?? 0,
    minimumParticipantCount:
      instance.minimum_participant_count ??
      MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      instance.max_participant_count ?? MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint: template.recommendation_copy ?? subtitle,
    reason: template.recommendation_copy ?? subtitle,
    recommendationName: name,
    detailSummary: template.detail_summary?.trim() || undefined,
    detailActivities: textList(template.detail_activities),
    detailFlow: textList(template.detail_flow),
    detailGoodFor: textList(template.detail_good_for),
    detailNotice: template.detail_notice?.trim() || undefined,
    place: null,
    stageCopy: sanitizeTicketStageCopy(template.stage_copy),
    atmosphere: atmosphereForTicket(template, atmosphereDefaults),
    vibeScores: {
      temperature: template.score_temperature,
      texture: template.score_texture,
      tone: template.score_tone,
      rhythm: template.score_rhythm,
      alcohol: template.score_alcohol,
      romance: template.score_romance,
    },
  };
}

function groupByDate(
  tickets: GatheringTicket[],
  profile: TicketRecommendationProfile | null,
  answers: TicketRecommendationAnswer[],
  applyRecommendation = true,
) {
  const groups = new Map<string, GatheringTicket[]>();

  for (const ticket of tickets) {
    groups.set(ticket.date, [...(groups.get(ticket.date) ?? []), ticket]);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([date, dateTickets]): AvailableDate => ({
        id: `date-${date}`,
        date,
        label: dateLabel(date),
        tickets: applyRecommendation
          ? recommendTickets(dateTickets, profile, answers)
          : dateTickets,
        ticketCount: dateTickets.length,
      }),
    );
}

function groupDateMetadata(tickets: GatheringTicket[]) {
  const counts = new Map<string, number>();

  for (const ticket of tickets) {
    counts.set(ticket.date, (counts.get(ticket.date) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([date, ticketCount]): AvailableDate => ({
        id: `date-${date}`,
        date,
        label: dateLabel(date),
        tickets: [],
        ticketCount,
      }),
    );
}

function groupTicketResponseDates({
  tickets,
  datesOnly,
  profile,
  answers,
  applyRecommendation = true,
}: {
  tickets: GatheringTicket[];
  datesOnly: boolean;
  profile: TicketRecommendationProfile | null;
  answers: TicketRecommendationAnswer[];
  applyRecommendation?: boolean;
}) {
  return datesOnly
    ? groupDateMetadata(tickets)
    : groupByDate(tickets, profile, answers, applyRecommendation);
}

function searchDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function datesResponse(dates: AvailableDate[]) {
  return NextResponse.json(
    { dates },
    {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const includeApplied = requestUrl.searchParams.get("includeApplied") === "1";
    const datesOnly = requestUrl.searchParams.get("mode") === "dates";
    const publicOnly = requestUrl.searchParams.get("publicOnly") === "1";
    const selectedDate = searchDate(requestUrl.searchParams.get("date"));
    const supabase = createAdminClient();
    const userSupabase = publicOnly ? null : await createClient();
    const user = userSupabase
      ? (await userSupabase.auth.getUser()).data.user
      : null;

    let publicInstancesQuery = supabase
      .from("ticket_instances")
      .select(instanceSelect)
      .eq("visibility", "public")
      .not("event_date", "is", null);
    if (selectedDate) {
      publicInstancesQuery = publicInstancesQuery.eq("event_date", selectedDate);
    }

    const { data: instances, error: instancesError } = await publicInstancesQuery
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true, nullsFirst: false });

    if (instancesError) throw instancesError;

    const publicInstanceRows = (instances ?? []) as unknown as InstanceRow[];
    const invitationMap = new Map<string, InvitationRow>();
    const hiddenInvitationInstanceIds = new Set<string>();
    let invitedInstanceRows: InstanceRow[] = [];
    let testInstanceRows: InstanceRow[] = [];
    let recommendationProfile: TicketRecommendationProfile | null = null;
    let recommendationAnswers: TicketRecommendationAnswer[] = [];
    let userRecommendationName: string | undefined;
    let canBypassAgeVisibility = false;

    if (user && userSupabase) {
      const { data: invitationData, error: invitationsError } = await supabase
        .from("ticket_invitations")
        .select("id,ticket_instance_id,status,expires_at")
        .eq("user_id", user.id)
        .returns<InvitationRow[]>();
      if (invitationsError) throw invitationsError;

      const effectiveInvitations = (invitationData ?? []).map((invitation) =>
        invitation.expires_at &&
        new Date(invitation.expires_at).getTime() <= Date.now() &&
        ["sent", "viewed"].includes(invitation.status)
          ? { ...invitation, status: "expired" as const }
          : invitation,
      );

      for (const invitation of effectiveInvitations) {
        invitationMap.set(invitation.ticket_instance_id, invitation);
        if (["expired", "cancelled"].includes(invitation.status)) {
          hiddenInvitationInstanceIds.add(invitation.ticket_instance_id);
        }
      }

      const invitedInstanceIds = effectiveInvitations
        .filter((invitation) =>
          ["sent", "viewed", "accepted", "declined"].includes(
            invitation.status,
          ) &&
          (!invitation.expires_at ||
            new Date(invitation.expires_at).getTime() > Date.now()),
        )
        .map((invitation) => invitation.ticket_instance_id);
      if (invitedInstanceIds.length > 0) {
        let invitedInstancesQuery = supabase
          .from("ticket_instances")
          .select(instanceSelect)
          .in("id", invitedInstanceIds)
          .in("visibility", ["invite_only", "public"])
          .not("event_date", "is", null);
        if (selectedDate) {
          invitedInstancesQuery = invitedInstancesQuery.eq(
            "event_date",
            selectedDate,
          );
        }
        const { data: invitedInstances, error: invitedInstancesError } =
          await invitedInstancesQuery;
        if (invitedInstancesError) throw invitedInstancesError;
        invitedInstanceRows =
          (invitedInstances ?? []) as unknown as InstanceRow[];
      }

      const { data: profileAccess, error: profileAccessError } = await supabase
        .from("profiles")
        .select(
          "is_test_participant,name,nickname,birth_year,score_temperature,score_texture,score_tone,score_rhythm",
        )
        .eq("user_id", user.id)
        .maybeSingle<ProfileAccessRow>();
      if (profileAccessError) throw profileAccessError;

      if (profileAccess) {
        canBypassAgeVisibility = profileAccess.is_test_participant === true;
        userRecommendationName = recommendationName(profileAccess);
        recommendationProfile = {
          score_temperature: profileAccess.score_temperature,
          score_texture: profileAccess.score_texture,
          score_tone: profileAccess.score_tone,
          score_rhythm: profileAccess.score_rhythm,
        };
      }

      if (!datesOnly) {
        const { data: answerRows, error: answersError } = await supabase
          .from("user_answers")
          .select("question_order,answer_value,answer_values,answer_text")
          .eq("user_id", user.id)
          .returns<TicketRecommendationAnswer[]>();
        if (answersError) throw answersError;
        recommendationAnswers = answerRows ?? [];
      }

      const canSeeTestTickets = canBypassAgeVisibility;

      if (!canSeeTestTickets) {
        const instanceRows = Array.from(
          new Map(
            [...publicInstanceRows, ...invitedInstanceRows]
              .filter((instance) => !hiddenInvitationInstanceIds.has(instance.id))
              .map((instance) => [instance.id, instance]),
          ).values(),
        );
        const instanceMap = new Map(
          instanceRows.map((instance) => [instance.id, instance]),
        );
        const excludedTemplateDates = new Set<string>();

        if (!includeApplied) {
          const { data: waitlistRows, error: waitlistError } = await userSupabase
            .from("ticket_participations")
            .select(
              "ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status",
            )
            .eq("user_id", user.id)
            .returns<WaitlistRow[]>();

          if (waitlistError) throw waitlistError;

          for (const row of waitlistRows ?? []) {
            const linkedInstance =
              (row.ticket_instance_id
                ? instanceMap.get(row.ticket_instance_id)
                : null) ??
              (row.ticket_id ? instanceMap.get(row.ticket_id) : null);
            const templateId =
              row.ticket_template_id ?? linkedInstance?.template_id ?? null;
            const meetingDate = row.meeting_date ?? linkedInstance?.event_date ?? null;

            if (templateId && meetingDate) {
              excludedTemplateDates.add(`${templateId}|${meetingDate}`);
            }
          }
        }

        const templateIds = Array.from(
          new Set(instanceRows.map((instance) => instance.template_id)),
        );

        if (templateIds.length === 0) {
          return datesResponse([]);
        }

        const templateRows = await fetchTemplateRows(supabase, templateIds);
        const templateMap = new Map(
          templateRows.map((template) => [
            template.id,
            template,
          ]),
        );
        const atmosphereDefaultsByInstance = datesOnly
          ? new Map<string, MeetingAtmosphereDefaults>()
          : await fetchAtmosphereDefaultsByInstance(supabase, instanceRows);

        const tickets = instanceRows
          .filter(
            (instance) =>
              !excludedTemplateDates.has(
                `${instance.template_id}|${instance.event_date ?? ""}`,
              ),
          )
          .map((instance) => {
            const template = templateMap.get(instance.template_id);
            return template
              ? toTicket(
                  instance,
                  template,
                   userRecommendationName,
                   atmosphereDefaultsByInstance.get(instance.id) ?? null,
                   invitationMap.get(instance.id) ?? null,
                 )
              : null;
          })
          .filter((ticket): ticket is GatheringTicket => Boolean(ticket));

        return datesResponse(
          groupTicketResponseDates({
            tickets,
            datesOnly,
            profile: recommendationProfile,
            answers: recommendationAnswers,
            applyRecommendation: !publicOnly,
          }),
        );
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from("ticket_participations")
        .select("ticket_instance_id")
        .eq("user_id", user.id)
        .in("status", ["approved", "completed", "feedback_done"])
        .returns<ParticipationRow[]>();

      if (assignmentsError) throw assignmentsError;

      const testInstanceIds = Array.from(
        new Set(
          (assignments ?? [])
            .map((assignment) => assignment.ticket_instance_id)
            .filter(Boolean),
        ),
      );

      if (testInstanceIds.length > 0) {
        let assignedInstancesQuery = supabase
          .from("ticket_instances")
          .select(instanceSelect)
          .in("id", testInstanceIds)
          .eq("visibility", "test_only")
          .not("event_date", "is", null);
        if (selectedDate) {
          assignedInstancesQuery = assignedInstancesQuery.eq(
            "event_date",
            selectedDate,
          );
        }

        const { data: assignedInstances, error: assignedInstancesError } =
          await assignedInstancesQuery
            .order("event_date", { ascending: true })
            .order("event_time", { ascending: true, nullsFirst: false });

        if (assignedInstancesError) throw assignedInstancesError;
        testInstanceRows = (assignedInstances ?? []) as unknown as InstanceRow[];
      }
    }

    const instanceRows = Array.from(
      new Map(
        [...publicInstanceRows, ...invitedInstanceRows, ...testInstanceRows]
          .filter((instance) => !hiddenInvitationInstanceIds.has(instance.id))
          .map((instance) => [
          instance.id,
          instance,
        ]),
      ).values(),
    ).sort((left, right) =>
      `${left.event_date ?? ""}${left.event_time ?? ""}${left.title}`.localeCompare(
        `${right.event_date ?? ""}${right.event_time ?? ""}${right.title}`,
      ),
    );
    const instanceMap = new Map(
      instanceRows.map((instance) => [instance.id, instance]),
    );
    const excludedTemplateDates = new Set<string>();

    if (!includeApplied && user && userSupabase) {
      const { data: waitlistRows, error: waitlistError } = await userSupabase
        .from("ticket_participations")
        .select(
          "ticket_id,ticket_template_id,ticket_instance_id,meeting_date,status",
        )
        .eq("user_id", user.id)
        .returns<WaitlistRow[]>();

      if (waitlistError) throw waitlistError;

      for (const row of waitlistRows ?? []) {
        const linkedInstance =
          (row.ticket_instance_id
            ? instanceMap.get(row.ticket_instance_id)
            : null) ??
          (row.ticket_id ? instanceMap.get(row.ticket_id) : null);
        const templateId =
          row.ticket_template_id ?? linkedInstance?.template_id ?? null;
        const meetingDate = row.meeting_date ?? linkedInstance?.event_date ?? null;

        if (templateId && meetingDate) {
          excludedTemplateDates.add(`${templateId}|${meetingDate}`);
        }
      }
    }

    const templateIds = Array.from(
      new Set(instanceRows.map((instance) => instance.template_id)),
    );

    if (templateIds.length === 0) {
      return datesResponse([]);
    }

    const templateRows = await fetchTemplateRows(supabase, templateIds);
    const templateMap = new Map(
      templateRows.map((template) => [
        template.id,
        template,
      ]),
    );
    const atmosphereDefaultsByInstance = datesOnly
      ? new Map<string, MeetingAtmosphereDefaults>()
      : await fetchAtmosphereDefaultsByInstance(supabase, instanceRows);

    const tickets = instanceRows
      .filter(
        (instance) =>
          !excludedTemplateDates.has(
            `${instance.template_id}|${instance.event_date ?? ""}`,
          ),
      )
      .map((instance) => {
        const template = templateMap.get(instance.template_id);
        return template
          ? toTicket(
              instance,
              template,
              userRecommendationName,
              atmosphereDefaultsByInstance.get(instance.id) ?? null,
              invitationMap.get(instance.id) ?? null,
            )
          : null;
      })
      .filter((ticket): ticket is GatheringTicket => Boolean(ticket));

    return datesResponse(
      groupTicketResponseDates({
        tickets,
        datesOnly,
        profile: recommendationProfile,
        answers: recommendationAnswers,
        applyRecommendation: !publicOnly,
      }),
    );
  } catch (error) {
    console.error("[meetings tickets]", error);
    return NextResponse.json(
      { error: "모임 티켓 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
