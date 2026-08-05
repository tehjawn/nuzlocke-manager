#!/usr/bin/env node
/**
 * Build the tables needed to replay Modern Emerald's wild-encounter randomizer.
 *
 * The hack does not rewrite encounter tables in the ROM. `CreateWildMon`
 * (src/wild_encounter.c) rerolls each species at spawn time through
 * `GetSpeciesRandomSeeded(species, TX_RANDOM_T_WILD_POKEMON, 0)`
 * (src/pokemon.c), which bottoms out in:
 *
 *   RandomSeededModulo(value, modulo):
 *     result = ISO_RANDOMIZE1(otId + value + result)   // 1103515245*x + 24691
 *     return result % modulo
 *
 * The only per-save input is the player's 32-bit trainer ID, so the whole
 * mapping is reproducible offline from the vanilla tables plus five setting
 * bits. This generator emits everything that replay needs; the arithmetic
 * itself lives in `src/lib/tx-randomizer.ts`.
 *
 * Ground truth, in priority order:
 * - `sRandomSpeciesEvo{0,1,2,Legendary}` / `sRandomSpecies` /
 *   `sRandomSpeciesLegendary` (src/pokemon.c) — the destination pools.
 * - `gSpeciesMapping` (src/pokemon.c) — evolution stage per species, which
 *   picks the pool and short-circuits `EVO_TYPE_SELF` to "unrandomized".
 * - `src/data/wild_encounters.json` × `data/maps/<Map>/map.json` — the vanilla
 *   tables and their slot rates, keyed by the mapsec each map resolves to.
 * - `NuzlockeGetCurrentRegionMapSectionId` (src/overworld.c) — `mapOffset` uses
 *   the *nuzlocke* mapsec, so the six Safari sub-areas roll on their synthesized
 *   0xD8–0xDD ids rather than the umbrella Safari mapsec.
 *
 * Usage:
 *   node scripts/generate-randomizer-tables.mjs [path/to/pokeemerald]
 *
 * Defaults to .tmp/modern-emerald if present, else fetches the tarball.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/randomizer-tables.generated.ts");
const catalogPath = join(root, "src/data/pokemon.json");
const tmpDir = join(root, ".tmp");
const localRoot = process.argv[2] ?? join(tmpDir, "modern-emerald");
const TARBALL_URL =
  "https://codeload.github.com/resetes12/pokeemerald/tar.gz/refs/heads/master";

/** `gSpeciesMapping` values (src/pokemon.c). */
const EVO_SLOT = {
  EVO_TYPE_0: 0,
  EVO_TYPE_1: 1,
  EVO_TYPE_2: 2,
  EVO_TYPE_SELF: 3,
  EVO_TYPE_LEGENDARY: 4,
};

/** SPECIES_* names whose default slug does not match pokemon.json. */
const SPECIES_SLUG_ALIASES = {
  DEOXYS: "deoxys-normal",
  DUDUNSPARCE: "dudunsparce-two-segment",
  WORMADAM: "wormadam-plant",
  BASCUIN: "basculin-red-striped",
  BASCULIN: "basculin-red-striped",
};

const ENCOUNTER_FIELDS = {
  land_mons: "land",
  water_mons: "water",
  rock_smash_mons: "rock-smash",
  fishing_mons: "fishing",
};

function ensureSource() {
  if (existsSync(join(localRoot, "src/pokemon.c"))) return localRoot;
  if (localRoot !== join(tmpDir, "modern-emerald")) {
    throw new Error(`No pokeemerald checkout at ${localRoot}`);
  }
  console.error(`Fetching ${TARBALL_URL} …`);
  mkdirSync(tmpDir, { recursive: true });
  const tarball = join(tmpDir, "modern-emerald.tar.gz");
  execFileSync("curl", ["-sSL", "-o", tarball, TARBALL_URL], { stdio: "inherit" });
  mkdirSync(localRoot, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", localRoot, "--strip-components=1"], {
    stdio: "inherit",
  });
  return localRoot;
}

function readSpeciesIds(src) {
  const text = readFileSync(join(src, "include/constants/species.h"), "utf8");
  const byName = new Map();
  for (const m of text.matchAll(/#define\s+(SPECIES_[A-Z0-9_]+)\s+(\d+)/g)) {
    byName.set(m[1], Number(m[2]));
  }
  if (byName.size === 0) throw new Error("no SPECIES_* constants parsed");
  return byName;
}

function readSpeciesNames(src, speciesIds) {
  const text = readFileSync(join(src, "src/data/text/species_names.h"), "utf8");
  const byId = new Map();
  for (const m of text.matchAll(/\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*_\("([^"]*)"\)/g)) {
    const id = speciesIds.get(m[1]);
    if (id != null) byId.set(id, m[2]);
  }
  return byId;
}

/**
 * ROM species id → real National Dex id, via the shared pokemon.json catalog.
 * The parser already ships `MODERN_SPECIES_TO_NATIONAL`, but that table is
 * generated from a *different* fork (chethtrayen/nzl_modern). Deriving our own
 * from the same tree the pools come from keeps a fork divergence from silently
 * mislabeling every rolled species; `main()` diffs the two and reports.
 */
function readSpeciesToNational(speciesIds) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const bySlug = new Map();
  for (const p of catalog.pokemon) if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);

  const resolve = (bare) => {
    const slug = SPECIES_SLUG_ALIASES[bare] ?? bare.toLowerCase().replaceAll("_", "-");
    const exact = bySlug.get(slug);
    if (exact) return exact.pokedexId;
    for (const p of bySlug.values()) {
      if (p.slug.startsWith(`${slug}-`) && !p.isForme) return p.pokedexId;
    }
    for (const p of bySlug.values()) {
      if (p.slug.startsWith(`${slug}-`)) return p.pokedexId;
    }
    return null;
  };

  const table = [];
  const unresolved = [];
  for (const [name, id] of speciesIds) {
    const bare = name.replace(/^SPECIES_/, "");
    if (
      bare === "NONE" ||
      bare === "EGG" ||
      bare === "SHINY_TAG" ||
      bare === "TEST" ||
      bare.startsWith("OLD_UNOWN") ||
      bare.startsWith("UNUSED")
    ) {
      continue;
    }
    const nd = resolve(bare);
    if (nd == null) {
      unresolved.push(bare);
      continue;
    }
    table[id] = nd;
  }
  for (let i = 0; i < table.length; i++) if (table[i] == null) table[i] = 0;
  return { table, unresolved };
}

function readEvoSlots(src, speciesIds) {
  const text = readFileSync(join(src, "src/pokemon.c"), "utf8");
  const block = /static const u8 gSpeciesMapping\[[^\]]*\]\s*=\s*\{([\s\S]*?)\n\};/.exec(text);
  if (!block) throw new Error("gSpeciesMapping not found");
  const table = [];
  for (const m of block[1].matchAll(/\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*(EVO_TYPE_[A-Z0-9_]+)/g)) {
    const id = speciesIds.get(m[1]);
    const slot = EVO_SLOT[m[2]];
    if (id != null && slot != null) table[id] = slot;
  }
  if (table.length === 0) throw new Error("gSpeciesMapping parsed empty");
  // Unlisted ids are zero-filled by the C designated initializer, which is
  // EVO_TYPE_0 — not "unrandomized". Mirror that instead of guessing SELF.
  for (let i = 0; i < table.length; i++) if (table[i] == null) table[i] = EVO_SLOT.EVO_TYPE_0;
  return table;
}

function readPool(src, name, speciesIds) {
  const text = readFileSync(join(src, "src/pokemon.c"), "utf8");
  const block = new RegExp(`static const u16 ${name}\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(
    text,
  );
  if (!block) throw new Error(`${name} not found`);
  const out = [];
  for (const line of block[1].split("\n")) {
    // Every entry carries a trailing `//= EVO_TYPE_n` comment; stripping it
    // first keeps commented-out species (the file's tail) out of the pool.
    for (const m of line.split("//")[0].matchAll(/\b(SPECIES_[A-Z0-9_]+)\b/g)) {
      const id = speciesIds.get(m[1]);
      if (id != null) out.push(id);
    }
  }
  if (out.length === 0) throw new Error(`${name} parsed empty`);
  return out;
}

function readMapsecIds(src) {
  const text = readFileSync(join(src, "include/constants/region_map_sections.h"), "utf8");
  const byName = new Map();
  for (const m of text.matchAll(/#define\s+(MAPSEC_\w+)\s+(0x[0-9A-Fa-f]+|\d+)/g)) {
    byName.set(m[1], Number(m[2]));
  }
  if (byName.size === 0) throw new Error("no MAPSEC constants parsed");
  return byName;
}

/**
 * `mapOffset` in `GetRandomSpecies` is `NuzlockeGetCurrentRegionMapSectionId()`,
 * not the on-disk `region_map_section`. Same remap the catch-route generator
 * applies — kept independent so neither generator has to import the other.
 */
function readNuzlockeRemap(src) {
  const text = readFileSync(join(src, "src/overworld.c"), "utf8");
  const fn = /u8 NuzlockeGetCurrentRegionMapSectionId\(void\)[\s\S]*?\n\}/.exec(text);
  if (!fn) throw new Error("NuzlockeGetCurrentRegionMapSectionId not found");
  const byMap = new Map();
  for (const m of fn[0].matchAll(/case MAP_NUM\((\w+)\):\s*\n\s*return\s+(MAPSEC_\w+);/g)) {
    byMap.set(`MAP_${m[1]}`, m[2]);
  }
  if (byMap.size === 0) throw new Error("nuzlocke remap parsed empty");
  return byMap;
}

function readMapToSection(src) {
  const mapsDir = join(src, "data/maps");
  const byMap = new Map();
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(mapsDir, dir.name, "map.json");
    if (!existsSync(file)) continue;
    const json = JSON.parse(readFileSync(file, "utf8"));
    if (json.id && json.region_map_section) byMap.set(json.id, json.region_map_section);
  }
  return byMap;
}

/** Per-slot encounter chance as a percentage, straight from the field's rates. */
function slotChances(field) {
  const rates = field.encounter_rates ?? [];
  if (!field.groups) {
    const total = rates.reduce((a, b) => a + b, 0) || 1;
    return rates.map((r) => ({ chance: (r / total) * 100, group: null }));
  }
  // Fishing slots are scoped to a rod; a slot's chance is relative to its own
  // rod's total, because you only ever roll within one rod's window.
  const out = rates.map(() => ({ chance: 0, group: null }));
  for (const [group, indices] of Object.entries(field.groups)) {
    const total = indices.reduce((a, i) => a + (rates[i] ?? 0), 0) || 1;
    for (const i of indices) {
      out[i] = { chance: ((rates[i] ?? 0) / total) * 100, group };
    }
  }
  return out;
}

/**
 * Vanilla wild tables collapsed to one row per (nuzlocke mapsec, encounter kind).
 *
 * A mapsec can span several maps (Route 119's three sub-maps, Meteor Falls'
 * two floors under one id). Their tables are merged by species: chance takes
 * the max across maps and the level range takes the union, so the row answers
 * "what can appear somewhere in this area" rather than pretending the area has
 * a single table.
 */
function readWildTables(src, mapToArea, mapsecIds) {
  const json = JSON.parse(readFileSync(join(src, "src/data/wild_encounters.json"), "utf8"));
  const group = (json.wild_encounter_groups ?? []).find((g) => g.for_maps);
  if (!group) throw new Error("no for_maps wild encounter group");
  const chancesByField = new Map();
  for (const field of group.fields ?? []) chancesByField.set(field.type, slotChances(field));

  /** `${mapsec}|${kind}` → Map<species, row> */
  const areas = new Map();
  for (const entry of group.encounters ?? []) {
    const section = mapToArea.get(entry.map);
    const mapsec = section == null ? null : mapsecIds.get(section);
    if (mapsec == null) continue;
    for (const [fieldName, kind] of Object.entries(ENCOUNTER_FIELDS)) {
      const field = entry[fieldName];
      if (!field) continue;
      const chances = chancesByField.get(fieldName) ?? [];
      const key = `${mapsec}|${kind}`;
      let bySpecies = areas.get(key);
      if (!bySpecies) {
        bySpecies = { mapsec, kind, encounterRate: field.encounter_rate ?? 0, mons: new Map() };
        areas.set(key, bySpecies);
      }
      bySpecies.encounterRate = Math.max(bySpecies.encounterRate, field.encounter_rate ?? 0);
      field.mons.forEach((mon, index) => {
        const slot = chances[index] ?? { chance: 0, group: null };
        const prev = bySpecies.mons.get(mon.species);
        if (prev) {
          prev.chance = Math.max(prev.chance, slot.chance);
          prev.minLevel = Math.min(prev.minLevel, mon.min_level);
          prev.maxLevel = Math.max(prev.maxLevel, mon.max_level);
          if (slot.group && !prev.groups.includes(slot.group)) prev.groups.push(slot.group);
        } else {
          bySpecies.mons.set(mon.species, {
            speciesName: mon.species,
            chance: slot.chance,
            minLevel: mon.min_level,
            maxLevel: mon.max_level,
            groups: slot.group ? [slot.group] : [],
          });
        }
      });
    }
  }
  return areas;
}

function main() {
  const src = ensureSource();
  const speciesIds = readSpeciesIds(src);
  const speciesNames = readSpeciesNames(src, speciesIds);
  const { table: speciesToNational, unresolved } = readSpeciesToNational(speciesIds);
  const evoSlots = readEvoSlots(src, speciesIds);
  const pools = {
    evo0: readPool(src, "sRandomSpeciesEvo0", speciesIds),
    evo1: readPool(src, "sRandomSpeciesEvo1", speciesIds),
    evo2: readPool(src, "sRandomSpeciesEvo2", speciesIds),
    legendary: readPool(src, "sRandomSpeciesEvoLegendary", speciesIds),
    all: readPool(src, "sRandomSpecies", speciesIds),
    allLegendary: readPool(src, "sRandomSpeciesLegendary", speciesIds),
  };

  const mapsecIds = readMapsecIds(src);
  const mapToSection = readMapToSection(src);
  const remap = readNuzlockeRemap(src);
  const mapToArea = new Map(mapToSection);
  for (const [map, section] of remap) if (mapToArea.has(map)) mapToArea.set(map, section);

  const areas = readWildTables(src, mapToArea, mapsecIds);

  const rows = [...areas.values()]
    .map((area) => ({
      mapsec: area.mapsec,
      kind: area.kind,
      encounterRate: area.encounterRate,
      mons: [...area.mons.values()]
        .map((mon) => {
          const id = speciesIds.get(mon.speciesName);
          if (id == null) return null;
          return {
            species: id,
            chance: Math.round(mon.chance * 10) / 10,
            minLevel: mon.minLevel,
            maxLevel: mon.maxLevel,
            ...(mon.groups.length ? { rods: mon.groups.sort() } : {}),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.chance - a.chance || a.species - b.species),
    }))
    .filter((row) => row.mons.length > 0)
    .sort((a, b) => a.mapsec - b.mapsec || a.kind.localeCompare(b.kind));

  // Drift check against the table the save parser already uses. A mismatch
  // means the two forks disagree about a species id and rolled results would be
  // labeled with the wrong Pokémon — loud, because it is silent otherwise.
  let driftCount = 0;
  const driftSample = [];
  try {
    const shipped = JSON.parse(
      readFileSync(join(root, "src/data/modern-emerald-species.json"), "utf8"),
    ).table;
    for (let id = 1; id < Math.min(shipped.length, speciesToNational.length); id++) {
      if (!shipped[id] || !speciesToNational[id]) continue;
      if (shipped[id] !== speciesToNational[id]) {
        driftCount += 1;
        if (driftSample.length < 8) {
          driftSample.push(`${speciesNames.get(id) ?? id}: ${shipped[id]} vs ${speciesToNational[id]}`);
        }
      }
    }
  } catch {
    // No shipped table yet — nothing to cross-check.
  }

  const list = (values) => `[${values.join(", ")}]`;
  writeFileSync(
    outPath,
    [
      "// Generated by scripts/generate-randomizer-tables.mjs from resetes12/pokeemerald",
      "// (Modern Emerald). Do not edit by hand — run `npm run data:randomizer`.",
      "//",
      "// Replay logic lives in src/lib/tx-randomizer.ts.",
      "",
      "/** `gSpeciesMapping` slots — which pool a species is rerolled from. */",
      "export const EVO_SLOT_0 = 0;",
      "export const EVO_SLOT_1 = 1;",
      "export const EVO_SLOT_2 = 2;",
      "/** Never randomized: `GetSpeciesRandomSeeded` returns the species as-is. */",
      "export const EVO_SLOT_SELF = 3;",
      "export const EVO_SLOT_LEGENDARY = 4;",
      "",
      "/** ROM species id → real National Dex id (0 when the catalog has no row). */",
      `export const ROM_SPECIES_TO_NATIONAL: readonly number[] = ${list(speciesToNational)};`,
      "",
      "/** ROM species id → `gSpeciesMapping` slot. */",
      `export const SPECIES_EVO_SLOT: readonly number[] = ${list(evoSlots)};`,
      "",
      "/** `sRandomSpeciesEvo0` — destinations for first-stage species. */",
      `export const POOL_EVO_0: readonly number[] = ${list(pools.evo0)};`,
      "/** `sRandomSpeciesEvo1` — destinations for middle-stage species. */",
      `export const POOL_EVO_1: readonly number[] = ${list(pools.evo1)};`,
      "/** `sRandomSpeciesEvo2` — destinations for final-stage species. */",
      `export const POOL_EVO_2: readonly number[] = ${list(pools.evo2)};`,
      "/** `sRandomSpeciesEvoLegendary` — only reachable with legendaries enabled. */",
      `export const POOL_EVO_LEGENDARY: readonly number[] = ${list(pools.legendary)};`,
      "/** `sRandomSpecies` — flat pool used when 'similar' is off. */",
      `export const POOL_ALL: readonly number[] = ${list(pools.all)};`,
      "/** `sRandomSpeciesLegendary` — flat pool + legendaries (also the chaos pool). */",
      `export const POOL_ALL_LEGENDARY: readonly number[] = ${list(pools.allLegendary)};`,
      "",
      "export type VanillaWildSlot = {",
      "  /** Rolled-from ROM species id. */",
      "  species: number;",
      "  /** Slot probability within this encounter kind, as a percentage. */",
      "  chance: number;",
      "  minLevel: number;",
      "  maxLevel: number;",
      "  /** Fishing only — which rods reach this slot. */",
      "  rods?: readonly string[];",
      "};",
      "",
      "export type VanillaWildTable = {",
      "  /** Nuzlocke MAPSEC id — also the `mapOffset` fed to the RNG. */",
      "  mapsec: number;",
      '  kind: "land" | "water" | "rock-smash" | "fishing";',
      "  /** ROM step-encounter rate for the area (higher = more frequent). */",
      "  encounterRate: number;",
      "  mons: readonly VanillaWildSlot[];",
      "};",
      "",
      "/** Vanilla tables, merged per nuzlocke mapsec. */",
      "export const VANILLA_WILD_TABLES: readonly VanillaWildTable[] = [",
      ...rows.map((row) => `  ${JSON.stringify(row)},`),
      "];",
      "",
    ].join("\n"),
  );

  const mapsecCount = new Set(rows.map((r) => r.mapsec)).size;
  console.error(
    `Wrote ${rows.length} wild tables across ${mapsecCount} mapsecs to ${outPath}\n` +
      `  pools: evo0=${pools.evo0.length} evo1=${pools.evo1.length} evo2=${pools.evo2.length} ` +
      `legendary=${pools.legendary.length} all=${pools.all.length} allLegendary=${pools.allLegendary.length}\n` +
      `  species mapped to National Dex: ${speciesToNational.filter(Boolean).length}` +
      (unresolved.length ? ` (unresolved: ${unresolved.join(", ")})` : ""),
  );
  if (driftCount > 0) {
    console.error(
      `  WARNING: ${driftCount} species id(s) disagree with modern-emerald-species.json — ` +
        `rolled species may be mislabeled. Sample: ${driftSample.join("; ")}`,
    );
  }
}

main();
