import {
  findPokemonById,
  findPokemonByName,
  type PokemonIndexEntry,
} from "@/data/pokemon-index";
import type { PokemonEntry } from "@/lib/challenge-types";
import { lookupMoveMeta } from "@/lib/move-meta";
import type { PokemonType as ChipType } from "@/lib/pokemon-types";
import { typesForPokedexId } from "@/lib/resolve-pokemon-types";
import { baseStatsForSpecies, type StatSpread } from "@/lib/stats";
import { attackMultiplierVs } from "@/lib/type-matchups";
import { TYPES, type PokemonType as ChartType } from "@/lib/type-chart";

export type SquadCounterSuggestion = {
  /** Stable board entry id — used for tip rerolls. */
  entryId: string;
  pokemon: PokemonIndexEntry;
  displayName: string;
  slot: PokemonEntry["slot"];
  types: ChipType[];
  attackType: ChartType;
  moveName: string;
  moveCategory: "Physical" | "Special";
  offenseMult: number;
  threatMult: number;
  threatAvg: number;
  baseStats: StatSpread | null;
  reason: string;
  score: number;
};

export type RecommendSquadCountersOptions = {
  /** Always skip this dex id (usually the looked-up species). */
  excludePokedexId?: number | null;
  /** Extra board entry ids to skip (already-shown tips, rerolls). */
  excludeEntryIds?: readonly string[];
  /** How many tips to return (default 3). */
  limit?: number;
  /** Minimum offense multiplier to recommend (default 2). */
  minOffenseMult?: number;
};

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
  moveName: string,
  threatMax: number,
  threatAvg: number,
  targetTypeCount: number,
): string {
  const hit = `${formatMult(offenseMult)} ${attackType} via ${moveName}`;
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

function resolveIndexEntry(mon: PokemonEntry): PokemonIndexEntry | null {
  if (mon.pokedexId != null && mon.pokedexId > 0) {
    const byId = findPokemonById(mon.pokedexId);
    if (byId) return byId;
  }
  return findPokemonByName(mon.species) ?? null;
}

function resolveTypes(
  mon: PokemonEntry,
  entry: PokemonIndexEntry | null,
): ChipType[] {
  if (mon.types.length > 0) return mon.types;
  if (entry) return typesForPokedexId(entry.pokedexId);
  if (mon.pokedexId != null && mon.pokedexId > 0) {
    return typesForPokedexId(mon.pokedexId);
  }
  return [];
}

function displayLabel(mon: PokemonEntry, entry: PokemonIndexEntry | null): string {
  const nick = mon.nickname?.trim();
  if (nick) return nick;
  return entry?.name ?? mon.species;
}

/** Insert into a small descending-score buffer (length ≤ limit). */
function considerTop(
  best: SquadCounterSuggestion[],
  tip: SquadCounterSuggestion,
  limit: number,
) {
  if (best.length < limit) {
    best.push(tip);
    best.sort(
      (a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId),
    );
    return;
  }
  const worst = best[best.length - 1]!;
  if (
    tip.score < worst.score ||
    (tip.score === worst.score && tip.entryId >= worst.entryId)
  ) {
    return;
  }
  best[best.length - 1] = tip;
  best.sort(
    (a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId),
  );
}

/**
 * Rank counters from the active trainer's Main + Reserve roster using each
 * mon's stored damaging moves (not sample STAB / learnset guesses).
 */
export function recommendSquadCounters(
  targetTypes: readonly ChipType[],
  squad: readonly PokemonEntry[],
  options: RecommendSquadCountersOptions = {},
): SquadCounterSuggestion[] {
  if (targetTypes.length === 0 || squad.length === 0) return [];

  const excludeEntries = new Set(options.excludeEntryIds ?? []);
  const excludeDex =
    options.excludePokedexId != null ? options.excludePokedexId : null;
  const limit = Math.max(1, options.limit ?? 3);
  const minOffense = options.minOffenseMult ?? 2;
  const best: SquadCounterSuggestion[] = [];

  for (const mon of squad) {
    if (excludeEntries.has(mon.id)) continue;
    const indexEntry = resolveIndexEntry(mon);
    if (!indexEntry) continue;
    if (excludeDex != null && indexEntry.pokedexId === excludeDex) continue;

    const types = resolveTypes(mon, indexEntry);
    if (types.length === 0) continue;

    let bestMove: {
      moveName: string;
      attackType: ChartType;
      category: "Physical" | "Special";
      offenseMult: number;
      power: number;
    } | null = null;

    for (const rawMove of mon.moves) {
      const meta = lookupMoveMeta(rawMove);
      if (!meta) continue;
      if (meta.category === "Status") continue;
      if (meta.power <= 0) continue;
      const attackType = asChartType(meta.type);
      if (!attackType) continue;
      const offenseMult = attackMultiplierVs(attackType, targetTypes);
      if (offenseMult < minOffense) continue;

      const candidate = {
        moveName: meta.name,
        attackType,
        category: meta.category,
        offenseMult,
        power: meta.power,
      };
      if (
        !bestMove ||
        candidate.offenseMult > bestMove.offenseMult ||
        (candidate.offenseMult === bestMove.offenseMult &&
          candidate.power > bestMove.power)
      ) {
        bestMove = candidate;
      }
    }

    if (!bestMove) continue;

    const threat = incomingStabThreat(targetTypes, types);
    const stats = baseStatsForSpecies(indexEntry.pokedexId);
    const offenseStat =
      stats == null
        ? 80
        : bestMove.category === "Physical"
          ? stats.atk
          : stats.spa;
    const total = stats
      ? stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
      : 400;

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
    const slotBias = mon.slot === "MAIN" ? 8 : 0;

    const score =
      bestMove.offenseMult * 100 +
      resistBonus +
      avgResistBonus +
      offenseStat * 0.14 +
      total * 0.015 +
      bestMove.power * 0.05 +
      slotBias;

    considerTop(
      best,
      {
        entryId: mon.id,
        pokemon: indexEntry,
        displayName: displayLabel(mon, indexEntry),
        slot: mon.slot,
        types,
        attackType: bestMove.attackType,
        moveName: bestMove.moveName,
        moveCategory: bestMove.category,
        offenseMult: bestMove.offenseMult,
        threatMult: threat.max,
        threatAvg: threat.avg,
        baseStats: stats,
        reason: buildReason(
          bestMove.offenseMult,
          bestMove.attackType,
          bestMove.moveName,
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

/** Next batch after excluding already-shown board entries. */
export function recommendMoreSquadCounters(
  targetTypes: readonly ChipType[],
  squad: readonly PokemonEntry[],
  shownEntryIds: readonly string[],
  options?: Omit<RecommendSquadCountersOptions, "excludeEntryIds">,
): SquadCounterSuggestion[] {
  return recommendSquadCounters(targetTypes, squad, {
    ...options,
    excludeEntryIds: shownEntryIds,
  });
}
