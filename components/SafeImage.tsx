"use client";

import { type ComponentPropsWithoutRef, useState } from "react";

const failedImageSources = new Set<string>();

type SafeImageProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src" | "onError"
> & {
  src?: string | null;
  onLoadError?: () => void;
};

export function SafeImage({
  src,
  alt = "",
  onLoadError,
  ...props
}: SafeImageProps) {
  const normalizedSrc = src?.trim() ?? "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed =
    !normalizedSrc ||
    failedSrc === normalizedSrc ||
    failedImageSources.has(normalizedSrc);

  if (!normalizedSrc || failed) return null;

  return (
    <img
      {...props}
      src={normalizedSrc}
      alt={alt}
      onError={() => {
        failedImageSources.add(normalizedSrc);
        setFailedSrc(normalizedSrc);
        onLoadError?.();
      }}
    />
  );
}
