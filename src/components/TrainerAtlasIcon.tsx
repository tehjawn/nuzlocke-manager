"use client";

import trainersAtlas from "@/data/sprite-atlases/trainers.json";
import {
  AtlasIconView,
  IndividualSpriteFallback,
  type AtlasIconProps,
  type AtlasJson,
} from "@/components/sprite-atlas-shared";

const ATLAS = trainersAtlas as AtlasJson;

/** Trainer spritesheet cell (Showdown `trainers`). */
export function TrainerAtlasIcon({
  stem,
  size,
  className = "",
  alt = "",
  title,
  loading = "lazy",
}: AtlasIconProps) {
  const frame = ATLAS.frames[stem] ?? null;
  if (!frame) {
    return (
      <IndividualSpriteFallback
        catalog="trainers"
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
