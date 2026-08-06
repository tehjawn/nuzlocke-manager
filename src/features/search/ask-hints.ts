import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Season anchors for the Ask guard — handles + species only.
 * Nicknames were omitted on purpose: hundreds of memorial nicknames made
 * `evaluateAskQuery` O(n) regex work on every keystroke.
 */
export function askEntityHints(
  season: SearchSeasonContext | null | undefined,
): string[] {
  if (!season) return [];
  const hints: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined) => {
    const v = raw?.trim();
    if (!v || v.length < 2) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    hints.push(v);
  };

  for (const t of season.trainers) {
    add(t.handle);
    for (const mon of t.pokemon ?? []) {
      add(mon.species);
    }
  }

  return hints;
}
