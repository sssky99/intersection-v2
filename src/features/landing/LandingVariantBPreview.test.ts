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

  it("keeps the onboarding CTA usable before client hydration", () => {
    const source = fs.readFileSync(
      new URL("./LandingVariantBPreview.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('href="/onboarding/start"');
    expect(source).not.toContain('window.location.assign("/onboarding/start")');
  });

  it("keeps the Instagram ad CTA visible in compact visual viewports", () => {
    const source = fs.readFileSync(
      new URL("./LandingVariantBPreview.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('landing_variant: instagramAd ? "instagram_ad" : "b"');
    expect(source).toContain('cta_position: instagramAd ? "upper_fold" : "bottom"');
    expect(source).toContain("useState(instagramAd)");
    expect(source).toContain("if (instagramAd) return;");
    expect(source).toContain("const instagramTypingDurationMs = 360");
    expect(source).toContain("? instagramTypingDurationMs");
    expect(source).toContain("setVisualViewportHeight");
    expect(source).toContain("compactInstagramViewport");
    expect(source).toContain("landing_page_visible_1s");
    expect(source).toContain("landing_cta_visible_1s");
    expect(source).toContain("landing_first_interaction");
    expect(source).toContain("landing_exit");
  });
});
