import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";

/** Slots that hold living partners lost when a wipe is recorded. */
export const WIPE_MEMORIAL_SLOTS = ["MAIN", "RESERVE"] as const;

export type WipeMemorialRow = {
  id: string;
  slot: PokemonSlot;
  partyIndex: number;
  causeOfDeath: string | null;
  diedOnRun: number | null;
  runId: string | null;
};

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
 * the wipe. Cross-run graves belong in Memorial / trainer history — not the
 * live board.
 */
export function memorialRowsAfterWipe(
  _rows: WipeMemorialRow[],
  _wipeNumber: number,
  _closedRunId: string | null = null,
): WipeMemorialRow[] {
  return [];
}

/** Client-friendly wrapper — wipe clears every live slot. */
export function memorialPokemonAfterWipe(
  _pokemon: PokemonEntry[],
  _wipeNumber: number,
  _closedRunId: string | null = null,
): PokemonEntry[] {
  return [];
}
