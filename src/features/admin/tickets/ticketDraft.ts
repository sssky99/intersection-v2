"use client";
import { profileName } from "@/features/admin/adminDisplay";
import type { AdminProfile } from "@/features/admin/adminProfile";
import {
  type AdminTicketInstance,
  type AdminTicketTemplate,
} from "@/features/admin/ticketAdminTypes";
import {
  normalizeMeetingAtmosphereAgeBandId,
  normalizeMeetingAtmosphereGenderMood,
} from "@/lib/meetingAtmosphere";
import {
  ticketPlaceFromLegacyFields,
  ticketPlaceFromMeetingPlace,
} from "@/lib/placePayload";
import {
  courseStepOpenOffsetMinutes,
  ensureMinimumStoredTicketCourseSteps,
  legacyStoredTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
  type StoredTicketCourseStep,
} from "@/lib/ticketCourse";
import { defaultTicketStageCopy } from "@/lib/ticketStageCopy";
import {
  MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
  MEETING_MAX_PARTICIPANT_COUNT,
  type GatheringTicket,
  type TicketArrivalStatus,
  type TicketMemberIntro,
  type TicketStageCopy,
  type UserTicket,
} from "@/types/ticket";
import {
  inferTicketCategory,
  normalizeTicketCategory,
} from "@/types/ticketCategory";
import type { Gender } from "@/types/user";
import {
  firstDraftCourseStep,
  mainDraftCourseStep,
  normalizeDraftCourseSteps,
  syncDraftCourseFields,
} from "./ticketCourseDraft";
import { TicketCourseStepDraft, TicketDraft } from "./ticketDraftTypes";
import { normalizeTimeValue } from "./TicketFormControls";

export const fixedDetailNotices = ["상세 장소는 참여 확정 후 안내돼요."];

export function lines(value: string, limit?: number) {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export function prose(value: string) {
  const text = value.trim();
  return text ? [text] : [];
}

export function customNoticeLines(value: string) {
  return lines(value).filter((item) => !fixedDetailNotices.includes(item));
}

export function customNoticeText(value: string) {
  return customNoticeLines(value).join("\n");
}

export function tags(value: string) {
  return value
    .split("#")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function firstNormalizedTimeValue(
  ...values: Array<string | null | undefined>
) {
  for (const value of values) {
    const normalized = normalizeTimeValue(value);
    if (normalized) return normalized;
  }
  return "";
}

export function primaryInstance(template: AdminTicketTemplate | null) {
  if (!template?.instances.length) return null;

  return [...template.instances]
    .sort((left, right) => {
      const leftArchived = left.visibility === "archived" ? 1 : 0;
      const rightArchived = right.visibility === "archived" ? 1 : 0;
      return (
        leftArchived - rightArchived ||
        `${left.event_date ?? "9999"}${left.event_time ?? ""}${left.created_at}`.localeCompare(
          `${right.event_date ?? "9999"}${right.event_time ?? ""}${right.created_at}`,
        )
      );
    })
    .at(0)!;
}

export function courseStepDraftFromStored(
  step: StoredTicketCourseStep,
): TicketCourseStepDraft {
  return {
    id: step.id,
    order: step.order,
    title: step.title ?? "",
    activityType: step.activityType ?? "",
    imageUrl: step.imageUrl ?? "",
    placeName: step.placeName ?? "",
    address: step.address ?? "",
    place: step.place,
    openOffsetMinutes: String(step.openOffsetMinutes),
    isMainActivity: step.isMainActivity,
  };
}

export function draftCourseStepsFromTicket(
  template: AdminTicketTemplate,
  instance: AdminTicketInstance | null,
) {
  const storedSteps = normalizeStoredTicketCourseSteps(template.course_steps);
  const courseSteps = ensureMinimumStoredTicketCourseSteps(
    storedSteps.length
      ? storedSteps
      : legacyStoredTicketCourseSteps({
          title: template.title,
          activityType: template.activity_type,
          imageUrl: template.image_url,
          placeName: instance?.place_name,
          address: instance?.address,
          place: instance?.place_payload,
        }),
  );

  const draftSteps = courseSteps.map(courseStepDraftFromStored);
  const instancePlace = instance?.place_payload ?? null;
  const instancePlaceName = instance?.place_name ?? instancePlace?.name ?? null;
  const instanceAddress =
    instance?.address ??
    instancePlace?.roadAddress ??
    instancePlace?.jibunAddress ??
    null;

  if (!instancePlace && !instancePlaceName && !instanceAddress) {
    return draftSteps;
  }

  return draftSteps.map((step, index) =>
    index === 0
      ? {
          ...step,
          place: instancePlace ?? step.place,
          placeName: instancePlaceName ?? step.placeName,
          address: instanceAddress ?? step.address,
        }
      : step,
  );
}

export function storedCourseStepsFromDraft(steps: TicketCourseStepDraft[]) {
  return normalizeDraftCourseSteps(steps).map((step, index) => ({
    id: step.id,
    order: step.order,
    title: step.title.trim() || null,
    activityType: normalizeTicketCategory(step.activityType) ?? null,
    imageUrl: step.imageUrl.trim() || null,
    placeName: step.placeName.trim() || null,
    address: step.address.trim() || null,
    place: step.place,
    openOffsetMinutes: courseStepOpenOffsetMinutes(
      step.openOffsetMinutes,
      index,
    ),
    isMainActivity: step.isMainActivity,
  }));
}

export function courseStepDraftHasContent(step: TicketCourseStepDraft) {
  return Boolean(
    step.title.trim() ||
      step.activityType.trim() ||
      step.imageUrl.trim() ||
      step.placeName.trim() ||
      step.address.trim() ||
      step.place,
  );
}

export function ticketCourseStepsFromDraft(
  draft: TicketDraft,
): GatheringTicket["courseSteps"] {
  return normalizeDraftCourseSteps(draft.courseSteps)
    .filter(courseStepDraftHasContent)
    .map((step, index) => ({
      id: step.id,
      order: index + 1,
      title: step.title.trim() || null,
      activityType: normalizeTicketCategory(step.activityType) ?? null,
      imageUrl: step.imageUrl.trim() || null,
      placeName: step.placeName.trim() || null,
      address: step.address.trim() || null,
      place:
        ticketPlaceFromMeetingPlace(step.place) ??
        ticketPlaceFromLegacyFields({
          placeName: step.placeName,
          address: step.address,
        }),
      openOffsetMinutes: courseStepOpenOffsetMinutes(
        step.openOffsetMinutes,
        index,
      ),
      isMainActivity: step.isMainActivity,
    }));
}

export function stageCopyValue(
  stageCopy: TicketStageCopy | null | undefined,
  key: keyof TicketStageCopy,
) {
  return stageCopy?.[key] ?? defaultTicketStageCopy[key];
}

export function draftFromTicket(
  template: AdminTicketTemplate,
  instance: AdminTicketInstance | null = primaryInstance(template),
): TicketDraft {
  const courseSteps = draftCourseStepsFromTicket(template, instance);
  const mainCourseStep = mainDraftCourseStep(courseSteps);
  const firstCourseStep = firstDraftCourseStep(courseSteps);

  return {
    templateKind: template.template_kind,
    title: template.title,
    shortDescription: template.short_description ?? "",
    detailSummary: template.detail_summary ?? "",
    detailActivities: template.detail_activities.join("\n"),
    detailFlow: template.detail_flow.join("\n"),
    detailGoodFor: template.detail_good_for.join("\n"),
    detailNotice: customNoticeText(template.detail_notice ?? ""),
    stagePaymentPendingText: stageCopyValue(
      template.stage_copy,
      "paymentPending",
    ),
    stageWaitlistedText: stageCopyValue(template.stage_copy, "waitlisted"),
    stageAppliedText: stageCopyValue(template.stage_copy, "applied"),
    stageApprovedText: stageCopyValue(template.stage_copy, "approved"),
    stagePreStartText: stageCopyValue(template.stage_copy, "preStart"),
    stageInProgressText: stageCopyValue(template.stage_copy, "inProgress"),
    stageFeedbackOpenText: stageCopyValue(template.stage_copy, "feedbackOpen"),
    feedbackTitle: stageCopyValue(template.stage_copy, "feedbackTitle"),
    feedbackBody: stageCopyValue(template.stage_copy, "feedbackBody"),
    imageUrl: mainCourseStep.imageUrl || template.image_url || "",
    courseSteps,
    moodTags: template.mood_tags.map((tag) => `#${tag}`).join(" "),
    activityType:
      mainCourseStep.activityType ||
      (inferTicketCategory({
        activityType: template.activity_type,
        title: template.title,
        moodTags: template.mood_tags,
        shortDescription: template.short_description,
      }) ??
        ""),
    recommendationCopy: template.recommendation_copy ?? "",
    recommendationPreferredActivities:
      template.recommendation_preferred_activities ?? [],
    recommendationRecentInterests:
      template.recommendation_recent_interests ?? [],
    eventDate: instance?.event_date ?? "",
    eventTime: firstNormalizedTimeValue(
      instance?.event_time,
      template.default_time,
    ),
    region: instance?.region ?? template.default_region ?? "",
    placeName: instance?.place_name || firstCourseStep.placeName || "",
    address: instance?.address || firstCourseStep.address || "",
    place: instance?.place_payload ?? firstCourseStep.place ?? null,
    atmosphereGenderMood: template.atmosphere_gender_mood ?? "",
    atmosphereAgeBandId: template.atmosphere_age_band_id ?? "",
    operationCode: instance?.operation_code ?? "",
    operationNote: instance?.operation_note ?? "",
    placeVisibility:
      instance?.place_visibility === "hidden" ? "hidden" : "confirmed_only",
    visibility:
      template.template_kind === "question_sample"
        ? "question"
        : (instance?.visibility ?? "draft"),
    questionOrder: template.question_order
      ? String(template.question_order)
      : template.template_kind === "question_sample"
        ? "1"
        : "",
    remainingSeatLabelCount: String(instance?.remaining_seat_label_count ?? 0),
    minimumParticipantCount: String(
      instance?.minimum_participant_count ??
        MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    ),
    maxParticipantCount: String(instance?.max_participant_count ?? 6),
  };
}

export function stageCopyFromDraft(draft: TicketDraft): TicketStageCopy {
  return {
    paymentPending: draft.stagePaymentPendingText,
    waitlisted: draft.stageWaitlistedText,
    applied: draft.stageAppliedText,
    approved: draft.stageApprovedText,
    preStart: draft.stagePreStartText,
    inProgress: draft.stageInProgressText,
    feedbackOpen: draft.stageFeedbackOpenText,
    feedbackTitle: draft.feedbackTitle,
    feedbackBody: draft.feedbackBody,
  };
}

export function ticketRequestBody(draft: TicketDraft) {
  const syncedDraft = syncDraftCourseFields(draft);
  const mainCourseStep = mainDraftCourseStep(syncedDraft.courseSteps);
  const eventTime = normalizeTimeValue(draft.eventTime);

  return {
    templateKind: syncedDraft.templateKind,
    title: syncedDraft.title,
    shortDescription: syncedDraft.shortDescription,
    detailSummary: syncedDraft.detailSummary,
    detailActivities: prose(syncedDraft.detailActivities),
    detailFlow: [],
    detailGoodFor: lines(syncedDraft.detailGoodFor),
    detailNotice: syncedDraft.detailNotice,
    stageCopy: stageCopyFromDraft(syncedDraft),
    imageUrl: mainCourseStep.imageUrl,
    courseSteps: storedCourseStepsFromDraft(syncedDraft.courseSteps),
    moodTags: tags(syncedDraft.moodTags),
    activityType: normalizeTicketCategory(mainCourseStep.activityType),
    recommendationCopy: syncedDraft.recommendationCopy,
    recommendationPreferredActivities:
      syncedDraft.recommendationPreferredActivities,
    recommendationRecentInterests: syncedDraft.recommendationRecentInterests,
    defaultRegion: syncedDraft.region,
    defaultTime: eventTime,
    eventDate: syncedDraft.eventDate,
    eventTime,
    region: syncedDraft.region,
    placeName: syncedDraft.placeName,
    address: syncedDraft.address,
    place: syncedDraft.place,
    atmosphereGenderMood: syncedDraft.atmosphereGenderMood || null,
    atmosphereAgeBandId: syncedDraft.atmosphereAgeBandId || null,
    operationCode: syncedDraft.operationCode,
    operationNote: syncedDraft.operationNote,
    placeVisibility: syncedDraft.placeVisibility,
    visibility: syncedDraft.visibility,
    questionOrder:
      syncedDraft.templateKind === "question_sample"
        ? syncedDraft.questionOrder
        : null,
    remainingSeatLabelCount: syncedDraft.remainingSeatLabelCount,
    minimumParticipantCount: syncedDraft.minimumParticipantCount,
    maxParticipantCount: syncedDraft.maxParticipantCount,
  };
}

export function ticketAtmospherePreview(
  draft: TicketDraft,
  template: AdminTicketTemplate | null,
): GatheringTicket["atmosphere"] {
  const ageBandOverride = normalizeMeetingAtmosphereAgeBandId(
    draft.atmosphereAgeBandId,
  );
  const genderMoodOverride = normalizeMeetingAtmosphereGenderMood(
    draft.atmosphereGenderMood,
  );

  return {
    ageBandId:
      ageBandOverride ?? template?.atmosphere_default_age_band_id ?? null,
    genderMood:
      genderMoodOverride ?? template?.atmosphere_default_gender_mood ?? null,
    defaultAgeBandId: template?.atmosphere_default_age_band_id ?? null,
    defaultGenderMood: template?.atmosphere_default_gender_mood ?? null,
    ageBandOverrideId: ageBandOverride,
    genderMoodOverride,
  };
}

export function ticketPreview(
  draft: TicketDraft,
  template: AdminTicketTemplate | null,
  instance: AdminTicketInstance | null,
): GatheringTicket {
  const syncedDraft = syncDraftCourseFields(draft);
  const mainCourseStep = mainDraftCourseStep(syncedDraft.courseSteps);
  const courseSteps = ticketCourseStepsFromDraft(syncedDraft);
  const isSampleTicket = draft.templateKind === "question_sample";
  const shortDescription =
    syncedDraft.shortDescription.trim() ||
    syncedDraft.recommendationCopy.trim();

  return {
    id: instance?.id ?? template?.id ?? "preview",
    templateId: template?.id ?? "preview",
    title: syncedDraft.title.trim() || "새 초대장",
    subtitle: shortDescription || "교집합 초대장",
    date: isSampleTicket ? "" : syncedDraft.eventDate,
    time: isSampleTicket
      ? ""
      : normalizeTimeValue(syncedDraft.eventTime) || "시간 미정",
    area: isSampleTicket ? "" : syncedDraft.region.trim() || "지역 미정",
    moodTags: tags(syncedDraft.moodTags),
    activityType:
      normalizeTicketCategory(mainCourseStep.activityType) ?? undefined,
    imageUrl: mainCourseStep.imageUrl.trim() || undefined,
    courseSteps,
    remainingSeatCount:
      Number.parseInt(syncedDraft.remainingSeatLabelCount, 10) || 0,
    minimumParticipantCount:
      Number.parseInt(syncedDraft.minimumParticipantCount, 10) ||
      MEETING_DEFAULT_MIN_PARTICIPANT_COUNT,
    maxParticipantCount:
      Number.parseInt(syncedDraft.maxParticipantCount, 10) ||
      MEETING_MAX_PARTICIPANT_COUNT,
    peopleHint:
      syncedDraft.recommendationCopy.trim() || shortDescription || "초대장",
    reason:
      syncedDraft.recommendationCopy.trim() || shortDescription || "초대장",
    recommendationAudience: {
      preferredActivities: syncedDraft.recommendationPreferredActivities,
      recentInterests: syncedDraft.recommendationRecentInterests,
    },
    detailSummary:
      syncedDraft.detailSummary.trim() || shortDescription || undefined,
    detailActivities: prose(syncedDraft.detailActivities),
    detailFlow: [],
    detailGoodFor: lines(syncedDraft.detailGoodFor),
    detailNotice: syncedDraft.detailNotice.trim() || undefined,
    place:
      ticketPlaceFromMeetingPlace(syncedDraft.place) ??
      ticketPlaceFromLegacyFields({
        placeName: syncedDraft.placeName,
        address: syncedDraft.address,
      }),
    stageCopy: stageCopyFromDraft(syncedDraft),
    atmosphere: ticketAtmospherePreview(syncedDraft, template),
  };
}

export function profileGender(
  profile: AdminProfile | null | undefined,
): Gender | null {
  if (
    profile?.gender === "여성" ||
    profile?.gender === "남성" ||
    profile?.gender === "비공개" ||
    profile?.gender === ""
  ) {
    return profile.gender;
  }
  return null;
}

export function ticketStartIso(ticket: GatheringTicket) {
  if (!ticket.date || !ticket.time) return null;
  const normalizedTime = ticket.time.slice(0, 5);
  const date = new Date(`${ticket.date}T${normalizedTime}:00+09:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function addHoursIso(iso: string | null, hours: number) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function memberFromProfile({
  profile,
  fallbackDisplayName,
  fallbackIntro,
  isSelf,
  arrivalStatus,
}: {
  profile: AdminProfile | null;
  fallbackDisplayName: string;
  fallbackIntro?: string | null;
  isSelf: boolean;
  arrivalStatus: TicketArrivalStatus | null;
}): TicketMemberIntro {
  return {
    id: profile?.user_id ?? `preview-${fallbackDisplayName}`,
    name: profile?.name ?? fallbackDisplayName,
    nickname: profile?.nickname ?? fallbackDisplayName,
    photoUrl: profile?.photo_url?.trim() || null,
    gender: profileGender(profile),
    publicIntro: profile?.public_intro ?? fallbackIntro ?? null,
    arrivalStatus,
    arrivalStatusUpdatedAt: arrivalStatus ? new Date().toISOString() : null,
    isSelf,
  };
}

export function progressPreviewUserTicket({
  ticket,
  draft,
  assignedProfiles,
  selectedInstance,
}: {
  ticket: GatheringTicket;
  draft: TicketDraft;
  assignedProfiles: AdminProfile[];
  selectedInstance: AdminTicketInstance | null;
}): UserTicket {
  const startAt = ticketStartIso(ticket);
  const firstCourseStep = firstDraftCourseStep(draft.courseSteps);
  const members = assignedProfiles.map((profile, index) =>
    memberFromProfile({
      profile,
      fallbackDisplayName: profileName(profile),
      isSelf: index === 0,
      arrivalStatus: index % 2 === 0 ? "on_time" : null,
    }),
  );

  return {
    id: `admin-preview:${ticket.id}`,
    waitlistId: `admin-preview:${ticket.id}`,
    ticket,
    rawStatus: "feedback_open",
    status: "feedback_open",
    statusLabel: "피드백 작성 가능",
    progressStep: "feedback",
    progressIndex: 4,
    meetingStartAt: startAt,
    arrivalOpensAt: addHoursIso(startAt, -3),
    feedbackOpensAt: addHoursIso(startAt, 3),
    canSetArrival: true,
    arrivalStatus: "on_time",
    arrivalStatusUpdatedAt: new Date().toISOString(),
    place: {
      name:
        (selectedInstance?.place_name ?? firstCourseStep.placeName.trim()) ||
        null,
      address:
        (selectedInstance?.address ?? firstCourseStep.address.trim()) || null,
    },
    members,
  };
}
