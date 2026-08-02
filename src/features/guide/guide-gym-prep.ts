import type { GuideChapter, GuideGymPrep } from "@/features/guide/guide-types";
import type { PokemonEntry } from "@/lib/challenge-types";
import type { PokemonType } from "@/lib/pokemon-types";

/** 1-based chapter number for UI / Discord reference. */
export function guideChapterNumber(chapter: GuideChapter): number {
  return chapter.sortOrder + 1;
}

/** e.g. "Ch. 5 · Fallarbor & Meteor Falls" */
export function guideChapterLabel(chapter: GuideChapter): string {
  return `Ch. ${guideChapterNumber(chapter)} · ${chapter.title}`;
}

export type GymPrepSquadMatch = {
  entry: PokemonEntry;
  matchedTypes: PokemonType[];
};

/**
 * Main + Reserve mons whose typing overlaps the gym’s recommended types.
 * Graveyard / encounter-only slots are ignored.
 */
export function squadMatchesForGymPrep(
  pokemon: readonly PokemonEntry[],
  prep: GuideGymPrep,
): GymPrepSquadMatch[] {
  const recommended = new Set(prep.recommendedTypes);
  const matches: GymPrepSquadMatch[] = [];

  for (const entry of pokemon) {
    if (entry.slot !== "MAIN" && entry.slot !== "RESERVE") continue;
    const matchedTypes = entry.types.filter((t) => recommended.has(t));
    if (matchedTypes.length === 0) continue;
    matches.push({ entry, matchedTypes });
  }

  return matches.sort((a, b) => {
    if (a.entry.slot !== b.entry.slot) {
      return a.entry.slot === "MAIN" ? -1 : 1;
    }
    return a.entry.partyIndex - b.entry.partyIndex;
  });
}
