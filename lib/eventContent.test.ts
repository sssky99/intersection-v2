import { describe, expect, it } from "vitest";
import { newEventSnapshot } from "./eventContent";
describe("event content", () => {
  it("creates a waiting-screen journey without a program", () => {
    expect(newEventSnapshot(null).courseSteps.map((s) => s.title)).toEqual([
      "저녁 식사",
      "두 번째 활동",
    ]);
  });
  it("copies the journey and notices without disclosing old venues or attendees", () => {
    const result = newEventSnapshot({
      reservationName: "Secret",
      participants: ["old"],
      stageCopy: { applied: "Welcome" },
      courseSteps: [
        {
          title: "Dinner",
          placeName: "old venue",
          imageUrl: "old-photo",
          reservationName: "old",
        },
        { title: "Games", openOffsetMinutes: 100 },
      ],
    });
    expect(result.courseSteps.map((s) => s.title)).toEqual(["Dinner", "Games"]);
    expect(result.courseSteps[0]).toMatchObject({
      placeName: null,
      imageUrl: null,
      reservationName: null,
    });
    expect(result).not.toHaveProperty("participants");
    expect(result.stageCopy.applied).toBe("Welcome");
  });
});
