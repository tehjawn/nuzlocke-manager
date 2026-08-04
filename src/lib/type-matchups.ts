import type { PokemonType as ChipType } from "@/lib/pokemon-types";
import {
  TYPES,
  typeMultiplier,
  type PokemonType as ChartType,
} from "@/lib/type-chart";

export type MatchupMult = 0 | 0.25 | 0.5 | 1 | 2 | 4;

export type DefensiveMatchups = {
  x4: ChartType[];
  x2: ChartType[];
  x1: ChartType[];
  x05: ChartType[];
  x025: ChartType[];
  x0: ChartType[];
};

function asChartType(type: string): ChartType | null {
  return (TYPES as readonly string[]).includes(type)
    ? (type as ChartType)
    : null;
}

/** Combined multiplier of one attack type vs a defender's typing. */
export function attackMultiplierVs(
  attack: ChartType,
  defenders: readonly ChipType[],
): number {
  if (defenders.length === 0) return 1;
  let mult = 1;
  for (const d of defenders) {
    const chart = asChartType(d);
    if (!chart) continue;
    mult *= typeMultiplier(attack, chart);
  }
  return mult;
}

function bucketMult(raw: number): MatchupMult {
  if (raw === 0) return 0;
  if (raw >= 4) return 4;
  if (raw >= 2) return 2;
  if (raw >= 1) return 1;
  if (raw >= 0.5) return 0.5;
  if (raw >= 0.25) return 0.25;
  return 0;
}

/** How every attacking type fares against this defensive typing. */
export function defensiveMatchups(
  defenders: readonly ChipType[],
): DefensiveMatchups {
  const out: DefensiveMatchups = {
    x4: [],
    x2: [],
    x1: [],
    x05: [],
    x025: [],
    x0: [],
  };
  if (defenders.length === 0) return out;

  for (const atk of TYPES) {
    const bucket = bucketMult(attackMultiplierVs(atk, defenders));
    if (bucket === 4) out.x4.push(atk);
    else if (bucket === 2) out.x2.push(atk);
    else if (bucket === 1) out.x1.push(atk);
    else if (bucket === 0.5) out.x05.push(atk);
    else if (bucket === 0.25) out.x025.push(atk);
    else out.x0.push(atk);
  }
  return out;
}

/** Best STAB multiplier this attacker can land on the defender. */
export function bestStabMultiplier(
  attackerTypes: readonly ChipType[],
  defenders: readonly ChipType[],
): { type: ChartType | null; mult: number } {
  let best: ChartType | null = null;
  let bestMult = 0;
  for (const t of attackerTypes) {
    const chart = asChartType(t);
    if (!chart) continue;
    const m = attackMultiplierVs(chart, defenders);
    if (m > bestMult) {
      bestMult = m;
      best = chart;
    }
  }
  return { type: best, mult: bestMult };
}

export type StabOffense = {
  /** Defenders its own typing hits for ≥2× — what it threatens on switch-in. */
  strongVs: ChartType[];
  /** Defenders that resist every one of its STAB types (best hit ≤½×). */
  resistedBy: ChartType[];
  /** Defenders immune to every one of its STAB types. */
  immuneTo: ChartType[];
};

/**
 * Offensive outlook of a typing against each mono-type defender, judged on
 * STAB alone. Coverage moves obviously change this — it's the species-level
 * "what does it threaten", not a moveset read.
 */
export function stabOffense(attackers: readonly ChipType[]): StabOffense {
  const out: StabOffense = { strongVs: [], resistedBy: [], immuneTo: [] };
  if (attackers.length === 0) return out;

  for (const defender of TYPES) {
    const { mult } = bestStabMultiplier(attackers, [defender]);
    if (mult >= 2) out.strongVs.push(defender);
    else if (mult === 0) out.immuneTo.push(defender);
    else if (mult < 1) out.resistedBy.push(defender);
  }
  return out;
}

export function formatMatchupMult(m: MatchupMult | number): string {
  if (m === 0) return "0×";
  if (m === 0.25) return "¼×";
  if (m === 0.5) return "½×";
  if (m === 1) return "1×";
  if (m === 2) return "2×";
  if (m === 4) return "4×";
  return `${m}×`;
}
