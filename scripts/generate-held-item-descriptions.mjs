#!/usr/bin/env node
/**
 * Enrich src/data/held-items.json with Pokémon Showdown shortDesc text.
 * Usage: node scripts/generate-held-item-descriptions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "src/data/held-items.json");

const ITEMS_JS_URL = "https://play.pokemonshowdown.com/data/items.js";

function unescapeJsString(raw) {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, " ")
    .replace(/\\\\/g, "\\");
}

/** Parse BattleItems shortDesc (or desc) keyed by Showdown id. */
function parseShowdownItemsJs(source) {
  const byKey = new Map();
  const entryRe =
    /([a-z0-9]+):\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi;
  let m;
  while ((m = entryRe.exec(source))) {
    const key = m[1].toLowerCase();
    const body = m[2];
    const short = body.match(/shortDesc:\s*"((?:\\.|[^"\\])*)"/);
    const desc = body.match(/(?:^|[,{])\s*desc:\s*"((?:\\.|[^"\\])*)"/);
    const text = unescapeJsString(short?.[1] ?? desc?.[1] ?? "").trim();
    if (text) byKey.set(key, text);
  }
  return byKey;
}

function itemLookupKeys(slug, name) {
  const slugKey = slug.replace(/-/g, "").toLowerCase();
  const nameKey = name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return [...new Set([slugKey, nameKey, slug.toLowerCase()])];
}

const res = await fetch(ITEMS_JS_URL);
if (!res.ok) throw new Error(`${ITEMS_JS_URL} → ${res.status}`);
const byKey = parseShowdownItemsJs(await res.text());

const data = JSON.parse(readFileSync(path, "utf8"));
let matched = 0;
const items = data.items.map((item) => {
  let description = null;
  for (const key of itemLookupKeys(item.slug, item.name)) {
    if (byKey.has(key)) {
      description = byKey.get(key);
      break;
    }
  }
  if (description) matched += 1;
  return { ...item, description };
});

writeFileSync(
  path,
  `${JSON.stringify(
    {
      version: 2,
      count: items.length,
      source: "catalog+pokemon-showdown-items",
      items,
    },
    null,
    0,
  )}\n`,
);

const missing = items.filter((i) => !i.description).map((i) => i.name);
console.log(
  `Wrote descriptions for ${matched}/${items.length} held items (${missing.length} missing).`,
);
if (missing.length && missing.length <= 40) {
  console.log("Missing:", missing.join(", "));
} else if (missing.length) {
  console.log(`Missing sample: ${missing.slice(0, 20).join(", ")}…`);
}
