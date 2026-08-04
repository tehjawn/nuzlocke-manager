import type { PokemonEntry } from "@/lib/challenge-types";

/** Current attempt number (1-based). Wipe #N ends run N. */
export function currentRunNumber(wipeCount: number): number {
  return wipeCount + 1;
}

export function wipeCauseOfDeath(wipeNumber: number): string {
  return `Run wiped (#${wipeNumber})`;
}

/**
 * Live board after a wipe: empty (party, box, encountered, and R.I.P.).
 * Pre-wipe partners are captured in the board history snapshot taken before
 * the wipe. Cross-run graves belong in Memorial / trainer history — see
 * `crossRunGraves` in `@/lib/memorial-backfill` — not the live board.
 */
export function memorialPokemonAfterWipe(
  _pokemon: PokemonEntry[],
  _wipeNumber: number,
  _closedRunId: string | null = null,
): PokemonEntry[] {
  return [];
}
