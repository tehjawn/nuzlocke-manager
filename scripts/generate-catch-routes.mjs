#!/usr/bin/env node
/**
 * Build the catch-route catalog from Modern Emerald's own tables.
 *
 * The catalog used to be a hand-written "common Hoenn locations" list. It drifted:
 * it carried ~24 entries that are not encounter areas at all (they sat in the
 * player-facing "open routes" list forever), and it was missing three areas the
 * hack added by repurposing dead FRLG mapsec slots.
 *
 * Ground truth, in priority order:
 * - `NuzlockeLUT` (src/tx_randomizer_and_challenges.c) — the ROM's own definition
 *   of a nuzlocke encounter area. MAPSEC → encounter-flag bit, 70 entries.
 * - `src/data/wild_encounters.json` × `data/maps/<Map>/map.json` — which mapsecs
 *   actually have a wild table, and of which kind.
 * - `data/maps/<Map>/scripts.inc` — gift / fossil / `seteventmon` statics, so a
 *   location with a legendary but no wild table is classified honestly.
 * - `src/data/region_map/region_map_sections.json` — in-game display names.
 *
 * Met location is stamped with the *plain* `GetCurrentRegionMapSectionId()`
 * (src/pokemon.c), never the nuzlocke variant, so the six Safari sub-areas
 * (0xD8–0xDD, synthesized at runtime) can only ever be claimed from the
 * encounter flags. That is why rows carry `claimSource`.
 *
 * Usage:
 *   node scripts/generate-catch-routes.mjs [path/to/pokeemerald]
 *
 * Defaults to .tmp/modern-emerald if present, else fetches the tarball.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/catch-routes.generated.ts");
const tmpDir = join(root, ".tmp");
const localRoot = process.argv[2] ?? join(tmpDir, "modern-emerald");
const TARBALL_URL =
  "https://codeload.github.com/resetes12/pokeemerald/tar.gz/refs/heads/master";

/**
 * Labels we must keep verbatim: trainers already have these strings stored in
 * `Pokemon.catchRoute`, and route matching is plain normalized-string equality.
 * Anything not listed here takes the ROM's own display name.
 */
const LABEL_OVERRIDES = {
  // Runtime-only Safari sub-areas. `NuzlockeGetCurrentRegionMapSectionId`
  // (src/overworld.c) maps SAFARI_ZONE_SOUTH → AREA1 … NORTHEAST → AREA6; the
  // ROM has no region-map name for them, and these strings are already stored
  // on existing Pokemon rows.
  0xd8: "Safari Zone (South)",
  0xd9: "Safari Zone (Southwest)",
  0xda: "Safari Zone (Northwest)",
  0xdb: "Safari Zone (North)",
  0xdc: "Safari Zone (Southeast)",
  0xdd: "Safari Zone (Northeast)",
  0x37: "Granite Cave",
  0x3f: "Meteor Falls",
  0x40: "Meteor Falls",
  0x41: "Mt. Pyre",
  0x4a: "Fiery Path",
  0x4b: "Fiery Path",
  0x4c: "Jagged Pass",
  0x4d: "Jagged Pass",
  // Known under-count: the ROM shows every underwater section as plain
  // "Underwater" but tracks Route 124 (0x32) and Route 126 (0x33) as two
  // separate nuzlocke areas, so one shared label retires both on the first
  // catch. Splitting them would orphan every already-imported "Underwater" row,
  // which is the worse trade — a met location alone cannot say which one a
  // stored row meant. Revisit if catch rows ever persist the raw mapsec.
  0x32: "Underwater",
  0x33: "Underwater",
  0x34: "Underwater",
  0x35: "Underwater",
  0x36: "Underwater",
  0x45: "Underwater",
  0x4f: "Underwater",
  0xcc: "Underwater",
  0xce: "Underwater",
  0xcf: "Underwater",
  0xd0: "Underwater",
  // Unused legacy id whose ROM name carries a "{AQUA}" team placeholder.
  0x42: "Aqua Hideout",
  // MAPSEC_DYNAMIC has no region-map entry; the game prints it as "Ferry"
  // (src/region_map.c → gText_Ferry). It was previously labeled "Special area",
  // which is 0xC4 and unused by any map.
  0x57: "Ferry",
  0xd2: "Altering Cave",
  0xd3: "Navel Rock",
  0xd4: "Trainer Hill",
  // METLOC_SPECIAL_EGG. Not the starter (a `givemon` in Birch's lab, stamped
  // Littleroot Town) — the ROM's only CreateEgg(..., setHotSpringsLocation=TRUE)
  // caller is ScriptGiveEgg (src/script_pokemon_util.c), i.e. a gift egg.
  0xfd: "Gift egg",
  0xfe: "In-game trade",
  0xff: "Event / gift",
};

/**
 * Umbrella labels that must never occupy an open-route slot of their own: the
 * areas underneath them are the real slots, and counting both double-counts.
 */
const FORCED_LEGACY_LABELS = new Set(["Safari Zone"]);

/** Extra strings that should resolve to a row (old free-text and renamed labels). */
const EXTRA_ALIASES = {
  "Gift egg": ["Starter gift", "Daycare egg"],
};

/**
 * Labels already stored on `Pokemon.catchRoute` rows. Route matching is plain
 * normalized-string equality, so dropping one of these would orphan real data —
 * they are kept even when the ROM says nothing is catchable there.
 */
const LEGACY_LABELS = new Set([
  "Littleroot Town", "Oldale Town", "Petalburg City", "Rustboro City",
  "Dewford Town", "Slateport City", "Mauville City", "Verdanturf Town",
  "Fallarbor Town", "Lavaridge Town", "Fortree City", "Lilycove City",
  "Mossdeep City", "Sootopolis City", "Pacifidlog Town", "Ever Grande City",
  "Petalburg Woods", "Rusturf Tunnel", "Granite Cave", "Mt. Chimney",
  "Jagged Pass", "Fiery Path", "Meteor Falls", "Mt. Pyre", "Desert Underpass",
  "Abandoned Ship", "New Mauville", "Safari Zone", "Shoal Cave",
  "Seafloor Cavern", "Cave of Origin", "Victory Road", "Sky Pillar",
  "Sealed Chamber", "Desert Ruins", "Island Cave", "Ancient Tomb",
  "Underwater", "Mirage Tower", "Aqua Hideout", "Magma Hideout",
  "Trainer Hill", "Battle Frontier", "Artisan Cave", "Altering Cave",
  "Mirage Island", "Southern Island", "Faraway Island", "Birth Island",
  "Navel Rock", "In-game trade", "Event / gift",
]);

/**
 * Rows with no mapsec of their own. The umbrella "Safari Zone" is what every
 * Safari catch actually imports as, so it has to survive as a matchable label.
 */
const SYNTHETIC_ROWS = [
  {
    label: "Safari Zone",
    mapsecs: [0x39],
    kind: "legacy",
    note: "Every Safari catch stamps this umbrella mapsec; the six areas come from encounter flags.",
  },
];

const METLOC_NAMES = {
  0xfd: "METLOC_SPECIAL_EGG",
  0xfe: "METLOC_IN_GAME_TRADE",
  0xff: "METLOC_FATEFUL_ENCOUNTER",
};

const ENCOUNTER_FIELDS = {
  land_mons: "land",
  water_mons: "water",
  rock_smash_mons: "rock-smash",
  fishing_mons: "fishing",
};

const STATIC_COMMANDS = /^\s*(seteventmon|givemon|giveegg|setwildbattle)\b/;

function ensureSource() {
  if (existsSync(join(localRoot, "include/constants/region_map_sections.h"))) {
    return localRoot;
  }
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

function readMapsecIds(src) {
  const text = readFileSync(join(src, "include/constants/region_map_sections.h"), "utf8");
  const byName = new Map();
  for (const line of text.split("\n")) {
    const m = /^#define\s+(MAPSEC_\w+|METLOC_\w+)\s+(0x[0-9A-Fa-f]+|\d+)/.exec(line);
    if (m) byName.set(m[1], Number(m[2]));
  }
  if (byName.size === 0) throw new Error("no MAPSEC constants parsed");
  return byName;
}

function readDisplayNames(src) {
  const json = JSON.parse(
    readFileSync(join(src, "src/data/region_map/region_map_sections.json"), "utf8"),
  );
  const byName = new Map();
  for (const entry of json.map_sections ?? []) {
    if (entry.map_section && entry.name) byName.set(entry.map_section, entry.name);
  }
  return byName;
}

function readNuzlockeLut(src) {
  const text = readFileSync(join(src, "src/tx_randomizer_and_challenges.c"), "utf8");
  const block = /const u8 NuzlockeLUT\[\]\s*=\s*\{([\s\S]*?)\n\};/.exec(text);
  if (!block) throw new Error("NuzlockeLUT not found");
  const byName = new Map();
  for (const m of block[1].matchAll(/\[(MAPSEC_\w+)\]\s*=\s*(0x[0-9A-Fa-f]+|\d+)/g)) {
    byName.set(m[1], Number(m[2]));
  }
  if (byName.size === 0) throw new Error("NuzlockeLUT parsed empty");
  return byName;
}

/**
 * `NuzlockeGetCurrentRegionMapSectionId` (src/overworld.c) swaps a handful of
 * maps onto mapsecs that exist only at runtime — today that is the six Safari
 * sub-areas. Encounter tracking uses the swapped id; met location does not.
 */
function readNuzlockeRemap(src) {
  const text = readFileSync(join(src, "src/overworld.c"), "utf8");
  const fn = /u8 NuzlockeGetCurrentRegionMapSectionId\(void\)[\s\S]*?\n\}/.exec(text);
  if (!fn) throw new Error("NuzlockeGetCurrentRegionMapSectionId not found");
  const byMap = new Map();
  for (const m of fn[0].matchAll(
    /case MAP_NUM\((\w+)\):\s*\n\s*return\s+(MAPSEC_\w+);/g,
  )) {
    byMap.set(`MAP_${m[1]}`, m[2]);
  }
  if (byMap.size === 0) throw new Error("nuzlocke remap parsed empty");
  return byMap;
}

function readMaps(src) {
  const mapsDir = join(src, "data/maps");
  const mapToSection = new Map();
  const sectionToMaps = new Map();
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(mapsDir, dir.name, "map.json");
    if (!existsSync(file)) continue;
    const json = JSON.parse(readFileSync(file, "utf8"));
    const section = json.region_map_section;
    if (!json.id || !section) continue;
    mapToSection.set(json.id, section);
    if (!sectionToMaps.has(section)) sectionToMaps.set(section, []);
    sectionToMaps.get(section).push({ id: json.id, dir: dir.name });
  }
  return { mapToSection, sectionToMaps };
}

function readWildEncounters(src, mapToSection) {
  const json = JSON.parse(readFileSync(join(src, "src/data/wild_encounters.json"), "utf8"));
  const bySection = new Map();
  for (const group of json.wild_encounter_groups ?? []) {
    if (!group.for_maps) continue;
    for (const entry of group.encounters ?? []) {
      const section = mapToSection.get(entry.map);
      if (!section) continue;
      if (!bySection.has(section)) bySection.set(section, new Set());
      for (const [field, kind] of Object.entries(ENCOUNTER_FIELDS)) {
        if (entry[field]) bySection.get(section).add(kind);
      }
    }
  }
  return bySection;
}

function readStatics(src, sectionToMaps) {
  const bySection = new Map();
  for (const [section, maps] of sectionToMaps) {
    const found = new Set();
    for (const map of maps) {
      if (!map.dir) continue;
      const file = join(src, "data/maps", map.dir, "scripts.inc");
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = STATIC_COMMANDS.exec(line);
        if (m) found.add(m[1]);
      }
    }
    if (found.size > 0) bySection.set(section, [...found].sort());
  }
  return bySection;
}

function classify({ encounters, statics, mapCount, isPseudo }) {
  if (isPseudo) return "pseudo";
  if (encounters.length > 0) return "wild";
  if (statics.length > 0) return "static";
  if (mapCount === 0) return "unreachable";
  return "egg-only";
}

function main() {
  const src = ensureSource();
  const mapsecIds = readMapsecIds(src);
  const displayNames = readDisplayNames(src);
  const lut = readNuzlockeLut(src);
  const { mapToSection, sectionToMaps: onDiskMaps } = readMaps(src);

  // Encounter/classification view: the runtime nuzlocke id, not the on-disk one.
  const remap = readNuzlockeRemap(src);
  const mapToArea = new Map(mapToSection);
  for (const [map, section] of remap) {
    if (mapToArea.has(map)) mapToArea.set(map, section);
  }
  const sectionToMaps = new Map();
  for (const [map, section] of mapToArea) {
    if (!sectionToMaps.has(section)) sectionToMaps.set(section, []);
    sectionToMaps.get(section).push({
      id: map,
      dir: (onDiskMaps.get(mapToSection.get(map)) ?? []).find((m) => m.id === map)?.dir,
    });
  }
  const wild = readWildEncounters(src, mapToArea);
  const statics = readStatics(src, sectionToMaps);

  /** label → row, merged across every mapsec that resolves to the same label. */
  const rows = new Map();

  const sections = [...mapsecIds.entries()]
    .filter(([name]) => name.startsWith("MAPSEC_") || METLOC_NAMES[mapsecIds.get(name)])
    .sort((a, b) => a[1] - b[1]);

  for (const [name, id] of sections) {
    const isPseudo = name.startsWith("METLOC_");
    const maps = sectionToMaps.get(name) ?? [];
    const encounters = [...(wild.get(name) ?? [])].sort();
    const sectionStatics = statics.get(name) ?? [];
    const label =
      LABEL_OVERRIDES[id] ?? displayNames.get(name) ?? name.replace(/^MAPSEC_/, "");
    // Dead constants nothing can ever produce: no map, no encounters, no bit.
    if (
      !isPseudo &&
      maps.length === 0 &&
      encounters.length === 0 &&
      !lut.has(name) &&
      !LEGACY_LABELS.has(label)
    ) {
      continue;
    }
    const kind = classify({
      encounters,
      statics: sectionStatics,
      mapCount: maps.length,
      isPseudo,
    });

    const row = rows.get(label) ?? {
      label,
      mapsecs: [],
      mapsecNames: [],
      nuzlockeBit: null,
      kind,
      encounters: [],
      statics: [],
      mapCount: 0,
      onDiskMapCount: 0,
      claimSource: "none",
      countsTowardOpen: false,
      aliases: [],
    };
    row.mapsecs.push(id);
    row.mapsecNames.push(name);
    row.mapCount += maps.length;
    row.onDiskMapCount += (onDiskMaps.get(name) ?? []).length;
    for (const kindName of encounters) {
      if (!row.encounters.includes(kindName)) row.encounters.push(kindName);
    }
    for (const command of sectionStatics) {
      if (!row.statics.includes(command)) row.statics.push(command);
    }
    // A LUT bit only counts when some map can actually resolve to that mapsec.
    // MAPSEC_ALTERING_CAVE_FRLG owns bit 0x42 but no map carries it, so the real
    // Altering Cave is untracked despite sharing the display name.
    const bit = lut.get(name);
    if (bit != null && maps.length > 0 && row.nuzlockeBit == null) row.nuzlockeBit = bit;
    // A merged label takes the strongest classification of its members.
    const rank = { pseudo: 0, unreachable: 1, "egg-only": 2, static: 3, wild: 4 };
    if (rank[kind] > rank[row.kind]) row.kind = kind;
    rows.set(label, row);
  }

  for (const synthetic of SYNTHETIC_ROWS) {
    if (rows.has(synthetic.label)) continue;
    rows.set(synthetic.label, {
      label: synthetic.label,
      mapsecs: synthetic.mapsecs,
      mapsecNames: [],
      nuzlockeBit: null,
      kind: synthetic.kind,
      encounters: [],
      statics: [],
      mapCount: 0,
      claimSource: "met-location",
      countsTowardOpen: false,
      aliases: [],
      note: synthetic.note,
    });
  }

  // Drop ROM plumbing nobody can log a catch on (Secret Base, Ferry, Inside of
  // Truck…) unless a stored row already uses the label.
  for (const [label, row] of rows) {
    const noise = row.kind === "egg-only" || row.kind === "unreachable";
    if (noise && !LEGACY_LABELS.has(label)) rows.delete(label);
  }

  for (const row of rows.values()) {
    if (FORCED_LEGACY_LABELS.has(row.label)) row.kind = "legacy";
    // Met location is stamped from the on-disk region_map_section, so a row whose
    // mapsecs only exist at runtime (the Safari sub-areas) is flag-only.
    const metLocation =
      row.onDiskMapCount > 0 || row.kind === "pseudo" || row.kind === "legacy";
    const flag = row.nuzlockeBit != null;
    row.claimSource =
      metLocation && flag
        ? "both"
        : flag
          ? "encounter-flag"
          : metLocation
            ? "met-location"
            : "none";
    // An encounter slot is anything the ROM tracks *or* anything with a wild
    // table. The bit alone matters: Aqua Hideout has no wild_encounters entry,
    // only a scripted Electrode, but the ROM burns bit 0x39 for it all the same.
    row.countsTowardOpen =
      row.kind !== "legacy" &&
      row.kind !== "pseudo" &&
      (row.nuzlockeBit != null || row.encounters.length > 0);
    // No LUT bit but real encounters: the ROM's designated-initializer LUT
    // zero-fills, so these share Route 101's flag (id 0) in game — catching here
    // burns Route 101, and once Route 101 is spent the ball throw is refused.
    if (row.countsTowardOpen && row.nuzlockeBit == null) row.aliasesRoute101 = true;
    // The in-game encounter slot this row consumes. Rows sharing a slotKey are
    // one slot, not several.
    row.slotKey = row.countsTowardOpen ? (row.nuzlockeBit ?? 0) : null;
    const extra = EXTRA_ALIASES[row.label];
    if (extra) row.aliases = extra;
    // Derivation-only fields. This JSON reaches the client bundle via the
    // catch-route picker, so it ships nothing the app does not read.
    delete row.mapCount;
    delete row.onDiskMapCount;
    delete row.mapsecNames;
    delete row.statics;
  }

  const ordered = [...rows.values()].sort((a, b) => {
    const pseudoDelta = Number(a.kind === "pseudo") - Number(b.kind === "pseudo");
    if (pseudoDelta !== 0) return pseudoDelta;
    return Math.min(...a.mapsecs) - Math.min(...b.mapsecs);
  });

  const counts = ordered.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});

  /**
   * Met-location naming table. Deliberately wider than the route catalog: any id
   * the ROM can name gets a label, so an unexpected met location degrades to a
   * readable string instead of `null` (which the importer drops on the floor).
   * Keyed by the *on-disk* section, so a Safari catch still resolves to the
   * umbrella "Safari Zone" exactly as the ROM stamps it.
   */
  const mapsecLabels = {};
  for (const [name, id] of sections) {
    if (name === "MAPSEC_NONE") continue;
    const label = LABEL_OVERRIDES[id] ?? displayNames.get(name);
    if (label) mapsecLabels[id] = label;
  }

  // Emitted as `as const` TypeScript rather than JSON so the catalog's literal
  // types line up with the CatchRoute union — the consuming assignment then
  // typechecks this generated data instead of casting past it.
  const labelLines = Object.entries(mapsecLabels)
    .map(([id, label]) => `  ${id}: ${JSON.stringify(label)},`)
    .join("\n");
  const rowLines = ordered
    .map((row) => `  ${JSON.stringify(row)},`)
    .join("\n");

  writeFileSync(
    outPath,
    [
      "// Generated by scripts/generate-catch-routes.mjs from resetes12/pokeemerald",
      "// (Modern Emerald). Do not edit by hand — run `npm run data:catch-routes`.",
      "",
      "/** Distinct encounter areas the ROM itself tracks (`NuzlockeLUT`). */",
      `export const NUZLOCKE_AREA_COUNT = ${new Set(lut.values()).size};`,
      "",
      "/** Met-location MAPSEC id → display name. */",
      "export const MAPSEC_LABELS: Record<number, string> = {",
      labelLines,
      "};",
      "",
      "export const CATCH_ROUTE_ROWS = [",
      rowLines,
      "] as const;",
      "",
    ].join("\n"),
  );

  console.error(
    `Wrote ${ordered.length} routes to ${outPath}\n` +
      `  NuzlockeLUT areas: ${new Set(lut.values()).size}\n` +
      `  counts by kind: ${JSON.stringify(counts)}\n` +
      `  counted toward open: ${ordered.filter((r) => r.countsTowardOpen).length}`,
  );
}

main();
