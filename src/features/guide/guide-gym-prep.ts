import type { GuideChapter, GuideGymPrep } from "@/features/guide/guide-types";
import type { PokemonEntry } from "@/lib/challenge-types";
import { lookupMoveMeta } from "@/lib/move-meta";
import type { PokemonType } from "@/lib/pokemon-types";

/** 1-based chapter number for UI / Discord reference. */
export function guideChapterNumber(chapter: GuideChapter): number {
  return chapter.sortOrder + 1;
}

/** e.g. "Ch. 5 · Fallarbor & Meteor Falls" */
export function guideChapterLabel(chapter: GuideChapter): string {
  return `Ch. ${guideChapterNumber(chapter)} · ${chapter.title}`;
}

/** One recommended type a mon answers, plus why it counts. */
export type GymPrepTypeMatch = {
  type: PokemonType;
  /** Damaging move supplying the type; null = species typing (STAB). */
  viaMove: string | null;
};

export type GymPrepSquadMatch = {
  entry: PokemonEntry;
  /** Answered recommended types — species typing first, then coverage moves. */
  typeMatches: GymPrepTypeMatch[];
};

/** e.g. "Fighting" for typing, "Electric via Thunderbolt" for a coverage move. */
export function formatGymPrepTypeMatch(match: GymPrepTypeMatch): string {
  return match.viaMove ? `${match.type} via ${match.viaMove}` : match.type;
}

/** True when at least one answer is species typing rather than a coverage move. */
export function hasTypingMatch(match: GymPrepSquadMatch): boolean {
  return match.typeMatches.some((m) => m.viaMove == null);
}

/**
 * Main + Reserve mons that answer the gym’s recommended types, either by
 * species typing or by a known damaging move of that type (same idea as the
 * Coverage tab). Graveyard / encounter-only slots are ignored.
 */
export function squadMatchesForGymPrep(
  pokemon: readonly PokemonEntry[],
  prep: GuideGymPrep,
): GymPrepSquadMatch[] {
  const recommended = new Set<PokemonType>(prep.recommendedTypes);
  const matches: GymPrepSquadMatch[] = [];

  for (const entry of pokemon) {
    if (entry.slot !== "MAIN" && entry.slot !== "RESERVE") continue;

    const seen = new Set<PokemonType>();
    const typeMatches: GymPrepTypeMatch[] = [];

    for (const type of entry.types) {
      if (!recommended.has(type) || seen.has(type)) continue;
      seen.add(type);
      typeMatches.push({ type, viaMove: null });
    }

    for (const rawMove of entry.moves) {
      const meta = lookupMoveMeta(rawMove);
      // Status moves deal no damage, so they never answer a recommended type.
      if (!meta || meta.category === "Status") continue;
      if (!recommended.has(meta.type) || seen.has(meta.type)) continue;
      seen.add(meta.type);
      typeMatches.push({ type: meta.type, viaMove: meta.name });
    }

    if (typeMatches.length === 0) continue;
    matches.push({ entry, typeMatches });
  }

  return matches.sort((a, b) => {
    if (a.entry.slot !== b.entry.slot) {
      return a.entry.slot === "MAIN" ? -1 : 1;
    }
    // Within a slot, typing answers outrank coverage-only ones so STAB survives
    // the planner's truncated sprite row. (The planner treats every draft mon as
    // MAIN, so this is its effective primary key.)
    const aTyping = hasTypingMatch(a);
    const bTyping = hasTypingMatch(b);
    if (aTyping !== bTyping) return aTyping ? -1 : 1;
    return a.entry.partyIndex - b.entry.partyIndex;
  });
}
