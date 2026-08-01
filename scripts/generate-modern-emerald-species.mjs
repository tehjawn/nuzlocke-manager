#!/usr/bin/env node
/**
 * Build Modern Emerald SPECIES_* → National Dex map from nzl_modern headers.
 *
 * Usage:
 *   node scripts/generate-modern-emerald-species.mjs [path/to/nzl_modern]
 *
 * Defaults to .tmp/nzl_modern-main if present, else fetches from GitHub.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/modern-emerald-species.json");
const localRoot =
  process.argv[2] ?? join(root, ".tmp/nzl_modern-main");
const SPECIES_URL =
  "https://raw.githubusercontent.com/chethtrayen/nzl_modern/main/include/constants/species.h";
const POKEDEX_URL =
  "https://raw.githubusercontent.com/chethtrayen/nzl_modern/main/include/constants/pokedex.h";

async function loadText(localRel, url) {
  const local = join(localRoot, localRel);
  if (existsSync(local)) return readFileSync(local, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function parseNationalEnum(text) {
  const national = new Map();
  for (const block of text.matchAll(/enum\s*\{([^}]+)\}/g)) {
    const body = block[1];
    if (!body.includes("NATIONAL_DEX_NONE") || !body.includes("NATIONAL_DEX_BULBASAUR")) {
      continue;
    }
    let i = 0;
    for (const name of body.matchAll(/NATIONAL_DEX_([A-Z0-9_]+)/g)) {
      national.set(name[1], i);
      i += 1;
    }
    break;
  }
  if (national.size === 0) throw new Error("No NATIONAL_DEX enum found");
  return national;
}

function parseSpeciesDefines(text) {
  const species = new Map();
  for (const m of text.matchAll(/#define\s+SPECIES_([A-Z0-9_]+)\s+(\d+)/g)) {
    species.set(Number(m[2]), m[1]);
  }
  return species;
}

const speciesText = await loadText("include/constants/species.h", SPECIES_URL);
const pokedexText = await loadText("include/constants/pokedex.h", POKEDEX_URL);
const national = parseNationalEnum(pokedexText);
const species = parseSpeciesDefines(speciesText);

const skipExact = new Set(["NONE", "EGG", "SHINY_TAG", "TEST"]);
const mapping = new Map();
for (const [sid, sname] of [...species.entries()].sort((a, b) => a[0] - b[0])) {
  if (skipExact.has(sname) || sname.startsWith("OLD_UNOWN") || sname.startsWith("UNUSED")) {
    continue;
  }
  const nd = national.get(sname);
  if (nd == null) {
    console.warn(`No NATIONAL_DEX_${sname} for SPECIES_${sname}=${sid}`);
    continue;
  }
  mapping.set(sid, nd);
}

const maxId = Math.max(...mapping.keys());
const table = Array.from({ length: maxId + 1 }, () => 0);
for (const [sid, nd] of mapping) table[sid] = nd;

const eggId = [...species.entries()].find(([, n]) => n === "EGG")?.[0] ?? 462;
const dexFlagBytes = Math.ceil(eggId / 8);

const payload = {
  description:
    "Modern Emerald (nzl_modern) SPECIES_* id → National Dex number.",
  source: "chethtrayen/nzl_modern include/constants/{species,pokedex}.h",
  numSpecies: eggId,
  dexFlagBytes,
  table,
};

writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
console.log(
  `Wrote ${outPath} (${mapping.size} species, max id ${maxId}, dexFlagBytes ${dexFlagBytes})`,
);
console.log(`  SPECIES_POOCHYENA 286 → ${table[286]}`);
console.log(`  SPECIES_NOSEPASS 320 → ${table[320]}`);
