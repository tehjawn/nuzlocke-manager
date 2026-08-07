/**
 * Seed-aware obtainability / scarcity buckets for the GM randomizer parser.
 *
 * Given rolled wild tables + statics and the Modern Emerald evolution graph,
 * classify every ME national id into scarcity buckets so GMs can draft against
 * what the seed actually allows — not vanilla route data.
 */

import speciesEvolutionsData from "@/data/species-evolutions.json";
import { modernEmeraldNationalIds } from "@/lib/modern-emerald-dex";
import type { EvolutionEdgeRaw } from "@/lib/species-evolutions";
import type {
  RolledArea,
  RolledStatic,
  SpeciesSighting,
} from "@/lib/tx-randomizer";

const BY_DEX = (speciesEvolutionsData as { byDex: Record<string, EvolutionEdgeRaw[]> })
  .byDex;

function isTradeMethod(method: string): boolean {
  return method === "EVO_TRADE" || method === "EVO_TRADE_ITEM";
}

export type ObtainabilityBucket =
  | "unobtainable"
  | "tradeEvo"
  | "evolutionOnly"
  | "singleSlot";

export type ObtainabilityBuckets = {
  /** No wild, no catchable static, no evo path (including trade) from anything obtainable. */
  unobtainable: number[];
  /**
   * Reachable only by crossing an `EVO_TRADE` / `EVO_TRADE_ITEM` edge from an
   * otherwise-obtainable pre-evo. Modern Emerald’s Lilycove self-trader covers
   * the ROM path; season Rules may still ban it — keep distinct from true
   * unobtainable.
   */
  tradeEvo: number[];
  /** No wild/static slot; reachable by non-trade evolution from something obtainable. */
  evolutionOnly: number[];
  /**
   * Appears in exactly one wild mapsec under this seed. Burning that route's
   * encounter flag removes the species for that player.
   */
  singleSlot: number[];
};

/**
 * Count distinct wild mapsecs a species appears in. Land/water/fishing on the
 * same mapsec share one Nuzlocke encounter flag, so mapsec — not raw table
 * rows — is the scarcity unit.
 */
export function wildMapsecCount(sighting: SpeciesSighting): number {
  return new Set(sighting.sources.map((source) => source.mapsec)).size;
}

/**
 * Classify every Modern Emerald species against the rolled seed.
 *
 * Priority (first match wins for the non-single-slot buckets):
 * 1. Direct catch (wild or catchable static) → not scarce (except single-slot)
 * 2. Non-trade evo from obtainable → evolution-only
 * 3. Trade evo from obtainable → trade-evo
 * 4. Else → unobtainable
 *
 * Single-slot overlays the direct-wild set and does not exclude other buckets.
 */
export function computeObtainabilityBuckets(
  areas: readonly RolledArea[],
  statics: readonly RolledStatic[],
  speciesIndex?: readonly SpeciesSighting[],
): ObtainabilityBuckets {
  const wildByDex = new Map<number, Set<number>>();
  for (const area of areas) {
    for (const slot of area.slots) {
      if (!slot.pokedexId) continue;
      const mapsecs = wildByDex.get(slot.pokedexId) ?? new Set<number>();
      mapsecs.add(area.mapsec);
      wildByDex.set(slot.pokedexId, mapsecs);
    }
  }

  // Prefer the prebuilt species index when callers already have it (same data).
  if (speciesIndex) {
    for (const entry of speciesIndex) {
      if (!wildByDex.has(entry.pokedexId)) {
        wildByDex.set(
          entry.pokedexId,
          new Set(entry.sources.map((source) => source.mapsec)),
        );
      }
    }
  }

  const direct = new Set<number>();
  for (const pokedexId of wildByDex.keys()) direct.add(pokedexId);
  for (const entry of statics) {
    if (entry.noCatching || !entry.pokedexId) continue;
    direct.add(entry.pokedexId);
  }

  // BFS via non-trade edges from everything directly catchable.
  const free = new Set<number>(direct);
  const queue = [...direct];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const edge of BY_DEX[String(current)] ?? []) {
      if (isTradeMethod(edge.method)) continue;
      if (free.has(edge.into)) continue;
      free.add(edge.into);
      queue.push(edge.into);
    }
  }

  // Trade edges from free species → trade-gated destinations not already free.
  const tradeEvo = new Set<number>();
  for (const from of free) {
    for (const edge of BY_DEX[String(from)] ?? []) {
      if (!isTradeMethod(edge.method)) continue;
      if (free.has(edge.into) || direct.has(edge.into)) continue;
      tradeEvo.add(edge.into);
    }
  }
  // Also: trade into a species whose pre-evo is only reachable via further
  // free expansion already covered; walk trade edges from free only once.
  // Chain trades (Porygon → Porygon2 → Porygon-Z) need a second pass from
  // trade-gated parents that themselves require trade.
  let grew = true;
  while (grew) {
    grew = false;
    for (const from of [...tradeEvo]) {
      for (const edge of BY_DEX[String(from)] ?? []) {
        if (!isTradeMethod(edge.method)) continue;
        if (free.has(edge.into) || tradeEvo.has(edge.into)) continue;
        tradeEvo.add(edge.into);
        grew = true;
      }
    }
  }

  const evolutionOnly: number[] = [];
  const unobtainable: number[] = [];
  const tradeEvoList: number[] = [];

  for (const pokedexId of modernEmeraldNationalIds()) {
    if (direct.has(pokedexId)) continue;
    if (free.has(pokedexId)) {
      evolutionOnly.push(pokedexId);
      continue;
    }
    if (tradeEvo.has(pokedexId)) {
      tradeEvoList.push(pokedexId);
      continue;
    }
    unobtainable.push(pokedexId);
  }

  const singleSlot: number[] = [];
  for (const [pokedexId, mapsecs] of wildByDex) {
    if (mapsecs.size === 1) singleSlot.push(pokedexId);
  }
  singleSlot.sort((a, b) => a - b);

  return {
    unobtainable,
    tradeEvo: tradeEvoList,
    evolutionOnly,
    singleSlot,
  };
}

export function bucketLabel(bucket: ObtainabilityBucket): string {
  switch (bucket) {
    case "unobtainable":
      return "Unobtainable";
    case "tradeEvo":
      return "Trade-evo";
    case "evolutionOnly":
      return "Evolution-only";
    case "singleSlot":
      return "Single-slot";
  }
}

export function bucketHint(bucket: ObtainabilityBucket): string {
  switch (bucket) {
    case "unobtainable":
      return "No wild slot, catchable static, or evolution path in this seed.";
    case "tradeEvo":
      return "Only reachable via trade evolution. Self-trade at Lilycove Dept Store 1F (10,000¥, or a lifetime license). Season Rules may still ban it.";
    case "evolutionOnly":
      return "No wild or static slot — only reachable by evolving an obtainable pre-evo.";
    case "singleSlot":
      return "Appears in exactly one wild area. Once that route's encounter is spent, this species is gone for that player.";
  }
}
