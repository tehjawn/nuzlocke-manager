#!/usr/bin/env node
/**
 * Build the tables needed to replay Modern Emerald's randomizers.
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
 * Three other randomizers share that RNG and are emitted here too:
 * - Trainers (`tx_Random_Trainer`, src/battle_main.c) — same call with
 *   `TX_RANDOM_T_TRAINER` and `additionalOffset = trainerNum`. `mapOffset` is
 *   the map the battle happens on, so trainers carry the mapsecs their
 *   `trainerbattle_*` scripts live in.
 * - Statics (`tx_Random_Static`) — `setwildbattle` (CreateScriptedWildMon) and
 *   `givemon` (ScriptGiveMon) reroll; `seteventmon` goes through CreateEventMon
 *   and does **not**, so those legendaries stay vanilla. Both kinds are emitted,
 *   tagged, because "this one is not randomized" is the useful answer.
 * - Starter (`tx_Random_Starter`, src/starter_choose.c) — a different algorithm:
 *   `ShuffleListU16(pool, 12289)` then `pool[starterId * 27]`.
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

/**
 * `gSpeciesMapping`, reproduced exactly — including where the ROM is wrong.
 *
 * Six of the tail entries are written `[SPECIES_X - 1] = …`. That is an
 * off-by-one in the hack, not a convention: `[SPECIES_FARIGIRAF - 1]` lands on
 * Annihilape's slot and, being later in the initializer list, silently
 * overwrites it. The knock-on shift runs to the end of the table and leaves
 * Kleavor with no entry at all (so it zero-fills to `EVO_TYPE_0`).
 *
 * Those wrong slots are what the ROM actually rolls with, so they are copied
 * verbatim: applied in source order, last write wins, zero-filled to
 * `NUM_SPECIES` — anything else would predict a game nobody is playing.
 */
function readEvoSlots(src, speciesIds) {
  const text = readFileSync(join(src, "src/pokemon.c"), "utf8");
  const block = /static const u8 gSpeciesMapping\[[^\]]*\]\s*=\s*\{([\s\S]*?)\n\};/.exec(text);
  if (!block) throw new Error("gSpeciesMapping not found");

  const assignments = [];
  const lines = block[1].split("\n");
  for (const line of lines) {
    // Commented-out entries contribute nothing to the compiled array.
    const code = line.split("//")[0];
    const m = /\[\s*(SPECIES_[A-Z0-9_]+)\s*(?:([-+])\s*(\d+)\s*)?\]\s*=\s*(EVO_TYPE_[A-Z0-9_]+)/.exec(
      code,
    );
    if (!m) continue;
    const base = speciesIds.get(m[1]);
    const slot = EVO_SLOT[m[4]];
    if (base == null || slot == null) continue;
    const offset = m[2] ? Number(m[3]) * (m[2] === "-" ? -1 : 1) : 0;
    assignments.push({ index: base + offset, slot, shifted: offset !== 0 });
  }
  if (assignments.length === 0) throw new Error("gSpeciesMapping parsed empty");

  // `u8 gSpeciesMapping[NUM_SPECIES + 1]`, zero-filled — and 0 is EVO_TYPE_0,
  // which means "roll from the first-stage pool", not "leave alone".
  const size = (speciesIds.get("SPECIES_EGG") ?? Math.max(...assignments.map((a) => a.index))) + 1;
  const table = new Array(size).fill(EVO_SLOT.EVO_TYPE_0);
  const clobbered = [];
  const written = new Set();
  for (const { index, slot } of assignments) {
    if (index < 0 || index >= size) continue;
    if (written.has(index)) clobbered.push(index);
    written.add(index);
    table[index] = slot;
  }
  const shiftedCount = assignments.filter((a) => a.shifted).length;
  return { table, shiftedCount, clobbered };
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

/**
 * Trainer classes worth showing. `gTrainers` has 864 entries; a nuzlocke player
 * plans around the ones that can end a run, so the view is scoped to gym
 * leaders, the Elite Four, the champion, the rival, and the two teams.
 */
const KEY_TRAINER_CLASSES = new Set([
  "TRAINER_CLASS_LEADER",
  "TRAINER_CLASS_ELITE_FOUR",
  "TRAINER_CLASS_CHAMPION",
  "TRAINER_CLASS_RIVAL",
  "TRAINER_CLASS_TEAM_AQUA",
  "TRAINER_CLASS_TEAM_MAGMA",
  "TRAINER_CLASS_AQUA_ADMIN",
  "TRAINER_CLASS_MAGMA_ADMIN",
  "TRAINER_CLASS_AQUA_LEADER",
  "TRAINER_CLASS_MAGMA_LEADER",
]);

function readTrainerIds(src) {
  const text = readFileSync(join(src, "include/constants/opponents.h"), "utf8");
  const byName = new Map();
  for (const m of text.matchAll(/#define\s+(TRAINER_[A-Z0-9_]+)\s+(\d+)/g)) {
    byName.set(m[1], Number(m[2]));
  }
  if (byName.size === 0) throw new Error("no TRAINER_* constants parsed");
  return byName;
}

/** `sParty_<Name>[] = { { .iv, .lvl, .species }, … }` from trainer_parties.h. */
function readTrainerParties(src, speciesIds) {
  const text = readFileSync(join(src, "src/data/trainer_parties.h"), "utf8");
  const byLabel = new Map();
  for (const block of text.matchAll(
    /static const struct \w+ (sParty_\w+)\[\]\s*=\s*\{([\s\S]*?)\n\};/g,
  )) {
    const mons = [];
    for (const mon of block[2].matchAll(
      /\.lvl\s*=\s*(\d+)\s*,[\s\S]*?\.species\s*=\s*(SPECIES_[A-Z0-9_]+)/g,
    )) {
      const id = speciesIds.get(mon[2]);
      if (id != null) mons.push({ species: id, level: Number(mon[1]) });
    }
    if (mons.length > 0) byLabel.set(block[1], mons);
  }
  return byLabel;
}

/**
 * Which mapsec each trainer is fought on — `mapOffset` for a trainer roll is
 * `NuzlockeGetCurrentRegionMapSectionId()` at party-creation time, i.e. wherever
 * the player is standing. A handful of trainers appear in more than one map's
 * scripts; all of them are recorded so the runtime can say when the roll differs
 * by location instead of quietly picking one.
 */
function readTrainerLocations(src, mapToArea, mapsecIds) {
  const mapsDir = join(src, "data/maps");
  const byTrainer = new Map();
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const scripts = join(mapsDir, dir.name, "scripts.inc");
    const mapJson = join(mapsDir, dir.name, "map.json");
    if (!existsSync(scripts) || !existsSync(mapJson)) continue;
    const mapId = JSON.parse(readFileSync(mapJson, "utf8")).id;
    const section = mapToArea.get(mapId);
    const mapsec = section == null ? null : mapsecIds.get(section);
    if (mapsec == null) continue;
    for (const m of readFileSync(scripts, "utf8").matchAll(
      /^\s*trainerbattle\w*\s+(TRAINER_[A-Z0-9_]+)/gm,
    )) {
      const set = byTrainer.get(m[1]) ?? new Set();
      set.add(mapsec);
      byTrainer.set(m[1], set);
    }
  }
  return byTrainer;
}

function readKeyTrainers(src, speciesIds, mapToArea, mapsecIds) {
  const text = readFileSync(join(src, "src/data/trainers.h"), "utf8");
  const trainerIds = readTrainerIds(src);
  const parties = readTrainerParties(src, speciesIds);
  const locations = readTrainerLocations(src, mapToArea, mapsecIds);

  const rows = [];
  for (const block of text.matchAll(
    /\[(TRAINER_[A-Z0-9_]+)\]\s*=\s*\{([\s\S]*?)\n\s*\},/g,
  )) {
    const name = block[1];
    const body = block[2];
    const className = /\.trainerClass\s*=\s*(TRAINER_CLASS_[A-Z0-9_]+)/.exec(body)?.[1];
    if (!className || !KEY_TRAINER_CLASSES.has(className)) continue;
    const id = trainerIds.get(name);
    const partyLabel = /\.party\s*=\s*\w+\((sParty_\w+)\)/.exec(body)?.[1];
    const party = partyLabel ? parties.get(partyLabel) : null;
    if (id == null || !party) continue;
    rows.push({
      id,
      name: /\.trainerName\s*=\s*_\("([^"]*)"\)/.exec(body)?.[1] ?? name,
      constant: name,
      className: className.replace(/^TRAINER_CLASS_/, ""),
      mapsecs: [...(locations.get(name) ?? [])].sort((a, b) => a - b),
      party,
    });
  }

  // Rematch entries (`TRAINER_ROXANNE_2` … `_5`) have no `trainerbattle_*` line
  // of their own — Match Call sends you back to the same gym — so they inherit
  // the location of their numbered sibling. Anything still unplaced keeps an
  // empty list, and the runtime refuses to guess a map-based roll for it.
  const byBase = new Map();
  for (const row of rows) {
    if (row.mapsecs.length === 0) continue;
    const base = row.constant.replace(/_\d+$/, "");
    if (!byBase.has(base)) byBase.set(base, row.mapsecs);
  }
  for (const row of rows) {
    if (row.mapsecs.length > 0) continue;
    const inherited = byBase.get(row.constant.replace(/_\d+$/, ""));
    if (inherited) row.mapsecs = inherited;
  }

  return rows.sort((a, b) => a.id - b.id);
}

/**
 * Scripted encounters, split by whether the ROM actually rerolls them.
 *
 * `setwildbattle` and `givemon` route through CreateScriptedWildMon /
 * ScriptGiveMon, which both call `GetSpeciesRandomSeeded(…, TX_RANDOM_T_STATIC,
 * 0)`. `seteventmon` routes through CreateEnemyEventMon → CreateEventMon →
 * CreateMon with no randomizer call at all, so those legendaries — the Regis,
 * Rayquaza, the Seafloor Cavern pair — are whatever the ROM says even with
 * static randomization on.
 */
const STATIC_COMMAND_KINDS = {
  setwildbattle: { kind: "wild-battle", randomized: true },
  givemon: { kind: "gift", randomized: true },
  seteventmon: { kind: "event", randomized: false },
};

function readStaticEncounters(src, speciesIds, mapToArea, mapsecIds) {
  const mapsDir = join(src, "data/maps");
  const rows = [];
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const scripts = join(mapsDir, dir.name, "scripts.inc");
    const mapJson = join(mapsDir, dir.name, "map.json");
    if (!existsSync(scripts) || !existsSync(mapJson)) continue;
    const mapId = JSON.parse(readFileSync(mapJson, "utf8")).id;
    const section = mapToArea.get(mapId);
    const mapsec = section == null ? null : mapsecIds.get(section);
    if (mapsec == null) continue;
    const seen = new Set();
    for (const m of readFileSync(scripts, "utf8").matchAll(
      /^\s*(setwildbattle|givemon|seteventmon)\s+(SPECIES_[A-Z0-9_]+)\s*,\s*(\d+)/gm,
    )) {
      const meta = STATIC_COMMAND_KINDS[m[1]];
      const species = speciesIds.get(m[2]);
      if (!meta || species == null) continue;
      // The same encounter is often scripted twice (a first visit and a
      // rematch); one row per species/level/kind is what a player cares about.
      const key = `${species}|${m[3]}|${meta.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        mapsec,
        species,
        level: Number(m[3]),
        kind: meta.kind,
        randomized: meta.randomized,
      });
    }
  }
  return rows.sort(
    (a, b) => a.mapsec - b.mapsec || a.species - b.species || a.level - b.level,
  );
}

function main() {
  const src = ensureSource();
  const speciesIds = readSpeciesIds(src);
  const speciesNames = readSpeciesNames(src, speciesIds);
  const { table: speciesToNational, unresolved } = readSpeciesToNational(speciesIds);
  const {
    table: evoSlots,
    shiftedCount,
    clobbered,
  } = readEvoSlots(src, speciesIds);
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
  const keyTrainers = readKeyTrainers(src, speciesIds, mapToArea, mapsecIds);
  const statics = readStaticEncounters(src, speciesIds, mapToArea, mapsecIds);

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
      "export type VanillaTrainerMon = {",
      "  /** Vanilla ROM species id. */",
      "  species: number;",
      "  /** ROM level before `GetScaledLevel` applies difficulty and badge count. */",
      "  level: number;",
      "};",
      "",
      "export type VanillaTrainer = {",
      "  /** `trainerNum` — also the `additionalOffset` fed to the RNG. */",
      "  id: number;",
      "  name: string;",
      "  constant: string;",
      "  /** `TRAINER_CLASS_*` with the prefix stripped. */",
      "  className: string;",
      "  /** Mapsecs whose scripts start this battle; `mapOffset` comes from these. */",
      "  mapsecs: readonly number[];",
      "  party: readonly VanillaTrainerMon[];",
      "};",
      "",
      "/** Gym leaders, Elite Four, champion, rival, and the two teams. */",
      "export const VANILLA_KEY_TRAINERS: readonly VanillaTrainer[] = [",
      ...keyTrainers.map((row) => `  ${JSON.stringify(row)},`),
      "];",
      "",
      "export type VanillaStatic = {",
      "  mapsec: number;",
      "  species: number;",
      "  level: number;",
      '  kind: "wild-battle" | "gift" | "event";',
      "  /** False for `seteventmon`, which the ROM never rerolls. */",
      "  randomized: boolean;",
      "};",
      "",
      "/** Scripted encounters — legendaries, gifts, fossils, in-game trades. */",
      "export const VANILLA_STATICS: readonly VanillaStatic[] = [",
      ...statics.map((row) => `  ${JSON.stringify(row)},`),
      "];",
      "",
      "/**",
      " * `PickRandomStarter` (src/starter_choose.c) shuffles the pool with a fixed",
      " * seed and reads `pool[starterId * 27]`, so only these three indices matter.",
      " */",
      "export const STARTER_POOL_STRIDE = 27;",
      "/** `ShuffleListU16(pool, …, 12289)` — a literal in the ROM, not the seed. */",
      "export const STARTER_SHUFFLE_SEED = 12289;",
      "/** `sStarterMon` — the trio the picker shows when the starter is not randomized. */",
      `export const VANILLA_STARTERS: readonly number[] = ${list(
        ["SPECIES_TREECKO", "SPECIES_TORCHIC", "SPECIES_MUDKIP"].map((n) => {
          const id = speciesIds.get(n);
          if (id == null) throw new Error(`${n} not found`);
          return id;
        }),
      )};`,
      "",
    ].join("\n"),
  );

  const mapsecCount = new Set(rows.map((r) => r.mapsec)).size;
  const placedTrainers = keyTrainers.filter((t) => t.mapsecs.length > 0).length;
  console.error(
    `Wrote ${rows.length} wild tables across ${mapsecCount} mapsecs to ${outPath}\n` +
      `  key trainers: ${keyTrainers.length} (${placedTrainers} located on a map)\n` +
      `  statics: ${statics.filter((s) => s.randomized).length} randomized, ` +
      `${statics.filter((s) => !s.randomized).length} seteventmon (never rerolled)\n` +
      `  pools: evo0=${pools.evo0.length} evo1=${pools.evo1.length} evo2=${pools.evo2.length} ` +
      `legendary=${pools.legendary.length} all=${pools.all.length} allLegendary=${pools.allLegendary.length}\n` +
      `  species mapped to National Dex: ${speciesToNational.filter(Boolean).length}` +
      (unresolved.length ? ` (unresolved: ${unresolved.join(", ")})` : ""),
  );
  if (shiftedCount > 0) {
    console.error(
      `  note: ${shiftedCount} gSpeciesMapping entries use the ROM's off-by-one ` +
        `[SPECIES_X - 1] form` +
        (clobbered.length
          ? `, overwriting ${clobbered.length} earlier slot(s) at index ${clobbered.join(", ")}`
          : "") +
        " — copied as-is.",
    );
  }
  if (driftCount > 0) {
    console.error(
      `  WARNING: ${driftCount} species id(s) disagree with modern-emerald-species.json — ` +
        `rolled species may be mislabeled. Sample: ${driftSample.join("; ")}`,
    );
  }
}

main();
