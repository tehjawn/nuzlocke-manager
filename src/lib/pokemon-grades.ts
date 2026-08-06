/**
 * Catch tier and bond tier for a single specimen — the one place either grade
 * is derived.
 *
 * **Policy: the grades are public for every Pokémon in the season; the IV / EV
 * spreads behind them are not.** Announcing "God catch" (role-key IVs excellent
 * with a respectable overall spread) or an Ultra-friends heart (Best-friends
 * floors on friendship *and* EVs, plus a true max on at least one) to the whole
 * pack is deliberate — that is what the Showcase is for. Withholding the
 * spread itself is equally deliberate. Publish the tier enum and nothing
 * finer: `summarizeIvs().headline` and friends name exact stats and belong
 * behind `showCompetitiveDetails`.
 *
 * `null` means **nothing on file to grade**, never "withheld from you". An
 * un-imported encounter has no IVs, and grading it "oof" would publish a bad
 * catch the app never actually measured.
 */

import type { PokemonEntry } from "@/lib/challenge-types";
import { ivCatchTier, type CatchTier } from "@/lib/iv-quality";
import { keyStatsForSpecies, recommendPlaystyle } from "@/lib/playstyle";
import { isEmptySpread } from "@/lib/stats";
import {
  specimenTrainingTier,
  type TrainingTier,
} from "@/lib/training-quality";

type GradableEntry = Pick<
  PokemonEntry,
  "pokedexId" | "nature" | "ability" | "ivs" | "evs" | "friendship"
>;

/**
 * IV-derived catch tier; null when the specimen has no IVs on file.
 *
 * Grades against the species' playstyle key stats when base stats are known
 * (see `ivCatchTier` / #342). Unknown dex falls back to the legacy count ladder.
 */
export function catchTierFor(pokemon: GradableEntry): CatchTier | null {
  if (isEmptySpread(pokemon.ivs) || !pokemon.ivs) return null;
  return ivCatchTier(pokemon.ivs, {
    keyStats: keyStatsForSpecies(pokemon.pokedexId),
  });
}

/**
 * EV + nature-fit + friendship bond tier; null when none of those are on file.
 * `raw` stays meaningful — graded, but no investment yet.
 */
export function trainingTierFor(pokemon: GradableEntry): TrainingTier | null {
  const evs = isEmptySpread(pokemon.evs) ? null : pokemon.evs;
  if (!evs && pokemon.friendship == null) return null;
  return specimenTrainingTier({
    evs,
    natureAlignment:
      recommendPlaystyle({
        pokedexId: pokemon.pokedexId,
        nature: pokemon.nature,
        ability: pokemon.ability,
        ivs: isEmptySpread(pokemon.ivs) ? null : pokemon.ivs,
      })?.natureAlignment ?? null,
    friendship: pokemon.friendship,
  });
}

/**
 * Catch tier for display. Prefers the grade stamped at the redaction boundary,
 * falling back to deriving it from an entry that still carries its spreads.
 */
export function resolveCatchTier(pokemon: PokemonEntry): CatchTier | null {
  return pokemon.catchTier !== undefined
    ? pokemon.catchTier
    : catchTierFor(pokemon);
}

/** Bond tier for display — see {@link resolveCatchTier}. */
export function resolveTrainingTier(
  pokemon: PokemonEntry,
): TrainingTier | null {
  return pokemon.trainingTier !== undefined
    ? pokemon.trainingTier
    : trainingTierFor(pokemon);
}
