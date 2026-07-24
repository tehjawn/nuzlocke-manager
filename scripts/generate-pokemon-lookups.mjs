#!/usr/bin/env node
/**
 * Generate natures / abilities / species-ability / Gen 3 move lookup JSON.
 * Species abilities prefer Gen 3 (Emerald-era) sets via PokeAPI past_abilities.
 * Usage: node scripts/generate-pokemon-lookups.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "src/data");

const GEN_ORDER = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

function titleCaseSlug(slug) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function slotsFromAbilities(abilities) {
  const slots = [];
  for (const a of abilities ?? []) {
    if (!a?.ability?.name || a.is_hidden) continue;
    slots[a.slot - 1] = titleCaseSlug(a.ability.name);
  }
  return slots.filter(Boolean);
}

/**
 * Resolve non-hidden abilities as they existed in Gen 3.
 * PokeAPI past_abilities entries are partial slot overrides: `ability: null`
 * means that slot did not exist through that generation.
 */
function abilitiesAsOfGen3(pokemon) {
  const bySlot = new Map();
  for (const a of pokemon.abilities ?? []) {
    if (!a) continue;
    bySlot.set(a.slot, a);
  }

  const past = [...(pokemon.past_abilities ?? [])].sort(
    (a, b) =>
      (GEN_ORDER[a.generation?.name] ?? 99) -
      (GEN_ORDER[b.generation?.name] ?? 99),
  );

  for (const entry of past) {
    const lastGen = GEN_ORDER[entry.generation?.name] ?? 99;
    // Any past state that lasted through Gen 3+ also applies to Gen 3.
    if (lastGen < 3) continue;
    for (const a of entry.abilities ?? []) {
      if (!a) continue;
      if (a.ability == null) bySlot.delete(a.slot);
      else bySlot.set(a.slot, a);
    }
  }

  return slotsFromAbilities([...bySlot.values()]);
}

const NATURES = [
  "Hardy",
  "Lonely",
  "Brave",
  "Adamant",
  "Naughty",
  "Bold",
  "Docile",
  "Relaxed",
  "Impish",
  "Lax",
  "Timid",
  "Hasty",
  "Serious",
  "Jolly",
  "Naive",
  "Modest",
  "Mild",
  "Quiet",
  "Bashful",
  "Rash",
  "Calm",
  "Gentle",
  "Sassy",
  "Careful",
  "Quirky",
];

console.log("Fetching abilities…");
const abilityList = await fetchJson(
  "https://pokeapi.co/api/v2/ability?limit=400",
);
const abilities = abilityList.results
  .map((r) => {
    const id = Number(r.url.split("/").filter(Boolean).pop());
    return { id, name: titleCaseSlug(r.name), slug: r.name };
  })
  .filter((a) => a.id > 0 && a.id < 10000)
  .sort((a, b) => a.name.localeCompare(b.name));

console.log("Fetching Gen 3 moves…");
const moveList = await fetchJson("https://pokeapi.co/api/v2/move?limit=354");
const moves = new Array(355).fill(null);
for (const r of moveList.results) {
  const id = Number(r.url.split("/").filter(Boolean).pop());
  if (id >= 1 && id <= 354) moves[id] = titleCaseSlug(r.name);
}

console.log("Fetching species abilities (Gen 3–aware, 1–1025)…");
const speciesAbilities = {};
const batchSize = 40;
for (let start = 1; start <= 1025; start += batchSize) {
  const end = Math.min(start + batchSize - 1, 1025);
  await Promise.all(
    Array.from({ length: end - start + 1 }, (_, i) => start + i).map(
      async (id) => {
        const p = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`);
        // National Dex 1–386: Gen 3 Emerald sets. Later species: current non-hidden.
        speciesAbilities[String(id)] =
          id <= 386 ? abilitiesAsOfGen3(p) : slotsFromAbilities(p.abilities);
      },
    ),
  );
  process.stdout.write(`  ${end}/1025\r`);
}
console.log("\nWriting files…");

writeFileSync(
  join(dataDir, "natures.json"),
  JSON.stringify({ version: 1, natures: NATURES }),
);
writeFileSync(
  join(dataDir, "abilities.json"),
  JSON.stringify({ version: 1, count: abilities.length, abilities }),
);
writeFileSync(
  join(dataDir, "gen3-moves.json"),
  JSON.stringify({ version: 1, moves }),
);
writeFileSync(
  join(dataDir, "species-abilities.json"),
  JSON.stringify({ version: 1, generationHint: "iii-for-1-386", species: speciesAbilities }),
);

console.log(
  `Wrote natures (${NATURES.length}), abilities (${abilities.length}), moves, species-abilities.`,
);
