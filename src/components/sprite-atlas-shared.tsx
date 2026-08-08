"use client";

import type { CSSProperties } from "react";

export type AtlasFrame = { x: number; y: number; w: number; h: number };

export type AtlasJson = {
  image: string;
  width: number;
  height: number;
  frames: Record<string, AtlasFrame>;
};

export function spriteIndividualUrl(
  catalog: "trainers" | "itemicons",
  stem: string,
): string {
  return `/sprites/${catalog}/${stem}.png`;
}

export function AtlasIconView({
  atlas,
  frame,
  size,
  className,
  alt,
  title,
}: {
  atlas: AtlasJson;
  frame: AtlasFrame;
  size: number;
  className: string;
  alt: string;
  title?: string;
}) {
  const scale = size / Math.max(frame.w, frame.h);
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${atlas.image})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
    backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
    imageRendering: "pixelated",
  };

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      title={title}
      className={`inline-block shrink-0 ${className}`.trim()}
      style={style}
    />
  );
}

export function IndividualSpriteFallback({
  catalog,
  stem,
  size,
  className,
  alt,
  title,
  loading,
}: {
  catalog: "trainers" | "itemicons";
  stem: string;
  size: number;
  className: string;
  alt: string;
  title?: string;
  loading: "eager" | "lazy";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spriteIndividualUrl(catalog, stem)}
      alt={alt}
      title={title}
      width={size}
      height={size}
      className={`pixelated shrink-0 object-contain ${className}`.trim()}
      style={{ width: size, height: size }}
      decoding="async"
      loading={loading}
    />
  );
}

export type AtlasIconProps = {
  stem: string;
  size: number;
  className?: string;
  alt?: string;
  title?: string;
  loading?: "eager" | "lazy";
};
