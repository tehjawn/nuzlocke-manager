#!/usr/bin/env node
/**
 * Build the Modern Emerald item catalog — what every item does, and every place
 * the ROM actually puts one.
 *
 * The motivating question is an evolution one: "my Dusclops needs a Spell Tag,
 * where do I get one?" Wikis answer for vanilla Emerald and get it wrong, and
 * for the items that actually block people the honest answer is not a place at
 * all. Four evolution items (Spell Tag, Metal Coat, Dragon Scale, Up-Grade)
 * have **zero** pickups anywhere in this ROM; their only overworld source is a
 * rare wild hold, which under randomized encounters means "wherever that
 * species rolled in your seed".
 *
 * Ground truth, in priority order:
 * - `gItems[]` (src/data/items.h) — name, price, pocket, description symbol.
 *   **The file declares two tables**; `gItems2[]` is a second copy and must be
 *   ignored or every item doubles.
 * - `src/data/text/item_descriptions.h` — the ROM's own description strings.
 * - `data/maps/<Map>/map.json` — item balls (`OBJ_EVENT_GFX_ITEM_BALL` object
 *   events) and hidden items (`bg_events` of type `hidden_item`).
 * - `data/scripts/item_ball_scripts.inc` + `data/maps/<Map>/scripts.inc` —
 *   the `finditem` / `giveitem` behind each ball, and NPC gifts.
 * - `src/data/pokemon/species_info.h` — `itemCommon` / `itemRare` wild holds.
 * - `src/battle_script_commands.c` — the three Pickup tables.
 * - `data/scripts/new_game.inc` — `setberrytree`, the initial berry planting.
 *
 * Deliberately **not** a source: `gBattleFrontierHeldItems` (src/battle_tower.c).
 * It reads like a prize list but it is the held-item table for Factory rentals
 * and facility opponents — nothing there enters the player's bag.
 *
 * Item balls resolve two ways: a named script label carrying `finditem ITEM_X`,
 * or the shared `Common_EventScript_FindItem`, which packs the item into the
 * object event's `trainer_sight_or_berry_tree_id` field. Battle Pyramid balls
 * (`BattlePyramid_FindItemBall`) resolve to neither because the ROM rolls them
 * per round — they are skipped rather than guessed.
 *
 * Usage:
 *   node scripts/generate-items.mjs [path/to/pokeemerald]
 *
 * Defaults to .tmp/modern-emerald if present, else fetches the tarball.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/items.generated.ts");
/**
 * Second, much smaller output for the modules that ship on hot pages: the Jump
 * index (mounted from the root layout) and the item links on the trainer board.
 * Neither needs sources or descriptions, and the full catalog is ~100 KB. Same
 * generator, so the two can't drift.
 */
const liteOutPath = join(root, "src/data/items-lite.generated.ts");
const catalogPath = join(root, "src/data/pokemon.json");
const tmpDir = join(root, ".tmp");
const localRoot = process.argv[2] ?? join(tmpDir, "modern-emerald");
/** Pinned upstream revision — matches `npm run data:randomizer`. */
const SOURCE_REF = "4f0a494ea9d282fc034e61f1df363cf3a321384c";
const TARBALL_URL = `https://codeload.github.com/resetes12/pokeemerald/tar.gz/${SOURCE_REF}`;

/** Placeholder rows in `gItems[]` that are not real items. */
const PLACEHOLDER_NAMES = new Set(["????????", "??????????"]);

/**
 * Unnamed ROM slots (`ITEM_072`…`ITEM_076`). They carry real-looking display
 * names — "Leftovers", "Sitrus Berry" — but nothing gives them to the player:
 * `battle_main.c` uses them as "no modifier" sentinels on trainer held items.
 * Keeping them would shadow the genuine Leftovers / Sitrus Berry in name
 * lookups and mint `?item=072` links.
 */
const PLACEHOLDER_CONSTANT = /^ITEM_[0-9A-F]{3}$/;

/** SPECIES_* names whose default slug does not match pokemon.json. */
const SPECIES_SLUG_ALIASES = {
  DEOXYS: "deoxys-normal",
  DUDUNSPARCE: "dudunsparce-two-segment",
  WORMADAM: "wormadam-plant",
  BASCUIN: "basculin-red-striped",
  BASCULIN: "basculin-red-striped",
  MR_MIME: "mr-mime",
  MIME_JR: "mime-jr",
  PORYGON_Z: "porygon-z",
  NIDORAN_F: "nidoran-f",
  NIDORAN_M: "nidoran-m",
};

/**
 * Mapsec display names the region map does not give us, or gives us badly.
 * Kept deliberately small — item locations want the ROM's own vocabulary so
 * they line up with `catch-routes.generated.ts` labels.
 */
const MAPSEC_LABEL_OVERRIDES = {
  MAPSEC_UNDERWATER_124: "Underwater",
  MAPSEC_UNDERWATER_126: "Underwater",
  MAPSEC_UNDERWATER_127: "Underwater",
  MAPSEC_UNDERWATER_128: "Underwater",
  MAPSEC_UNDERWATER_129: "Underwater",
  MAPSEC_UNDERWATER_SOOTOPOLIS: "Underwater",
  MAPSEC_UNDERWATER_SEAFLOOR_CAVERN: "Underwater",
  MAPSEC_AQUA_HIDEOUT_OLD: "Aqua Hideout",
  MAPSEC_DYNAMIC: "Ferry",
};

const POCKETS = {
  POCKET_ITEMS: "items",
  POCKET_POKE_BALLS: "balls",
  POCKET_TM_HM: "tm-hm",
  POCKET_BERRIES: "berries",
  POCKET_KEY_ITEMS: "key",
};

function ensureSource() {
  if (existsSync(join(localRoot, "src/data/items.h"))) return localRoot;
  if (localRoot !== join(tmpDir, "modern-emerald")) {
    throw new Error(`No pokeemerald checkout at ${localRoot}`);
  }
  console.error(`Fetching ${TARBALL_URL} …`);
  mkdirSync(tmpDir, { recursive: true });
  const tarball = join(tmpDir, "modern-emerald.tar.gz");
  execFileSync("curl", ["-sSL", "-o", tarball, TARBALL_URL], {
    stdio: "inherit",
  });
  mkdirSync(localRoot, { recursive: true });
  execFileSync(
    "tar",
    ["-xzf", tarball, "-C", localRoot, "--strip-components=1"],
    { stdio: "inherit" },
  );
  return localRoot;
}

/**
 * `ITEM_SPELL_TAG` → `spell-tag`. Keyed off the constant, not the display name,
 * because the ROM still ships gen-3 compressed labels ("TwistedSpoon") while
 * `species-evolutions.json` derives its item strings from the same constants —
 * the constant is the only join key both sides agree on.
 */
function itemSlug(constant) {
  return constant.replace(/^ITEM_/, "").toLowerCase().replace(/_/g, "-");
}

/**
 * Must stay in lockstep with `itemKey` in src/data/item-links.ts — it is what
 * turns a stored/display name into a lookup key.
 */
function itemKey(nameOrSlug) {
  return nameOrSlug
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * TM/HM items are named `TM03` in the bag but `ITEM_TM_WATER_PULSE` in the
 * constant, so the move is already in the join key — no `sTMHMMoves` walk
 * needed. Moves themselves stay in `move-meta.json`; this is just the label.
 */
function tmMoveName(constant) {
  const m = /^ITEM_(?:TM|HM)_([A-Z0-9_]+)$/.exec(constant);
  if (!m) return null;
  return m[1]
    .split("_")
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(" ");
}

function speciesSlug(constant) {
  const body = constant.replace(/^SPECIES_/, "");
  return (
    SPECIES_SLUG_ALIASES[body] ?? body.toLowerCase().replace(/_/g, "-")
  );
}

/** `MtPyre_3F` → `Mt Pyre 3F`. Underscore + camelCase + trailing-digit splits. */
function humanizeMapName(name) {
  return name
    .split("_")
    .map((token) =>
      token
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([a-z])(\d)/g, "$1 $2"),
    )
    .join(" ")
    .trim();
}

/** Join the `_("..." "..." )` string pieces of an item description. */
function readDescriptions(src) {
  const text = readFileSync(
    join(src, "src/data/text/item_descriptions.h"),
    "utf8",
  );
  const bySymbol = new Map();
  for (const m of text.matchAll(
    /static const u8 (\w+)\[\]\s*=\s*_\(([\s\S]*?)\);/g,
  )) {
    const pieces = [...m[2].matchAll(/"((?:\\.|[^"\\])*)"/g)].map((p) => p[1]);
    const joined = pieces
      .join("")
      .replace(/\\n|\\l|\\p/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (joined) bySymbol.set(m[1], joined);
  }
  return bySymbol;
}

/**
 * Parse `gItems[]` only. `src/data/items.h` declares `gItems2[]` after it with
 * the same entry shape; including it silently doubles every item.
 */
function readItems(src, descriptions) {
  const text = readFileSync(join(src, "src/data/items.h"), "utf8");
  const table = text.split(/const struct Item gItems2\[\]/)[0];
  const items = [];
  for (const m of table.matchAll(
    /\[(ITEM_[A-Z0-9_]+)\]\s*=\s*\{([\s\S]*?)\n {4}\},/g,
  )) {
    const [, constant, body] = m;
    const name = /\.name = _\("([^"]*)"\)/.exec(body)?.[1];
    if (!name || PLACEHOLDER_NAMES.has(name)) continue;
    if (PLACEHOLDER_CONSTANT.test(constant)) continue;
    const pocketConst = /\.pocket = (\w+)/.exec(body)?.[1];
    const descSymbol = /\.description = (\w+)/.exec(body)?.[1];
    const move = tmMoveName(constant);
    items.push({
      constant,
      slug: itemSlug(constant),
      name,
      ...(move ? { move } : {}),
      price: Number(/\.price = (\d+)/.exec(body)?.[1] ?? 0),
      pocket: POCKETS[pocketConst] ?? "items",
      description: (descSymbol && descriptions.get(descSymbol)) || "",
      sources: [],
    });
  }
  if (items.length === 0) throw new Error("gItems parsed empty");
  return items;
}

function readMapsecLabels(src) {
  const json = JSON.parse(
    readFileSync(
      join(src, "src/data/region_map/region_map_sections.json"),
      "utf8",
    ),
  );
  const byName = new Map(Object.entries(MAPSEC_LABEL_OVERRIDES));
  for (const entry of json.map_sections ?? []) {
    if (!entry.map_section || !entry.name) continue;
    if (byName.has(entry.map_section)) continue;
    byName.set(entry.map_section, entry.name);
  }
  return byName;
}

/**
 * label → item constant, across the shared item-ball script file and every
 * map's own scripts. First `finditem` / `giveitem` under a label wins.
 */
function readScriptLabels(src) {
  const files = [join(src, "data/scripts/item_ball_scripts.inc")];
  const mapsDir = join(src, "data/maps");
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(mapsDir, dir.name, "scripts.inc");
    if (existsSync(file)) files.push(file);
  }

  const byLabel = new Map();
  for (const file of files) {
    if (!existsSync(file)) continue;
    let current = null;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const label = /^(\w+)::?/.exec(line);
      if (label) {
        current = label[1];
        continue;
      }
      const cmd = /^\s*(finditem|giveitem)\s+(ITEM_[A-Z0-9_]+)/.exec(line);
      if (cmd && current && !byLabel.has(current)) byLabel.set(current, cmd[2]);
    }
  }
  return byLabel;
}

/** Mart stock: `.2byte ITEM_*` rows under a `*_Pokemart*` data label. */
function readMartStock(src, mapDir) {
  const file = join(src, "data/maps", mapDir, "scripts.inc");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  const stock = new Set();
  let inMart = false;
  for (const line of text.split("\n")) {
    if (/^\w*Pokemart\w*:/.test(line)) {
      inMart = true;
      continue;
    }
    if (!inMart) continue;
    const m = /^\s*\.2byte\s+(ITEM_[A-Z0-9_]+)/.exec(line);
    if (m) {
      if (m[1] === "ITEM_NONE") inMart = false;
      else stock.add(m[1]);
      continue;
    }
    // Any non-`.2byte` line ends the table (`release` / `end` / next label).
    if (line.trim().length > 0) inMart = false;
  }
  return [...stock];
}

/** `setberrytree BERRY_TREE_X, ITEM_TO_BERRY(ITEM_Y), …` → tree → item. */
function readBerryPlantings(src) {
  const file = join(src, "data/scripts/new_game.inc");
  if (!existsSync(file)) return new Map();
  const byTree = new Map();
  for (const m of readFileSync(file, "utf8").matchAll(
    /setberrytree\s+(BERRY_TREE_[A-Z0-9_]+),\s*ITEM_TO_BERRY\((ITEM_[A-Z0-9_]+)\)/g,
  )) {
    byTree.set(m[1], m[2]);
  }
  return byTree;
}

/** `itemCommon` / `itemRare` per species. */
function readWildHeld(src) {
  const text = readFileSync(
    join(src, "src/data/pokemon/species_info.h"),
    "utf8",
  );
  /** item constant → [{ species, rate }] */
  const byItem = new Map();
  const perSpecies = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    const species = /\[(SPECIES_[A-Z0-9_]+)\]\s*=/.exec(line);
    if (species) {
      current = species[1];
      continue;
    }
    const held = /\.(itemCommon|itemRare)\s*=\s*(ITEM_[A-Z0-9_]+)/.exec(line);
    if (!held || !current) continue;
    if (held[2] === "ITEM_NONE") continue;
    const row = perSpecies.get(current) ?? {};
    row[held[1] === "itemCommon" ? "common" : "rare"] = held[2];
    perSpecies.set(current, row);
  }

  for (const [species, row] of perSpecies) {
    // Both slots the same item is the ROM's 100%-hold idiom (`SetWildMonHeldItem`
    // short-circuits before the rarity roll), not two separate 45%/10% chances.
    if (row.common && row.common === row.rare) {
      push(byItem, row.common, { species, rate: "always" });
      continue;
    }
    if (row.common) push(byItem, row.common, { species, rate: "common" });
    if (row.rare) push(byItem, row.rare, { species, rate: "rare" });
  }
  return byItem;
}

function push(map, key, value) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

/**
 * Item constants that gate an evolution. Read straight from `evolution.h`
 * rather than from the app's `species-evolutions.json` so this generator has
 * exactly one upstream (the ROM) and no ordering dependency on another one.
 */
function readEvolutionItems(src) {
  const text = readFileSync(
    join(src, "src/data/pokemon/evolution.h"),
    "utf8",
  );
  const items = new Set();
  for (const m of text.matchAll(/\{EVO_[A-Z_]+,\s*(ITEM_[A-Z0-9_]+)/g)) {
    items.add(m[1]);
  }
  return items;
}

/** The three Pickup tables (src/battle_script_commands.c). */
function readPickup(src) {
  const text = readFileSync(join(src, "src/battle_script_commands.c"), "utf8");
  const tables = {
    sPickupItems: "common",
    sRarePickupItems: "rare",
    sRarePickupItemsFiniteTMs: "rare",
  };
  const byItem = new Map();
  for (const [table, rate] of Object.entries(tables)) {
    const block = new RegExp(
      `static const u16 ${table}\\[\\][\\s\\S]*?\\{([\\s\\S]*?)\\n\\};`,
    ).exec(text);
    if (!block) continue;
    for (const m of block[1].matchAll(/(ITEM_[A-Z0-9_]+)/g)) {
      const existing = byItem.get(m[1]);
      // Common beats rare when an item sits in both tables.
      if (existing === "common") continue;
      byItem.set(m[1], rate);
    }
  }
  return byItem;
}

function main() {
  const src = ensureSource();
  const descriptions = readDescriptions(src);
  const items = readItems(src, descriptions);
  const byConstant = new Map(items.map((item) => [item.constant, item]));
  const mapsecLabels = readMapsecLabels(src);
  const scriptLabels = readScriptLabels(src);
  const berryPlantings = readBerryPlantings(src);
  const wildHeld = readWildHeld(src);
  const pickup = readPickup(src);
  const evolutionItems = readEvolutionItems(src);

  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const speciesBySlug = new Map();
  for (const p of catalog.pokemon) {
    if (!speciesBySlug.has(p.slug)) speciesBySlug.set(p.slug, p);
  }

  const stats = {
    ball: 0,
    hidden: 0,
    gift: 0,
    mart: 0,
    berry: 0,
    held: 0,
    pickup: 0,
    skippedPyramid: 0,
    // Ball-sprite object events that are not items at all: the Beldum gift, the
    // New Mauville / Aqua Hideout Voltorbs, the Johto starters in Birch's lab,
    // the rival's ball. Expected to be non-zero.
    ballSpriteNotAnItem: 0,
  };
  /** item constant → Map<dedupeKey, source> so repeats collapse into `count`. */
  const sourcesByItem = new Map();

  function addSource(itemConstant, source) {
    const item = byConstant.get(itemConstant);
    if (!item) return false;
    const bucket = sourcesByItem.get(itemConstant) ?? new Map();
    const key = [source.kind, source.where, source.detail, source.species]
      .map((part) => part ?? "")
      .join("|");
    const existing = bucket.get(key);
    if (existing) existing.count = (existing.count ?? 1) + 1;
    else bucket.set(key, source);
    sourcesByItem.set(itemConstant, bucket);
    return true;
  }

  // --- Map sources: item balls, hidden items, berry trees, marts, gifts ---
  const mapsDir = join(src, "data/maps");
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(mapsDir, dir.name, "map.json");
    if (!existsSync(file)) continue;
    const map = JSON.parse(readFileSync(file, "utf8"));
    const where =
      mapsecLabels.get(map.region_map_section) ??
      humanizeMapName(map.name ?? dir.name);
    const humanName = humanizeMapName(map.name ?? dir.name);
    const detail = humanName === where ? undefined : humanName;

    for (const object of map.object_events ?? []) {
      const graphics = String(object.graphics_id ?? "");
      const script = String(object.script ?? "");

      if (graphics.includes("ITEM_BALL")) {
        // Pyramid balls are rolled per round — no fixed item to report.
        if (script.includes("BattlePyramid")) {
          stats.skippedPyramid += 1;
          continue;
        }
        const constant =
          script === "Common_EventScript_FindItem"
            ? String(object.trainer_sight_or_berry_tree_id ?? "")
            : scriptLabels.get(script);
        if (!constant?.startsWith("ITEM_")) {
          stats.ballSpriteNotAnItem += 1;
          continue;
        }
        if (addSource(constant, { kind: "ball", where, detail })) {
          stats.ball += 1;
        }
        continue;
      }

      const tree = String(object.trainer_sight_or_berry_tree_id ?? "");
      if (tree.startsWith("BERRY_TREE_")) {
        const constant = berryPlantings.get(tree);
        if (constant && addSource(constant, { kind: "berry", where, detail })) {
          stats.berry += 1;
        }
      }
    }

    for (const bg of map.bg_events ?? []) {
      if (bg.type !== "hidden_item") continue;
      if (addSource(String(bg.item ?? ""), { kind: "hidden", where, detail })) {
        stats.hidden += 1;
      }
    }

    for (const constant of readMartStock(src, dir.name)) {
      if (addSource(constant, { kind: "mart", where, detail })) stats.mart += 1;
    }
  }

  // NPC gifts. `giveitem` labels that an item ball already consumed are skipped
  // so a ball is not double-reported as a gift.
  const ballScripts = new Set();
  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(mapsDir, dir.name, "map.json");
    if (!existsSync(file)) continue;
    const map = JSON.parse(readFileSync(file, "utf8"));
    for (const object of map.object_events ?? []) {
      if (String(object.graphics_id ?? "").includes("ITEM_BALL")) {
        ballScripts.add(String(object.script ?? ""));
      }
    }
  }

  for (const dir of readdirSync(mapsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const scriptFile = join(mapsDir, dir.name, "scripts.inc");
    const mapFile = join(mapsDir, dir.name, "map.json");
    if (!existsSync(scriptFile) || !existsSync(mapFile)) continue;
    const map = JSON.parse(readFileSync(mapFile, "utf8"));
    const where =
      mapsecLabels.get(map.region_map_section) ??
      humanizeMapName(map.name ?? dir.name);
    const humanName = humanizeMapName(map.name ?? dir.name);
    const detail = humanName === where ? undefined : humanName;

    let current = null;
    for (const line of readFileSync(scriptFile, "utf8").split("\n")) {
      const label = /^(\w+)::?/.exec(line);
      if (label) {
        current = label[1];
        continue;
      }
      const give = /^\s*giveitem\s+(ITEM_[A-Z0-9_]+)/.exec(line);
      if (!give) continue;
      if (current && ballScripts.has(current)) continue;
      if (addSource(give[1], { kind: "gift", where, detail })) stats.gift += 1;
    }
  }

  // --- Wild holds ---
  for (const [constant, holders] of wildHeld) {
    for (const holder of holders) {
      const slug = speciesSlug(holder.species);
      const entry = speciesBySlug.get(slug);
      const source = {
        kind: "held",
        species: entry?.name ?? holder.species.replace(/^SPECIES_/, ""),
        rate: holder.rate,
      };
      if (entry?.pokedexId) source.pokedexId = entry.pokedexId;
      if (addSource(constant, source)) stats.held += 1;
    }
  }

  // --- Pickup ---
  for (const [constant, rate] of pickup) {
    if (addSource(constant, { kind: "pickup", rate })) stats.pickup += 1;
  }

  // Sources are emitted fixed-location first: a place you can walk to beats a
  // probability every time, and the UI renders them in array order.
  const KIND_ORDER = {
    ball: 0,
    hidden: 1,
    gift: 2,
    berry: 3,
    mart: 4,
    held: 5,
    pickup: 6,
  };
  for (const item of items) {
    const bucket = sourcesByItem.get(item.constant);
    if (!bucket) continue;
    item.sources = [...bucket.values()].sort((a, b) => {
      const kindDelta = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      if (kindDelta !== 0) return kindDelta;
      return (a.where ?? a.species ?? "").localeCompare(
        b.where ?? b.species ?? "",
      );
    });
  }

  const rowLines = items
    .map((item) => {
      const { constant, ...rest } = item;
      void constant;
      return `  ${JSON.stringify(rest)},`;
    })
    .join("\n");

  const withSources = items.filter((item) => item.sources.length > 0).length;

  writeFileSync(
    outPath,
    [
      "// Generated by scripts/generate-items.mjs from resetes12/pokeemerald",
      `// (Modern Emerald @ ${SOURCE_REF}). Do not edit by hand — run \`npm run data:items\`.`,
      "//",
      "// Types and lookups live in src/data/items.ts.",
      "",
      "export const ITEM_ROWS = [",
      rowLines,
      "] as const;",
      "",
    ].join("\n"),
  );

  // Name → slug, only where they disagree *and* the name key isn't already a
  // real slug. `ITEM_UNUSED_BERRY_1` is literally named "Sitrus Berry" in the
  // ROM, so an unguarded alias would point "Sitrus Berry" at the dead slot
  // instead of `ITEM_SITRUS_BERRY`. Real slugs always win.
  const realSlugs = new Set(items.map((item) => item.slug));
  const nameAliases = [];
  const claimed = new Set();
  for (const item of items) {
    if (!item.name) continue;
    const key = itemKey(item.name);
    if (key === item.slug || realSlugs.has(key) || claimed.has(key)) continue;
    claimed.add(key);
    nameAliases.push([key, item.slug]);
  }

  // Palette digest: only items someone would hunt (evolution gates and wild
  // holds), and only the fields Fuse matches on.
  const searchRows = items
    .filter(
      (item) =>
        evolutionItems.has(item.constant) ||
        item.sources.some((source) => source.kind === "held"),
    )
    .map((item) => {
      const holders = item.sources
        .filter((source) => source.kind === "held")
        .map((source) => source.species)
        .filter(Boolean);
      const wheres = [
        ...new Set(
          item.sources.map((source) => source.where).filter(Boolean),
        ),
      ].slice(0, 6);
      return {
        slug: item.slug,
        name: item.name,
        evolution: evolutionItems.has(item.constant),
        // No fixed pickup at all — the palette flags these, they are the whole
        // reason the tool exists.
        holdOnly:
          item.sources.length > 0 &&
          item.sources.every(
            (source) => source.kind === "held" || source.kind === "pickup",
          ),
        holders,
        wheres,
      };
    });

  writeFileSync(
    liteOutPath,
    [
      "// Generated by scripts/generate-items.mjs from resetes12/pokeemerald",
      `// (Modern Emerald @ ${SOURCE_REF}). Do not edit by hand — run \`npm run data:items\`.`,
      "//",
      "// The bundle-safe slice of the catalog. Deliberately separate from",
      "// items.generated.ts: the Jump index (root layout) and the item links on",
      "// the trainer board both ship on hot pages, and neither needs sources or",
      "// descriptions. Lookups live in src/data/item-links.ts.",
      "",
      "/** Every catalog slug, for resolving a held-item string to a link. */",
      "export const ITEM_SLUGS = [",
      items.map((item) => `  ${JSON.stringify(item.slug)},`).join("\n"),
      "] as const;",
      "",
      "/**",
      " * Display-name key → slug, only where they disagree. The ROM still ships",
      " * gen-3 compressed names (\"TwistedSpoon\", \"EnergyPowder\") while slugs come",
      " * from the `ITEM_*` constant, so a stored held item needs this to resolve.",
      " */",
      "export const ITEM_NAME_ALIASES: ReadonlyArray<readonly [string, string]> = [",
      nameAliases
        .map(
          ([nameKey, slug]) =>
            `  [${JSON.stringify(nameKey)}, ${JSON.stringify(slug)}],`,
        )
        .join("\n"),
      "];",
      "",
      "/** Items worth surfacing in Jump: evolution gates and wild holds. */",
      "export const ITEM_SEARCH_ROWS = [",
      searchRows.map((row) => `  ${JSON.stringify(row)},`).join("\n"),
      "] as const;",
      "",
    ].join("\n"),
  );

  console.error(
    `Wrote ${items.length} items to ${outPath}\n` +
      `  with at least one source: ${withSources}\n` +
      `  evolution items: ${evolutionItems.size}\n` +
      `  search digest rows: ${searchRows.length} → ${liteOutPath}\n` +
      `  sources: ${JSON.stringify(stats)}`,
  );
}

main();
