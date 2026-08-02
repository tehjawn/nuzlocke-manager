"use client";

import { InfoTip } from "@/components/InfoTip";
import {
  heldItemDescription,
  heldItemSpriteUrl,
} from "@/data/pokemon-index";

type HeldItemLabelProps = {
  name: string;
  /**
   * When true, use a non-button trigger (safe inside parent cards/buttons).
   * Matches nature/ability tips on Pokémon slot cards.
   */
  embedded?: boolean;
  className?: string;
  /** Icon pixel size (default 16). */
  iconSize?: number;
};

/**
 * Held item name with Showdown itemicon + InfoTip description (when known).
 */
export function HeldItemLabel({
  name,
  embedded = false,
  className = "",
  iconSize = 16,
}: HeldItemLabelProps) {
  const tip = heldItemDescription(name) ?? "";
  return (
    <InfoTip tip={tip} embedded={embedded} className={className}>
      <span className="inline-flex min-w-0 max-w-full items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heldItemSpriteUrl(name)}
          alt=""
          width={iconSize}
          height={iconSize}
          className="pixelated shrink-0 object-contain"
          style={{ width: iconSize, height: iconSize }}
          decoding="async"
        />
        <span className="truncate">{name}</span>
      </span>
    </InfoTip>
  );
}
