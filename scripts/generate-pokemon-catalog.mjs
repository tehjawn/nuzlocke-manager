#!/usr/bin/env node
/**
 * Regenerate src/data/pokemon.json from PokeAPI (gens 1–9 National Dex).
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

function genFor(n) {
  for (const [a, b, g] of GEN_RANGES) {
    if (n >= a && n <= b) return g;
  }
  return 9;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
const data = await res.json();
const pokemon = data.results.map((r, i) => {
  const pokedexId = i + 1;
  const slug = r.name;
  const name = slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("-");
  return { name, pokedexId, slug, generation: genFor(pokedexId) };
});

const out = join(root, "src/data/pokemon.json");
writeFileSync(
  out,
  JSON.stringify({ version: 1, count: pokemon.length, pokemon }),
);
console.log(`Wrote ${pokemon.length} species → ${out}`);
