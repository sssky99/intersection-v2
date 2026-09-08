import { describe, expect, it } from "vitest";
import { programEventStages } from "./programEventStages";
describe("program to event journey", () => {
  it("copies all three activities in order instead of replacing them with generic names", () => {
    const stages = programEventStages("event", "19:00", [
      { title: "Dinner", openOffsetMinutes: 0 },
      { title: "Games", openOffsetMinutes: 90 },
      { title: "Bar", openOffsetMinutes: 150 },
    ]);
    expect(stages.map((s) => s.title)).toEqual([
      "Dinner",
      "Games",
      "Bar",
      "피드백",
    ]);
    expect(stages.map((s) => s.starts_at)).toEqual([
      "19:00",
      "20:30",
      "21:30",
      "22:00",
    ]);
    expect(stages.map((s) => s.sequence)).toEqual([1, 2, 3, 4]);
  });
  it("supports older programs without stored steps", () => {
    expect(
      programEventStages("event", "18:00", []).map((s) => s.starts_at),
    ).toEqual(["18:00", "19:30", "21:00"]);
  });
});
