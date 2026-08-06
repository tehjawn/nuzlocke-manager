import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";

/** Competitive fields withheld from public / non-owner board views. */
export function redactCompetitivePokemonDetails(
  pokemon: PokemonEntry,
): PokemonEntry {
  return {
    ...pokemon,
    nature: null,
    ability: null,
    moves: [],
    ivs: null,
    evs: null,
    friendship: null,
  };
}

export function redactTrainerCompetitiveDetails(
  trainer: TrainerProfile,
): TrainerProfile {
  return {
    ...trainer,
    pokemon: trainer.pokemon.map(redactCompetitivePokemonDetails),
  };
}
