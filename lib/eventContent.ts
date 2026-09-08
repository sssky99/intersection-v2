import { normalizeStoredTicketCourseSteps } from "@/lib/ticketCourse";
import { sanitizeTicketStageCopy } from "@/lib/ticketStageCopy";

// New dates copy only reusable content; attendees, venues and reveal state stay behind.
export function newEventSnapshot(source: unknown) {
  const snapshot =
    source && typeof source === "object"
      ? (source as Record<string, unknown>)
      : {};
  const existing = normalizeStoredTicketCourseSteps(snapshot.courseSteps);
  const steps =
    existing.length >= 2
      ? existing
      : [
          { title: "저녁 식사", openOffsetMinutes: 0 },
          { title: "두 번째 활동", openOffsetMinutes: 90 },
        ];
  return {
    stageCopy: sanitizeTicketStageCopy(snapshot.stageCopy),
    courseSteps: steps.map((step, index) => ({
      id: `course-${index + 1}`,
      order: index + 1,
      title: step.title || `활동 ${index + 1}`,
      openOffsetMinutes: step.openOffsetMinutes,
      isMainActivity: index === 0,
      imageUrl: null,
      activityType: null,
      place: null,
      placeName: null,
      address: null,
      reservationName: null,
    })),
  };
}
