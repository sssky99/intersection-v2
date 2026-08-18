import { describe, expect, it } from "vitest";
import {
  isNativeAndroidRequest,
  isNativeRestrictedPath,
  isProductionPreviewPath,
} from "./nativeAppRequest";

describe("native app request guards", () => {
  it("recognizes the Android app user agent suffix", () => {
    expect(
      isNativeAndroidRequest(
        "Mozilla/5.0 (Linux; Android 16) GyojiphapAndroid/0.1",
      ),
    ).toBe(true);
    expect(isNativeAndroidRequest("Mozilla/5.0 Chrome/140")).toBe(false);
  });

  it("blocks admin pages and APIs without blocking similar public paths", () => {
    expect(isNativeRestrictedPath("/admin")).toBe(true);
    expect(isNativeRestrictedPath("/admin/profiles")).toBe(true);
    expect(isNativeRestrictedPath("/api/admin/tickets")).toBe(true);
    expect(isNativeRestrictedPath("/administrator")).toBe(false);
    expect(isNativeRestrictedPath("/api/meetings/my-tickets")).toBe(false);
  });

  it("identifies development-only pages and APIs without matching public paths", () => {
    expect(isProductionPreviewPath("/dev/course-preview")).toBe(true);
    expect(isProductionPreviewPath("/api/dev/test-login")).toBe(true);
    expect(isProductionPreviewPath("/onboarding/questions/preview")).toBe(true);
    expect(isProductionPreviewPath("/developer")).toBe(false);
    expect(isProductionPreviewPath("/onboarding/questions")).toBe(false);
  });
});
