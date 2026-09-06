import {
  normalizeMeetingAtmosphereAgeBandId,
  normalizeMeetingAtmosphereGenderMood,
  type MeetingAtmosphereDefaults,
} from "@/lib/meetingAtmosphere";
import { type GroupStageLocationOverride } from "@/lib/meetingOperations";
import {
  normalizeMeetingPlace,
  ticketPlaceFromLegacyFields,
} from "@/lib/placePayload";
import {
  courseStepOpenOffsetMinutes,
  displayTicketCourseSteps,
  ensureMinimumStoredTicketCourseSteps,
  legacyStoredTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
  TICKET_COURSE_PLACE_REVEAL_LEAD_MINUTES,
} from "@/lib/ticketCourse";
import {
  sanitizeTicketStageCopy,
  ticketStageCopyKeys,
} from "@/lib/ticketStageCopy";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type GatheringTicket,
  type TicketArrivalStatus,
  type TicketProgressStep,
  type TicketStageCopy,
  type UserTicket,
  type UserTicketStatus,
} from "@/types/ticket";
import { inferTicketCategory } from "@/types/ticketCategory";

export type TemplateRow = {
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
};

export type InstanceRow = {
  id: string;
  template_id: string;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  address: string | null;
  place_visibility: string | null;
  place_payload: unknown;
  ticket_reveal_override_at: string | null;
  remaining_seat_label_count: number | null;
  minimum_participant_count: number | null;
  max_participant_count: number | null;
  visibility: string | null;
};

export type WaitlistRow = {
  id: number | string;
  user_id: string;
  ticket_id: string;
  ticket_template_id: string | null;
  ticket_instance_id: string | null;
  meeting_date: string | null;
  status: string;
  ticket_snapshot:
    | (GatheringTicket & {
        previewSourceInstanceId?: string | null;
        feedbackPreviewSourceInstanceId?: string | null;
      })
    | null;
  arrival_status: TicketArrivalStatus | null;
  arrival_status_updated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TicketSourceRow = WaitlistRow;

export const feedbackPreviewDate = "2026-08-15";

export const feedbackPreviewUserIds = new Set([
  "134de325-a77a-4e55-a646-cc0e267687e2",
  "9a726fad-a4ae-4672-afd5-a8bce5501ed2",
]);

export function forceFeedbackPreview(
  userId: string,
  row: TicketSourceRow,
  instance: InstanceRow | null,
) {
  const eventDate =
    instance?.event_date ?? row.meeting_date ?? row.ticket_snapshot?.date;
  return (
    feedbackPreviewUserIds.has(userId) && eventDate === feedbackPreviewDate
  );
}

export const hiddenStatuses = new Set(["cancelled", "not_selected"]);

export const confirmedStatuses = new Set([
  "approved",
  "completed",
  "feedback_done",
]);

export const statusPriority: Record<UserTicketStatus, number> = {
  approved: 0,
  in_progress: 0,
  feedback_open: 0,
  waitlisted: 1,
  payment_pending: 2,
};

export const statusLabels: Record<UserTicketStatus, string> = {
  payment_pending: "멤버십 결제 확인 중",
  waitlisted: "신청 완료",
  approved: "참여 확정",
  in_progress: "진행 중",
  feedback_open: "피드백 작성 가능",
};

export function textList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function courseStepsForTicket(
  template: TemplateRow,
  snapshot: GatheringTicket | null | undefined,
  includePlaceDetails: boolean,
  detailTicketPlace?: GatheringTicket["place"],
  startAt?: Date | null,
  displayNow?: Date,
  groupStageLocations?: GroupStageLocationOverride[],
  startsFromStageSequence = 1,
) {
  const normalizedSteps = normalizeStoredTicketCourseSteps(
    template.course_steps,
  );
  const storedSteps = ensureMinimumStoredTicketCourseSteps(
    normalizedSteps.length
      ? normalizedSteps
      : legacyStoredTicketCourseSteps({
          title: template.title,
          activityType: template.activity_type ?? snapshot?.activityType,
          imageUrl: template.image_url ?? snapshot?.imageUrl,
        }),
  ).map((step, index) => {
    const stage = groupStageLocations?.find(
      (location) => location.sequence === index + 1,
    );
    return {
      ...step,
      title: stage?.title ?? step.title ?? null,
      openOffsetMinutes: stage?.openOffsetMinutes ?? step.openOffsetMinutes,
    };
  });
  const courseSteps = displayTicketCourseSteps(storedSteps, {
    includePlaceDetails: true,
  });

  const displaySteps = courseSteps.length ? courseSteps : snapshot?.courseSteps;

  if (!displaySteps?.length) {
    return displaySteps;
  }

  const startIndex = Math.max(
    0,
    Math.min(displaySteps.length - 1, startsFromStageSequence - 1),
  );
  const startOffsetMinutes = courseStepOpenOffsetMinutes(
    displaySteps[startIndex]?.openOffsetMinutes,
    startIndex,
  );

  return displaySteps.slice(startIndex).map((step, visibleIndex) => {
    const index = startIndex + visibleIndex;
    const snapshotReservationName =
      snapshot?.reservationNames?.[index]?.trim() ||
      snapshot?.courseSteps?.[index]?.reservationName?.trim() ||
      null;
    const rebasedOpenOffsetMinutes = Math.max(
      0,
      courseStepOpenOffsetMinutes(step.openOffsetMinutes, index) -
        startOffsetMinutes,
    );
    const groupLocation = groupStageLocations?.find(
      (location) => location.sequence === index + 1,
    );
    const rebasedStep = {
      ...step,
      order: visibleIndex + 1,
      reservationName: snapshotReservationName ?? step.reservationName ?? null,
      openOffsetMinutes: rebasedOpenOffsetMinutes,
      isMainActivity: visibleIndex === 0,
    };
    const stepWithGroupLocation = groupLocation
      ? {
          ...rebasedStep,
          placeName: groupLocation.placeName,
          address: groupLocation.address,
          place: groupLocation.place,
        }
      : rebasedStep;
    const laterPlaceOpen = Boolean(
      index > 0 &&
        startAt &&
        displayNow &&
        displayNow >=
          addMinutes(
            startAt,
            rebasedOpenOffsetMinutes - TICKET_COURSE_PLACE_REVEAL_LEAD_MINUTES,
          ),
    );
    const stepPlaceVisible =
      includePlaceDetails &&
      !groupLocation?.hidden &&
      (index === 0 || laterPlaceOpen);

    if (!stepPlaceVisible) {
      return {
        ...stepWithGroupLocation,
        placeName: null,
        address: null,
        place: null,
      };
    }

    if (
      (rebasedStep.isMainActivity || visibleIndex === 0) &&
      detailTicketPlace
    ) {
      return {
        ...stepWithGroupLocation,
        placeName: detailTicketPlace.name,
        address: detailTicketPlace.address,
        place: detailTicketPlace,
      };
    }

    return stepWithGroupLocation;
  });
}

export function atmosphereForTicket(
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

export function mergedStageCopy(...values: unknown[]): TicketStageCopy {
  const merged: TicketStageCopy = {};

  for (const value of values) {
    const copy = sanitizeTicketStageCopy(value);
    for (const key of ticketStageCopyKeys) {
      if (copy[key]) merged[key] = copy[key];
    }
  }

  return merged;
}

export function toStartAt(
  date: string | null | undefined,
  time: string | null | undefined,
) {
  if (!date) return null;
  const normalizedTime = time?.slice(0, 5) || "00:00";
  const start = new Date(`${date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(start.getTime()) ? start : null;
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function toTicket(
  row: WaitlistRow,
  instance: InstanceRow | null,
  template: TemplateRow | null,
  atmosphereDefaults?: MeetingAtmosphereDefaults | null,
  placeVisible = false,
  displayNow = new Date(),
  groupStageLocations?: GroupStageLocationOverride[],
  startsFromStageSequence = 1,
): GatheringTicket | null {
  const snapshot = row.ticket_snapshot;

  if (!instance || !template) {
    return snapshot?.id
      ? {
          ...snapshot,
          activityType:
            inferTicketCategory({
              activityType: snapshot.activityType,
              title: snapshot.title,
              moodTags: snapshot.moodTags,
              shortDescription: snapshot.subtitle,
            }) ?? snapshot.activityType,
          place: null,
        }
      : null;
  }

  const date = instance.event_date ?? row.meeting_date ?? snapshot?.date;
  const time =
    instance.event_time?.slice(0, 5) ??
    template.default_time?.slice(0, 5) ??
    snapshot?.time;

  if (!date || !time) {
    return snapshot?.id
      ? {
          ...snapshot,
          activityType:
            inferTicketCategory({
              activityType: snapshot.activityType,
              title: snapshot.title,
              moodTags: snapshot.moodTags,
              shortDescription: snapshot.subtitle,
            }) ?? snapshot.activityType,
        }
      : null;
  }

  const startAt = toStartAt(date, time);
  const storedSteps = normalizeStoredTicketCourseSteps(template.course_steps);
  const startStepIndex = Math.max(0, startsFromStageSequence - 1);
  const participationStartOffsetMinutes = courseStepOpenOffsetMinutes(
    groupStageLocations?.find(
      (stage) => stage.sequence === startsFromStageSequence,
    )?.openOffsetMinutes ??
      storedSteps[startStepIndex]?.openOffsetMinutes ??
      snapshot?.courseSteps?.[startStepIndex]?.openOffsetMinutes,
    startStepIndex,
  );
  const participationStartAt = startAt
    ? addMinutes(startAt, participationStartOffsetMinutes)
    : null;
  const participationTime = participationStartAt
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(participationStartAt)
        .replace("24:", "00:")
    : time;

  const subtitle =
    template.short_description ??
    template.recommendation_copy ??
    snapshot?.subtitle ??
    "교집합이 준비한 실제 운영 모임";
  const area =
    instance.region ?? template.default_region ?? snapshot?.area ?? "지역 미정";
  const place = normalizeMeetingPlace(instance.place_payload);
  const firstStageLocation = groupStageLocations?.find(
    (location) => location.sequence === startsFromStageSequence,
  );
  const detailTicketPlace = placeVisible
    ? ticketPlaceFromLegacyFields({
        placeName: firstStageLocation
          ? firstStageLocation.placeName
          : instance.place_name,
        address: firstStageLocation
          ? firstStageLocation.address
          : instance.address,
        place: firstStageLocation
          ? normalizeMeetingPlace(firstStageLocation.place)
          : place,
      })
    : null;
  const courseSteps = courseStepsForTicket(
    template,
    snapshot,
    placeVisible,
    detailTicketPlace,
    participationStartAt,
    displayNow,
    groupStageLocations,
    startsFromStageSequence,
  );
  const mainCourseStep =
    courseSteps?.find((step) => step.isMainActivity) ??
    courseSteps?.[0] ??
    null;

  return {
    id: instance.id,
    templateId: instance.template_id,
    title: instance.title || template.title || snapshot?.title || "티켓",
    subtitle,
    date,
    time: participationTime,
    area,
    moodTags: template.mood_tags ?? snapshot?.moodTags ?? [],
    activityType:
      inferTicketCategory({
        activityType:
          mainCourseStep?.activityType ??
          template.activity_type ??
          snapshot?.activityType,
        title: instance.title || template.title || snapshot?.title,
        moodTags: template.mood_tags ?? snapshot?.moodTags,
        shortDescription: subtitle,
      }) ?? snapshot?.activityType,
    imageUrl:
      mainCourseStep?.imageUrl ?? template.image_url ?? snapshot?.imageUrl,
    courseSteps,
    startsFromStageSequence,
    participationStartOffsetMinutes,
    remainingSeatCount:
      instance.remaining_seat_label_count ?? snapshot?.remainingSeatCount ?? 0,
    minimumParticipantCount:
      instance.minimum_participant_count ??
      snapshot?.minimumParticipantCount ??
      MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      instance.max_participant_count ??
      snapshot?.maxParticipantCount ??
      MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint:
      template.recommendation_copy ?? snapshot?.peopleHint ?? subtitle,
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
    reservationName: snapshot?.reservationName?.trim() || null,
    place:
      startsFromStageSequence > 1
        ? (mainCourseStep?.place ?? null)
        : detailTicketPlace,
    stageCopy: mergedStageCopy(snapshot?.stageCopy, template.stage_copy),
    atmosphere: atmosphereForTicket(template, atmosphereDefaults),
  };
}

export function deriveStatus(
  rawStatus: string,
  startAt: Date | null,
  now: Date,
  timing?: {
    activityStartAt?: Date | null;
    feedbackOpenAt?: Date | null;
    chatClosesAt?: Date | null;
  },
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

  const activityStartAt = timing?.activityStartAt ?? startAt;

  if (
    activityStartAt &&
    now >= activityStartAt &&
    !confirmedStatuses.has(rawStatus)
  ) {
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

  if (!confirmedStatuses.has(rawStatus)) {
    return {
      status: "waitlisted",
      statusLabel: statusLabels.waitlisted,
      progressStep: "applied",
      progressIndex: 0,
      canSetArrival: false,
    };
  }

  if (!startAt) {
    if (rawStatus !== "approved") {
      return {
        status: null,
        statusLabel: "",
        progressStep: "feedback",
        progressIndex: 4,
        canSetArrival: false,
      };
    }

    return {
      status: "approved",
      statusLabel: statusLabels.approved,
      progressStep: "approved",
      progressIndex: 1,
      canSetArrival: false,
    };
  }

  const approvalOpenAt = addHours(activityStartAt ?? startAt, -24);
  const arrivalOpenAt = addHours(activityStartAt ?? startAt, -3);
  const feedbackOpenAt = timing?.feedbackOpenAt ?? addHours(startAt, 3);
  const chatClosesAt = timing?.chatClosesAt ?? addHours(feedbackOpenAt, 24);
  const canSetArrival = rawStatus === "approved" && now >= arrivalOpenAt;

  if (now >= chatClosesAt) {
    return {
      status: null,
      statusLabel: "",
      progressStep: "feedback",
      progressIndex: 4,
      canSetArrival: false,
    };
  }

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
      statusLabel:
        rawStatus === "feedback_done"
          ? "피드백 작성 완료"
          : statusLabels.feedback_open,
      progressStep: "feedback",
      progressIndex: 4,
      canSetArrival,
    };
  }

  if (now >= (activityStartAt ?? startAt)) {
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

export function sortUserTickets(left: UserTicket, right: UserTicket) {
  const priority = statusPriority[left.status] - statusPriority[right.status];
  if (priority !== 0) return priority;

  const leftStart =
    left.meetingStartAt ?? `${left.ticket.date}T${left.ticket.time}`;
  const rightStart =
    right.meetingStartAt ?? `${right.ticket.date}T${right.ticket.time}`;
  const dateCompare = leftStart.localeCompare(rightStart);
  if (dateCompare !== 0) return dateCompare;

  return left.ticket.title.localeCompare(right.ticket.title, "ko");
}
