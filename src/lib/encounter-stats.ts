import { findPokemonByName } from "@/data/pokemon-index";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { buildEncounterLedger } from "@/lib/encounter-ledger";
import {
  modernEmeraldDexTotal,
  modernEmeraldNationalIds,
  modernEmeraldSpeciesRef,
  type ModernEmeraldSpeciesRef,
} from "@/lib/modern-emerald-dex";
import { displayName } from "@/lib/trainer-display";

export type EncounterSpeciesHighlight = {
  species: string;
  pokedexId: number | null;
  count: number;
  tied: boolean;
};

export type EncounterRouteHighlight = {
  route: string;
  claimCount: number;
  trainerCount: number;
  tied: boolean;
};

export type EncounterSeasonHighlights = {
  /** Every live Pokémon row across the season (any slot). */
  totalLogged: number;
  uniqueSpecies: number;
  routesClaimed: number;
  meDexLogged: number;
  meDexTotal: number;
  mostLogged: EncounterSpeciesHighlight | null;
  /** Rarest among species that appear at least once. */
  leastLogged: EncounterSpeciesHighlight | null;
  hottestRoute: EncounterRouteHighlight | null;
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

function toSpeciesHighlight(
  ranked: SpeciesBucket[],
  pick: "most" | "least",
): EncounterSpeciesHighlight | null {
  if (ranked.length === 0) return null;
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
  const top = ordered[0]!;
  const tied = ordered.filter((entry) => entry.count === top.count).length > 1;
  return {
    species: top.species,
    pokedexId: top.pokedexId,
    count: top.count,
    tied,
  };
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
 * Route heat still comes from `catchRoute` via the encounter ledger.
 */
export function encounterSeasonHighlights(
  trainers: TrainerProfile[],
): EncounterSeasonHighlights {
  const speciesCounts = new Map<string, SpeciesBucket>();
  let totalLogged = 0;

  for (const trainer of trainers) {
    for (const mon of trainer.pokemon) {
      totalLogged += 1;
      bumpSpecies(speciesCounts, mon);
    }
  }

  const ranked = [...speciesCounts.values()];
  const ledger = buildEncounterLedger(trainers);

  let hottestRoute: EncounterRouteHighlight | null = null;
  if (ledger.length > 0) {
    const routeRows = ledger.map((group) => {
      const trainerIds = new Set(group.claims.map((c) => c.trainerId));
      return {
        route: group.route,
        claimCount: group.claims.length,
        trainerCount: trainerIds.size,
      };
    });
    routeRows.sort((a, b) => {
      if (b.claimCount !== a.claimCount) return b.claimCount - a.claimCount;
      if (b.trainerCount !== a.trainerCount) {
        return b.trainerCount - a.trainerCount;
      }
      return a.route.localeCompare(b.route);
    });
    const top = routeRows[0]!;
    const tied =
      routeRows.filter((row) => row.claimCount === top.claimCount).length > 1;
    hottestRoute = { ...top, tied };
  }

  const meTotal = modernEmeraldDexTotal();
  const meLogged = [...seasonTouchedPokedexIds(trainers)].filter((id) =>
    modernEmeraldNationalIdSet().has(id),
  ).length;

  return {
    totalLogged,
    uniqueSpecies: ranked.length,
    routesClaimed: ledger.length,
    meDexLogged: meLogged,
    meDexTotal: meTotal,
    mostLogged: toSpeciesHighlight(ranked, "most"),
    leastLogged: toSpeciesHighlight(ranked, "least"),
    hottestRoute,
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

/**
 * ME species missing from a single trainer's board (any slot).
 * Used by Bounty Hunter "My gaps".
 */
export function personalMissingModernEmerald(
  trainers: TrainerProfile[],
  trainerId: string,
): ModernEmeraldSpeciesRef[] {
  const trainer = trainers.find((t) => t.id === trainerId);
  if (!trainer) return modernEmeraldNationalIds().map(modernEmeraldSpeciesRef);
  const mine = trainerTouchedPokedexIds(trainer);
  return modernEmeraldNationalIds()
    .filter((id) => !mine.has(id))
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
      trainerHandle: displayName(only.trainer),
      slot: only.slot,
    });
  }

  return exclusives.sort((a, b) => {
    if (a.pokedexId !== b.pokedexId) return a.pokedexId - b.pokedexId;
    return a.species.localeCompare(b.species);
  });
}
