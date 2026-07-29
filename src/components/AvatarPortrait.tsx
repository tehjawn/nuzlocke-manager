import Image from "next/image";
import type { CSSProperties } from "react";
import {
  avatarBackgroundCustomUrl,
  avatarBackgroundDataAttr,
} from "@/data/avatar-backgrounds";
import { cssTextureUrl } from "@/lib/custom-texture";
import { avatarImageClassName, avatarImageUrl } from "@/lib/sprites";

type AvatarPortraitProps = {
  avatarSpriteKey: string;
  backgroundKey?: string | null;
  /** Tailwind size classes for the image (e.g. `h-24 w-24`). */
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

  return (
    <span
      className={`avatar-portrait inline-flex shrink-0 items-end justify-center ${className}`}
      data-avatar-bg={dataBg}
      style={style}
    >
      <Image
        key={avatarSpriteKey}
        src={avatarImageUrl(avatarSpriteKey)}
        alt={alt}
        width={width}
        height={height}
        className={`${avatarImageClassName(avatarSpriteKey, `relative z-1 ${sizeClass}`)}${
          imgClassName ? ` ${imgClassName}` : ""
        }`}
        unoptimized
      />
    </span>
  );
}
