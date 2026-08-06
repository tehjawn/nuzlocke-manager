import type { SearchSeasonContext } from "@/features/search/search-types";

/** Handles / species / nicknames the Ask guard can treat as season anchors. */
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
      add(mon.nickname);
    }
  }

  return hints;
}
