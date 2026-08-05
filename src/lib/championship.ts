/**
 * "Has this trainer actually beaten the game?" — the gate for offering to
 * record a run completion.
 *
 * Badges are hand-toggleable in the badge case, so `championship` on its own is
 * one stray tap away from claiming a finish. Requiring the full Elite Four run
 * plus the Champion makes a mis-toggle harmless. Callers on the server must
 * re-check against database badges rather than trusting a client label.
 */
export const CHAMPIONSHIP_BADGE_KEYS = [
  "elite-1",
  "elite-2",
  "elite-3",
  "elite-4",
  "championship",
] as const;

export function hasBeatenChampionship(
  earnedBadgeKeys: Iterable<string>,
): boolean {
  const earned = new Set(earnedBadgeKeys);
  return CHAMPIONSHIP_BADGE_KEYS.every((key) => earned.has(key));
}
