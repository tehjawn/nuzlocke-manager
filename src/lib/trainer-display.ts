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

/**
 * League board order: the viewer's claimed trainer first, then sortOrder.
 */
export function sortTrainersForViewer<T extends { id: string; sortOrder: number }>(
  trainers: T[],
  myTrainerId?: string | null,
): T[] {
  return [...trainers].sort((a, b) => {
    if (myTrainerId) {
      if (a.id === myTrainerId) return -1;
      if (b.id === myTrainerId) return 1;
    }
    return a.sortOrder - b.sortOrder;
  });
}
