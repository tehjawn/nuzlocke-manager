#!/usr/bin/env node
/**
 * Build Modern Emerald SPECIES_* → real National Dex map from nzl_modern headers.
 *
 * Important: nzl_modern's NATIONAL_DEX_* enum is a *compacted* list of species
 * included in the ROM — its indices match real National Dex numbers for early
 * Pokémon, but diverge once the ROM omits species (e.g. NATIONAL_DEX_LEAFEON
 * is 414, while real Leafeon is 470 / Mothim). Party/box species IDs must map
 * to real National Dex for our catalog; dex bitfields still use the ROM enum.
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
const catalogPath = join(root, "src/data/pokemon.json");
const localRoot =
  process.argv[2] ?? join(root, ".tmp/nzl_modern-main");
const SPECIES_URL =
  "https://raw.githubusercontent.com/chethtrayen/nzl_modern/main/include/constants/species.h";
const POKEDEX_URL =
  "https://raw.githubusercontent.com/chethtrayen/nzl_modern/main/include/constants/pokedex.h";

/** SPECIES_* names whose default slug does not match pokemon.json. */
const SPECIES_SLUG_ALIASES = {
  DEOXYS: "deoxys-normal",
  DUDUNSPARCE: "dudunsparce-two-segment",
  WORMADAM: "wormadam-plant",
  BASCUIN: "basculin-red-striped",
};

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

function buildCatalogLookup(catalog) {
  const bySlug = new Map();
  for (const p of catalog.pokemon) {
    if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
  }
  return bySlug;
}

function resolveNationalDex(sname, bySlug) {
  const slug =
    SPECIES_SLUG_ALIASES[sname] ?? sname.toLowerCase().replaceAll("_", "-");
  const hit = bySlug.get(slug);
  if (hit) return hit.pokedexId;
  // Prefer a base (non-forme) species when only prefixed formes exist.
  for (const p of bySlug.values()) {
    if (p.slug === slug || p.slug.startsWith(`${slug}-`)) {
      if (!p.isForme) return p.pokedexId;
    }
  }
  for (const p of bySlug.values()) {
    if (p.slug === slug || p.slug.startsWith(`${slug}-`)) return p.pokedexId;
  }
  return null;
}

const speciesText = await loadText("include/constants/species.h", SPECIES_URL);
const pokedexText = await loadText("include/constants/pokedex.h", POKEDEX_URL);
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const bySlug = buildCatalogLookup(catalog);
const romNational = parseNationalEnum(pokedexText);
const species = parseSpeciesDefines(speciesText);

const skipExact = new Set(["NONE", "EGG", "SHINY_TAG", "TEST"]);
const mapping = new Map();
const romDexToNational = new Map();
let mismatches = 0;

for (const [sid, sname] of [...species.entries()].sort((a, b) => a[0] - b[0])) {
  if (skipExact.has(sname) || sname.startsWith("OLD_UNOWN") || sname.startsWith("UNUSED")) {
    continue;
  }
  const romDex = romNational.get(sname);
  if (romDex == null) {
    console.warn(`No NATIONAL_DEX_${sname} for SPECIES_${sname}=${sid}`);
    continue;
  }
  const realNd = resolveNationalDex(sname, bySlug);
  if (realNd == null) {
    console.warn(`No catalog entry for SPECIES_${sname}=${sid}`);
    continue;
  }
  mapping.set(sid, realNd);
  romDexToNational.set(romDex, realNd);
  if (romDex !== realNd) mismatches += 1;
}

const maxId = Math.max(...mapping.keys());
const table = Array.from({ length: maxId + 1 }, () => 0);
for (const [sid, nd] of mapping) table[sid] = nd;

const maxRomDex = Math.max(...romDexToNational.keys());
const romDexTable = Array.from({ length: maxRomDex + 1 }, () => 0);
for (const [romDex, nd] of romDexToNational) romDexTable[romDex] = nd;

const eggId = [...species.entries()].find(([, n]) => n === "EGG")?.[0] ?? 462;
const dexFlagBytes = Math.ceil(eggId / 8);

const payload = {
  description:
    "Modern Emerald (nzl_modern) SPECIES_* id → real National Dex number. romDexToNational maps compacted ROM NATIONAL_DEX_* indices used in Pokédex bitfields.",
  source:
    "chethtrayen/nzl_modern include/constants/{species,pokedex}.h + src/data/pokemon.json",
  numSpecies: eggId,
  dexFlagBytes,
  table,
  romDexToNational: romDexTable,
};

writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
console.log(
  `Wrote ${outPath} (${mapping.size} species, max id ${maxId}, dexFlagBytes ${dexFlagBytes}, ${mismatches} ROM≠real)`,
);
console.log(`  SPECIES_POOCHYENA 286 → ${table[286]}`);
console.log(`  SPECIES_NOSEPASS 320 → ${table[320]}`);
console.log(`  SPECIES_LEAFEON 428 → ${table[428]} (ROM dex ${romNational.get("LEAFEON")})`);
console.log(`  SPECIES_GLACEON 424 → ${table[424]}`);
