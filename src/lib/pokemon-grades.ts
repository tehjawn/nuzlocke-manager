/**
 * Catch tier and bond tier for a single specimen — the one place either grade
 * is derived.
 *
 * **Policy: the grades are public for every Pokémon in the season; the IV / EV
 * spreads behind them are not.** Announcing "God catch" (weighted playstyle
 * score in the top band) or an Ultra-friends heart (true-max bond — see
 * {@link specimenTrainingTier}) to the whole
 * pack is deliberate — that is what the Showcase is for. The rounded catch
 * **score** may ride along in hover tips (same public grade surface); the
 * spread itself stays private. Finer breakdowns (`summarizeIvs().headline`
 * and friends) belong behind `showCompetitiveDetails`.
 *
 * Bond chrome: when friendship is missing, a near-max EV pool (≥450) stands
 * in for Best friends and a true-max pool (510) for Ultra friends — same
 * "true max on one axis" idea as the logged-friendship path. An explicit
 * friendship below the Best-friends floor still blocks ultra.
 *
 * `null` means **nothing on file to grade**, never "withheld from you". An
 * un-imported encounter has no IVs, and grading it "oof" would publish a bad
 * catch the app never actually measured.
 */

import type { PokemonEntry } from "@/lib/challenge-types";
import { ivCatchGrade, type CatchTier } from "@/lib/iv-quality";
import {
  catchArchetypeForSpecies,
  recommendPlaystyle,
} from "@/lib/playstyle";
import { isEmptySpread } from "@/lib/stats";
import {
  specimenTrainingTier,
  type TrainingTier,
} from "@/lib/training-quality";

type GradableEntry = Pick<
  PokemonEntry,
  "pokedexId" | "nature" | "ability" | "ivs" | "evs" | "friendship"
>;

export type CatchGrade = {
  tier: CatchTier;
  /** Rounded weighted catch score (tips / public stamp; may exceed 100). */
  score: number;
};

/**
 * IV-derived catch grade; null when the specimen has no IVs on file.
 *
 * Grades against the species' catch archetype (weighted playstyle ladder)
 * when base stats are known (see `ivCatchGrade` / #356). Unknown dex falls
 * back to Balanced weights.
 */
export function catchGradeFor(pokemon: GradableEntry): CatchGrade | null {
  if (isEmptySpread(pokemon.ivs) || !pokemon.ivs) return null;
  const { tier, score } = ivCatchGrade(pokemon.ivs, {
    archetype: catchArchetypeForSpecies(pokemon.pokedexId),
  });
  return { tier, score: Math.round(score) };
}

/** IV-derived catch tier; null when the specimen has no IVs on file. */
export function catchTierFor(pokemon: GradableEntry): CatchTier | null {
  return catchGradeFor(pokemon)?.tier ?? null;
}

/** Weighted catch score; null when the specimen has no IVs on file. */
export function catchScoreFor(pokemon: GradableEntry): number | null {
  return catchGradeFor(pokemon)?.score ?? null;
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

/** Catch score for tips — see {@link resolveCatchTier}. */
export function resolveCatchScore(pokemon: PokemonEntry): number | null {
  return pokemon.catchScore !== undefined
    ? pokemon.catchScore
    : catchScoreFor(pokemon);
}

/** Bond tier for display — see {@link resolveCatchTier}. */
export function resolveTrainingTier(
  pokemon: PokemonEntry,
): TrainingTier | null {
  return pokemon.trainingTier !== undefined
    ? pokemon.trainingTier
    : trainingTierFor(pokemon);
}
