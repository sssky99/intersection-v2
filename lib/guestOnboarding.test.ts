import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyGuestOnboardingDraft, loadGuestOnboardingDraft } from "./guestOnboarding";
import { signupQuestionnaireVersion } from "@/data/localSignupQuestions";

afterEach(() => vi.unstubAllGlobals());
describe("questionnaire version in saved guest drafts", () => {
  it("starts new guests on the current version", () => {
    expect(emptyGuestOnboardingDraft().questionnaireVersion).toBe(signupQuestionnaireVersion);
  });
  it("starts a fresh questionnaire for unfinished old drafts", () => {
    const draft = { ...emptyGuestOnboardingDraft(), questionnaireVersion: undefined, phase: "auth", answers: [{ question_order: 13, answer_values: ["music"], answer_value: null, answer_text: null, other_text: null }] };
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(draft) }, sessionStorage: { getItem: () => null } });
    const restored = loadGuestOnboardingDraft();
    expect(restored.questionnaireVersion).toBe(signupQuestionnaireVersion);
    expect(restored.phase).toBe("guide");
    expect(restored.answers).toEqual([]);
  });
});
