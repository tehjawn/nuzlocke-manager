import { findPokemonByName } from "@/data/pokemon-index";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { buildEncounterLedger } from "@/lib/encounter-ledger";
import {
  modernEmeraldDexTotal,
  modernEmeraldNationalIds,
  modernEmeraldSpeciesRef,
  type ModernEmeraldSpeciesRef,
} from "@/lib/modern-emerald-dex";
import { evolutionFamily } from "@/lib/species-evolutions";

/** Noise species excluded from popularity / rarity callout rankings. */
const RANKING_EXCLUDED_NAMES = new Set(["zigzagoon"]);
const RANKING_EXCLUDED_DEX = new Set([263]);

export const ENCOUNTER_STATS_TOP_N = 3;

export type EncounterSpeciesHighlight = {
  species: string;
  pokedexId: number | null;
  count: number;
};

export type EncounterRouteHighlight = {
  route: string;
  /** Graves logged with this catch route. */
  graveCount: number;
  trainerCount: number;
};

export type EncounterSeasonHighlights = {
  /** Every live Pokémon row across the season (any slot). */
  totalLogged: number;
  uniqueSpecies: number;
  routesClaimed: number;
  meDexLogged: number;
  meDexTotal: number;
  /** Top N by raw board appearances (Zigzagoon excluded). */
  mostLogged: EncounterSpeciesHighlight[];
  /** Top N rarest among seen (Zigzagoon excluded). */
  rarestSeen: EncounterSpeciesHighlight[];
  /**
   * Top N catch routes by grave count — Soft Lock lore without early-route
   * claim bias (Route 101 always “wins” raw claims).
   */
  deadliestRoutes: EncounterRouteHighlight[];
};

export type ExclusiveSpecies = ModernEmeraldSpeciesRef & {
  trainerId: string;
  trainerHandle: string;
  /** Prefer MAIN over RESERVE when both exist for the exclusive holder. */
  slot: "MAIN" | "RESERVE";
};

type SpeciesBucket = {
  key: string;
  species: string;
  pokedexId: number | null;
  count: number;
};

/** Name-keyed like memorial stats so rows with/without pokedexId merge. */
function speciesNameKey(species: string): string {
  return species.trim().toLowerCase();
}

function resolvePokedexId(
  mon: Pick<PokemonEntry, "species" | "pokedexId">,
): number | null {
  if (mon.pokedexId != null && mon.pokedexId > 0) return mon.pokedexId;
  return findPokemonByName(mon.species)?.pokedexId ?? null;
}

function isRankingExcluded(
  mon: Pick<PokemonEntry, "species" | "pokedexId">,
): boolean {
  if (RANKING_EXCLUDED_NAMES.has(speciesNameKey(mon.species))) return true;
  const dex = resolvePokedexId(mon);
  return dex != null && RANKING_EXCLUDED_DEX.has(dex);
}

function bumpSpecies(
  map: Map<string, SpeciesBucket>,
  mon: Pick<PokemonEntry, "species" | "pokedexId">,
  by = 1,
): void {
  const key = speciesNameKey(mon.species);
  const existing = map.get(key);
  if (existing) {
    existing.count += by;
    if (existing.pokedexId == null) {
      existing.pokedexId = resolvePokedexId(mon);
    }
    return;
  }
  map.set(key, {
    key,
    species: mon.species,
    pokedexId: resolvePokedexId(mon),
    count: by,
  });
}

function toSpeciesList(
  ranked: SpeciesBucket[],
  pick: "most" | "least",
  limit = ranked.length,
): EncounterSpeciesHighlight[] {
  if (ranked.length === 0) return [];
  const ordered =
    pick === "most"
      ? [...ranked].sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.species.localeCompare(b.species);
        })
      : [...ranked].sort((a, b) => {
          if (a.count !== b.count) return a.count - b.count;
          return a.species.localeCompare(b.species);
        });
  return ordered.slice(0, limit).map((entry) => ({
    species: entry.species,
    pokedexId: entry.pokedexId,
    count: entry.count,
  }));
}

/** Every ranked species, ordered from fewest board appearances to most. */
export function encounterSpeciesRarity(
  trainers: TrainerProfile[],
): EncounterSpeciesHighlight[] {
  const speciesCounts = new Map<string, SpeciesBucket>();
  for (const trainer of trainers) {
    for (const mon of trainer.pokemon) {
      bumpSpecies(speciesCounts, mon);
    }
  }

  const rankingPool = [...speciesCounts.values()].filter(
    (entry) => !isRankingExcluded(entry),
  );
  return toSpeciesList(rankingPool, "least");
}

/**
 * Resolve National Dex ids touched by a trainer board.
 * Prefer `pokedexId`; fall back to name lookup when dex is missing.
 */
export function trainerTouchedPokedexIds(
  trainer: TrainerProfile,
  slots?: ReadonlySet<PokemonEntry["slot"]>,
): Set<number> {
  const ids = new Set<number>();
  for (const mon of trainer.pokemon) {
    if (slots && !slots.has(mon.slot)) continue;
    if (mon.pokedexId != null && mon.pokedexId > 0) {
      ids.add(mon.pokedexId);
      continue;
    }
    const entry = findPokemonByName(mon.species);
    if (entry) ids.add(entry.pokedexId);
  }
  return ids;
}

export function seasonTouchedPokedexIds(
  trainers: TrainerProfile[],
  slots?: ReadonlySet<PokemonEntry["slot"]>,
): Set<number> {
  const ids = new Set<number>();
  for (const trainer of trainers) {
    for (const id of trainerTouchedPokedexIds(trainer, slots)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Season encounter meta from live boards (any slot counts as logged).
 * Popularity rankings skip Zigzagoon; third callout is deadliest catch routes.
 */
export function encounterSeasonHighlights(
  trainers: TrainerProfile[],
): EncounterSeasonHighlights {
  const speciesCounts = new Map<string, SpeciesBucket>();
  const graveRoutes = new Map<
    string,
    { route: string; graveCount: number; trainers: Set<string> }
  >();
  let totalLogged = 0;

  for (const trainer of trainers) {
    for (const mon of trainer.pokemon) {
      totalLogged += 1;
      bumpSpecies(speciesCounts, mon);

      if (mon.slot !== "GRAVEYARD") continue;
      const route = mon.catchRoute?.trim();
      if (!route) continue;
      const key = route.toLowerCase();
      const row = graveRoutes.get(key) ?? {
        route,
        graveCount: 0,
        trainers: new Set<string>(),
      };
      row.graveCount += 1;
      row.trainers.add(trainer.id);
      graveRoutes.set(key, row);
    }
  }

  const allRanked = [...speciesCounts.values()];
  const rankingPool = allRanked.filter((entry) => !isRankingExcluded(entry));
  const ledger = buildEncounterLedger(trainers);

  const deadliestRoutes = [...graveRoutes.values()]
    .sort((a, b) => {
      if (b.graveCount !== a.graveCount) return b.graveCount - a.graveCount;
      if (b.trainers.size !== a.trainers.size) {
        return b.trainers.size - a.trainers.size;
      }
      return a.route.localeCompare(b.route);
    })
    .slice(0, ENCOUNTER_STATS_TOP_N)
    .map((row) => ({
      route: row.route,
      graveCount: row.graveCount,
      trainerCount: row.trainers.size,
    }));

  const meTotal = modernEmeraldDexTotal();
  const meLogged = [...seasonTouchedPokedexIds(trainers)].filter((id) =>
    modernEmeraldNationalIdSet().has(id),
  ).length;

  return {
    totalLogged,
    uniqueSpecies: allRanked.length,
    routesClaimed: ledger.filter((group) => group.kind === "route").length,
    meDexLogged: meLogged,
    meDexTotal: meTotal,
    mostLogged: toSpeciesList(rankingPool, "most", ENCOUNTER_STATS_TOP_N),
    rarestSeen: toSpeciesList(rankingPool, "least", ENCOUNTER_STATS_TOP_N),
    deadliestRoutes,
  };
}

let meIdSet: Set<number> | null = null;

function modernEmeraldNationalIdSet(): Set<number> {
  if (!meIdSet) meIdSet = new Set(modernEmeraldNationalIds());
  return meIdSet;
}

/** Pack-wide Modern Emerald species with zero appearances on any board. */
export function missingModernEmeraldSpecies(
  trainers: TrainerProfile[],
): ModernEmeraldSpeciesRef[] {
  const touched = seasonTouchedPokedexIds(trainers);
  return modernEmeraldNationalIds()
    .filter((id) => !touched.has(id))
    .map(modernEmeraldSpeciesRef);
}

const OWNED_SLOTS = new Set<PokemonEntry["slot"]>(["MAIN", "RESERVE"]);

/**
 * Species held in Main/Reserve by exactly one trainer (pack monopoly).
 * Graves / ENCOUNTERED stubs do not count as ownership.
 */
export function exclusiveOwnedSpecies(
  trainers: TrainerProfile[],
): ExclusiveSpecies[] {
  type Holder = {
    trainer: TrainerProfile;
    slot: "MAIN" | "RESERVE";
    species: string;
    pokedexId: number | null;
  };

  const holders = new Map<string, Holder[]>();

  for (const trainer of trainers) {
    const seenKeys = new Set<string>();
    const owned = trainer.pokemon
      .filter((mon) => OWNED_SLOTS.has(mon.slot))
      .sort((a, b) => {
        if (a.slot !== b.slot) return a.slot === "MAIN" ? -1 : 1;
        return a.partyIndex - b.partyIndex;
      });

    for (const mon of owned) {
      const key = speciesNameKey(mon.species);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const list = holders.get(key) ?? [];
      list.push({
        trainer,
        slot: mon.slot === "MAIN" ? "MAIN" : "RESERVE",
        species: mon.species,
        pokedexId: resolvePokedexId(mon),
      });
      holders.set(key, list);
    }
  }

  const exclusives: ExclusiveSpecies[] = [];
  for (const list of holders.values()) {
    if (list.length !== 1) continue;
    const only = list[0]!;
    if (only.pokedexId == null || only.pokedexId <= 0) continue;
    exclusives.push({
      pokedexId: only.pokedexId,
      species: only.species,
      trainerId: only.trainer.id,
      trainerHandle: only.trainer.handle,
      slot: only.slot,
    });
  }

  return exclusives.sort((a, b) => {
    if (a.pokedexId !== b.pokedexId) return a.pokedexId - b.pokedexId;
    return a.species.localeCompare(b.species);
  });
}

export type SpeciesOwnershipStatus = "owned" | "encountered" | "untouched";

export type SpeciesOwnershipHolder = {
  trainerId: string;
  trainerHandle: string;
  /** GRAVEYARD counts as "encountered" — caught once, not currently held. */
  slot: "MAIN" | "RESERVE" | "ENCOUNTERED" | "GRAVEYARD";
};

export type SpeciesOwnershipEntry = ModernEmeraldSpeciesRef & {
  /** Pack-wide tier: "owned" if anyone currently holds it, else "encountered"
   * if anyone's only seen/lost it, else "untouched". */
  status: SpeciesOwnershipStatus;
  /** Every trainer currently holding it live in Main/Reserve. */
  owners: SpeciesOwnershipHolder[];
  /**
   * Every trainer who's touched it without currently holding it (an
   * `ENCOUNTERED` stub or a grave). Populated even when `owners` is also
   * non-empty, so a per-trainer lens (`personalSpeciesStatus`) can still
   * find someone who merely saw a species others own.
   */
  encounteredBy: SpeciesOwnershipHolder[];
  /** Raw board appearances across every trainer/slot — used for rarity sort. */
  totalSeen: number;
};

/**
 * Every Modern Emerald species tagged with its season-wide ownership tier:
 * Owned (kept live in Main/Reserve) beats Encountered (an `ENCOUNTERED` stub
 * or a grave — someone touched it, nobody currently holds it) beats
 * Untouched. Powers Bounty Hunter's species tracker (owned vs. encountered
 * vs. open bounty in one view instead of three disconnected lists).
 */
export function speciesOwnershipBoard(
  trainers: TrainerProfile[],
): SpeciesOwnershipEntry[] {
  const owners = new Map<number, SpeciesOwnershipHolder[]>();
  const encounteredBy = new Map<number, SpeciesOwnershipHolder[]>();
  const totalSeen = new Map<number, number>();

  for (const trainer of trainers) {
    const ownedHere = new Set<number>();
    const encounteredHere = new Set<number>();

    for (const mon of trainer.pokemon) {
      const dex = resolvePokedexId(mon);
      if (dex == null || dex <= 0) continue;
      totalSeen.set(dex, (totalSeen.get(dex) ?? 0) + 1);

      if (OWNED_SLOTS.has(mon.slot)) {
        if (ownedHere.has(dex)) continue;
        ownedHere.add(dex);
        const list = owners.get(dex) ?? [];
        list.push({
          trainerId: trainer.id,
          trainerHandle: trainer.handle,
          slot: mon.slot === "MAIN" ? "MAIN" : "RESERVE",
        });
        owners.set(dex, list);
      } else if (mon.slot === "ENCOUNTERED" || mon.slot === "GRAVEYARD") {
        if (encounteredHere.has(dex)) continue;
        encounteredHere.add(dex);
        const list = encounteredBy.get(dex) ?? [];
        list.push({
          trainerId: trainer.id,
          trainerHandle: trainer.handle,
          slot: mon.slot,
        });
        encounteredBy.set(dex, list);
      }
    }
  }

  return modernEmeraldNationalIds().map((pokedexId) => {
    const ref = modernEmeraldSpeciesRef(pokedexId);
    const ownerList = owners.get(pokedexId) ?? [];
    const seenList = encounteredBy.get(pokedexId) ?? [];
    const status: SpeciesOwnershipStatus =
      ownerList.length > 0
        ? "owned"
        : seenList.length > 0
          ? "encountered"
          : "untouched";
    return {
      ...ref,
      status,
      owners: ownerList,
      encounteredBy: seenList,
      totalSeen: totalSeen.get(pokedexId) ?? 0,
    };
  });
}

/**
 * Re-tier a season-wide board entry relative to one trainer — owned by them,
 * merely encountered by them, or not on their board at all. Lets "my gaps"
 * be a filter (trainer + status) over `speciesOwnershipBoard` instead of a
 * second data path.
 */
export function personalSpeciesStatus(
  entry: SpeciesOwnershipEntry,
  trainerId: string,
): SpeciesOwnershipStatus {
  if (entry.owners.some((holder) => holder.trainerId === trainerId)) {
    return "owned";
  }
  if (entry.encounteredBy.some((holder) => holder.trainerId === trainerId)) {
    return "encountered";
  }
  return "untouched";
}

export type ExclusiveLineGroup = {
  rootPokedexId: number;
  rootSpecies: string;
  /**
   * True only when one trainer's exclusive entries cover every stage of the
   * real evolution family — not merely every stage present in `entries`.
   */
  singleTrainer: boolean;
  /** Exclusive stages in this line, in dex order (may be incomplete). */
  entries: ExclusiveSpecies[];
};

/** Lowest-dex member of the full evolution family (base / baby form). */
function lineRoot(pokedexId: number): { pokedexId: number; species: string } {
  const family = evolutionFamily(pokedexId);
  const rootId = family[0] ?? pokedexId;
  return { pokedexId: rootId, species: modernEmeraldSpeciesRef(rootId).species };
}

/**
 * Group `exclusiveOwnedSpecies` results by evolution line so a monopoly on
 * a whole family (e.g. every Treecko-line stage) reads as one callout
 * instead of N disconnected single-species rows.
 *
 * Pass the full pack exclusives list — never pre-filter by viewer. Line
 * completeness is evaluated against the full Modern Emerald family, then
 * callers may filter the resulting groups for display.
 */
export function groupExclusivesByLine(
  exclusives: ExclusiveSpecies[],
): ExclusiveLineGroup[] {
  const groups = new Map<number, ExclusiveLineGroup>();

  for (const entry of exclusives) {
    const root = lineRoot(entry.pokedexId);
    const group = groups.get(root.pokedexId) ?? {
      rootPokedexId: root.pokedexId,
      rootSpecies: root.species,
      singleTrainer: false,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(root.pokedexId, group);
  }

  for (const group of groups.values()) {
    group.entries.sort((a, b) => a.pokedexId - b.pokedexId);
    const familyIds = evolutionFamily(group.rootPokedexId);
    const ownedByTrainer = new Map<string, Set<number>>();
    for (const entry of group.entries) {
      const owned = ownedByTrainer.get(entry.trainerId) ?? new Set();
      owned.add(entry.pokedexId);
      ownedByTrainer.set(entry.trainerId, owned);
    }

    group.singleTrainer = [...ownedByTrainer.values()].some((owned) =>
      familyIds.every((id) => owned.has(id)),
    );
  }

  return [...groups.values()].sort(
    (a, b) => a.rootPokedexId - b.rootPokedexId,
  );
}
