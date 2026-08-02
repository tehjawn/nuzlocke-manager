#!/usr/bin/env node
/**
 * Enrich src/data/held-items.json with Pokémon Showdown shortDesc text and
 * the real itemicons filename stem (Showdown is inconsistent: blackglasses vs
 * black-belt, nevermeltice vs mystic-water, etc.).
 *
 * Usage: node scripts/generate-held-item-descriptions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "src/data/held-items.json");

const ITEMS_JS_URL = "https://play.pokemonshowdown.com/data/items.js";
const ITEMICONS_DIR_URL =
  "https://play.pokemonshowdown.com/sprites/itemicons/?sort=name&view=dir";

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

/** Resolve Showdown `/sprites/itemicons/{stem}.png` filename stem. */
function resolveIconStem(slug, name, files) {
  const fromName = name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, "-");
  const candidates = [
    slug,
    slug.replace(/-/g, ""),
    fromName,
    fromName.replace(/-/g, ""),
  ];
  for (const stem of candidates) {
    if (files.has(`${stem}.png`)) return stem;
  }
  return null;
}

const [itemsRes, iconsRes] = await Promise.all([
  fetch(ITEMS_JS_URL),
  fetch(ITEMICONS_DIR_URL, {
    headers: { Referer: "https://play.pokemonshowdown.com/" },
  }),
]);
if (!itemsRes.ok) throw new Error(`${ITEMS_JS_URL} → ${itemsRes.status}`);
if (!iconsRes.ok) throw new Error(`${ITEMICONS_DIR_URL} → ${iconsRes.status}`);

const byKey = parseShowdownItemsJs(await itemsRes.text());
const iconHtml = await iconsRes.text();
const files = new Set(
  [...iconHtml.matchAll(/href="\.\/([^"]+\.png)"/gi)].map((m) => m[1]),
);

const data = JSON.parse(readFileSync(path, "utf8"));
let matchedDesc = 0;
let matchedIcon = 0;
const items = data.items.map((item) => {
  let description = null;
  for (const key of itemLookupKeys(item.slug, item.name)) {
    if (byKey.has(key)) {
      description = byKey.get(key);
      break;
    }
  }
  if (description) matchedDesc += 1;

  const icon = resolveIconStem(item.slug, item.name, files);
  if (icon) matchedIcon += 1;

  return { ...item, description, icon };
});

writeFileSync(
  path,
  `${JSON.stringify(
    {
      version: 3,
      count: items.length,
      source: "catalog+pokemon-showdown-items+itemicons",
      items,
    },
    null,
    0,
  )}\n`,
);

const missingDesc = items.filter((i) => !i.description).map((i) => i.name);
const missingIcon = items.filter((i) => !i.icon).map((i) => i.slug);
const iconOverrides = items.filter((i) => i.icon && i.icon !== i.slug);
console.log(
  `Descriptions: ${matchedDesc}/${items.length} (${missingDesc.length} missing).`,
);
console.log(
  `Icons: ${matchedIcon}/${items.length} (${missingIcon.length} missing, ${iconOverrides.length} filename overrides).`,
);
if (iconOverrides.length) {
  console.log(
    "Overrides:",
    iconOverrides.map((i) => `${i.slug}→${i.icon}`).join(", "),
  );
}
if (missingIcon.length) {
  console.log(
    "No individual PNG (sheet-only / unknown):",
    missingIcon.join(", "),
  );
}
