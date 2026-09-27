import { describe, expect, it } from "vitest";
import { hasColorHuntingStarted } from "./availability";
describe("color hunting start time", () => {
  const start = "2026-10-03T18:00:00+09:00";
  const time = Date.parse(start);
  it("blocks registration before the start", () => expect(hasColorHuntingStarted(start, time - 1)).toBe(false));
  it("opens at the start and stays open afterward", () => {
    expect(hasColorHuntingStarted(start, time)).toBe(true);
    expect(hasColorHuntingStarted(start, time + 86400000)).toBe(true);
  });
  it("fails closed when start time is absent or invalid", () => {
    for (const value of [null, undefined, "", "invalid"]) expect(hasColorHuntingStarted(value, time)).toBe(false);
  });
});
