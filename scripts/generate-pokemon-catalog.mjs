#!/usr/bin/env node
/**
 * Regenerate src/data/pokemon.json from PokeAPI (gens 1–9 National Dex + formes).
 * Usage: node scripts/generate-pokemon-catalog.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const GEN_RANGES = [
  [1, 151, 1],
  [152, 251, 2],
  [252, 386, 3],
  [387, 493, 4],
  [494, 649, 5],
  [650, 721, 6],
  [722, 809, 7],
  [810, 905, 8],
  [906, 1025, 9],
];

const NATIONAL_MAX = 1025;

function genForNational(n) {
  for (const [a, b, g] of GEN_RANGES) {
    if (n >= a && n <= b) return g;
  }
  return 9;
}

function titleCaseSlug(slug) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("-");
}

function genForForme(slug, nationalSorted) {
  const parts = slug.split("-");
  for (let len = parts.length; len >= 1; len--) {
    const candidate = parts.slice(0, len).join("-");
    for (const entry of nationalSorted) {
      if (
        entry.slug === candidate ||
        entry.slug.startsWith(`${candidate}-`) ||
        slug.startsWith(`${entry.slug}-`)
      ) {
        return entry.generation;
      }
    }
  }
  return 9;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=20000");
const data = await res.json();

const national = [];
const formes = [];

for (const r of data.results) {
  const match = r.url.match(/\/pokemon\/(\d+)\/?$/);
  if (!match) continue;
  const pokedexId = Number(match[1]);
  const slug = r.name;
  const name = titleCaseSlug(slug);
  if (pokedexId >= 1 && pokedexId <= NATIONAL_MAX) {
    national.push({
      name,
      pokedexId,
      slug,
      generation: genForNational(pokedexId),
      isForme: false,
    });
  } else if (pokedexId >= 10000) {
    formes.push({ name, pokedexId, slug, isForme: true });
  }
}

national.sort((a, b) => a.pokedexId - b.pokedexId);
const nationalSorted = [...national].sort(
  (a, b) => b.slug.length - a.slug.length,
);

const formeEntries = formes
  .map((f) => ({
    ...f,
    generation: genForForme(f.slug, nationalSorted),
  }))
  .sort((a, b) => a.pokedexId - b.pokedexId);

const pokemon = [...national, ...formeEntries];
const out = join(root, "src/data/pokemon.json");
writeFileSync(
  out,
  JSON.stringify({ version: 2, count: pokemon.length, pokemon }, null, 0),
);
console.log(
  `Wrote ${national.length} species + ${formeEntries.length} formes (${pokemon.length} total) → ${out}`,
);
