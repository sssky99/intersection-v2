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
      const script = document.createElement("script");
      const fail = (error: Error) => {
        window.clearTimeout(timeout);
        window.__interV5NaverMapsPromise = undefined;
        reject(error);
      };
      const timeout = window.setTimeout(() => {
        fail(new Error("naver-map-timeout"));
      }, 12000);

      script.onload = () => {
        window.clearTimeout(timeout);
        if (window.naver?.maps) {
          resolve();
        } else {
          fail(new Error("naver-map-not-initialized"));
        }
      };

      script.src =
        `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}` +
        "&submodules=geocoder";
      script.async = true;
      script.onerror = () => {
        fail(new Error("naver-map-load-failed"));
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
  place: Pick<NaverPlace, "name"> & {
    mapx?: number | null;
    mapy?: number | null;
    address?: string | null;
  };
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
      .then(async () => {
        if (cancelled || !containerRef.current || !window.naver?.maps) return;

        const maps = window.naver.maps;
        const hasCoordinates =
          typeof place.mapx === "number" && typeof place.mapy === "number";
        let position = null;

        if (hasCoordinates) {
          const usesScaledLongitudeLatitude =
            Math.abs(place.mapx as number) > 1_000_000_000 &&
            Math.abs(place.mapy as number) > 100_000_000;
          position = usesScaledLongitudeLatitude
            ? new maps.LatLng(
                (place.mapy as number) / 10_000_000,
                (place.mapx as number) / 10_000_000,
              )
            : maps.TransCoord?.fromTM128ToLatLng
              ? maps.TransCoord.fromTM128ToLatLng(
                  new maps.Point(place.mapx, place.mapy),
                )
              : null;
        } else if (place.address && maps.Service?.geocode) {
          position = await new Promise<any>((resolve) => {
            maps.Service.geocode(
              { query: place.address },
              (status: unknown, response: any) => {
                if (status !== maps.Service.Status.OK) {
                  resolve(null);
                  return;
                }
                const result = response?.v2?.addresses?.[0];
                const longitude = Number(result?.x);
                const latitude = Number(result?.y);
                resolve(
                  Number.isFinite(longitude) && Number.isFinite(latitude)
                    ? new maps.LatLng(latitude, longitude)
                    : null,
                );
              },
            );
          });
        }

        if (cancelled) return;
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
  }, [place.address, place.mapx, place.mapy, place.name]);

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
