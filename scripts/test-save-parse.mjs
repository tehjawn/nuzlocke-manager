import { readFileSync } from "fs";
import { inflateSync } from "zlib";

// Minimal inline test mirroring parser crypto (avoid TS path aliases)
const POS_OF_TYPE = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
  [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
  [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
];

function inflateRzip(buf) {
  const totalSize = Number(buf.readBigUInt64LE(12));
  let offset = 20;
  const parts = [];
  while (offset < buf.length && Buffer.concat(parts).length < totalSize) {
    const compSize = buf.readUInt32LE(offset); offset += 4;
    parts.push(inflateSync(buf.subarray(offset, offset + compSize)));
    offset += compSize;
  }
  return Buffer.concat(parts).subarray(0, totalSize);
}

const path = process.argv[2] ?? `${process.env.HOME}/Downloads/save.state`;
const raw = readFileSync(path);
const state = inflateRzip(raw);
const mem = state.subarray(16);
const ewram = mem.subarray(0x21000, 0x61000);

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

const found = [];
for (let off = 0; off + 100 <= ewram.length; off += 4) {
  const pid = ewram.readUInt32LE(off);
  const oid = ewram.readUInt32LE(off + 4);
  if (!pid) continue;
  const chk = ewram.readUInt16LE(off + 28);
  const key = (pid ^ oid) >>> 0;
  const data = Buffer.from(ewram.subarray(off + 32, off + 80));
  for (let i = 0; i < 48; i += 4) data.writeUInt32LE((data.readUInt32LE(i) ^ key) >>> 0, i);
  let sum = 0;
  for (let i = 0; i < 48; i += 2) sum = (sum + data.readUInt16LE(i)) & 0xffff;
  if (sum !== chk) continue;
  const pos = POS_OF_TYPE[pid % 24][0];
  const species = data.readUInt16LE(pos * 12);
  const level = ewram[off + 84];
  const maxHp = ewram.readUInt16LE(off + 88);
  if (level < 1 || level > 100 || maxHp === 0) continue;
  const nick = decode(ewram.subarray(off + 8, off + 18));
  if (!found.some((f) => f.pid === pid)) {
    found.push({ nick, species, level, pid });
  }
}
console.log(found);