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
