import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";

/** Pure helpers safe for client components (no DB imports). */

export function pokemonInSlot(
  trainer: TrainerProfile,
  slot: PokemonEntry["slot"],
): PokemonEntry[] {
  return trainer.pokemon
    .filter((p) => p.slot === slot)
    .sort((a, b) => a.partyIndex - b.partyIndex);
}

export function displayName(trainer: TrainerProfile): string {
  return trainer.realName
    ? `${trainer.handle} (${trainer.realName})`
    : trainer.handle;
}

/** Living box size shown on TrainerCard (MAIN + RESERVE). */
export function livingPokemonCount(trainer: {
  pokemon: Array<{ slot: PokemonEntry["slot"] }>;
  slotCounts?: {
    main: number;
    reserve: number;
    graveyard: number;
    encountered: number;
  };
}): number {
  if (trainer.slotCounts) {
    return trainer.slotCounts.main + trainer.slotCounts.reserve;
  }
  let count = 0;
  for (const p of trainer.pokemon) {
    if (p.slot === "MAIN" || p.slot === "RESERVE") count += 1;
  }
  return count;
}

export const TRAINER_SORT_MODES = [
  "recent",
  "badges",
  "pokemon",
  "name-asc",
  "name-desc",
] as const;

export type TrainerSortMode = (typeof TRAINER_SORT_MODES)[number];

export function isTrainerSortMode(value: string): value is TrainerSortMode {
  return (TRAINER_SORT_MODES as readonly string[]).includes(value);
}

export const TRAINER_SORT_LABELS: Record<TrainerSortMode, string> = {
  recent: "Recently updated",
  badges: "Most badges",
  pokemon: "Most Pokémon",
  "name-asc": "A → Z",
  "name-desc": "Z → A",
};

type SortableTrainer = {
  id: string;
  sortOrder: number;
  handle?: string;
  updatedAt?: string | null;
  earnedBadgeKeys?: string[];
  pokemon?: Array<{ slot: PokemonEntry["slot"] }>;
  slotCounts?: {
    main: number;
    reserve: number;
    graveyard: number;
    encountered: number;
  };
};

function updatedAtMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function tieBreak(a: SortableTrainer, b: SortableTrainer): number {
  const bySort = a.sortOrder - b.sortOrder;
  if (bySort !== 0) return bySort;
  return a.id.localeCompare(b.id);
}

function compareRecent(a: SortableTrainer, b: SortableTrainer): number {
  const aTime = updatedAtMs(a.updatedAt);
  const bTime = updatedAtMs(b.updatedAt);
  const aOk = Number.isFinite(aTime);
  const bOk = Number.isFinite(bTime);
  if (aOk && bOk && aTime !== bTime) return bTime - aTime;
  if (aOk !== bOk) return aOk ? -1 : 1;
  return tieBreak(a, b);
}

function compareBadges(a: SortableTrainer, b: SortableTrainer): number {
  const aBadges = a.earnedBadgeKeys?.length ?? 0;
  const bBadges = b.earnedBadgeKeys?.length ?? 0;
  if (aBadges !== bBadges) return bBadges - aBadges;
  return tieBreak(a, b);
}

function comparePokemon(a: SortableTrainer, b: SortableTrainer): number {
  const aCount = livingPokemonCount({
    pokemon: a.pokemon ?? [],
    slotCounts: a.slotCounts,
  });
  const bCount = livingPokemonCount({
    pokemon: b.pokemon ?? [],
    slotCounts: b.slotCounts,
  });
  if (aCount !== bCount) return bCount - aCount;
  return tieBreak(a, b);
}

function compareName(
  a: SortableTrainer,
  b: SortableTrainer,
  direction: "asc" | "desc",
): number {
  const byName = (a.handle ?? "").localeCompare(b.handle ?? "", undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return direction === "asc" ? byName : -byName;
  return tieBreak(a, b);
}

function compareByMode(
  a: SortableTrainer,
  b: SortableTrainer,
  mode: TrainerSortMode,
): number {
  switch (mode) {
    case "badges":
      return compareBadges(a, b);
    case "pokemon":
      return comparePokemon(a, b);
    case "name-asc":
      return compareName(a, b, "asc");
    case "name-desc":
      return compareName(a, b, "desc");
    case "recent":
    default:
      return compareRecent(a, b);
  }
}

/**
 * League board order: the viewer's claimed trainer first, then the selected
 * sort mode. Default mode matches historical "recently updated" behavior.
 * Null/invalid timestamps sort last; sortOrder/id break ties.
 */
export function sortTrainersForViewer<T extends SortableTrainer>(
  trainers: T[],
  myTrainerId?: string | null,
  mode: TrainerSortMode = "recent",
): T[] {
  return [...trainers].sort((a, b) => {
    if (myTrainerId) {
      if (a.id === myTrainerId) return -1;
      if (b.id === myTrainerId) return 1;
    }
    return compareByMode(a, b, mode);
  });
}
