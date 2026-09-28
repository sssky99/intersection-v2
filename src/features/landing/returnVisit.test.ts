import { describe, expect, it } from "vitest";
import { landingEntry } from "./returnVisit";

const fresh = { hasAuthCookie: false, hasSeenIntro: false, phase: "guide", answerCount: 0 };
describe("landing visitors without a mandatory intro", () => {
  it("checks member state before stale guest drafts or video history", () => {
    expect(landingEntry({ ...fresh, hasAuthCookie: true, phase: "auth" })).toBe("member");
  });
  it.each([false, true])("preserves questionnaire progress with intro history %s", (hasSeenIntro) => {
    expect(landingEntry({ ...fresh, hasSeenIntro, phase: "questions" })).toBe("resume");
    expect(landingEntry({ ...fresh, hasSeenIntro, phase: "auth" })).toBe("resume");
    expect(landingEntry({ ...fresh, hasSeenIntro, answerCount: 3 })).toBe("resume");
  });
  it.each([false, true])("opens the landing immediately with intro history %s", (hasSeenIntro) => {
    expect(landingEntry({ ...fresh, hasSeenIntro })).toBe("landing");
  });
});
