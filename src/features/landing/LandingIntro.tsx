"use client";

import { trackEvent } from "@/lib/analytics";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LandingIntro({ onComplete, preview = false, instagramAd = false }: { onComplete: () => void; preview?: boolean; instagramAd?: boolean }) {
  const started = useRef(false);
  const track = (event: string) => {
    if (!preview) trackEvent(event, {
      landing_version: "intro_sentence_returning_20260924",
      landing_variant: instagramAd ? "instagram_ad" : "b",
      video_seconds: video.current?.currentTime ?? 0,
    });
  };
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    let active = true;
    player.play().catch(() => { if (active) setNeedsPlay(true); });
    return () => { active = false; };
  }, []);

  const play = async () => {
    const player = video.current;
    if (!player) return;
    if (failed) {
      setFailed(false);
      player.load();
    }
    try {
      await player.play();
      setNeedsPlay(false);
    } catch {
      setNeedsPlay(true);
    }
  };

  return (
    <main className="flex h-dvh justify-center overflow-hidden bg-[#e9e9e5] md:px-4">
      <section aria-label="교집합 소개 영상" className="relative h-full w-full max-w-[430px] overflow-hidden bg-black text-white md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px]">
        <video
          ref={video}
          src="/videos/landing-intro-optimized.mp4"
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          aria-label="교집합 소개. 재생이 끝나면 랜딩 화면으로 이동합니다."
          className="pointer-events-none h-full w-full object-contain"
          onPlaying={() => { setNeedsPlay(false); if (!started.current) { started.current = true; track("landing_video_start"); } }}
          onEnded={() => { track("landing_video_complete"); onComplete(); }}
          onError={() => { setFailed(true); track("landing_video_error"); }}
        />
        <button
          type="button"
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          onClick={() => setMuted((value) => !value)}
          className="absolute right-5 top-[max(20px,env(safe-area-inset-top))] flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-xs backdrop-blur"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {muted ? "소리 켜기" : "소리 끄기"}
        </button>
        {(needsPlay || failed) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60">
            {failed && <p role="alert" className="text-sm">영상을 불러오지 못했어요.</p>}
            <button type="button" onClick={play} className="rounded-full bg-white px-6 py-3 text-sm text-black">
              {failed ? "다시 재생하기" : "영상 재생하기"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
