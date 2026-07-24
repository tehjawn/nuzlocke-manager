/**
 * Parse Pokémon from Gen 3–style saves and Afterplay/RetroArch save states.
 *
 * Supports:
 * - Afterplay `#RZIPv` compressed save states (mGBA / RASTATE)
 * - Raw `.sav` / `.srm` flash saves (128 KiB / 64 KiB)
 *
 * Emerald Crest (and similar expansion hacks) XOR-encrypt the 48-byte data
 * section with repeating `pid ^ otId` instead of the vanilla LCG stream.
 * Both schemes are tried per candidate.
 */

import { findPokemonById } from "@/data/pokemon-index";

export type ParsedSavePokemon = {
  pid: number;
  nickname: string | null;
  species: string;
  pokedexId: number;
  level: number | null;
  isShiny: boolean;
  source: "party" | "box";
};

export type ParseSaveResult =
  | { ok: true; pokemon: ParsedSavePokemon[]; format: string; warnings: string[] }
  | { ok: false; error: string };

const GBA_STATE_SIZE = 0x61000;
const EWRAM_OFFSET = 0x21000;
const EWRAM_SIZE = 0x40000;
const MON_SIZE = 100;
const BOX_SIZE = 80;

/** Personality % 24 → position of each substructure type [G,A,E,M]. */
const POS_OF_TYPE: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 0, 3, 1],
  [3, 0, 2, 1],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
  [2, 3, 0, 1],
  [3, 2, 0, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 1, 3, 0],
  [3, 1, 2, 0],
  [2, 3, 1, 0],
  [3, 2, 1, 0],
];

const GEN3_CHAR: Record<number, string> = {
  0x7f: " ",
  0xab: "?",
  0xac: "?",
  0xb1: "&",
  0xb2: "+",
  0xb8: "!",
};
for (let i = 0; i < 10; i++) GEN3_CHAR[0xa1 + i] = String(i);
for (let i = 0; i < 26; i++) {
  GEN3_CHAR[0xbb + i] = String.fromCharCode(65 + i);
  GEN3_CHAR[0xd5 + i] = String.fromCharCode(97 + i);
}

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function decodeGen3Text(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    if (b === 0xff) break;
    out += GEN3_CHAR[b] ?? "";
  }
  return out.trim();
}

function readRzipChunks(
  buf: Uint8Array,
): { totalSize: number; chunks: Uint8Array[] } | null {
  if (buf.length < 24) return null;
  const magic = String.fromCharCode(...buf.subarray(0, 8));
  if (magic !== "#RZIPv\x01#") return null;

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const totalSize = Number(view.getBigUint64(12, true));
  if (totalSize <= 0 || totalSize > 32 * 1024 * 1024) return null;

  const chunks: Uint8Array[] = [];
  let offset = 20;
  while (offset + 4 <= buf.length) {
    const compSize = view.getUint32(offset, true);
    offset += 4;
    if (compSize <= 0 || offset + compSize > buf.length) break;
    chunks.push(buf.subarray(offset, offset + compSize));
    offset += compSize;
    if (chunks.length > 256) return null;
  }
  if (chunks.length === 0) return null;
  return { totalSize, chunks };
}

async function inflateRzipAsync(buf: Uint8Array): Promise<Uint8Array | null> {
  const parsed = readRzipChunks(buf);
  if (!parsed) return null;
  const parts: Uint8Array[] = [];
  for (const chunk of parsed.chunks) {
    const inflated = await inflateZlibAsync(chunk);
    if (!inflated) return null;
    parts.push(inflated);
    if (parts.reduce((n, p) => n + p.length, 0) >= parsed.totalSize) break;
  }
  return concatBytes(parts).subarray(0, parsed.totalSize);
}

async function inflateZlibAsync(chunk: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    // "deflate" = zlib wrapper (what RetroArch RZIP chunks use)
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([chunk as BlobPart]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function extractMgbaEwram(mem: Uint8Array): Uint8Array | null {
  if (mem.length < EWRAM_OFFSET + EWRAM_SIZE) return null;
  const version = new DataView(mem.buffer, mem.byteOffset, 4).getUint32(0, true);
  if ((version & 0xff000000) !== 0x01000000) return null;
  return mem.subarray(EWRAM_OFFSET, EWRAM_OFFSET + EWRAM_SIZE);
}

function extractRastateMem(state: Uint8Array): Uint8Array | null {
  if (state.length < 16) return null;
  const tag = String.fromCharCode(...state.subarray(0, 7));
  if (tag !== "RASTATE") return null;
  const view = new DataView(state.buffer, state.byteOffset, state.byteLength);
  let p = 8;
  while (p + 8 <= state.length) {
    const chunkTag = String.fromCharCode(...state.subarray(p, p + 4));
    const size = view.getUint32(p + 4, true);
    p += 8;
    if (chunkTag === "END ") break;
    if (p + size > state.length) return null;
    if (chunkTag === "MEM ") return state.subarray(p, p + size);
    p += size;
  }
  return null;
}

function cryptXor32(data: Uint8Array, key: number): Uint8Array {
  const out = new Uint8Array(data);
  const view = new DataView(out.buffer);
  for (let i = 0; i + 4 <= out.length; i += 4) {
    view.setUint32(i, (view.getUint32(i, true) ^ key) >>> 0, true);
  }
  return out;
}

function cryptLcg(data: Uint8Array, seed: number): Uint8Array {
  const out = new Uint8Array(data);
  const view = new DataView(out.buffer);
  let s = seed >>> 0;
  for (let i = 0; i + 2 <= out.length; i += 2) {
    s = (Math.imul(0x41c64e6d, s) + 0x00006073) >>> 0;
    const xor = (s >>> 16) & 0xffff;
    view.setUint16(i, view.getUint16(i, true) ^ xor, true);
  }
  return out;
}

function checksum48(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let sum = 0;
  for (let i = 0; i < 48; i += 2) sum = (sum + view.getUint16(i, true)) & 0xffff;
  return sum;
}

type RawMon = {
  pid: number;
  oid: number;
  nickname: string;
  speciesId: number;
  level: number | null;
  hp: number;
  maxHp: number;
  isShiny: boolean;
  offset: number;
  crypto: "xor32" | "lcg";
};

function tryParseMon(bytes: Uint8Array, offset: number): RawMon | null {
  if (offset + BOX_SIZE > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, BOX_SIZE);
  const pid = u32(view, 0);
  const oid = u32(view, 4);
  if (pid === 0) return null;

  const nickname = decodeGen3Text(bytes.subarray(offset + 8, offset + 18));
  if (
    nickname.length < 1 ||
    nickname.length > 10 ||
    !/^[A-Za-z0-9 .'\-♀♂?]+$/.test(nickname)
  ) {
    return null;
  }

  // Language: English is typically 2 on Emerald / Crest
  const language = bytes[offset + 18] ?? 0;
  if (language === 0 || language > 8) return null;

  const expect = u16(view, 28);
  if (expect === 0) return null;
  const enc = bytes.subarray(offset + 32, offset + 80);
  const key = (pid ^ oid) >>> 0;

  let dec: Uint8Array | null = null;
  let crypto: RawMon["crypto"] | null = null;
  const xor = cryptXor32(enc, key);
  if (checksum48(xor) === expect) {
    dec = xor;
    crypto = "xor32";
  } else {
    const lcg = cryptLcg(enc, key);
    if (checksum48(lcg) === expect) {
      dec = lcg;
      crypto = "lcg";
    }
  }
  if (!dec || !crypto) return null;

  const posOfType = POS_OF_TYPE[pid % 24]!;
  const growthPos = posOfType[0]!;
  const growthView = new DataView(dec.buffer, dec.byteOffset + growthPos * 12, 12);
  const speciesId = growthView.getUint16(0, true);
  // National dex through Gen 9 (+ headroom for hack forms)
  if (speciesId === 0 || speciesId > 1500) return null;
  if (!findPokemonById(speciesId) && !/^[A-Z]/.test(nickname)) return null;

  let level: number | null = null;
  let hp = 0;
  let maxHp = 0;
  if (offset + MON_SIZE <= bytes.length) {
    const lvl = bytes[offset + 84] ?? 0;
    const partyView = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset,
      MON_SIZE,
    );
    hp = partyView.getUint16(86, true);
    maxHp = partyView.getUint16(88, true);
    if (lvl >= 1 && lvl <= 100 && maxHp >= 1 && maxHp <= 999 && hp <= maxHp) {
      level = lvl;
    } else {
      hp = 0;
      maxHp = 0;
    }
  }

  const shiny =
    ((pid >>> 16) ^ (pid & 0xffff) ^ (oid >>> 16) ^ (oid & 0xffff)) < 8;

  return {
    pid,
    oid,
    nickname,
    speciesId,
    level,
    hp,
    maxHp,
    isShiny: shiny,
    offset,
    crypto,
  };
}

function collectMons(bytes: Uint8Array): RawMon[] {
  const best = new Map<number, RawMon>();
  for (let off = 0; off + BOX_SIZE <= bytes.length; off += 4) {
    const mon = tryParseMon(bytes, off);
    if (!mon) continue;
    const prev = best.get(mon.pid);
    if (!prev) {
      best.set(mon.pid, mon);
      continue;
    }
    // Prefer healed / party-stat copies over battle-damaged duplicates
    const score = (m: RawMon) =>
      (m.level != null ? 1000 : 0) + (m.maxHp > 0 ? 100 : 0) + m.hp;
    if (score(mon) > score(prev)) best.set(mon.pid, mon);
  }
  return [...best.values()].sort((a, b) => a.offset - b.offset);
}

function toParsed(mon: RawMon): ParsedSavePokemon {
  const entry = findPokemonById(mon.speciesId);
  const species =
    entry?.name ??
    (mon.nickname && /^[A-Z][a-z0-9-]*$/.test(mon.nickname)
      ? mon.nickname
      : `Species #${mon.speciesId}`);
  const nick =
    mon.nickname &&
    mon.nickname.toLowerCase() !== species.toLowerCase()
      ? mon.nickname
      : null;

  return {
    pid: mon.pid,
    nickname: nick,
    species,
    pokedexId: mon.speciesId,
    level: mon.level,
    isShiny: mon.isShiny,
    source: mon.level != null ? "party" : "box",
  };
}

function parseFromRegions(
  regions: { label: string; bytes: Uint8Array }[],
): ParseSaveResult {
  const warnings: string[] = [];
  let best: RawMon[] = [];
  let format = regions[0]?.label ?? "unknown";

  for (const region of regions) {
    const mons = collectMons(region.bytes);
    if (mons.length > best.length) {
      best = mons;
      format = region.label;
    }
  }

  if (best.length === 0) {
    return {
      ok: false,
      error:
        "No Pokémon found. Use an Afterplay save state or a Gen 3 .sav/.srm (in-game save).",
    };
  }

  const party = best.filter((m) => m.level != null);
  // Prefer party-stat copies (levels/HP). Fall back to box-only if that's all we found.
  const ordered = party.length > 0 ? party : best;
  if (party.length === 0) {
    warnings.push("No party stats found — showing box/PC Pokémon instead.");
  } else if (best.length > party.length) {
    warnings.push(
      `Skipped ${best.length - party.length} box-only Pokémon (party import only).`,
    );
  }
  if (ordered.some((m) => m.crypto === "xor32")) {
    warnings.push("Decoded with Crest-style encryption (pid⊕otId).");
  }

  return {
    ok: true,
    pokemon: ordered.map(toParsed),
    format,
    warnings,
  };
}

/** Parse uncompressed dumps / flash saves (no RZIP). */
export function parsePokemonSave(buf: Uint8Array): ParseSaveResult {
  if (buf.length >= 8) {
    const magic = String.fromCharCode(...buf.subarray(0, 8));
    if (magic === "#RZIPv\x01#") {
      return {
        ok: false,
        error: "Compressed Afterplay states require parsePokemonSaveAsync().",
      };
    }
  }

  if (buf.length >= 16 && String.fromCharCode(...buf.subarray(0, 7)) === "RASTATE") {
    return parseUncompressedState(buf);
  }

  const regions: { label: string; bytes: Uint8Array }[] = [];

  if (buf.length >= GBA_STATE_SIZE) {
    const ewram = extractMgbaEwram(buf);
    if (ewram) regions.push({ label: "mGBA state EWRAM", bytes: ewram });
  }

  if (buf.length === 0x20000 || buf.length === 0x10000 || buf.length === 0x20010) {
    regions.push({
      label: "Gen 3 flash save",
      bytes: buf.subarray(0, Math.min(buf.length, 0x20000)),
    });
  }

  regions.push({ label: "raw buffer", bytes: buf });
  return parseFromRegions(regions);
}

function parseUncompressedState(state: Uint8Array): ParseSaveResult {
  const regions: { label: string; bytes: Uint8Array }[] = [];
  const mem = extractRastateMem(state) ?? state;
  const ewram = extractMgbaEwram(mem);
  if (ewram) regions.push({ label: "Afterplay/mGBA EWRAM", bytes: ewram });
  regions.push({ label: "state memory", bytes: mem });
  return parseFromRegions(regions);
}

/** Preferred browser entry: handles Afterplay RZIP via DecompressionStream. */
export async function parsePokemonSaveAsync(
  buf: Uint8Array,
): Promise<ParseSaveResult> {
  if (buf.length >= 8) {
    const magic = String.fromCharCode(...buf.subarray(0, 8));
    if (magic === "#RZIPv\x01#") {
      const inflated = await inflateRzipAsync(buf);
      if (!inflated) {
        return {
          ok: false,
          error: "Couldn't decompress Afterplay save state.",
        };
      }
      return parseUncompressedState(inflated);
    }
  }
  return parsePokemonSave(buf);
}
