import { describe, expect, it } from "vitest";
import {
  courseStepOpenOffsetMinutes,
  courseStepPlaceRevealOffsetMinutes,
  normalizeStoredTicketCourseSteps,
} from "./ticketCourse";

describe("ticket course timing", () => {
  it("reveals later course places 30 minutes before the activity starts", () => {
    expect(courseStepOpenOffsetMinutes(90, 1)).toBe(90);
    expect(courseStepPlaceRevealOffsetMinutes(90, 1)).toBe(60);
  });

  it("does not move the first course reveal before the meeting starts", () => {
    expect(courseStepPlaceRevealOffsetMinutes(0, 0)).toBe(0);
  });

  it("keeps configured activity offsets while applying the reveal lead", () => {
    const steps = normalizeStoredTicketCourseSteps([
      { id: "step-1", order: 1, openOffsetMinutes: 0 },
      { id: "step-2", order: 2, openOffsetMinutes: 90 },
      { id: "step-3", order: 3, openOffsetMinutes: 150 },
    ]);

    expect(steps.map((step) => step.openOffsetMinutes)).toEqual([0, 90, 150]);
    expect(
      steps.map((step, index) =>
        courseStepPlaceRevealOffsetMinutes(step.openOffsetMinutes, index),
      ),
    ).toEqual([0, 60, 120]);
  });
});
