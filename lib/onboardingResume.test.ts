import { describe, expect, it } from "vitest";
import {
  initialResumeQuestionIndex,
  shouldResumeAtPhotoStep,
} from "./onboardingResume";

describe("onboarding resume", () => {
  it("uses the requested start only before any answer has been stored", () => {
    expect(
      initialResumeQuestionIndex({
        requestedStartIndex: 0,
        firstIncompleteIndex: 0,
        questionCount: 20,
        storedAnswerCount: 0,
      }),
    ).toBe(0);
  });

  it("resumes at the first incomplete question when an old URL says start=1", () => {
    expect(
      initialResumeQuestionIndex({
        requestedStartIndex: 0,
        firstIncompleteIndex: 7,
        questionCount: 20,
        storedAnswerCount: 7,
      }),
    ).toBe(7);
  });

  it("preserves an explicit profile-review question", () => {
    expect(
      initialResumeQuestionIndex({
        explicitQuestionIndex: 2,
        requestedStartIndex: 0,
        firstIncompleteIndex: -1,
        questionCount: 20,
        storedAnswerCount: 20,
      }),
    ).toBe(2);
  });

  it("sends completed onboarding answers to the photo step", () => {
    expect(
      shouldResumeAtPhotoStep({
        mode: "onboarding",
        initialPhotoStep: false,
        firstIncompleteIndex: -1,
      }),
    ).toBe(true);
  });

  it("does not replace an explicit review question with the photo step", () => {
    expect(
      shouldResumeAtPhotoStep({
        mode: "preview",
        initialPhotoStep: false,
        explicitQuestionIndex: 2,
        firstIncompleteIndex: -1,
      }),
    ).toBe(false);
  });
});
