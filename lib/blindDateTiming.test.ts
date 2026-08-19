import { describe, expect, it } from "vitest";
import { addBlindDateHours, blindDateStartAtFromParts } from "./blindDateTiming";

describe("blindDateStartAtFromParts", () => {
  it("parses Korean evening labels in Korea time", () => {
    expect(
      blindDateStartAtFromParts("2026-08-20", "저녁 7시")?.toISOString(),
    ).toBe("2026-08-20T10:00:00.000Z");
  });

  it("parses 24-hour labels", () => {
    expect(
      blindDateStartAtFromParts("2026-08-20", "19:30")?.toISOString(),
    ).toBe("2026-08-20T10:30:00.000Z");
  });

  it("returns null for an unknown label", () => {
    expect(blindDateStartAtFromParts("2026-08-20", "시간 미정")).toBeNull();
  });

  it("calculates the arrival and feedback boundaries", () => {
    const startAt = new Date("2026-08-20T10:00:00.000Z");
    expect(addBlindDateHours(startAt, -3).toISOString()).toBe(
      "2026-08-20T07:00:00.000Z",
    );
    expect(addBlindDateHours(startAt, 3).toISOString()).toBe(
      "2026-08-20T13:00:00.000Z",
    );
  });
});
