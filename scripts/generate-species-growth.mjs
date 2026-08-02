#!/usr/bin/env node
/**
 * Fetch National Dex growth rates from PokeAPI (6 growth-rate endpoints).
 * Usage: node scripts/generate-species-growth.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/species-growth.json");

/** PokeAPI growth-rate names → compact ids used by experience.ts */
const RATE_IDS = {
  slow: "slow",
  medium: "medium-fast",
  fast: "fast",
  "medium-slow": "medium-slow",
  "slow-then-very-fast": "erratic",
  "fast-then-very-slow": "fluctuating",
};

const growth = {};
for (let id = 1; id <= 6; id++) {
  const r = await fetch(`https://pokeapi.co/api/v2/growth-rate/${id}`);
  if (!r.ok) throw new Error(`growth-rate ${id} → ${r.status}`);
  const data = await r.json();
  const rate = RATE_IDS[data.name];
  if (!rate) throw new Error(`unknown growth-rate name: ${data.name}`);
  for (const entry of data.pokemon_species) {
    const url = entry.url ?? "";
    const match = /\/pokemon-species\/(\d+)\/?$/.exec(url);
    if (!match) continue;
    growth[match[1]] = rate;
  }
  console.log(`  ${data.name} → ${rate} (${data.pokemon_species.length} species)`);
}

writeFileSync(
  outPath,
  JSON.stringify(
    {
      version: 1,
      source: "pokeapi/growth-rate",
      growth,
    },
    null,
    0,
  ),
);
console.log(`\nWrote growth rates for ${Object.keys(growth).length} species.`);
