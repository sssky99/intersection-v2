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

  it("keeps the Instagram ad CTA in the upper fold and tracks it separately", () => {
    const source = fs.readFileSync(
      new URL("./LandingVariantBPreview.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('instagramAd ? "top-[17%]"');
    expect(source).toContain('landing_variant: instagramAd ? "instagram_ad" : "b"');
    expect(source).toContain('cta_position: instagramAd ? "upper_fold" : "bottom"');
    expect(source).toContain("useState(instagramAd)");
    expect(source).toContain("if (instagramAd) return;");
    expect(source).toContain("const instagramTypingDurationMs = 360");
    expect(source).toContain("? instagramTypingDurationMs");
  });
});
