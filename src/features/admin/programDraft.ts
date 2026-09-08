import {
  normalizeStoredTicketCourseSteps,
  legacyStoredTicketCourseSteps,
  ensureMinimumStoredTicketCourseSteps,
} from "@/lib/ticketCourse";
import { sanitizeTicketStageCopy } from "@/lib/ticketStageCopy";
import type { GatheringTicket, TicketStageCopy } from "@/types/ticket";

export type ProgramDraft = {
  title: string;
  steps: Array<{ title: string }>;
  stageCopy: TicketStageCopy;
};

export type AdminProgram = {
  id: string;
  title: string;
  course_steps: unknown;
  stage_copy: unknown;
  activity_type: string | null;
  updated_at: string;
};

export function programDraft(program?: AdminProgram): ProgramDraft {
  const steps =
    program && normalizeStoredTicketCourseSteps(program.course_steps);
  return {
    title: program?.title ?? "",
    stageCopy: sanitizeTicketStageCopy(program?.stage_copy) ?? {},
    steps: ensureMinimumStoredTicketCourseSteps(
      steps?.length
        ? steps
        : legacyStoredTicketCourseSteps({
            title: program?.title,
            activityType: program?.activity_type,
          }),
    ).map((step, index) => ({
      title: step.title || step.activityType || (index === 0 ? "저녁 식사" : "두 번째 활동"),
    })),
  };
}

// A program carries reusable content only. Never copy venue or reservation data.
export function programPayload(value: unknown) {
  const draft = value as ProgramDraft | null;
  if (
    !draft ||
    typeof draft.title !== "string" ||
    !draft.title.trim() ||
    !Array.isArray(draft.steps) ||
    draft.steps.length < 2 ||
    draft.steps.length > 3 ||
    draft.steps.some(
      (step) => !step || typeof step.title !== "string" || !step.title.trim(),
    )
  ) {
    throw new Error("프로그램 제목과 2~3개의 활동 이름을 입력해주세요.");
  }
  return {
    title: draft.title.trim(),
    stage_copy: sanitizeTicketStageCopy(draft.stageCopy),
    course_steps: draft.steps.map((step, index) => ({
      id: `course-${index + 1}`,
      order: index + 1,
      title: step.title.trim(),
      activityType: null,
      imageUrl: null,
      isMainActivity: index === 0,
      openOffsetMinutes: [0, 90, 150][index],
      placeName: null,
      address: null,
      place: null,
      reservationName: null,
    })),
    activity_type: null,
    image_url: null,
    template_kind: "experience",
    lifecycle_status: "active",
    visibility: "draft",
  };
}

export function programPreview(draft: ProgramDraft): GatheringTicket {
  return {
    id: "program-preview",
    templateId: "program-preview",
    title: draft.title || "프로그램 제목",
    subtitle: "",
    date: "",
    time: "",
    area: "",
    moodTags: [],
    peopleHint: "",
    reason: "",
    courseSteps: draft.steps.map((step, index) => ({
      ...step,
      id: `course-${index + 1}`,
      order: index + 1,
      isMainActivity: index === 0,
      openOffsetMinutes: [0, 90, 150][index],
    })),
    stageCopy: draft.stageCopy,
  };
}
