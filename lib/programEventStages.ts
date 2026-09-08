import {
  ensureMinimumStoredTicketCourseSteps,
  normalizeStoredTicketCourseSteps,
} from "@/lib/ticketCourse";

export function programEventStages(
  eventId: string,
  startsAt: string,
  courseSteps: unknown,
) {
  const [hours, minutes] = startsAt.split(":").map(Number);
  const at = (offset: number) => {
    const total = (hours * 60 + minutes + offset) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const steps = ensureMinimumStoredTicketCourseSteps(
    normalizeStoredTicketCourseSteps(courseSteps),
  );
  return [
    ...steps.map((step, index) => ({
      event_id: eventId,
      title: step.title || (index === 0 ? "저녁 식사" : "공통 활동"),
      stage_type: index === 0 ? "meal" : "activity",
      sequence: index + 1,
      starts_at: at(step.openOffsetMinutes),
      location_mode: index === 0 ? "group_specific" : "shared",
    })),
    {
      event_id: eventId,
      title: "피드백",
      stage_type: "feedback",
      sequence: steps.length + 1,
      starts_at: at(180),
      location_mode: "hidden",
    },
  ];
}
