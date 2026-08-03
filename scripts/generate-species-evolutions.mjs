#!/usr/bin/env node
/**
 * Parse Modern Emerald gEvolutionTable → National Dex evolution graph.
 *
 * Usage:
 *   node scripts/generate-species-evolutions.mjs [path/to/evolution.h]
 *
 * Defaults to fixtures/modern-emerald/evolution.h
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "src/data/pokemon.json");
const outPath = join(root, "src/data/species-evolutions.json");
const defaultSrc = join(root, "fixtures/modern-emerald/evolution.h");
const srcPath = process.argv[2] ?? defaultSrc;

/** SPECIES_* names whose default slug does not match pokemon.json. */
const SPECIES_SLUG_ALIASES = {
  DEOXYS: "deoxys-normal",
  DUDUNSPARCE: "dudunsparce-two-segment",
  WORMADAM: "wormadam-plant",
  BASCUIN: "basculin-red-striped",
  MR_MIME: "mr-mime",
  MIME_JR: "mime-jr",
  PORYGON_Z: "porygon-z",
  NIDORAN_F: "nidoran-f",
  NIDORAN_M: "nidoran-m",
};

function titleCaseToken(token) {
  if (!token) return token;
  if (token === "JR") return "Jr";
  if (token === "MR") return "Mr";
  if (token === "Z") return "Z";
  return token.charAt(0) + token.slice(1).toLowerCase();
}

function constToDisplayName(raw, prefix) {
  const body = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  return body
    .split("_")
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ")
    .replace(/\bUp Grade\b/i, "Up-Grade")
    .replace(/\bKings Rock\b/i, "King's Rock")
    .replace(/\bDeep Sea Tooth\b/i, "Deep Sea Tooth")
    .replace(/\bDeep Sea Scale\b/i, "Deep Sea Scale");
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

function parseParam(method, raw) {
  if (raw.startsWith("ITEM_")) {
    return { paramKind: "item", param: constToDisplayName(raw, "ITEM_") };
  }
  if (raw.startsWith("MOVE_")) {
    return { paramKind: "move", param: constToDisplayName(raw, "MOVE_") };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Unknown evolution param for ${method}: ${raw}`);
  }
  if (method === "EVO_BEAUTY") {
    return { paramKind: "beauty", param: n };
  }
  // Friendship methods use 0 as placeholder.
  if (method.startsWith("EVO_FRIENDSHIP") || method === "EVO_TRADE") {
    return { paramKind: "none", param: 0 };
  }
  return { paramKind: "level", param: n };
}

const text = readFileSync(srcPath, "utf8");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const bySlug = buildCatalogLookup(catalog);

const speciesUnresolved = new Set();
const byDex = {};
let edgeCount = 0;

// Match [SPECIES_X] = {{...}, {...}}; across multiline entries.
const entryRe =
  /\[SPECIES_([A-Z0-9_]+)\]\s*=\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;

for (const match of text.matchAll(entryRe)) {
  const fromName = match[1];
  const body = match[2];
  const fromDex = resolveNationalDex(fromName, bySlug);
  if (fromDex == null) {
    speciesUnresolved.add(fromName);
    continue;
  }

  const edges = [];
  for (const evo of body.matchAll(
    /\{\s*(EVO_[A-Z0-9_]+)\s*,\s*([A-Z0-9_]+)\s*,\s*SPECIES_([A-Z0-9_]+)\s*\}/g,
  )) {
    const method = evo[1];
    const intoName = evo[3];
    const intoDex = resolveNationalDex(intoName, bySlug);
    if (intoDex == null) {
      speciesUnresolved.add(intoName);
      continue;
    }
    const { paramKind, param } = parseParam(method, evo[2]);
    edges.push({ method, paramKind, param, into: intoDex });
    edgeCount += 1;
  }

  if (edges.length > 0) {
    byDex[String(fromDex)] = edges;
  }
}

if (speciesUnresolved.size > 0) {
  console.warn(
    `Unresolved SPECIES_* (${speciesUnresolved.size}):`,
    [...speciesUnresolved].sort().join(", "),
  );
}

const payload = {
  version: 1,
  source: "fixtures/modern-emerald/evolution.h (Modern Emerald / nzl_modern)",
  speciesWithEvos: Object.keys(byDex).length,
  edgeCount,
  byDex,
};

writeFileSync(outPath, `${JSON.stringify(payload)}\n`);
console.log(
  `Wrote ${outPath} (${payload.speciesWithEvos} species, ${edgeCount} edges)`,
);
console.log(`  Eevee (#133) → ${byDex["133"]?.length ?? 0} options`);
console.log(`  Snorunt (#361) → ${JSON.stringify(byDex["361"])}`);
console.log(`  Scyther (#123) → ${JSON.stringify(byDex["123"])}`);
