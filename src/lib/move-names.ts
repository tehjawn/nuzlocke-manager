import gen3MovesData from "@/data/gen3-moves.json";

/** pokeemerald-expansion / Emerald Crest move IDs → display names. */
export const GEN3_MOVES = gen3MovesData.moves as (string | null)[];

export function gen3MoveName(moveId: number): string | null {
  if (moveId <= 0) return null;
  return GEN3_MOVES[moveId] ?? `Move #${moveId}`;
}

const UNKNOWN_MOVE_RE = /^Move #(\d+)$/i;

/**
 * Resolve a stored move label. Crest/expansion IDs beyond vanilla Gen 3 were
 * previously persisted as "Move #522"; look those up against the expansion table.
 */
export function resolveMoveName(move: string): string {
  const trimmed = move.trim();
  if (!trimmed) return trimmed;
  const m = UNKNOWN_MOVE_RE.exec(trimmed);
  if (!m) return trimmed;
  const id = Number(m[1]);
  if (!Number.isFinite(id) || id <= 0) return trimmed;
  return GEN3_MOVES[id] ?? trimmed;
}

export function resolveMoveNames(moves: string[]): string[] {
  return moves.map(resolveMoveName);
}
