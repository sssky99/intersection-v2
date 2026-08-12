import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("landing variant B analytics", () => {
  it("does not record another landing view when opening the phone form", () => {
    const source = fs.readFileSync(
      new URL("./LandingVariantBPreview.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trackLandingView={false}");
  });
});
