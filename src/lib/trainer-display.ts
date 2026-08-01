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

type SortableTrainer = {
  id: string;
  sortOrder: number;
  updatedAt?: string | null;
};

function updatedAtMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/**
 * League board order: the viewer's claimed trainer first, then most recently
 * updated first. Null/invalid timestamps sort last; sortOrder/id break ties.
 */
export function sortTrainersForViewer<T extends SortableTrainer>(
  trainers: T[],
  myTrainerId?: string | null,
): T[] {
  return [...trainers].sort((a, b) => {
    if (myTrainerId) {
      if (a.id === myTrainerId) return -1;
      if (b.id === myTrainerId) return 1;
    }

    const aTime = updatedAtMs(a.updatedAt);
    const bTime = updatedAtMs(b.updatedAt);
    const aOk = Number.isFinite(aTime);
    const bOk = Number.isFinite(bTime);
    if (aOk && bOk && aTime !== bTime) return bTime - aTime;
    if (aOk !== bOk) return aOk ? -1 : 1;

    const bySort = a.sortOrder - b.sortOrder;
    if (bySort !== 0) return bySort;
    return a.id.localeCompare(b.id);
  });
}
