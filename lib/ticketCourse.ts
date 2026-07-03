import {
  meetingPlaceAddress,
  normalizeMeetingPlace,
  ticketPlaceFromLegacyFields,
  ticketPlaceFromMeetingPlace,
} from "@/lib/placePayload";
import type { MeetingPlace } from "@/types/place";
import type { TicketCourseStep } from "@/types/ticket";
import {
  inferTicketCategory,
  normalizeTicketCategory,
} from "@/types/ticketCategory";

export const TICKET_COURSE_MIN_STEPS = 2;
export const TICKET_COURSE_MAX_STEPS = 3;

export type StoredTicketCourseStep = {
  id: string;
  order: number;
  title: string | null;
  activityType: string | null;
  imageUrl: string | null;
  placeName: string | null;
  address: string | null;
  place: MeetingPlace | null;
  isMainActivity: boolean;
};

type LegacyCourseStepSource = {
  title?: string | null;
  activityType?: string | null;
  imageUrl?: string | null;
  placeName?: string | null;
  address?: string | null;
  place?: MeetingPlace | null;
};

function record(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function orderValue(value: unknown, fallback: number) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : fallback;
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(TICKET_COURSE_MAX_STEPS, Math.trunc(number)));
}

function withSingleMainActivity(steps: StoredTicketCourseStep[]) {
  const mainIndex = Math.max(
    0,
    steps.findIndex((step) => step.isMainActivity),
  );

  return steps.map((step, index) => ({
    ...step,
    order: index + 1,
    isMainActivity: index === mainIndex,
  }));
}

function normalizeStep(value: unknown, index: number): StoredTicketCourseStep {
  const source = record(value) ?? {};
  const place = normalizeMeetingPlace(source.place);
  const activityType =
    normalizeTicketCategory(source.activityType) ?? text(source.activityType);
  const placeName = place?.name ?? text(source.placeName);
  const address = meetingPlaceAddress(place) ?? text(source.address);

  return {
    id: text(source.id) ?? `step-${index + 1}`,
    order: orderValue(source.order, index + 1),
    title: text(source.title),
    activityType,
    imageUrl: text(source.imageUrl),
    placeName,
    address,
    place,
    isMainActivity: source.isMainActivity === true,
  };
}

export function normalizeStoredTicketCourseSteps(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  const steps = source
    .slice(0, TICKET_COURSE_MAX_STEPS)
    .map(normalizeStep)
    .sort((left, right) => left.order - right.order);

  return withSingleMainActivity(steps);
}

export function legacyStoredTicketCourseSteps(
  source: LegacyCourseStepSource,
): StoredTicketCourseStep[] {
  const place = normalizeMeetingPlace(source.place);
  const activityType =
    inferTicketCategory({
      activityType: source.activityType,
      title: source.title,
    }) ??
    normalizeTicketCategory(source.activityType) ??
    text(source.activityType);

  return withSingleMainActivity([
    {
      id: "step-1",
      order: 1,
      title: null,
      activityType,
      imageUrl: text(source.imageUrl),
      placeName: place?.name ?? text(source.placeName),
      address: meetingPlaceAddress(place) ?? text(source.address),
      place,
      isMainActivity: true,
    },
  ]);
}

export function ensureMinimumStoredTicketCourseSteps(
  steps: StoredTicketCourseStep[],
) {
  const next = steps.slice(0, TICKET_COURSE_MAX_STEPS);
  while (next.length < TICKET_COURSE_MIN_STEPS) {
    const order = next.length + 1;
    next.push({
      id: `step-${order}`,
      order,
      title: null,
      activityType: null,
      imageUrl: null,
      placeName: null,
      address: null,
      place: null,
      isMainActivity: false,
    });
  }
  return withSingleMainActivity(next);
}

export function ticketCourseStepHasContent(
  step: StoredTicketCourseStep | TicketCourseStep,
) {
  return Boolean(
    step.title?.trim() ||
      step.activityType?.trim() ||
      step.imageUrl?.trim() ||
      step.placeName?.trim() ||
      step.address?.trim() ||
      step.place,
  );
}

export function mainStoredTicketCourseStep(steps: StoredTicketCourseStep[]) {
  return steps.find((step) => step.isMainActivity) ?? steps[0] ?? null;
}

export function displayTicketCourseSteps(
  steps: StoredTicketCourseStep[],
  options: { includePlaceDetails?: boolean } = {},
): TicketCourseStep[] {
  const includePlaceDetails = options.includePlaceDetails ?? true;

  return steps
    .filter((step) =>
      includePlaceDetails
        ? ticketCourseStepHasContent(step)
        : Boolean(
            step.title?.trim() ||
              step.activityType?.trim() ||
              step.imageUrl?.trim(),
          ),
    )
    .map((step, index) => ({
      id: step.id,
      order: index + 1,
      title: step.title,
      activityType: step.activityType,
      imageUrl: step.imageUrl,
      placeName: includePlaceDetails ? step.placeName : null,
      address: includePlaceDetails ? step.address : null,
      place: includePlaceDetails
        ? ticketPlaceFromMeetingPlace(step.place) ??
          ticketPlaceFromLegacyFields({
            placeName: step.placeName,
            address: step.address,
          })
        : null,
      isMainActivity: step.isMainActivity,
    }));
}
