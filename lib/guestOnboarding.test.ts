import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyGuestOnboardingDraft, loadGuestOnboardingDraft } from "./guestOnboarding";
import { preferenceProfileVersion } from "@/data/preferenceQuestions";

afterEach(() => vi.unstubAllGlobals());
describe("questionnaire version in saved guest drafts", () => {
  it("starts new guests on the current version", () => {
    expect(emptyGuestOnboardingDraft().questionnaireVersion).toBe(preferenceProfileVersion);
  });
  it("keeps old in-progress answers and authentication phase on their original question set", () => {
    const draft = { ...emptyGuestOnboardingDraft(), questionnaireVersion: undefined, phase: "auth", answers: [{ question_order: 13, answer_values: ["music"], answer_value: null, answer_text: null, other_text: null }] };
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(draft) }, sessionStorage: { getItem: () => null } });
    const restored = loadGuestOnboardingDraft();
    expect(restored.questionnaireVersion).toBe("preferences-v14");
    expect(restored.phase).toBe("auth");
    expect(restored.answers).toEqual(draft.answers);
  });
});
