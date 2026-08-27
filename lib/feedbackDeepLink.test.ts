import { describe, expect, it } from "vitest";
import {
  feedbackDeepLinkPath,
  normalizeFeedbackParticipationId,
} from "./feedbackDeepLink";

describe("normalizeFeedbackParticipationId", () => {
  it("accepts and canonicalizes positive bigint participation ids", () => {
    expect(normalizeFeedbackParticipationId("204")).toBe("204");
    expect(normalizeFeedbackParticipationId("000204")).toBe("204");
    expect(normalizeFeedbackParticipationId(["204", "999"])).toBe("204");
  });

  it("rejects unsafe or invalid participation ids", () => {
    expect(normalizeFeedbackParticipationId(undefined)).toBeNull();
    expect(normalizeFeedbackParticipationId("0")).toBeNull();
    expect(normalizeFeedbackParticipationId("-1")).toBeNull();
    expect(normalizeFeedbackParticipationId("204?next=//evil.example")).toBeNull();
    expect(normalizeFeedbackParticipationId("9223372036854775808")).toBeNull();
  });
});

describe("feedbackDeepLinkPath", () => {
  it("builds the canonical internal feedback path", () => {
    expect(feedbackDeepLinkPath("204")).toBe("/feedback/204");
  });
});
