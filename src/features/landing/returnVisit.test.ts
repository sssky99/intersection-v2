import { describe, expect, it } from "vitest";
import { landingEntry } from "./returnVisit";

const fresh = { hasAuthCookie: false, hasSeenIntro: false, phase: "guide", answerCount: 0 };
describe("returning landing visitors", () => {
  it("checks member state before stale guest drafts or video history", () => {
    expect(landingEntry({ ...fresh, hasAuthCookie: true, phase: "auth" })).toBe("member");
  });
  it("resumes questions and completed guest questionnaires without replaying video", () => {
    expect(landingEntry({ ...fresh, phase: "questions" })).toBe("resume");
    expect(landingEntry({ ...fresh, phase: "auth" })).toBe("resume");
    expect(landingEntry({ ...fresh, answerCount: 3 })).toBe("resume");
  });
  it("shows the intro only when there is no progress or completed intro", () => {
    expect(landingEntry(fresh)).toBe("intro");
    expect(landingEntry({ ...fresh, hasSeenIntro: true })).toBe("landing");
  });
});
