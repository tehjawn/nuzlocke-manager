#!/usr/bin/env node
/**
 * Fetch National Dex base stats from PokeAPI.
 * Usage: node scripts/generate-base-stats.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/base-stats.json");
const MAX_ID = 1025;
const BATCH = 50;

const stats = {};
for (let start = 1; start <= MAX_ID; start += BATCH) {
  const end = Math.min(start + BATCH - 1, MAX_ID);
  await Promise.all(
    Array.from({ length: end - start + 1 }, (_, i) => start + i).map(
      async (id) => {
        const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!r.ok) throw new Error(`pokemon ${id} → ${r.status}`);
        const p = await r.json();
        const by = Object.fromEntries(
          p.stats.map((s) => [s.stat.name, s.base_stat]),
        );
        stats[String(id)] = {
          hp: by.hp,
          atk: by.attack,
          def: by.defense,
          spa: by["special-attack"],
          spd: by["special-defense"],
          spe: by.speed,
        };
      },
    ),
  );
  process.stdout.write(`  ${end}/${MAX_ID}\r`);
}

writeFileSync(
  outPath,
  JSON.stringify({ version: 1, source: "pokeapi", stats }),
);
console.log(`\nWrote base stats for ${Object.keys(stats).length} species.`);
