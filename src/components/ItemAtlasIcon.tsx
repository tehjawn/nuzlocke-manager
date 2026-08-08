"use client";

import itemiconsAtlas from "@/data/sprite-atlases/itemicons.json";
import {
  AtlasIconView,
  IndividualSpriteFallback,
  type AtlasIconProps,
  type AtlasJson,
} from "@/components/sprite-atlas-shared";

const ATLAS = itemiconsAtlas as AtlasJson;

function resolveItemStem(stem: string): string | null {
  if (ATLAS.frames[stem]) return stem;
  const compact = stem.replace(/-/g, "");
  if (compact !== stem && ATLAS.frames[compact]) return compact;
  return null;
}

/** Item-icon spritesheet cell (Showdown `itemicons`). */
export function ItemAtlasIcon({
  stem,
  size,
  className = "",
  alt = "",
  title,
  loading = "lazy",
}: AtlasIconProps) {
  const resolved = resolveItemStem(stem);
  const frame = resolved ? ATLAS.frames[resolved] : null;
  if (!frame) {
    return (
      <IndividualSpriteFallback
        catalog="itemicons"
        stem={stem}
        size={size}
        className={className}
        alt={alt}
        title={title}
        loading={loading}
      />
    );
  }
  return (
    <AtlasIconView
      atlas={ATLAS}
      frame={frame}
      size={size}
      className={className}
      alt={alt}
      title={title}
    />
  );
}
