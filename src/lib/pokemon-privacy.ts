import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { catchTierFor, trainingTierFor } from "@/lib/pokemon-grades";

/**
 * Public projection of a specimen: grade first, then drop the spreads the
 * grade was derived from.
 *
 * This is the **only** place competitive fields get stripped, and grading and
 * stripping are one operation on purpose — a second hand-written strip list
 * would silently ship ungraded cards, since the tiers can't be recovered once
 * the inputs are gone. Route any new redaction path through here.
 */
export function toPublicPokemonEntry(pokemon: PokemonEntry): PokemonEntry {
  return {
    ...pokemon,
    catchTier: catchTierFor(pokemon),
    trainingTier: trainingTierFor(pokemon),
    nature: null,
    ability: null,
    moves: [],
    ivs: null,
    evs: null,
    friendship: null,
  };
}

export function toPublicTrainerPokemon(
  trainer: TrainerProfile,
): TrainerProfile {
  return {
    ...trainer,
    pokemon: trainer.pokemon.map(toPublicPokemonEntry),
  };
}
