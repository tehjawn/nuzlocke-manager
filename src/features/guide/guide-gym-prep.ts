import type { GuideChapter, GuideGymPrep } from "@/features/guide/guide-types";
import type { PokemonEntry } from "@/lib/challenge-types";
import { DEFAULT_BADGE_DEFINITIONS } from "@/lib/constants";
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

export type GymPrepLevelState = "under" | "ready" | "over";

export type GymPrepLevelVerdict = {
  state: GymPrepLevelState;
  /** `level - aceLevel` (negative when under). */
  delta: number;
  level: number;
  aceLevel: number;
};

/**
 * Compare a mon’s level to the checkpoint ace / house-rule cap.
 * `null` level → no verdict (render like today).
 */
export function levelVerdictForGymPrep(
  level: number | null | undefined,
  aceLevel: number,
): GymPrepLevelVerdict | null {
  if (level == null || !Number.isFinite(level)) return null;
  const delta = level - aceLevel;
  if (delta < 0) return { state: "under", delta, level, aceLevel };
  if (delta > 0) return { state: "over", delta, level, aceLevel };
  return { state: "ready", delta: 0, level, aceLevel };
}

/** Cleared gyms are history; the next unearned badge is the live house-rule cap. */
export type GymPrepCapRole = "cleared" | "live" | "upcoming";

/** First unearned badge in definition order — the live Trash Pack level cap. */
export function liveCapBadgeKey(
  earnedBadgeKeys: readonly string[],
): string | null {
  const earned = new Set(earnedBadgeKeys);
  for (const def of DEFAULT_BADGE_DEFINITIONS) {
    if (!earned.has(def.key)) return def.key;
  }
  return null;
}

export function gymPrepCapRole(
  badgeKey: string | undefined,
  earnedBadgeKeys: readonly string[],
): GymPrepCapRole {
  if (!badgeKey) return "upcoming";
  if (earnedBadgeKeys.includes(badgeKey)) return "cleared";
  return liveCapBadgeKey(earnedBadgeKeys) === badgeKey ? "live" : "upcoming";
}

/** e.g. "Lv. 24 · 7 under", "Lv. 31", "Lv. 36 · 5 over cap". */
export function formatGymPrepLevelVerdict(
  verdict: GymPrepLevelVerdict,
  capRole: GymPrepCapRole = "live",
): string {
  if (verdict.state === "under") {
    return `Lv. ${verdict.level} · ${Math.abs(verdict.delta)} under`;
  }
  if (verdict.state === "over") {
    const overLabel =
      capRole === "live" ? "over cap" : capRole === "cleared" ? "over" : "over target";
    return `Lv. ${verdict.level} · ${verdict.delta} ${overLabel}`;
  }
  return `Lv. ${verdict.level}`;
}

/**
 * Type/coverage answer that is also fight-ready on level (or has no level to
 * judge). Underleveled answers still match on typing but do not count as covered.
 */
export function isGymPrepLevelReady(match: GymPrepSquadMatch, aceLevel: number): boolean {
  const verdict = levelVerdictForGymPrep(match.entry.level, aceLevel);
  return verdict == null || verdict.state !== "under";
}

/**
 * Whether the checkpoint counts as answered by this draft.
 *
 * Level only enters the question at the live cap. The house rule pins the squad
 * *below* every later checkpoint’s ace, so demanding level-readiness there would
 * report rules-compliant play as a gap — and would make the count a function of
 * badge progress rather than of the draft.
 */
export function isGymPrepAnswered(
  matches: readonly GymPrepSquadMatch[],
  aceLevel: number,
  capRole: GymPrepCapRole,
): boolean {
  if (capRole === "cleared") return true;
  if (matches.length === 0) return false;
  if (capRole !== "live") return true;
  return matches.some((match) => isGymPrepLevelReady(match, aceLevel));
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
