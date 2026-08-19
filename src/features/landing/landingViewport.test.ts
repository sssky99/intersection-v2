import { describe, expect, it } from "vitest";
import {
  isCompactVisualViewport,
  visualViewportOverlapRatio,
  type LandingViewportSnapshot,
} from "./landingViewport";

const partialViewport: LandingViewportSnapshot = {
  layoutHeight: 639,
  visualHeight: 190,
  visualWidth: 390,
  offsetTop: 0,
  offsetLeft: 0,
  scale: 1,
};

describe("landing visual viewport", () => {
  it("treats the observed 190px viewport as compact", () => {
    expect(isCompactVisualViewport(partialViewport.visualHeight)).toBe(true);
  });

  it("recognizes a CTA placed inside the observed 190px viewport", () => {
    expect(
      visualViewportOverlapRatio(
        {
          top: 122,
          right: 375,
          bottom: 178,
          left: 15,
          width: 360,
          height: 56,
        },
        partialViewport,
      ),
    ).toBe(1);
  });

  it("rejects a CTA that only fits in the larger layout viewport", () => {
    expect(
      visualViewportOverlapRatio(
        {
          top: 420,
          right: 375,
          bottom: 476,
          left: 15,
          width: 360,
          height: 56,
        },
        partialViewport,
      ),
    ).toBe(0);
  });
});
