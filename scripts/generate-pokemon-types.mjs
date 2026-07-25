#!/usr/bin/env node
/**
 * Build src/data/pokemon-types-by-id.json from PokeAPI type endpoints.
 * Usage: node scripts/generate-pokemon-types.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TYPE_NAMES = [
  "Normal",
  "Fighting",
  "Flying",
  "Poison",
  "Ground",
  "Rock",
  "Bug",
  "Ghost",
  "Steel",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Psychic",
  "Ice",
  "Dragon",
  "Dark",
  "Fairy",
];

/** @type {Map<number, (string | undefined)[]>} */
const byId = new Map();

function idFromUrl(url) {
  const match = String(url).match(/\/pokemon\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

for (const typeName of TYPE_NAMES) {
  const slug = typeName.toLowerCase();
  const res = await fetch(`https://pokeapi.co/api/v2/type/${slug}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch type ${slug}: ${res.status}`);
  }
  const data = await res.json();
  for (const entry of data.pokemon ?? []) {
    const id = idFromUrl(entry.pokemon?.url);
    if (id == null) continue;
    const slot = Number(entry.slot);
    if (slot !== 1 && slot !== 2) continue;
    let slots = byId.get(id);
    if (!slots) {
      slots = [];
      byId.set(id, slots);
    }
    slots[slot - 1] = typeName;
  }
  console.log(`… ${typeName}`);
}

/** @type {Record<string, string[]>} */
const typesById = {};
for (const [id, slots] of [...byId.entries()].sort((a, b) => a[0] - b[0])) {
  const types = slots.filter(Boolean);
  if (types.length) typesById[String(id)] = types;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/data/pokemon-types-by-id.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      version: 1,
      count: Object.keys(typesById).length,
      typesById,
    },
    null,
    0,
  ),
);
console.log(`Wrote ${Object.keys(typesById).length} Pokémon → ${out}`);
