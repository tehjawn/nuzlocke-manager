/**
 * Replay Modern Emerald's wild-encounter and static randomizers offline.
 *
 * The hack never rewrites the ROM's encounter tables. `CreateWildMon`
 * (src/wild_encounter.c) rerolls the vanilla species at spawn time via
 * `GetSpeciesRandomSeeded(species, TX_RANDOM_T_WILD_POKEMON, 0)`, and the only
 * per-save input to that chain is the player's 32-bit trainer ID. Given the ID
 * and a handful of setting bits — both readable from a save — the entire "what
 * actually spawns where" mapping is reproducible without the ROM.
 *
 * Tables come from `scripts/generate-randomizer-tables.mjs`; this file is only
 * the arithmetic and the two indexes the UI reads.
 */

import { MAPSEC_LABELS } from "@/data/catch-routes.generated";
import {
  EVO_SLOT_0,
  EVO_SLOT_1,
  EVO_SLOT_2,
  EVO_SLOT_LEGENDARY,
  EVO_SLOT_SELF,
  POOL_ALL,
  POOL_ALL_LEGENDARY,
  POOL_EVO_0,
  POOL_EVO_1,
  POOL_EVO_2,
  POOL_EVO_LEGENDARY,
  ROM_SPECIES_TO_NATIONAL,
  SPECIES_EVO_SLOT,
  VANILLA_STATICS,
  VANILLA_WILD_TABLES,
  type VanillaStatic,
  type VanillaWildTable,
} from "@/data/randomizer-tables.generated";
import { CATCH_ROUTE_TABLE, findCatchRoute } from "@/data/catch-routes";
import { evolutionFamily } from "@/lib/species-evolutions";

/** The `tx_Random_*` bits that decide how a species is rerolled. */
export type RandomizerSettings = {
  /** `tx_Random_WildPokemon` — master switch for wild encounters. */
  wildPokemon: boolean;
  /** `tx_Random_Similar` — roll within the species' own evolution stage. */
  similar: boolean;
  /** `tx_Random_MapBased` — fold the area's mapsec into the seed. */
  mapBased: boolean;
  /** `tx_Random_IncludeLegendaries` — legendaries become valid destinations. */
  includeLegendaries: boolean;
  /** `tx_Random_Chaos` — rerolls from live RNG; nothing here can predict it. */
  chaos: boolean;
  /** `tx_Random_Static` — rerolls `setwildbattle` and `givemon` encounters. */
  statics: boolean;
};

export type EncounterKind = VanillaWildTable["kind"];

export type RolledSlot = {
  /** Vanilla ROM species this slot rolls from. */
  vanillaSpecies: number;
  /** National Dex id of the vanilla species (0 when uncatalogued). */
  vanillaPokedexId: number;
  /** ROM species that actually spawns under this seed. */
  species: number;
  /** National Dex id of the spawning species (0 when uncatalogued). */
  pokedexId: number;
  /** True when the randomizer left this slot alone (`EVO_TYPE_SELF`). */
  unchanged: boolean;
  /** Slot probability within its encounter kind, as a percentage. */
  chance: number;
  minLevel: number;
  maxLevel: number;
  /** Fishing only — the rods that reach this slot. */
  rods?: readonly string[];
};

export type RolledArea = {
  /** Nuzlocke MAPSEC id — also the `mapOffset` fed to the RNG. */
  mapsec: number;
  /** Catch-route label, so rolled areas join against logged catches. */
  label: string;
  kind: EncounterKind;
  /** ROM step-encounter rate (higher = more frequent). */
  encounterRate: number;
  slots: RolledSlot[];
};

/** One place a species can be found under a given seed. */
export type SpeciesSource = {
  mapsec: number;
  label: string;
  kind: EncounterKind;
  chance: number;
  minLevel: number;
  maxLevel: number;
  encounterRate: number;
  vanillaPokedexId: number;
  rods?: readonly string[];
};

export type SpeciesSighting = {
  pokedexId: number;
  /** Best source first (highest slot chance, then most frequent area). */
  sources: SpeciesSource[];
};

/** `ISO_RANDOMIZE1` (include/random.h) — `1103515245 * val + 24691`, u32. */
function isoRandomize1(value: number): number {
  return (Math.imul(1103515245, value | 0) + 24691) >>> 0;
}

/** ROM rejection-loop bound in `RandomSeededModulo` (src/random.c). */
const I_MAX = 5;

/**
 * `RandomSeededModulo` (src/random.c).
 *
 * The rejection loop gives up after `I_MAX` tries and returns a biased value —
 * that bias is part of the ROM's behaviour, so it is reproduced rather than
 * corrected.
 */
export function randomSeededModulo(
  value: number,
  modulo: number,
  otId: number,
): number {
  if (modulo <= 0) return 0;
  const randMax = 0xffffffff - (0xffffffff % modulo);
  let result = 0;
  let i = 0;
  do {
    result = isoRandomize1((otId + value + result) >>> 0);
  } while (result >= randMax && ++i !== I_MAX);
  return result % modulo;
}

function poolFor(slot: number, settings: RandomizerSettings): readonly number[] {
  if (!settings.similar) {
    return settings.includeLegendaries ? POOL_ALL_LEGENDARY : POOL_ALL;
  }
  switch (slot) {
    case EVO_SLOT_0:
      return POOL_EVO_0;
    case EVO_SLOT_1:
      return POOL_EVO_1;
    case EVO_SLOT_2:
      return POOL_EVO_2;
    case EVO_SLOT_LEGENDARY:
      return POOL_EVO_LEGENDARY;
    default:
      return POOL_EVO_0;
  }
}

/**
 * `GetSpeciesRandomSeeded(species, type, 0)`.
 *
 * Wild and static rolls share this body and differ only in which setting bit
 * gates the call. (The ROM's other types pass a non-zero `additionalOffset` —
 * `trainerNum` for trainer parties — which nothing here needs.) Returns the
 * species unchanged whenever the ROM would: an `EVO_TYPE_SELF` species, or a
 * legendary while legendaries are excluded. Chaos mode is *not* modelled —
 * callers must check `settings.chaos` first, because the ROM draws from live
 * RNG there and no offline answer exists.
 */
function rollSpecies(
  romSpecies: number,
  mapsec: number,
  otId: number,
  settings: RandomizerSettings,
): number {
  // The table covers 0…NUM_SPECIES; only a species id the ROM does not have
  // falls through, and leaving those alone beats rolling on a garbage slot.
  const slot = SPECIES_EVO_SLOT[romSpecies] ?? EVO_SLOT_SELF;
  if (slot === EVO_SLOT_SELF) return romSpecies;
  if (slot === EVO_SLOT_LEGENDARY && !settings.includeLegendaries) {
    return romSpecies;
  }
  const pool = poolFor(slot, settings);
  const mapOffset = settings.mapBased ? mapsec : 0;
  return (
    pool[randomSeededModulo(romSpecies + mapOffset, pool.length, otId)] ?? romSpecies
  );
}

/** `GetSpeciesRandomSeeded(species, TX_RANDOM_T_WILD_POKEMON, 0)`. */
export function randomizeWildSpecies(
  romSpecies: number,
  mapsec: number,
  otId: number,
  settings: RandomizerSettings,
): number {
  if (!settings.wildPokemon) return romSpecies;
  return rollSpecies(romSpecies, mapsec, otId, settings);
}

function nationalFor(romSpecies: number): number {
  return ROM_SPECIES_TO_NATIONAL[romSpecies] ?? 0;
}

/**
 * Every wild table in the game, with each slot resolved to what this seed
 * actually spawns there. Areas with no catch-route label are dropped — they
 * cannot be joined to anything a player logs.
 */
export function rollWildTables(
  otId: number,
  settings: RandomizerSettings,
): RolledArea[] {
  const areas: RolledArea[] = [];
  for (const table of VANILLA_WILD_TABLES) {
    const label = MAPSEC_LABELS[table.mapsec];
    if (!label) continue;
    const slots = table.mons.map((mon) => {
      const species = randomizeWildSpecies(mon.species, table.mapsec, otId, settings);
      return {
        vanillaSpecies: mon.species,
        vanillaPokedexId: nationalFor(mon.species),
        species,
        pokedexId: nationalFor(species),
        unchanged: species === mon.species,
        chance: mon.chance,
        minLevel: mon.minLevel,
        maxLevel: mon.maxLevel,
        ...(mon.rods ? { rods: mon.rods } : {}),
      };
    });
    areas.push({
      mapsec: table.mapsec,
      label,
      kind: table.kind,
      encounterRate: table.encounterRate,
      slots,
    });
  }
  return areas;
}

/**
 * Invert the rolled tables: species → where it spawns, best source first.
 *
 * This is the view that answers "I need a Water type, where do I go" — the
 * question a randomized run makes unanswerable from vanilla route data.
 */
export function indexBySpecies(areas: readonly RolledArea[]): SpeciesSighting[] {
  const byDex = new Map<number, SpeciesSource[]>();
  for (const area of areas) {
    for (const slot of area.slots) {
      if (!slot.pokedexId) continue;
      const list = byDex.get(slot.pokedexId) ?? [];
      list.push({
        mapsec: area.mapsec,
        label: area.label,
        kind: area.kind,
        chance: slot.chance,
        minLevel: slot.minLevel,
        maxLevel: slot.maxLevel,
        encounterRate: area.encounterRate,
        vanillaPokedexId: slot.vanillaPokedexId,
        ...(slot.rods ? { rods: slot.rods } : {}),
      });
      byDex.set(slot.pokedexId, list);
    }
  }
  return [...byDex.entries()]
    .map(([pokedexId, sources]) => ({
      pokedexId,
      sources: sources.sort(
        (a, b) => b.chance - a.chance || b.encounterRate - a.encounterRate,
      ),
    }))
    .sort((a, b) => a.pokedexId - b.pokedexId);
}

export type RolledStatic = {
  label: string;
  mapsec: number;
  kind: VanillaStatic["kind"];
  level: number;
  vanillaSpecies: number;
  vanillaPokedexId: number;
  species: number;
  pokedexId: number;
  /** False for `seteventmon`, which the ROM never rerolls. */
  randomized: boolean;
  /** True when the script sets `FLAG_SYS_NO_CATCHING` around this fight. */
  noCatching: boolean;
};

/**
 * Scripted encounters — legendaries, fossils, gifts, in-game trades.
 *
 * `seteventmon` rows are included on purpose even though the ROM leaves them
 * alone: "the Regis are still the Regis" is the answer a player needs, and it
 * is not something the wild tables can tell them.
 */
export function rollStatics(
  otId: number,
  settings: RandomizerSettings,
): RolledStatic[] {
  return VANILLA_STATICS.filter((entry) => MAPSEC_LABELS[entry.mapsec]).map(
    (entry) => {
      const species =
        entry.randomized && settings.statics
          ? rollSpecies(entry.species, entry.mapsec, otId, settings)
          : entry.species;
      return {
        label: MAPSEC_LABELS[entry.mapsec]!,
        mapsec: entry.mapsec,
        kind: entry.kind,
        level: entry.level,
        vanillaSpecies: entry.species,
        vanillaPokedexId: nationalFor(entry.species),
        species,
        pokedexId: nationalFor(species),
        randomized: entry.randomized && settings.statics,
        noCatching: entry.noCatching === true,
      };
    },
  );
}

export type SeedCheckEntry = {
  pokedexId: number;
  species: string;
  route: string;
  /** "exact" — the seed spawns this species; "family" — it spawns a relative. */
  match: "exact" | "family" | "none";
  /** What the seed does put on that route, when the catch does not match. */
  expected: number[];
};

export type SeedCheck = {
  /** Catches that could be checked (a wild route with a rolled table). */
  checked: number;
  matched: number;
  entries: SeedCheckEntry[];
  /** Catches skipped because the route has no wild table (gifts, fossils, trades). */
  skipped: number;
};

/**
 * Score a seed against the trainer's own logged catches.
 *
 * The pools are pinned to one upstream commit of Modern Emerald. If a player is
 * on an older build the pools shift and every answer here is quietly wrong, so
 * the tool refuses to look confident without evidence: replay the seed against
 * catches the player already made and report how many line up.
 *
 * A catch counts as a "family" match when the seed rolls a relative of it —
 * high-level slots spawn already-evolved, and the tables store the base roll.
 */
export function checkSeedAgainstCatches(
  areas: readonly RolledArea[],
  catches: readonly { pokedexId: number; species: string; catchRoute: string | null }[],
): SeedCheck {
  const byLabel = new Map<string, Set<number>>();
  for (const area of areas) {
    const set = byLabel.get(area.label) ?? new Set<number>();
    for (const slot of area.slots) if (slot.pokedexId) set.add(slot.pokedexId);
    byLabel.set(area.label, set);
  }

  const entries: SeedCheckEntry[] = [];
  let skipped = 0;
  for (const mon of catches) {
    const route = findCatchRoute(mon.catchRoute);
    const expected = route ? byLabel.get(route.label) : undefined;
    if (!route || !expected || expected.size === 0) {
      skipped += 1;
      continue;
    }
    const match = expected.has(mon.pokedexId)
      ? "exact"
      : evolutionFamily(mon.pokedexId).some((id) => expected.has(id))
        ? "family"
        : "none";
    entries.push({
      pokedexId: mon.pokedexId,
      species: mon.species,
      route: route.label,
      match,
      expected: [...expected].sort((a, b) => a - b),
    });
  }

  return {
    checked: entries.length,
    matched: entries.filter((e) => e.match !== "none").length,
    entries,
    skipped,
  };
}

/** Human-readable summary of which knobs are on, for the seed header. */
export function describeSettings(settings: RandomizerSettings): string[] {
  const chips: string[] = [];
  chips.push(settings.wildPokemon ? "Wild Pokémon randomized" : "Wild Pokémon vanilla");
  if (settings.chaos) chips.push("Chaos");
  if (settings.statics) chips.push("Statics randomized");
  if (settings.wildPokemon || settings.statics) {
    chips.push(settings.similar ? "Similar evolution stage" : "Any species");
    chips.push(settings.mapBased ? "Map-based" : "Global mapping");
    chips.push(
      settings.includeLegendaries ? "Legendaries included" : "Legendaries excluded",
    );
  }
  return chips;
}

/** A species the player already owns, and whether it is the exact catch. */
export type CaughtState = "caught" | "line" | null;

/**
 * Index the player's own Pokémon so the encounter views can say "you have this
 * already". Evolution families are folded in: a rolled Zubat is not worth a
 * route slot to someone already carrying a Crobat.
 */
export function buildCaughtIndex(
  caught: readonly { pokedexId: number }[],
): (pokedexId: number) => CaughtState {
  const exact = new Set<number>();
  const family = new Set<number>();
  for (const mon of caught) {
    if (!mon.pokedexId) continue;
    exact.add(mon.pokedexId);
    for (const id of evolutionFamily(mon.pokedexId)) family.add(id);
  }
  return (pokedexId: number) =>
    exact.has(pokedexId) ? "caught" : family.has(pokedexId) ? "line" : null;
}

/**
 * Route labels whose encounter slot the player has already spent.
 *
 * The ROM tracks this itself in `NuzlockeEncounterFlags`, so this reads the
 * truth rather than inferring it from stored `catchRoute` strings — a failed
 * catch still burns the slot, and the flags know that.
 *
 * Only the label whose own `nuzlockeBit` is set is marked. We deliberately do
 * **not** expand across `slotKey` / `aliasesRoute101` siblings (Scorched Slab,
 * Navel Rock, … share Route 101's bit 0 in the ROM) — painting every alias as
 * "spent" with the early-route catch is wrong for the seed-scanner UI.
 */
export function buildUsedRouteIndex(
  usedEncounterBits: readonly number[],
): (label: string) => boolean {
  const bits = new Set(usedEncounterBits);
  const usedLabels = new Set<string>();
  for (const route of CATCH_ROUTE_TABLE) {
    if (route.nuzlockeBit != null && bits.has(route.nuzlockeBit)) {
      usedLabels.add(route.label);
    }
  }
  return (label: string) => usedLabels.has(label);
}

/**
 * Which Pokémon (if any) logged a catch on each route label.
 *
 * Used for the seed parser's route accordion chrome — when the slot is spent
 * and we know who they caught there, show that sprite next to the checkmark.
 * Only the Pokémon's own catch-route label is mapped; shared `slotKey` aliases
 * are not.
 */
export function buildSlotPokemonIndex(
  caught: readonly { pokedexId: number; catchRoute: string | null }[],
): (label: string) => number | null {
  const byLabel = new Map<string, number>();
  for (const mon of caught) {
    if (!mon.pokedexId) continue;
    const route = findCatchRoute(mon.catchRoute);
    if (!route) continue;
    if (!byLabel.has(route.label)) byLabel.set(route.label, mon.pokedexId);
  }
  return (label: string) => byLabel.get(label) ?? null;
}
