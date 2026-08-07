"use client";

import type { PokemonEntry } from "@/lib/challenge-types";
import { PokemonSlotCard } from "@/components/PokemonSlotCard";
import {
  InfiniteRevealFooter,
  useInfiniteReveal,
} from "@/lib/use-infinite-reveal";

/** Dense Encountered grids — window DOM after accordion hydrate (#382). */
const PAGE_SIZE = 48;

type EncounteredSpeciesStripProps = {
  pokemon: PokemonEntry[];
  onSelect?: (pokemon: PokemonEntry) => void;
};

/**
 * Species-only Encountered strip with progressive reveal. Keep Main / Reserves
 * / R.I.P. on plain `PartyStrip` so DnD slots stay fully mounted.
 */
export function EncounteredSpeciesStrip({
  pokemon,
  onSelect,
}: EncounteredSpeciesStripProps) {
  const sorted = [...pokemon].sort((a, b) => a.partyIndex - b.partyIndex);
  const resetKey = `${sorted.length}:${sorted[0]?.id ?? ""}:${sorted[sorted.length - 1]?.id ?? ""}`;
  const { visible, hasMore, remaining, sentinelRef, loadMore } =
    useInfiniteReveal(sorted, resetKey, {
      pageSize: PAGE_SIZE,
      root: "viewport",
    });

  if (sorted.length === 0) return null;

  return (
    <div className="grid grid-cols-4 items-start gap-2 sm:grid-cols-6 md:grid-cols-8">
      {visible.map((p) => (
        <div key={p.id} className="h-full min-h-0">
          <PokemonSlotCard
            pokemon={p}
            size="sm"
            speciesOnly
            onSelect={onSelect ? () => onSelect(p) : undefined}
          />
        </div>
      ))}
      <InfiniteRevealFooter
        hasMore={hasMore}
        remaining={remaining}
        sentinelRef={sentinelRef}
        onLoadMore={loadMore}
      />
    </div>
  );
}
