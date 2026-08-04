import gen3MovesCrestData from "@/data/gen3-moves.json";
import gen3MovesModernData from "@/data/gen3-moves-modern.json";

/**
 * Move ID space for Gen 3 saves.
 * - modern: Modern Emerald (nzl_modern) `#define MOVE_*` table
 * - crest: pokeemerald-expansion / Emerald Crest enum
 */
export type Gen3MoveMode = "modern" | "crest";

/** pokeemerald-expansion / Emerald Crest move IDs → display names. */
export const GEN3_MOVES = gen3MovesCrestData.moves as (string | null)[];

/** Modern Emerald (nzl_modern) move IDs → display names. */
export const GEN3_MOVES_MODERN = gen3MovesModernData.moves as (string | null)[];

function movesForMode(mode: Gen3MoveMode): (string | null)[] {
  return mode === "modern" ? GEN3_MOVES_MODERN : GEN3_MOVES;
}

export function gen3MoveName(
  moveId: number,
  mode: Gen3MoveMode = "crest",
): string | null {
  if (moveId <= 0) return null;
  const table = movesForMode(mode);
  return table[moveId] ?? `Move #${moveId}`;
}

const UNKNOWN_MOVE_RE = /^Move #(\d+)$/i;

/**
 * Resolve a stored move label. Crest/expansion IDs beyond vanilla Gen 3 were
 * previously persisted as "Move #522"; look those up against the expansion table
 * first, then Modern Emerald.
 */
export function resolveMoveName(move: string): string {
  const trimmed = move.trim();
  if (!trimmed) return trimmed;
  const m = UNKNOWN_MOVE_RE.exec(trimmed);
  if (!m) return trimmed;
  const id = Number(m[1]);
  if (!Number.isFinite(id) || id <= 0) return trimmed;
  return GEN3_MOVES[id] ?? GEN3_MOVES_MODERN[id] ?? trimmed;
}

export function resolveMoveNames(moves: string[]): string[] {
  return moves.map(resolveMoveName);
}
