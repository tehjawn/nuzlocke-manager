"use client";

import Link from "next/link";
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
  /**
   * ItemDex entry to open. Ignored when `embedded` is set for nesting safety —
   * `embedded` marks call sites that already sit inside an interactive parent
   * (e.g. `PokemonSlotCard`, whose whole body becomes a `<button>` when it has
   * an `onSelect`), and a `<Link>` inside a `<button>` is invalid.
   */
  href?: string | null;
  className?: string;
  /** Icon pixel size (default 16). */
  iconSize?: number;
};

/**
 * Held item name with Showdown itemicon + InfoTip description (when known),
 * optionally linking to its ItemDex entry.
 */
export function HeldItemLabel({
  name,
  embedded = false,
  href = null,
  className = "",
  iconSize = 16,
}: HeldItemLabelProps) {
  const tip = heldItemDescription(name) ?? "";
  const linkHref = embedded ? null : href;
  const body = (
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
  );

  return (
    <InfoTip
      tip={tip}
      // A linked label supplies its own interactive element, so the tip must
      // not render its own <button> around it.
      embedded={embedded || linkHref != null}
      className={className}
    >
      {linkHref ? (
        <Link
          href={linkHref}
          className="inline-flex min-w-0 max-w-full rounded-sm underline-offset-2 hover:underline focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </InfoTip>
  );
}
