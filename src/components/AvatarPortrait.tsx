"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import {
  avatarBackgroundCustomUrl,
  avatarBackgroundDataAttr,
} from "@/data/avatar-backgrounds";
import { cssTextureUrl } from "@/lib/custom-texture";
import {
  avatarImageClassName,
  avatarImageUrl,
  avatarStillImageUrl,
} from "@/lib/sprites";

type AvatarPortraitProps = {
  avatarSpriteKey: string;
  backgroundKey?: string | null;
  /** Tailwind size classes for the portrait and its backdrop (e.g. `h-24 w-24`). */
  sizeClass: string;
  width: number;
  height: number;
  className?: string;
  /** Extra classes merged onto the image (e.g. drop-shadow). */
  imgClassName?: string;
  alt?: string;
};

/**
 * Trainer sprite with an optional curated or custom stage plate behind it.
 * Surfaces that show identity should prefer this over a bare `<Image>`.
 */
export function AvatarPortrait({
  avatarSpriteKey,
  backgroundKey = null,
  sizeClass,
  width,
  height,
  className = "",
  imgClassName = "",
  alt = "",
}: AvatarPortraitProps) {
  const dataBg = avatarBackgroundDataAttr(backgroundKey);
  const customUrl = avatarBackgroundCustomUrl(backgroundKey);
  const style = customUrl
    ? ({
        ["--avatar-bg-custom" as string]: cssTextureUrl(customUrl),
      } as CSSProperties)
    : undefined;
  const src = avatarImageUrl(avatarSpriteKey);
  const stillSrc = avatarStillImageUrl(avatarSpriteKey);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const gifFailed = Boolean(stillSrc && failedSrc === src);
  const displaySrc = gifFailed && stillSrc ? stillSrc : src;
  const imgClass = `${avatarImageClassName(
    avatarSpriteKey,
    "relative z-1 h-full w-full max-h-full max-w-full object-contain",
  )}${imgClassName ? ` ${imgClassName}` : ""}`;

  return (
    <span
      className={`avatar-portrait inline-flex shrink-0 items-end justify-center ${
        dataBg ? "avatar-portrait--staged" : ""
      } ${sizeClass} ${className}`}
      data-avatar-bg={dataBg}
      style={style}
    >
      {stillSrc ? (
        <picture key={avatarSpriteKey} className="contents">
          {!gifFailed && (
            <source
              srcSet={stillSrc}
              media="(prefers-reduced-motion: reduce)"
            />
          )}
          {/* Animated GIFs need a plain img so <picture> can swap the still. */}
          <img
            src={displaySrc}
            alt={alt}
            width={width}
            height={height}
            className={imgClass}
            decoding="async"
            onError={() => {
              if (stillSrc && failedSrc !== src) setFailedSrc(src);
            }}
          />
        </picture>
      ) : (
        <Image
          key={avatarSpriteKey}
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={imgClass}
          unoptimized
        />
      )}
    </span>
  );
}
