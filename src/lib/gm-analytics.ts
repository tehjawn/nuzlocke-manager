/**
 * GM console Analytics (#404) — pack-level coverage aggregates over claimed
 * trainers' saved Main Squads. Reuses Team Planner coverage math; subject is
 * MAIN only (not planner drafts).
 */

import type { PokemonEntry } from "@/lib/challenge-types";
import {
  SE_THRESHOLD,
  offensiveCoverage,
} from "@/lib/team-coverage";
import { attackMultiplierVs } from "@/lib/type-matchups";
import { TYPES, type PokemonType } from "@/lib/type-chart";

export type GmAnalyticsMain = {
  trainerId: string;
  handle: string;
  pokemon: PokemonEntry[];
};

export type LeastCoveredRow = {
  defendingType: PokemonType;
  /** Mains that hit this defending type for ≥ SE_THRESHOLD. */
  answeredCount: number;
  mainCount: number;
};

export type PackPressureRow = {
  attackType: PokemonType;
  /** Mains with ≥1 mon taking ≥ SE_THRESHOLD from this attack. */
  pressuredCount: number;
  mainCount: number;
};

export type TypeFrequencyRow = {
  type: PokemonType;
  /** Appearances on MAIN slot typing (dual types count twice). */
  count: number;
  /** count / total type appearances across MAIN slots. */
  share: number;
};

export type GmAnalyticsReport = {
  claimedTrainerCount: number;
  /** Claimed trainers with at least one MAIN Pokémon. */
  mainsWithPokemon: number;
  mainPokemonCount: number;
  leastCovered: LeastCoveredRow[];
  packPressure: PackPressureRow[];
  typeFrequency: TypeFrequencyRow[];
  /** Short plain-language highlights for the panel header. */
  callouts: string[];
};

function chartTypesOn(mon: PokemonEntry): PokemonType[] {
  return mon.types.filter((t): t is PokemonType =>
    (TYPES as readonly string[]).includes(t),
  );
}

function mainPressuredBy(
  pokemon: readonly PokemonEntry[],
  attackType: PokemonType,
): boolean {
  for (const mon of pokemon) {
    const types = chartTypesOn(mon);
    if (types.length === 0) continue;
    if (attackMultiplierVs(attackType, types) >= SE_THRESHOLD) return true;
  }
  return false;
}

/**
 * Aggregate pack meta from claimed trainers' Main Squads.
 * Empty Mains are excluded from coverage denominators.
 */
export function buildGmAnalyticsReport(
  mains: readonly GmAnalyticsMain[],
  options?: { claimedTrainerCount?: number },
): GmAnalyticsReport {
  const claimedTrainerCount = options?.claimedTrainerCount ?? mains.length;
  const active = mains.filter((m) => m.pokemon.length > 0);
  const mainCount = active.length;
  const mainPokemonCount = active.reduce((n, m) => n + m.pokemon.length, 0);

  const answeredByType = new Map<PokemonType, number>(
    TYPES.map((t) => [t, 0]),
  );
  const pressuredByType = new Map<PokemonType, number>(
    TYPES.map((t) => [t, 0]),
  );
  const typeCounts = new Map<PokemonType, number>(TYPES.map((t) => [t, 0]));

  for (const main of active) {
    const coverage = offensiveCoverage(main.pokemon);
    for (const cell of coverage.cells) {
      if (cell.bestMult >= SE_THRESHOLD) {
        answeredByType.set(
          cell.defendingType,
          (answeredByType.get(cell.defendingType) ?? 0) + 1,
        );
      }
    }

    for (const attackType of TYPES) {
      if (mainPressuredBy(main.pokemon, attackType)) {
        pressuredByType.set(
          attackType,
          (pressuredByType.get(attackType) ?? 0) + 1,
        );
      }
    }

    for (const mon of main.pokemon) {
      for (const t of chartTypesOn(mon)) {
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    }
  }

  const leastCovered: LeastCoveredRow[] = TYPES.map((defendingType) => ({
    defendingType,
    answeredCount: answeredByType.get(defendingType) ?? 0,
    mainCount,
  })).sort(
    (a, b) =>
      a.answeredCount - b.answeredCount ||
      a.defendingType.localeCompare(b.defendingType),
  );

  const packPressure: PackPressureRow[] = TYPES.map((attackType) => ({
    attackType,
    pressuredCount: pressuredByType.get(attackType) ?? 0,
    mainCount,
  })).sort(
    (a, b) =>
      b.pressuredCount - a.pressuredCount ||
      a.attackType.localeCompare(b.attackType),
  );

  const totalTypeAppearances = [...typeCounts.values()].reduce(
    (n, c) => n + c,
    0,
  );
  const typeFrequency: TypeFrequencyRow[] = TYPES.map((type) => {
    const count = typeCounts.get(type) ?? 0;
    return {
      type,
      count,
      share: totalTypeAppearances > 0 ? count / totalTypeAppearances : 0,
    };
  }).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  return {
    claimedTrainerCount,
    mainsWithPokemon: mainCount,
    mainPokemonCount,
    leastCovered,
    packPressure,
    typeFrequency,
    callouts: buildCallouts({
      mainCount,
      leastCovered,
      packPressure,
      typeFrequency,
    }),
  };
}

function buildCallouts(input: {
  mainCount: number;
  leastCovered: LeastCoveredRow[];
  packPressure: PackPressureRow[];
  typeFrequency: TypeFrequencyRow[];
}): string[] {
  const { mainCount, leastCovered, packPressure, typeFrequency } = input;
  if (mainCount === 0) {
    return [
      "No Main Squads yet — analytics unlock once trainers claim and fill a Main.",
    ];
  }
  if (mainCount === 1) {
    return [
      "Only one Main Squad filled — pack patterns need a few more teams to mean much.",
    ];
  }

  const callouts: string[] = [];
  const softest = leastCovered[0];
  if (softest && softest.answeredCount < mainCount) {
    callouts.push(
      `Softest defending type: ${softest.defendingType} — ${softest.answeredCount}/${softest.mainCount} Mains have an answer.`,
    );
  }

  const topPressure = packPressure[0];
  if (topPressure && topPressure.pressuredCount > 0) {
    callouts.push(
      `Weak to ${topPressure.attackType} — pressures ${topPressure.pressuredCount}/${topPressure.mainCount} Mains.`,
    );
  }

  const lean = typeFrequency.filter((r) => r.count > 0).slice(0, 3);
  if (lean.length > 0) {
    callouts.push(
      `Pack typing leans ${lean.map((r) => `${r.type} (×${r.count})`).join(", ")}.`,
    );
  }

  return callouts.slice(0, 3);
}
