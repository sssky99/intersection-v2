"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { NaverPlace } from "@/types/place";

declare global {
  interface Window {
    naver?: {
      maps?: any;
    };
    __interV5NaverMapsPromise?: Promise<void>;
  }
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function loadNaverMaps() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.naver?.maps) return Promise.resolve();

  if (!window.__interV5NaverMapsPromise) {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) return Promise.reject(new Error("missing-naver-map-client-id"));

    window.__interV5NaverMapsPromise = new Promise<void>((resolve, reject) => {
      const callbackName = `__interV5NaverMapsReady_${Date.now()}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        reject(new Error("naver-map-timeout"));
      }, 12000);

      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        window.clearTimeout(timeout);
        delete (window as unknown as Record<string, () => void>)[callbackName];
        resolve();
      };

      script.src =
        `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}` +
        `&submodules=geocoder&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        delete (window as unknown as Record<string, () => void>)[callbackName];
        reject(new Error("naver-map-load-failed"));
      };

      document.head.appendChild(script);
    });
  }

  return window.__interV5NaverMapsPromise;
}

export function NaverMapPreview({
  place,
  className,
  heightClassName = "h-[180px]",
}: {
  place: Pick<NaverPlace, "name" | "mapx" | "mapy">;
  className?: string;
  heightClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapId = useId();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: any = null;

    setFailed(false);
    loadNaverMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.naver?.maps) return;

        const maps = window.naver.maps;
        const usesScaledLongitudeLatitude =
          Math.abs(place.mapx) > 1_000_000_000 &&
          Math.abs(place.mapy) > 100_000_000;
        const position = usesScaledLongitudeLatitude
          ? new maps.LatLng(
              place.mapy / 10_000_000,
              place.mapx / 10_000_000,
            )
          : maps.TransCoord?.fromTM128ToLatLng
            ? maps.TransCoord.fromTM128ToLatLng(
                new maps.Point(place.mapx, place.mapy),
              )
            : null;
        if (!position) {
          setFailed(true);
          return;
        }

        map = new maps.Map(containerRef.current, {
          center: position,
          zoom: 16,
          minZoom: 8,
          scaleControl: false,
          logoControl: true,
          mapDataControl: false,
          zoomControl: false,
        });

        new maps.Marker({
          position,
          map,
          title: place.name,
        });

        window.requestAnimationFrame(() => {
          if (cancelled || !map) return;
          maps.Event.trigger(map, "resize");
          map.setCenter(position);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (map && window.naver?.maps?.Event) {
        window.naver.maps.Event.clearInstanceListeners(map);
      }
    };
  }, [place.mapx, place.mapy, place.name]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/10 bg-black/[0.035]",
        heightClassName,
        className,
      )}
    >
      <div
        id={mapId}
        ref={containerRef}
        className="h-full w-full"
        aria-label={`${place.name} 지도`}
      />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/[0.035] px-5 text-center text-xs font-bold leading-5 text-black/45">
          지도를 불러오지 못했어요.
        </div>
      )}
    </div>
  );
}
