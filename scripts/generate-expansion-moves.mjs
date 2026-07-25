#!/usr/bin/env node
/**
 * Build move-name lookup from pokeemerald-expansion constants (Emerald Crest).
 * Usage: node scripts/generate-expansion-moves.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/gen3-moves.json");
const MOVES_H =
  "https://raw.githubusercontent.com/rh-hideout/pokeemerald-expansion/master/include/constants/moves.h";

function titleFromConst(name) {
  return name
    .replace(/^MOVE_/, "")
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

const res = await fetch(MOVES_H);
if (!res.ok) throw new Error(`moves.h → ${res.status}`);
const text = await res.text();

const values = Object.create(null);
const moves = [null];
let next = 0;
let inEnum = false;

for (const raw of text.split("\n")) {
  const line = raw.trim();
  if (line.startsWith("enum")) {
    inEnum = true;
    next = 0;
    continue;
  }
  if (!inEnum) continue;
  if (line.startsWith("}")) {
    inEnum = false;
    continue;
  }
  if (!line || line.startsWith("//") || line.startsWith("/*")) continue;

  const m = line.match(/^([A-Z0-9_]+)\s*(?:=\s*([^,/]+))?\s*,?/);
  if (!m) continue;
  const name = m[1];
  let id;
  if (m[2]) {
    const expr = m[2].trim();
    if (/^\d+$/.test(expr)) id = Number(expr);
    else if (values[expr] != null) id = values[expr];
    else continue;
  } else {
    id = next;
  }
  values[name] = id;
  next = id + 1;

  if (!name.startsWith("MOVE_") || id <= 0) continue;
  while (moves.length <= id) moves.push(null);
  if (moves[id] == null) moves[id] = titleFromConst(name);
}

const count = values.MOVES_COUNT ?? values.MOVES_COUNT_GEN9 ?? moves.length;
const trimmed = moves.slice(0, count);

writeFileSync(
  outPath,
  JSON.stringify({
    version: 2,
    source: "pokeemerald-expansion",
    moves: trimmed,
  }),
);

console.log(
  `Wrote ${trimmed.filter(Boolean).length} moves (len ${trimmed.length}). 522=${trimmed[522]} 525=${trimmed[525]}`,
);
