#!/usr/bin/env node
/**
 * Build move-name lookup from Modern Emerald (nzl_modern) MOVE_* #defines.
 * Usage: node scripts/generate-modern-moves.mjs [path/to/nzl_modern]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/gen3-moves-modern.json");
const localRoot = process.argv[2] ?? join(root, ".tmp/nzl_modern-main");
const localMoves = join(localRoot, "include/constants/moves.h");
const remoteMoves =
  "https://raw.githubusercontent.com/chethtrayen/nzl_modern/main/include/constants/moves.h";

function titleFromConst(name) {
  return name
    .replace(/^MOVE_/, "")
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

async function loadMovesH() {
  if (existsSync(localMoves)) {
    return readFileSync(localMoves, "utf8");
  }
  const res = await fetch(remoteMoves);
  if (!res.ok) throw new Error(`moves.h → ${res.status}`);
  return res.text();
}

const text = await loadMovesH();

const values = Object.create(null);
const moves = [null];

for (const raw of text.split("\n")) {
  const line = raw.trim();
  if (!line.startsWith("#define")) continue;

  const m = line.match(/^#define\s+(MOVE_[A-Z0-9_]+)\s+(.+)$/);
  if (!m) continue;

  const name = m[1];
  const expr = m[2].trim().split(/\s+\/\//)[0].trim();
  let id;
  if (/^\d+$/.test(expr)) id = Number(expr);
  else if (/^0x[0-9a-fA-F]+$/i.test(expr)) id = Number.parseInt(expr, 16);
  else if (values[expr] != null) id = values[expr];
  else continue;

  values[name] = id;
  if (id <= 0 || id === 0xffff) continue;
  while (moves.length <= id) moves.push(null);
  if (moves[id] == null) moves[id] = titleFromConst(name);
}

const count = values.MOVES_COUNT ?? moves.length;
const trimmed = moves.slice(0, count);

writeFileSync(
  outPath,
  JSON.stringify({
    version: 1,
    source: "chethtrayen/nzl_modern include/constants/moves.h",
    moves: trimmed,
  }),
);

console.log(
  `Wrote ${trimmed.filter(Boolean).length} modern moves (len ${trimmed.length}). 359=${trimmed[359]} 362=${trimmed[362]}`,
);
