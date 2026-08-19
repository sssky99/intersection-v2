import { describe, expect, it } from "vitest";
import { validateProfilePhoto } from "./profilePhotoValidation";

describe("validateProfilePhoto", () => {
  it("accepts supported mobile image formats", () => {
    expect(validateProfilePhoto({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateProfilePhoto({ type: "image/heic", size: 1024 })).toBeNull();
  });

  it("rejects unsupported formats", () => {
    expect(validateProfilePhoto({ type: "image/gif", size: 1024 })).toContain(
      "JPG",
    );
  });

  it("rejects files larger than 30MB", () => {
    expect(
      validateProfilePhoto({ type: "image/jpeg", size: 30 * 1024 * 1024 + 1 }),
    ).toContain("30MB");
  });
});
