"use client";
import {
  courseStepOpenOffsetMinutes,
  TICKET_COURSE_MAX_STEPS,
} from "@/lib/ticketCourse";
import { TicketCourseStepDraft, TicketDraft } from "./ticketDraftTypes";

export function limitTagInput(value: string) {
  return value;
}

export function blankCourseStep(order: number): TicketCourseStepDraft {
  return {
    id: `step-${order}`,
    order,
    title: "",
    activityType: "",
    imageUrl: "",
    placeName: "",
    address: "",
    place: null,
    openOffsetMinutes: String(courseStepOpenOffsetMinutes(null, order - 1)),
    isMainActivity: order === 1,
  };
}

export function normalizeDraftCourseSteps(steps: TicketCourseStepDraft[]) {
  const next = steps.slice(0, TICKET_COURSE_MAX_STEPS).map((step, index) => ({
    ...step,
    id: step.id || `step-${index + 1}`,
    order: index + 1,
  }));

  while (next.length < 2) {
    next.push(blankCourseStep(next.length + 1));
  }

  const mainIndex = Math.max(
    0,
    next.findIndex((step) => step.isMainActivity),
  );

  let previousOpenOffset = 0;
  return next.map((step, index) => {
    const openOffsetMinutes = Math.max(
      previousOpenOffset,
      courseStepOpenOffsetMinutes(step.openOffsetMinutes, index),
    );
    previousOpenOffset = openOffsetMinutes;

    return {
      ...step,
      order: index + 1,
      openOffsetMinutes: String(openOffsetMinutes),
      isMainActivity: index === mainIndex,
    };
  });
}

export function mainDraftCourseStep(steps: TicketCourseStepDraft[]) {
  return (
    steps.find((step) => step.isMainActivity) ?? steps[0] ?? blankCourseStep(1)
  );
}

export function firstDraftCourseStep(steps: TicketCourseStepDraft[]) {
  return steps[0] ?? blankCourseStep(1);
}

export function syncDraftCourseFields(draft: TicketDraft): TicketDraft {
  const courseSteps = normalizeDraftCourseSteps(draft.courseSteps);
  const mainStep = mainDraftCourseStep(courseSteps);
  const firstStep = firstDraftCourseStep(courseSteps);

  return {
    ...draft,
    courseSteps,
    imageUrl: mainStep.imageUrl,
    activityType: mainStep.activityType,
    placeName: firstStep.placeName,
    address: firstStep.address,
    place: firstStep.place,
  };
}

export function updatedDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
