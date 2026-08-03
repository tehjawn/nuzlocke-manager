#!/usr/bin/env node
/**
 * Build move name → battle details lookup from Pokémon Showdown moves data.
 * Keys are normalized (lowercase alphanumeric) so "U Turn" / "U-turn" match.
 * Usage: node scripts/generate-move-meta.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/move-meta.json");
const MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";

function normalizeMoveKey(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const res = await fetch(MOVES_URL);
if (!res.ok) throw new Error(`moves.json → ${res.status}`);
const raw = await res.json();

/** @type {Record<string, { category: string; description: string; name: string; power: number; type: string }>} */
const byKey = Object.create(null);
let count = 0;

for (const entry of Object.values(raw)) {
  if (!entry || typeof entry !== "object" || !entry.name || !entry.type) continue;
  const category = entry.category;
  if (
    category !== "Physical" &&
    category !== "Special" &&
    category !== "Status"
  ) {
    continue;
  }
  const key = normalizeMoveKey(entry.name);
  if (!key) continue;
  byKey[key] = {
    category,
    description:
      typeof entry.shortDesc === "string"
        ? entry.shortDesc.trim()
        : typeof entry.desc === "string"
          ? entry.desc.trim()
          : "",
    name: entry.name,
    power: typeof entry.basePower === "number" ? entry.basePower : 0,
    type: entry.type,
  };
  count += 1;
}

writeFileSync(
  outPath,
  `${JSON.stringify({
    byKey,
    source: "pokemon-showdown/moves.json",
    version: 2,
  })}\n`,
);

console.log(`Wrote ${count} moves → ${outPath}`);
