#!/usr/bin/env node
/**
 * Build the Modern Emerald learnset catalog from nzl_modern source tables.
 * Usage: node scripts/generate-modern-emerald-learnsets.mjs [path/to/nzl_modern]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/modern-emerald-learnsets.json");
const speciesDataPath = join(root, "src/data/modern-emerald-species.json");
const localRoot = process.argv[2] ?? join(root, ".tmp/nzl_modern-main");
const rawRoot =
  "https://raw.githubusercontent.com/chethtrayen/nzl_modern/main";

const SOURCE_PATHS = {
  eggMoves: "src/data/pokemon/egg_moves.h",
  levelPointers: "src/data/pokemon/level_up_learnset_pointers.h",
  levelUp: "src/data/pokemon/level_up_learnsets.h",
  species: "include/constants/species.h",
  tmHm: "src/data/pokemon/tmhm_learnsets.h",
  tmHmConstants: "include/constants/tms_hms.h",
  tutor: "src/data/pokemon/tutor_learnsets.h",
};

const MOVE_NAME_OVERRIDES = {
  DOUBLE_EDGE: "Double-Edge",
  DYNAMIC_PUNCH: "Dynamic Punch",
  FREEZE_DRY: "Freeze-Dry",
  LOCK_ON: "Lock-On",
  SAND_ATTACK: "Sand-Attack",
  SELF_DESTRUCT: "Self-Destruct",
  SOFT_BOILED: "Soft-Boiled",
  U_TURN: "U-turn",
  V_CREATE: "V-create",
  WILL_O_WISP: "Will-O-Wisp",
  X_SCISSOR: "X-Scissor",
};

async function loadSource(relativePath) {
  const localPath = join(localRoot, relativePath);
  if (existsSync(localPath)) return readFileSync(localPath, "utf8");
  const url = `${rawRoot}/${relativePath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

function moveName(moveConstant) {
  const token = moveConstant.replace(/^MOVE_/, "");
  return (
    MOVE_NAME_OVERRIDES[token] ??
    token
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ")
  );
}

function firstTable(text, laterTableDeclaration) {
  const end = text.indexOf(laterTableDeclaration);
  return end >= 0 ? text.slice(0, end) : text;
}

function parseSpeciesIds(text) {
  const ids = new Map();
  for (const match of text.matchAll(
    /#define\s+SPECIES_([A-Z0-9_]+)\s+(\d+)/g,
  )) {
    ids.set(match[1], Number(match[2]));
  }
  return ids;
}

function parseLevelUp(levelText, pointerText) {
  const byArray = new Map();
  for (const match of levelText.matchAll(
    /static const u16 (\w+LevelUpLearnset)\[\]\s*=\s*\{([\s\S]*?)\};/g,
  )) {
    const moves = [];
    for (const move of match[2].matchAll(
      /LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*(MOVE_[A-Z0-9_]+)\s*\)/g,
    )) {
      moves.push({ level: Number(move[1]), move: moveName(move[2]) });
    }
    moves.sort((a, b) => a.level - b.level);
    byArray.set(match[1], moves);
  }

  const bySpecies = new Map();
  const modernPointers = firstTable(
    pointerText,
    "const u16 *const gLevelUpLearnsets_Original",
  );
  for (const match of modernPointers.matchAll(
    /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*(\w+LevelUpLearnset)/g,
  )) {
    bySpecies.set(match[1], byArray.get(match[2]) ?? []);
  }
  return bySpecies;
}

function parseMachineCodes(text) {
  const tmBlock = text.slice(
    text.indexOf("#define FOREACH_TM(F)"),
    text.indexOf("#define FOREACH_HM(F)"),
  );
  const hmBlock = text.slice(
    text.indexOf("#define FOREACH_HM(F)"),
    text.indexOf("#define FOREACH_TMHM(F)"),
  );
  const codes = new Map();
  for (const [prefix, block] of [
    ["TM", tmBlock],
    ["HM", hmBlock],
  ]) {
    const moves = [...block.matchAll(/F\(([A-Z0-9_]+)\)/g)];
    moves.forEach((match, index) => {
      codes.set(
        match[1],
        `${prefix}${String(index + 1).padStart(2, "0")}`,
      );
    });
  }
  return codes;
}

function parseTmHm(text, machineCodes) {
  const bySpecies = new Map();
  const modernTable = firstTable(text, "gTMHMLearnsets_Old[NUM_SPECIES]");
  for (const match of modernTable.matchAll(
    /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{\s*\.learnset\s*=\s*\{([\s\S]*?)\}\s*\}/g,
  )) {
    const seen = new Set();
    const moves = [];
    for (const move of match[2].matchAll(/\.([A-Z0-9_]+)\s*=\s*TRUE/g)) {
      const machine = machineCodes.get(move[1]);
      if (!machine || seen.has(machine)) continue;
      seen.add(machine);
      moves.push({ machine, move: moveName(move[1]) });
    }
    moves.sort((a, b) => {
      const kindOrder =
        Number(a.machine.startsWith("HM")) -
        Number(b.machine.startsWith("HM"));
      return kindOrder || a.machine.localeCompare(b.machine);
    });
    bySpecies.set(match[1], moves);
  }
  return bySpecies;
}

function parseTutor(text) {
  const byArray = new Map();
  for (const match of text.matchAll(
    /static const u8 (\w+TutorLearnset)\[\]\s*=\s*\{([\s\S]*?)\};/g,
  )) {
    const moves = [
      ...match[2].matchAll(/TUTOR\((MOVE_[A-Z0-9_]+)\)/g),
    ].map((move) => moveName(move[1]));
    byArray.set(match[1], [...new Set(moves)].sort());
  }

  const bySpecies = new Map();
  for (const match of text.matchAll(
    /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*(\w+TutorLearnset)/g,
  )) {
    bySpecies.set(match[1], byArray.get(match[2]) ?? []);
  }
  return bySpecies;
}

function parseEggMoves(text) {
  const bySpecies = new Map();
  const modernTable = firstTable(text, "const u16 gEggMoves_Old[]");
  for (const match of modernTable.matchAll(
    /egg_moves\(\s*([A-Z0-9_]+)\s*,([\s\S]*?)\)\s*,/g,
  )) {
    const moves = [...match[2].matchAll(/MOVE_[A-Z0-9_]+/g)].map((move) =>
      moveName(move[0]),
    );
    bySpecies.set(match[1], [...new Set(moves)].sort());
  }
  return bySpecies;
}

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
      key,
      await loadSource(relativePath),
    ]),
  ),
);
const speciesData = JSON.parse(readFileSync(speciesDataPath, "utf8"));
const speciesIds = parseSpeciesIds(sources.species);
const levelUp = parseLevelUp(sources.levelUp, sources.levelPointers);
const machineCodes = parseMachineCodes(sources.tmHmConstants);
const tmHm = parseTmHm(sources.tmHm, machineCodes);
const tutor = parseTutor(sources.tutor);
const egg = parseEggMoves(sources.eggMoves);
const speciesNames = new Set([
  ...levelUp.keys(),
  ...tmHm.keys(),
  ...tutor.keys(),
  ...egg.keys(),
]);

const unresolved = new Set();
const byDexEntries = [];
for (const speciesName of speciesNames) {
  const speciesId = speciesIds.get(speciesName);
  const pokedexId = speciesData.table[speciesId ?? -1];
  if (!pokedexId) {
    if (
      speciesName !== "NONE" &&
      speciesName !== "TEST" &&
      !speciesName.startsWith("OLD_UNOWN_") &&
      !speciesName.startsWith("UNUSED_")
    ) {
      unresolved.add(speciesName);
    }
    continue;
  }
  byDexEntries.push([
    String(pokedexId),
    {
      egg: egg.get(speciesName) ?? [],
      levelUp: levelUp.get(speciesName) ?? [],
      tmHm: tmHm.get(speciesName) ?? [],
      tutor: tutor.get(speciesName) ?? [],
    },
  ]);
}

if (unresolved.size > 0) {
  throw new Error(
    `Unresolved Modern Emerald species: ${[...unresolved].sort().join(", ")}`,
  );
}

byDexEntries.sort((a, b) => Number(a[0]) - Number(b[0]));
const byDex = Object.fromEntries(byDexEntries);
const totals = Object.values(byDex).reduce(
  (sum, learnset) => ({
    egg: sum.egg + learnset.egg.length,
    levelUp: sum.levelUp + learnset.levelUp.length,
    tmHm: sum.tmHm + learnset.tmHm.length,
    tutor: sum.tutor + learnset.tutor.length,
  }),
  { egg: 0, levelUp: 0, tmHm: 0, tutor: 0 },
);

if (Object.keys(byDex).length < 400 || Object.values(totals).some((n) => n === 0)) {
  throw new Error(`Learnset output failed validation: ${JSON.stringify(totals)}`);
}

const payload = {
  byDex,
  source: "chethtrayen/nzl_modern main learnset tables",
  speciesCount: Object.keys(byDex).length,
  totals,
  version: 1,
};
writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
console.log(
  `Wrote ${outPath} (${payload.speciesCount} species; ${totals.levelUp} level, ${totals.tmHm} TM/HM, ${totals.tutor} tutor, ${totals.egg} egg moves)`,
);
