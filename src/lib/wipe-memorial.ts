import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";

/** Slots that hold living partners and should join the memorial on wipe. */
export const WIPE_MEMORIAL_SLOTS = ["MAIN", "RESERVE"] as const;

export type WipeMemorialRow = {
  id: string;
  slot: PokemonSlot;
  partyIndex: number;
  causeOfDeath: string | null;
  diedOnRun: number | null;
};

/** Current attempt number (1-based). Wipe #N ends run N. */
export function currentRunNumber(wipeCount: number): number {
  return wipeCount + 1;
}

export function wipeCauseOfDeath(wipeNumber: number): string {
  return `Run wiped (#${wipeNumber})`;
}

function livingSlotRank(slot: PokemonSlot): number {
  if (slot === "MAIN") return 0;
  if (slot === "RESERVE") return 1;
  return 2;
}

/**
 * Season memorial after a wipe: keep existing graves, append living Main/Reserve
 * into GRAVEYARD (Encountered is discarded), preserving MAIN→RESERVE order.
 * `wipeNumber` is the wipe being recorded (also the run that just ended).
 */
export function memorialRowsAfterWipe(
  rows: WipeMemorialRow[],
  wipeNumber: number,
): WipeMemorialRow[] {
  const graves = rows.filter((p) => p.slot === "GRAVEYARD");
  const memorialSlots: ReadonlySet<PokemonSlot> = new Set(WIPE_MEMORIAL_SLOTS);
  const living = rows
    .filter((p) => memorialSlots.has(p.slot))
    .sort((a, b) => {
      const bySlot = livingSlotRank(a.slot) - livingSlotRank(b.slot);
      if (bySlot !== 0) return bySlot;
      return a.partyIndex - b.partyIndex;
    });

  let nextIndex =
    graves.reduce((max, p) => Math.max(max, p.partyIndex), -1) + 1;
  const cause = wipeCauseOfDeath(wipeNumber);
  const memorialized = living.map((p) => ({
    id: p.id,
    slot: "GRAVEYARD" as const,
    partyIndex: nextIndex++,
    causeOfDeath: p.causeOfDeath?.trim() || cause,
    diedOnRun: wipeNumber,
  }));

  return [...graves, ...memorialized];
}

/** Client-friendly wrapper that preserves full Pokémon payloads. */
export function memorialPokemonAfterWipe(
  pokemon: PokemonEntry[],
  wipeNumber: number,
): PokemonEntry[] {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  return memorialRowsAfterWipe(pokemon, wipeNumber).map((row) => {
    const source = byId.get(row.id)!;
    return {
      ...source,
      slot: row.slot,
      partyIndex: row.partyIndex,
      causeOfDeath: row.causeOfDeath,
      diedOnRun: row.diedOnRun,
    };
  });
}
