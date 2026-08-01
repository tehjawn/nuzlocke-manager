#!/usr/bin/env node
/**
 * Smoke-test save parsing for Modern Emerald .ss0 and Afterplay RZIP states.
 * Usage: node scripts/test-modern-save.mjs [path]
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const modern = require(join(root, "src/data/modern-emerald-species.json"));
const pokemon = require(join(root, "src/data/pokemon.json"));
const byId = new Map(pokemon.pokemon.map((p) => [p.pokedexId, p.name]));

const POS = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
  [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
  [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
];
const GEN3 = { 0x7f: " " };
for (let i = 0; i < 26; i++) {
  GEN3[0xbb + i] = String.fromCharCode(65 + i);
  GEN3[0xd5 + i] = String.fromCharCode(97 + i);
}

function decode(b) {
  let s = "";
  for (const x of b) {
    if (x === 0xff) break;
    s += GEN3[x] ?? "";
  }
  return s.trim();
}

function extractGbas(buf) {
  if (buf[0] !== 0x89) return null;
  let off = 8;
  while (off + 8 <= buf.length) {
    const length = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("binary");
    const data = buf.subarray(off + 8, off + 8 + length);
    if (type === "gbAs") return inflateSync(data);
    off += 12 + length;
    if (type === "IEND") break;
  }
  return null;
}

function inflateRzip(buf) {
  const totalSize = Number(buf.readBigUInt64LE(12));
  let offset = 20;
  const parts = [];
  while (offset < buf.length && Buffer.concat(parts).length < totalSize) {
    const compSize = buf.readUInt32LE(offset);
    offset += 4;
    parts.push(inflateSync(buf.subarray(offset, offset + compSize)));
    offset += compSize;
  }
  return Buffer.concat(parts).subarray(0, totalSize);
}

function loadEwram(path) {
  const raw = readFileSync(path);
  if (raw.subarray(0, 8).toString() === "#RZIPv\x01#") {
    const state = inflateRzip(raw);
    return state.subarray(0x21000 + 16, 0x61000 + 16); // Afterplay: 16-byte hdr then mem?
  }
  const gbas = extractGbas(raw);
  if (gbas) {
    // mGBA dump: EWRAM at 0x21000
    return gbas.subarray(0x21000, 0x61000);
  }
  throw new Error(`Unrecognized format: ${path}`);
}

function scan(ewram) {
  const found = [];
  for (let off = 0; off + 100 <= ewram.length; off += 4) {
    const pid = ewram.readUInt32LE(off);
    const oid = ewram.readUInt32LE(off + 4);
    if (!pid) continue;
    const chk = ewram.readUInt16LE(off + 28);
    const key = (pid ^ oid) >>> 0;
    const data = Buffer.from(ewram.subarray(off + 32, off + 80));
    for (let i = 0; i < 48; i += 4) {
      data.writeUInt32LE((data.readUInt32LE(i) ^ key) >>> 0, i);
    }
    let sum = 0;
    for (let i = 0; i < 48; i += 2) sum = (sum + data.readUInt16LE(i)) & 0xffff;
    if (sum !== chk) continue;
    const pos = POS[pid % 24][0];
    const speciesId = data.readUInt16LE(pos * 12);
    const level = ewram[off + 84];
    const maxHp = ewram.readUInt16LE(off + 88);
    if (level < 1 || level > 100 || maxHp === 0) continue;
    const nick = decode(ewram.subarray(off + 8, off + 18));
    const national = modern.table[speciesId] || speciesId;
    if (!found.some((f) => f.pid === pid)) {
      found.push({
        nick,
        speciesId,
        national,
        name: byId.get(national) ?? `?${national}`,
        level,
        hp: ewram.readUInt16LE(off + 86),
        maxHp,
        pid,
      });
    }
  }
  return found;
}

const path = process.argv[2] ?? `${process.env.HOME}/Downloads/revive_token_true.ss0`;
const ewram = loadEwram(path);
const mons = scan(ewram);
console.log(`File: ${path}`);
console.log(`EWRAM: ${ewram.length} bytes`);
console.log("Mons (Modern Emerald remap):");
for (const m of mons) console.log(m);

const nosepass = mons.find((m) => m.national === 299 || m.speciesId === 320);
const pooch = mons.find((m) => m.national === 261 || m.name === "Poochyena");
if (path.includes("revive_token")) {
  if (!pooch) {
    console.error("FAIL: expected Poochyena (species 286 → national 261)");
    process.exit(1);
  }
  if (pooch.name !== "Poochyena") {
    console.error("FAIL: Poochyena mislabeled as", pooch.name);
    process.exit(1);
  }
  console.log("OK: Poochyena remapped correctly (would have been Breloom as national 286)");
  if (nosepass) console.log("Nosepass present:", nosepass);
  else console.log("Note: Nosepass not in this save (party has", mons.map((m) => m.name).join(", "), ")");
}
