import { describe, expect, it } from "vitest";
import {
  meetingEventDeepLinkPath,
  normalizeMeetingEventId,
} from "./meetingDeepLink";

describe("meeting event deep links", () => {
  it("accepts a meeting event UUID", () => {
    expect(
      normalizeMeetingEventId("CC09D600-33A0-4B6B-9B7B-D115A00FA192"),
    ).toBe("cc09d600-33a0-4b6b-9b7b-d115a00fa192");
  });

  it("rejects malformed or external values", () => {
    expect(normalizeMeetingEventId("2026-09-04")).toBeNull();
    expect(normalizeMeetingEventId("//example.com")).toBeNull();
  });

  it("builds the public meeting path", () => {
    expect(
      meetingEventDeepLinkPath("cc09d600-33a0-4b6b-9b7b-d115a00fa192"),
    ).toBe(
      "/meetings?event=cc09d600-33a0-4b6b-9b7b-d115a00fa192",
    );
  });
});
