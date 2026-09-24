"use client";

import { LandingSentence } from "./LandingSentence";
import { LandingFooter } from "./LandingFooter";
import { LandingIntro } from "./LandingIntro";
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

type LandingVariantBProps = {
  instagramAd?: boolean;
  preview?: boolean;
};

export function LandingVariantB(props: LandingVariantBProps) {
  const { instagramAd = false, preview = false } = props;
  const [introComplete, setIntroComplete] = useState(false);
  useEffect(() => {
    if (!preview) {
      const viewport = readLandingViewport();
      trackEvent("landing_view", {
        landing_version: "intro_sentence_20260924",
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

  }, [instagramAd, preview]);

  return introComplete
    ? <LandingVariantBContent {...props} />
    : <LandingIntro preview={preview} instagramAd={instagramAd} onComplete={() => setIntroComplete(true)} />;
}

function LandingVariantBContent({
  instagramAd = false,
  preview = false,
}: LandingVariantBProps) {
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const previewDialogRef = useRef<HTMLDialogElement>(null);
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
      trackEvent("landing_content_view", {
        landing_version: "intro_sentence_20260924",
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
        landing_version: "intro_sentence_20260924",
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
      landing_version: "intro_sentence_20260924",
        experiment_id: "landing_ab_2026_08",
      landing_variant: instagramAd ? "instagram_ad" : "b",
      landing_surface: instagramAd ? "instagram_paid" : "default",
      cta_position: instagramAd ? "upper_fold" : "bottom",
    });
  };

  const openMemberLogin = () => {
    trackEvent("existing_member_login_click", {
      landing_version: "intro_sentence_20260924",
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
        onClick={(event) => { if (preview) { event.preventDefault(); previewDialogRef.current?.showModal(); return; } trackOnboardingStart(); }}
        className={`relative mx-auto flex w-full max-w-[168px] items-center justify-center gap-4 rounded-full border border-white/10 bg-black px-8 font-["Nanum_Myeongjo"] text-[16px] font-normal text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)] hover:bg-[#171717] transition-transform active:scale-[0.98] ${
          compact ? "h-12" : "h-[48px]"
        }`}
      >
        시작하기
        <ArrowRight
          size={17}
          strokeWidth={1.5}
          aria-hidden
          className="shrink-0"
        />
      </Link>
      {!compact && (
        <button
          type="button"
          onClick={() => { if (preview) { previewDialogRef.current?.showModal(); return; } openMemberLogin(); }}
          className="mx-auto mt-4 block text-[12px] font-semibold text-white/70 underline decoration-white/35 underline-offset-4 transition hover:text-white"
        >
          이미 교집합 멤버예요
        </button>
      )}
    </>
  );

  return (
    <main
      className={`flex min-h-0 justify-center overflow-y-auto bg-[#e9e9e5] text-[#121212] md:px-4 ${
        instagramAd ? "h-svh" : "h-dvh"
      }`}
      style={
        instagramAd && visualViewportHeight !== null
          ? { height: `${visualViewportHeight}px` }
          : undefined
      }
    >
      <section
        style={!instagramAd ? { minHeight: 540 } : undefined}
        aria-label="교집합 랜딩"
        className="relative h-full w-full shrink-0 max-w-[430px] overflow-hidden bg-black md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame"
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
          >
            <source src="/videos/details-preview.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/25 to-black/75" />
        </div>

        <div className="absolute inset-0">
          <div
            className={`absolute inset-x-6 text-center transition-opacity duration-500 ${
              instagramAd
                ? compactInstagramViewport
                  ? "top-3"
                  : "top-[17%]"
                : "top-[43%]"
            } ${
              "opacity-100"
            }`}
          >
            <LandingSentence compact={compactInstagramViewport} />
            {!compactInstagramViewport && (
              <div className="mt-9">{primaryAction()}</div>
            )}
          </div>

          {compactInstagramViewport && (
            <div className="absolute inset-x-4 bottom-[max(8px,env(safe-area-inset-bottom))]">
              {primaryAction(true)}
            </div>
          )}


        </div>

        {!compactInstagramViewport && <LandingFooter />}

        {preview && (
          <div className="absolute left-5 bottom-3 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
            LOCAL PREVIEW
          </div>
        )}
        <dialog ref={previewDialogRef} className="m-auto w-[calc(100%-40px)] max-w-[360px] rounded-[28px] bg-white p-8 text-center text-[#121212] backdrop:bg-black/60">
          <p className="text-[11px] tracking-[0.18em] text-black/50">교집합 · 미리보기</p>
          <h2 className="mt-5 text-xl font-semibold">당신의 이야기가 궁금해요.</h2>
          <p className="mt-3 text-sm leading-7 text-black/60">실제 서비스에서는 여기서<br />나를 알아가는 질문이 시작돼요.</p>
          <form method="dialog"><button className="mt-7 w-full rounded-full bg-black py-4 text-sm font-semibold text-white">랜딩으로 돌아가기</button></form>
        </dialog>
      </section>
    </main>
  );
}

export function LandingVariantBPreview() {
  return <LandingVariantB preview />;
}
