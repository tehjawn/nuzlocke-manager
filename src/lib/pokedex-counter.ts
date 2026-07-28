import { POKEMON_INDEX, type PokemonIndexEntry } from "@/data/pokemon-index";
import { pickCounterMove } from "@/data/type-signature-moves";
import type { PokemonType as ChipType } from "@/lib/pokemon-types";
import { typesForPokedexId } from "@/lib/resolve-pokemon-types";
import { baseStatsForSpecies, type StatSpread } from "@/lib/stats";
import {
  attackMultiplierVs,
  bestStabMultiplier,
} from "@/lib/type-matchups";
import { TYPES, type PokemonType as ChartType } from "@/lib/type-chart";

export type CounterSuggestion = {
  pokemon: PokemonIndexEntry;
  types: ChipType[];
  attackType: ChartType;
  moveName: string;
  moveCategory: "Physical" | "Special";
  offenseMult: number;
  /** Highest STAB multiplier any of the target's types land on this counter. */
  threatMult: number;
  /** Average of per-type STAB threats (dual-type aware). */
  threatAvg: number;
  baseStats: StatSpread;
  reason: string;
  /** Higher is better — useful for debugging / future UI ranking. */
  score: number;
};

export type RecommendCountersOptions = {
  /** Always skip this dex id (usually the looked-up species). */
  excludePokedexId?: number | null;
  /** Extra ids to skip (already-shown tips, rerolls). */
  excludeIds?: readonly number[];
  /** How many tips to return (default 3). */
  limit?: number;
};

type CounterCandidate = {
  pokemon: PokemonIndexEntry;
  types: ChipType[];
  stats: StatSpread;
  total: number;
  genBias: number;
};

/** Mid-BST base species with types + stats — built once for tip ranking. */
const COUNTER_CANDIDATES: CounterCandidate[] = [];
for (const mon of POKEMON_INDEX) {
  if (mon.isForme) continue;
  const types = typesForPokedexId(mon.pokedexId);
  if (types.length === 0) continue;
  const stats = baseStatsForSpecies(mon.pokedexId);
  if (!stats) continue;
  const total =
    stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;
  if (total > 600) continue;
  COUNTER_CANDIDATES.push({
    pokemon: mon,
    types,
    stats,
    total,
    genBias: mon.generation <= 3 ? 28 : mon.generation <= 5 ? 10 : 0,
  });
}

function formatMult(m: number): string {
  if (m === 0) return "0×";
  if (m === 0.25) return "¼×";
  if (m === 0.5) return "½×";
  if (m === 1) return "1×";
  if (m === 2) return "2×";
  if (m === 4) return "4×";
  if (Number.isInteger(m)) return `${m}×`;
  if (Math.abs(m - 0.75) < 1e-9) return "¾×";
  if (Math.abs(m - 1.5) < 1e-9) return "1½×";
  return `${Number(m.toFixed(2))}×`;
}

function asChartType(type: string): ChartType | null {
  return (TYPES as readonly string[]).includes(type)
    ? (type as ChartType)
    : null;
}

function incomingStabThreat(
  targetTypes: readonly ChipType[],
  defenderTypes: readonly ChipType[],
): { max: number; avg: number } {
  if (targetTypes.length === 0) return { max: 1, avg: 1 };
  let max = 0;
  let sum = 0;
  let n = 0;
  for (const t of targetTypes) {
    const chart = asChartType(t);
    if (!chart) continue;
    const m = attackMultiplierVs(chart, defenderTypes);
    max = Math.max(max, m);
    sum += m;
    n += 1;
  }
  return { max, avg: n > 0 ? sum / n : 1 };
}

function buildReason(
  offenseMult: number,
  attackType: ChartType,
  threatMax: number,
  threatAvg: number,
  targetTypeCount: number,
): string {
  const hit = `${formatMult(offenseMult)} ${attackType} STAB`;
  if (threatMax === 0) return `${hit}; immune to its STAB`;
  if (threatMax < 1) {
    return targetTypeCount > 1
      ? `${hit}; resists its STABs (worst ${formatMult(threatMax)}, avg ${formatMult(threatAvg)})`
      : `${hit}; resists its STAB (${formatMult(threatMax)})`;
  }
  if (threatMax === 1) {
    return targetTypeCount > 1
      ? `${hit}; takes at most neutral from its STABs`
      : `${hit}; takes neutral STAB`;
  }
  return `${hit}; still weak to its STAB (${formatMult(threatMax)})`;
}

/** Insert into a small descending-score buffer (length ≤ limit). */
function considerTop(
  best: CounterSuggestion[],
  tip: CounterSuggestion,
  limit: number,
) {
  if (best.length < limit) {
    best.push(tip);
    best.sort(
      (a, b) => b.score - a.score || a.pokemon.pokedexId - b.pokemon.pokedexId,
    );
    return;
  }
  const worst = best[best.length - 1]!;
  if (
    tip.score < worst.score ||
    (tip.score === worst.score && tip.pokemon.pokedexId >= worst.pokemon.pokedexId)
  ) {
    return;
  }
  best[best.length - 1] = tip;
  best.sort(
    (a, b) => b.score - a.score || a.pokemon.pokedexId - b.pokemon.pokedexId,
  );
}

/**
 * Ranked type-based counter tips for a defensive typing.
 * Prefers SE STAB + low incoming STAB pressure, Gen 1–3 / mid-BST species.
 * Deterministic for a given exclude set.
 */
export function recommendCounters(
  targetTypes: readonly ChipType[],
  options: RecommendCountersOptions = {},
): CounterSuggestion[] {
  if (targetTypes.length === 0) return [];

  const exclude = new Set<number>(options.excludeIds ?? []);
  if (options.excludePokedexId != null) {
    exclude.add(options.excludePokedexId);
  }
  const limit = Math.max(1, options.limit ?? 3);
  const best: CounterSuggestion[] = [];

  for (const c of COUNTER_CANDIDATES) {
    if (exclude.has(c.pokemon.pokedexId)) continue;

    const { type: attackType, mult: offenseMult } = bestStabMultiplier(
      c.types,
      targetTypes,
    );
    if (!attackType || offenseMult < 2) continue;

    // Cheap reject when the buffer is full and this can't beat the worst tip.
    if (best.length >= limit) {
      const optimistic =
        offenseMult * 100 + 55 + 20 + Math.max(c.stats.atk, c.stats.spa) * 0.14 +
        c.total * 0.015 +
        c.genBias;
      const worst = best[best.length - 1]!;
      if (optimistic < worst.score) continue;
    }

    const threat = incomingStabThreat(targetTypes, c.types);
    const preferPhysical = c.stats.atk >= c.stats.spa;
    const move = pickCounterMove(attackType, preferPhysical);
    const offenseStat =
      move.category === "Physical" ? c.stats.atk : c.stats.spa;

    const resistBonus =
      threat.max === 0
        ? 55
        : threat.max <= 0.5
          ? 40
          : threat.max <= 1
            ? 18
            : -35;
    const avgResistBonus =
      threat.avg < 1 ? (1 - threat.avg) * 20 : -(threat.avg - 1) * 12;

    const score =
      offenseMult * 100 +
      resistBonus +
      avgResistBonus +
      offenseStat * 0.14 +
      c.total * 0.015 +
      c.genBias -
      c.pokemon.pokedexId * 0.0001;

    considerTop(
      best,
      {
        pokemon: c.pokemon,
        types: c.types,
        attackType,
        moveName: move.name,
        moveCategory: move.category,
        offenseMult,
        threatMult: threat.max,
        threatAvg: threat.avg,
        baseStats: c.stats,
        reason: buildReason(
          offenseMult,
          attackType,
          threat.max,
          threat.avg,
          targetTypes.length,
        ),
        score,
      },
      limit,
    );
  }

  return best;
}

/** Best single tip — thin wrapper over {@link recommendCounters}. */
export function recommendCounter(
  targetTypes: readonly ChipType[],
  options?: Omit<RecommendCountersOptions, "limit">,
): CounterSuggestion | null {
  return recommendCounters(targetTypes, { ...options, limit: 1 })[0] ?? null;
}

/** Next batch after excluding already-shown tips. */
export function recommendMoreCounters(
  targetTypes: readonly ChipType[],
  shownIds: readonly number[],
  options?: Omit<RecommendCountersOptions, "excludeIds">,
): CounterSuggestion[] {
  return recommendCounters(targetTypes, {
    ...options,
    excludeIds: shownIds,
  });
}
