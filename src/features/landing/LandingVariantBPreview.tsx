"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiftyQLandingClient } from "@/app/FiftyQLandingClient";
import { trackEvent } from "@/lib/analytics";
import {
  isCompactVisualViewport,
  readLandingViewport,
  stableLandingExposureMs,
  visualViewportOverlapRatio,
} from "./landingViewport";

const headline =
  "아무나 만나지 않도록,\n당신에게 딱 맞는 사람들을 찾아줄게요.";
const headlineLead = "아무나 만나지 않도록,\n";
const contentCueFallbackDelayMs = 600;
const instagramTypingDurationMs = 360;
const defaultTypingDurationMs = 1300;

type LandingVariantBProps = {
  instagramAd?: boolean;
  preview?: boolean;
};

export function LandingVariantB({
  instagramAd = false,
  preview = false,
}: LandingVariantBProps) {
  const [typedHeadline, setTypedHeadline] = useState(headlineLead);
  const [isContentVisible, setIsContentVisible] = useState(instagramAd);
  const [hasReachedContentCue, setHasReachedContentCue] = useState(instagramAd);
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(
    null,
  );
  const ctaButtonRef = useRef<HTMLAnchorElement>(null);
  const ctaClickedRef = useRef(false);

  const compactInstagramViewport =
    instagramAd && isCompactVisualViewport(visualViewportHeight);

  useEffect(() => {
    if (!preview) {
      const viewport = readLandingViewport();
      trackEvent("landing_view", {
        experiment_id: "landing_ab_2026_08",
        landing_variant: instagramAd ? "instagram_ad" : "b",
        landing_surface: instagramAd ? "instagram_paid" : "default",
        viewport_height: viewport.layoutHeight,
        visual_viewport_height: viewport.visualHeight,
        visual_viewport_width: viewport.visualWidth,
        visual_viewport_offset_top: viewport.offsetTop,
        visual_viewport_scale: viewport.scale,
        initial_visibility_state: document.visibilityState,
        screen_height: window.screen.height,
      });
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduceMotion) return;

    setTypedHeadline(headline);
    setIsContentVisible(true);
  }, [instagramAd, preview]);

  useEffect(() => {
    if (!instagramAd) return;

    const visualViewport = window.visualViewport;
    const updateVisualViewport = () => {
      const nextHeight = readLandingViewport().visualHeight;
      setVisualViewportHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    updateVisualViewport();
    window.addEventListener("resize", updateVisualViewport);
    visualViewport?.addEventListener("resize", updateVisualViewport);
    visualViewport?.addEventListener("scroll", updateVisualViewport);

    return () => {
      window.removeEventListener("resize", updateVisualViewport);
      visualViewport?.removeEventListener("resize", updateVisualViewport);
      visualViewport?.removeEventListener("scroll", updateVisualViewport);
    };
  }, [instagramAd]);

  useEffect(() => {
    if (preview) return;

    const startedAt = performance.now();
    let visibleStartedAt =
      document.visibilityState === "visible" ? startedAt : null;
    let accumulatedVisibleMs = 0;
    let pageVisibleTimer: number | null = null;
    let ctaVisibleTimer: number | null = null;
    let animationFrame: number | null = null;
    let pageVisibleTracked = false;
    let ctaVisibleTracked = false;
    let firstInteractionTracked = false;
    let exitTracked = false;
    let minVisualViewportHeight = Number.POSITIVE_INFINITY;
    let maxVisualViewportHeight = 0;

    const commonPayload = () => {
      const viewport = readLandingViewport();
      minVisualViewportHeight = Math.min(
        minVisualViewportHeight,
        viewport.visualHeight,
      );
      maxVisualViewportHeight = Math.max(
        maxVisualViewportHeight,
        viewport.visualHeight,
      );

      return {
        experiment_id: "landing_ab_2026_08",
        landing_variant: instagramAd ? "instagram_ad" : "b",
        landing_surface: instagramAd ? "instagram_paid" : "default",
        viewport_height: viewport.layoutHeight,
        visual_viewport_height: viewport.visualHeight,
        visual_viewport_width: viewport.visualWidth,
        visual_viewport_offset_top: viewport.offsetTop,
        visual_viewport_scale: viewport.scale,
        compact_viewport: isCompactVisualViewport(viewport.visualHeight),
      };
    };

    const clearPageVisibleTimer = () => {
      if (pageVisibleTimer === null) return;
      window.clearTimeout(pageVisibleTimer);
      pageVisibleTimer = null;
    };

    const clearCtaVisibleTimer = () => {
      if (ctaVisibleTimer === null) return;
      window.clearTimeout(ctaVisibleTimer);
      ctaVisibleTimer = null;
    };

    const schedulePageVisible = () => {
      if (
        pageVisibleTracked ||
        pageVisibleTimer !== null ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      pageVisibleTimer = window.setTimeout(() => {
        pageVisibleTimer = null;
        if (document.visibilityState !== "visible" || pageVisibleTracked) return;

        pageVisibleTracked = true;
        trackEvent("landing_page_visible_1s", commonPayload());
      }, stableLandingExposureMs);
    };

    const updateCtaExposure = () => {
      commonPayload();
      schedulePageVisible();

      const button = ctaButtonRef.current;
      if (!button || document.visibilityState !== "visible") {
        clearCtaVisibleTimer();
        return;
      }

      const rect = button.getBoundingClientRect();
      const viewport = readLandingViewport();
      const visibleRatio = visualViewportOverlapRatio(rect, viewport);
      if (visibleRatio < 0.9) {
        clearCtaVisibleTimer();
        return;
      }

      if (ctaVisibleTracked || ctaVisibleTimer !== null) return;
      ctaVisibleTimer = window.setTimeout(() => {
        ctaVisibleTimer = null;
        const currentButton = ctaButtonRef.current;
        if (
          !currentButton ||
          document.visibilityState !== "visible" ||
          ctaVisibleTracked
        ) {
          return;
        }

        const currentViewport = readLandingViewport();
        const currentRect = currentButton.getBoundingClientRect();
        const currentRatio = visualViewportOverlapRatio(
          currentRect,
          currentViewport,
        );
        if (currentRatio < 0.9) return;

        ctaVisibleTracked = true;
        const currentPayload = commonPayload();
        trackEvent("landing_cta_visible_1s", {
          ...currentPayload,
          visual_viewport_height: currentViewport.visualHeight,
          visual_viewport_offset_top: currentViewport.offsetTop,
          cta_top: Math.round(currentRect.top),
          cta_bottom: Math.round(currentRect.bottom),
          cta_visible_percent: Math.round(currentRatio * 100),
        });
      }, stableLandingExposureMs);
    };

    const queueExposureUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateCtaExposure();
      });
    };

    const updateVisibleClock = () => {
      const now = performance.now();
      if (document.visibilityState === "visible") {
        if (visibleStartedAt === null) visibleStartedAt = now;
        schedulePageVisible();
      } else {
        if (visibleStartedAt !== null) {
          accumulatedVisibleMs += now - visibleStartedAt;
          visibleStartedAt = null;
        }
        clearPageVisibleTimer();
        clearCtaVisibleTimer();
      }
      queueExposureUpdate();
    };

    const trackFirstInteraction = (interactionType: string) => {
      if (firstInteractionTracked) return;
      firstInteractionTracked = true;
      trackEvent("landing_first_interaction", {
        ...commonPayload(),
        interaction_type: interactionType,
        elapsed_ms: Math.round(performance.now() - startedAt),
        cta_visible_1s: ctaVisibleTracked,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      trackFirstInteraction(event.pointerType || "pointer");
    };

    const handleKeyDown = () => {
      trackFirstInteraction("keyboard");
    };

    const handlePageHide = () => {
      if (exitTracked) return;
      exitTracked = true;

      const now = performance.now();
      const visibleMs =
        accumulatedVisibleMs +
        (visibleStartedAt === null ? 0 : now - visibleStartedAt);
      const payload = commonPayload();
      trackEvent("landing_exit", {
        ...payload,
        elapsed_ms: Math.round(now - startedAt),
        visible_ms: Math.round(visibleMs),
        min_visual_viewport_height: Number.isFinite(minVisualViewportHeight)
          ? minVisualViewportHeight
          : payload.visual_viewport_height,
        max_visual_viewport_height:
          maxVisualViewportHeight || payload.visual_viewport_height,
        page_visible_1s: pageVisibleTracked,
        cta_visible_1s: ctaVisibleTracked,
        first_interaction: firstInteractionTracked,
        cta_clicked: ctaClickedRef.current,
      });
    };

    const visualViewport = window.visualViewport;
    schedulePageVisible();
    queueExposureUpdate();
    document.addEventListener("visibilitychange", updateVisibleClock);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", queueExposureUpdate);
    window.addEventListener("pageshow", queueExposureUpdate);
    window.addEventListener("pagehide", handlePageHide);
    visualViewport?.addEventListener("resize", queueExposureUpdate);
    visualViewport?.addEventListener("scroll", queueExposureUpdate);

    return () => {
      clearPageVisibleTimer();
      clearCtaVisibleTimer();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", updateVisibleClock);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", queueExposureUpdate);
      window.removeEventListener("pageshow", queueExposureUpdate);
      window.removeEventListener("pagehide", handlePageHide);
      visualViewport?.removeEventListener("resize", queueExposureUpdate);
      visualViewport?.removeEventListener("scroll", queueExposureUpdate);
    };
  }, [instagramAd, preview]);

  useEffect(() => {
    if (!hasReachedContentCue) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let length = headlineLead.length;
    const typingDuration = instagramAd
      ? instagramTypingDurationMs
      : defaultTypingDurationMs;
    setIsContentVisible(true);
    const interval = window.setInterval(() => {
      length += 1;
      setTypedHeadline(headline.slice(0, length));
      if (length >= headline.length) {
        window.clearInterval(interval);
      }
    }, typingDuration / (headline.length - headlineLead.length));

    return () => window.clearInterval(interval);
  }, [hasReachedContentCue, instagramAd]);

  useEffect(() => {
    if (instagramAd) return;

    const fallbackTimer = window.setTimeout(() => {
      setHasReachedContentCue(true);
    }, contentCueFallbackDelayMs);

    return () => window.clearTimeout(fallbackTimer);
  }, [instagramAd]);

  if (showMemberLogin) {
    return (
      <FiftyQLandingClient
        initialHasSeenIntro
        previewPhoneOnly={preview}
        trackLandingView={false}
      />
    );
  }

  const trackOnboardingStart = () => {
    ctaClickedRef.current = true;
    trackEvent("landing_cta_click", {
      experiment_id: "landing_ab_2026_08",
      landing_variant: instagramAd ? "instagram_ad" : "b",
      landing_surface: instagramAd ? "instagram_paid" : "default",
      cta_position: instagramAd ? "upper_fold" : "bottom",
    });
  };

  const openMemberLogin = () => {
    trackEvent("existing_member_login_click", {
      experiment_id: "landing_ab_2026_08",
      landing_variant: instagramAd ? "instagram_ad" : "b",
      landing_surface: instagramAd ? "instagram_paid" : "default",
      cta_position: instagramAd ? "upper_fold" : "bottom",
    });
    setShowMemberLogin(true);
  };

  const primaryAction = (compact = false) => (
    <>
      <Link
        ref={ctaButtonRef}
        href="/onboarding/start"
        onClick={trackOnboardingStart}
        className={`relative mx-auto flex w-full max-w-[320px] items-center justify-center rounded-full bg-black px-14 text-[16px] font-bold text-white shadow-[0_16px_42px_rgba(18,18,18,0.28)] transition-transform active:scale-[0.98] ${
          compact ? "h-14" : "h-16"
        }`}
      >
        교집합 시작하기
        <ArrowRight
          size={20}
          strokeWidth={2}
          aria-hidden
          className="absolute right-6"
        />
      </Link>
      {!compact && (
        <button
          type="button"
          onClick={openMemberLogin}
          className="mx-auto mt-4 block text-[12px] font-semibold text-white/70 underline decoration-white/35 underline-offset-4 transition hover:text-white"
        >
          이미 교집합 멤버예요
        </button>
      )}
    </>
  );

  return (
    <main
      className={`flex min-h-0 justify-center overflow-hidden bg-[#e9e9e5] text-[#121212] md:px-4 ${
        instagramAd ? "h-svh" : "h-dvh"
      }`}
      style={
        instagramAd && visualViewportHeight !== null
          ? { height: `${visualViewportHeight}px` }
          : undefined
      }
    >
      <section
        aria-label="교집합 B 랜딩 미리보기"
        className="relative h-full w-full max-w-[430px] overflow-hidden bg-black md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[url('/videos/details-preview-poster.webp')] bg-cover bg-center motion-safe:hidden" />
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/videos/details-preview-poster.webp"
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            onLoadedData={() => setHasReachedContentCue(true)}
            onError={() => setHasReachedContentCue(true)}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= 0.8) {
                setHasReachedContentCue(true);
              }
            }}
          >
            <source src="/videos/details-preview.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/70" />
        </div>

        <div className="absolute inset-0">
          <div
            className={`absolute inset-x-6 text-center transition-opacity duration-500 ${
              instagramAd
                ? compactInstagramViewport
                  ? "top-3"
                  : "top-[17%]"
                : "top-[56%] -translate-y-1/2"
            } ${
              isContentVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <h1
              aria-label={headline.replace("\n", " ")}
              className={`mx-auto whitespace-pre-line break-keep font-bold tracking-[-0.045em] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.95),0_6px_24px_rgba(0,0,0,0.75)] ${
                compactInstagramViewport
                  ? "min-h-0 text-[17px] leading-[1.3]"
                  : "min-h-[76px] text-[22px] leading-[1.42]"
              }`}
            >
              {typedHeadline}
              {typedHeadline.length < headline.length && (
                <span className="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-white/70 align-[-0.12em]" />
              )}
            </h1>
            {instagramAd && !compactInstagramViewport && (
              <div className="mt-6">{primaryAction()}</div>
            )}
          </div>

          {compactInstagramViewport && (
            <div className="absolute inset-x-4 bottom-[max(8px,env(safe-area-inset-bottom))]">
              {primaryAction(true)}
            </div>
          )}

          {!instagramAd && (
            <div className="absolute inset-x-6 bottom-[max(64px,calc(8dvh+env(safe-area-inset-bottom)))]">
              {primaryAction()}
            </div>
          )}
        </div>

        {preview && (
          <div className="absolute left-5 top-5 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
            B · PREVIEW
          </div>
        )}
      </section>
    </main>
  );
}

export function LandingVariantBPreview() {
  return <LandingVariantB preview />;
}
