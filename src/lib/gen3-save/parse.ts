/**
 * Parse Pokémon + trainer meta from Gen 3–style saves and Afterplay states.
 *
 * Target ROM: Pokémon Modern Emerald (nzl_modern / classic Gen 3 species IDs).
 * Crest / pokeemerald-expansion national IDs are still detected as a fallback.
 *
 * Categories:
 * - party: 6-slot playerParty (only filled slots)
 * - encountered: post-party wild buffer ∪ Pokédex "seen" species not already
 *   present as full party/box/rip mons (species-only stubs when dex-only)
 * - box: remaining PC / storage Pokémon
 * - rip: nuzlocke-ribbon cemetery mons, or storage copies with 0 HP
 *
 * Encryption: repeating `pid ^ otId` (xor32) and vanilla LCG are both tried.
 *
 * Also accepts libretro/mGBA screenshot-states (`.ss0`–`.ss9`): PNG with a
 * zlib-compressed `gbAs` memory dump chunk.
 */

import { findPokemonById } from "@/data/pokemon-index";
import {
  abilityForSpecies,
  gen3ItemName,
  gen3MetLocationName,
  natureFromPid,
} from "@/data/pokemon-lookups";
import { gen3MoveName } from "@/lib/move-names";
import type { StatSpread } from "@/lib/stats";
import { EMPTY_EVS, EMPTY_IVS } from "@/lib/stats";
import { looksLikeFlashSave, parseFlashSave } from "./flash";
import {
  BOX_MON_SIZE,
  CREST_DEX_FLAG_BYTES,
  CREST_DEX_MAX_SPECIES,
  CREST_FLAGS_AFTER_PARTY,
  CREST_NUZLOCKE_FLAGS_AFTER_PARTY,
  CREST_SEEN1_AFTER_PARTY,
  FLAG_BADGE01,
  FLAGS_AFTER_PARTY as MODERN_FLAGS_AFTER_PARTY,
  MODERN_DEX_FLAG_BYTES,
  MODERN_NUM_SPECIES,
  MODERN_REVIVES_TOTAL,
  MODERN_SPECIES_TO_NATIONAL,
  NUZLOCKE_FLAGS_AFTER_PARTY as MODERN_NUZLOCKE_FLAGS_AFTER_PARTY,
  PARTY_MON_SIZE,
  PARTY_SLOTS,
  REVIVES_USED_MASK,
  SB1_FLAGS,
  CREST_SB1_FLAGS,
  SB1_NUZLOCKE_ENCOUNTER_FLAGS,
  SB1_NUZLOCKE_FLAGS_LEN,
  SB1_PARTY,
  SB1_PARTY_COUNT,
  SB1_REVIVES_USED,
  SB1_REVIVES_USED_BYTE,
  SB1_SEEN1,
  SEEN1_AFTER_PARTY as MODERN_SEEN1_AFTER_PARTY,
  STORAGE_BOX_CAPACITY,
  STORAGE_BOX_COUNT,
  STORAGE_BOXES,
  SYSTEM_FLAGS,
} from "./layout";

export type SaveMonCategory = "party" | "box" | "rip" | "encountered";

type SpeciesIdMode = "modern" | "crest";

export type ParsedSavePokemon = {
  pid: number;
  nickname: string | null;
  species: string;
  pokedexId: number;
  level: number | null;
  isShiny: boolean;
  nature: string | null;
  ability: string | null;
  heldItem: string | null;
  catchRoute: string | null;
  moves: string[];
  ivs: StatSpread;
  evs: StatSpread;
  category: SaveMonCategory;
};

export type ParsedSaveTrainer = {
  name: string;
  gender: "M" | "F" | null;
};

export type ParsedSaveBadges = {
  /** Keys matching DEFAULT_BADGE_DEFINITIONS gym-1 … gym-8 */
  earnedKeys: string[];
  /** True when flag bytes looked coherent enough to trust. */
  reliable: boolean;
};

/** Modern Emerald nuzlocke revive token (TX_NUZLOCKE_REVIVES). */
export type ParsedSaveRevive = {
  /** True when the in-game revive has been spent. */
  used: boolean;
  /** Remaining revives (0–15). */
  remaining: number;
  reliable: boolean;
};

export type ParseSaveResult =
  | {
      ok: true;
      format: string;
      warnings: string[];
      trainer: ParsedSaveTrainer | null;
      badges: ParsedSaveBadges;
      revive: ParsedSaveRevive;
      party: ParsedSavePokemon[];
      box: ParsedSavePokemon[];
      rip: ParsedSavePokemon[];
      encountered: ParsedSavePokemon[];
    }
  | { ok: false; error: string };

const GBA_STATE_SIZE = 0x61000;
const EWRAM_OFFSET = 0x21000;
const EWRAM_SIZE = 0x40000;
const MON_SIZE = PARTY_MON_SIZE;
const BOX_SIZE = BOX_MON_SIZE;
/** Cap dex-only stubs so late-game national dex cannot blow past import limits. */
const DEX_SEEN_STUB_CAP = 200;

function flagsAfterParty(mode: SpeciesIdMode): number {
  return mode === "modern" ? MODERN_FLAGS_AFTER_PARTY : CREST_FLAGS_AFTER_PARTY;
}

function seen1AfterParty(mode: SpeciesIdMode): number {
  return mode === "modern" ? MODERN_SEEN1_AFTER_PARTY : CREST_SEEN1_AFTER_PARTY;
}

function nuzlockeFlagsAfterParty(mode: SpeciesIdMode): number {
  return mode === "modern"
    ? MODERN_NUZLOCKE_FLAGS_AFTER_PARTY
    : CREST_NUZLOCKE_FLAGS_AFTER_PARTY;
}
/** Synthetic PID prefix for dex-only encounter stubs (avoids real PID clashes). */
const DEX_SEEN_PID_BASE = 0xde000000;
/**
 * Crest seen/owned bitfields have been observed near mid-EWRAM (~0x27bxx).
 * Search preferred windows first; only fall through to the rest of EWRAM if needed.
 */
const DEX_BITFIELD_WINDOWS: readonly (readonly [number, number])[] = [
  [0x25000, 0x2d000],
  [0x10000, 0x25000],
  [0x2d000, 0x40000],
  [0x0, 0x10000],
];
/** Cleartext dex UI table materializes near the start of EWRAM when present. */
const DEX_TABLE_SCAN_END = 0x8000;

const EMPTY_REVIVE: ParsedSaveRevive = {
  used: false,
  remaining: MODERN_REVIVES_TOTAL,
  reliable: false,
};

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

function readPngChunks(
  buf: Uint8Array,
): { type: string; data: Uint8Array }[] | null {
  if (buf.length < 8) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) return null;
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const chunks: { type: string; data: Uint8Array }[] = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const length = view.getUint32(off, false);
    const type = String.fromCharCode(...buf.subarray(off + 4, off + 8));
    if (off + 12 + length > buf.length) return null;
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + length) });
    off += 12 + length;
    if (type === "IEND") break;
  }
  return chunks.length ? chunks : null;
}

/** libretro/mGBA screenshot-state: zlib `gbAs` chunk holds the memory dump. */
async function extractGbaScreenshotStateAsync(
  buf: Uint8Array,
): Promise<Uint8Array | null> {
  const chunks = readPngChunks(buf);
  if (!chunks) return null;
  const gbas = chunks.find((c) => c.type === "gbAs");
  if (!gbas || gbas.data.length < 2) return null;
  return inflateZlibAsync(gbas.data);
}

function modernNationalId(speciesId: number): number | null {
  if (speciesId <= 0 || speciesId >= MODERN_SPECIES_TO_NATIONAL.length) {
    return null;
  }
  const nd = MODERN_SPECIES_TO_NATIONAL[speciesId] ?? 0;
  return nd > 0 ? nd : null;
}

function resolvePokedexId(speciesId: number, mode: SpeciesIdMode): number {
  if (mode === "modern") {
    return modernNationalId(speciesId) ?? speciesId;
  }
  return speciesId;
}

function speciesModeScore(
  samples: { speciesId: number; nickname: string }[],
  mode: SpeciesIdMode,
): number {
  let score = 0;
  for (const sample of samples) {
    const dexId = resolvePokedexId(sample.speciesId, mode);
    const entry = findPokemonById(dexId);
    if (!entry) {
      score -= 1;
      continue;
    }
    score += 1;
    if (
      sample.nickname &&
      sample.nickname.toLowerCase() === entry.name.toLowerCase()
    ) {
      score += 3;
    }
    if (mode === "modern" && modernNationalId(sample.speciesId) === dexId) {
      // Prefer modern when the Gen 3 internal id differs from national.
      if (dexId !== sample.speciesId) score += 1;
    }
    if (mode === "crest" && sample.speciesId > MODERN_NUM_SPECIES) {
      score += 2;
    }
  }
  return score;
}

function detectSpeciesMode(
  samples: { speciesId: number; nickname: string }[],
): SpeciesIdMode {
  if (samples.length === 0) return "modern";
  if (samples.some((s) => s.speciesId > MODERN_NUM_SPECIES)) return "crest";
  const modern = speciesModeScore(samples, "modern");
  const crest = speciesModeScore(samples, "crest");
  return modern >= crest ? "modern" : "crest";
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
  /** Raw species field from the growth substruct (ROM-specific id space). */
  speciesId: number;
  level: number | null;
  hp: number;
  maxHp: number;
  isShiny: boolean;
  nature: string;
  abilitySlot: number;
  heldItem: string | null;
  catchRoute: string | null;
  moves: string[];
  ivs: StatSpread;
  evs: StatSpread;
  nuzlockeRibbon: boolean;
  /** Modern Emerald growth.box_hp (0 on party; PC uses 0 for fainted). */
  boxHp: number | null;
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
  const attacksPos = posOfType[1]!;
  const evPos = posOfType[2]!;
  const miscPos = posOfType[3]!;

  const growthView = new DataView(dec.buffer, dec.byteOffset + growthPos * 12, 12);
  const attacksView = new DataView(
    dec.buffer,
    dec.byteOffset + attacksPos * 12,
    12,
  );
  const evView = new DataView(dec.buffer, dec.byteOffset + evPos * 12, 12);
  const miscView = new DataView(dec.buffer, dec.byteOffset + miscPos * 12, 12);

  const speciesId = growthView.getUint16(0, true);
  if (speciesId === 0 || speciesId > 1500) return null;
  const modernId = modernNationalId(speciesId);
  const known =
    findPokemonById(speciesId) != null ||
    (modernId != null && findPokemonById(modernId) != null);
  if (!known && !/^[A-Z]/.test(nickname)) return null;

  const itemId = growthView.getUint16(2, true);
  const heldItem = gen3ItemName(itemId);

  const moves: string[] = [];
  for (let i = 0; i < 4; i++) {
    const moveId = attacksView.getUint16(i * 2, true);
    const name = gen3MoveName(moveId);
    if (name) moves.push(name);
  }

  const evs: StatSpread = {
    hp: evView.getUint8(0),
    atk: evView.getUint8(1),
    def: evView.getUint8(2),
    spe: evView.getUint8(3),
    spa: evView.getUint8(4),
    spd: evView.getUint8(5),
  };

  const metLocation = miscView.getUint8(1);
  const catchRoute = gen3MetLocationName(metLocation);

  const ivAbility = miscView.getUint32(4, true);
  const ivs: StatSpread = {
    hp: ivAbility & 0x1f,
    atk: (ivAbility >>> 5) & 0x1f,
    def: (ivAbility >>> 10) & 0x1f,
    spe: (ivAbility >>> 15) & 0x1f,
    spa: (ivAbility >>> 20) & 0x1f,
    spd: (ivAbility >>> 25) & 0x1f,
  };
  const abilitySlot = (ivAbility >>> 31) & 1;
  // Modern Emerald: unusedRibbons:3 + nuzlockeRibbon:1 + fateful:1 at end of ribbon u32.
  const ribbonWord = miscView.getUint32(8, true);
  const nuzlockeRibbon = ((ribbonWord >>> 30) & 1) === 1;
  // Modern growth ends with box_hp; vanilla pads — reading is harmless either way.
  const boxHp = growthView.getUint8(11);

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
    nature: natureFromPid(pid),
    abilitySlot,
    heldItem,
    catchRoute,
    moves,
    ivs,
    evs,
    nuzlockeRibbon,
    boxHp: maxHp > 0 ? null : boxHp, // only meaningful for BoxPokemon
    offset,
    crypto,
  };
}

function monScore(m: RawMon): number {
  return (m.level != null ? 1000 : 0) + (m.maxHp > 0 ? 100 : 0) + m.hp;
}

function toParsed(
  mon: RawMon,
  category: SaveMonCategory,
  mode: SpeciesIdMode,
): ParsedSavePokemon {
  const pokedexId = resolvePokedexId(mon.speciesId, mode);
  const entry = findPokemonById(pokedexId);
  const species =
    entry?.name ??
    (mon.nickname && /^[A-Z][a-z0-9-]*$/.test(mon.nickname)
      ? mon.nickname
      : `Species #${pokedexId}`);
  const nick =
    mon.nickname && mon.nickname.toLowerCase() !== species.toLowerCase()
      ? mon.nickname
      : null;

  return {
    pid: mon.pid,
    nickname: nick,
    species,
    pokedexId,
    level: mon.level,
    isShiny: mon.isShiny,
    nature: mon.nature,
    ability: abilityForSpecies(pokedexId, mon.abilitySlot),
    heldItem: mon.heldItem,
    catchRoute: mon.catchRoute,
    moves: mon.moves,
    ivs: mon.ivs ?? { ...EMPTY_IVS },
    evs: mon.evs ?? { ...EMPTY_EVS },
    category,
  };
}

/** Find 6-slot party arrays; prefer healed storage copies. */
function rankPartyBases(bytes: Uint8Array): {
  withPost: number[];
  withoutPost: number[];
} {
  const scored: { off: number; base: number; post: number }[] = [];

  // Best (highest monScore) copy per PID — live party slots should reference these.
  const bestOffsetByPid = new Map<number, number>();
  const bestScoreByPid = new Map<number, number>();
  for (let off = 0; off + MON_SIZE <= bytes.length; off += 4) {
    const mon = tryParseMon(bytes, off);
    if (!mon || mon.level == null) continue;
    const score = monScore(mon);
    const prev = bestScoreByPid.get(mon.pid);
    if (prev == null || score > prev) {
      bestScoreByPid.set(mon.pid, score);
      bestOffsetByPid.set(mon.pid, mon.offset);
    }
  }

  for (let off = 0; off + PARTY_SLOTS * MON_SIZE <= bytes.length; off += 4) {
    let filled = 0;
    let heal = 0;
    let valid = true;
    let seenEmpty = false;
    let bestCopies = 0;
    for (let i = 0; i < PARTY_SLOTS; i++) {
      const slotOff = off + i * MON_SIZE;
      const pid = new DataView(
        bytes.buffer,
        bytes.byteOffset + slotOff,
        4,
      ).getUint32(0, true);
      if (pid === 0 || pid === 0xffffffff) {
        seenEmpty = true;
        continue;
      }
      // Real parties are compacted — a filled slot after an empty is a false window.
      if (seenEmpty) {
        valid = false;
        break;
      }
      const mon = tryParseMon(bytes, slotOff);
      if (!mon || mon.level == null) {
        valid = false;
        break;
      }
      filled += 1;
      heal += mon.hp;
      if (bestOffsetByPid.get(mon.pid) === mon.offset) bestCopies += 1;
    }
    if (!valid || filled === 0) continue;
    // Reject windows that stitch together stale secondary copies of party mons.
    if (bestCopies < filled) continue;

    // Crest: post-party living mons (wild buffer). Always scored so Modern can
    // re-rank without a second full-buffer scan.
    let post = 0;
    const postBase = off + PARTY_SLOTS * MON_SIZE;
    for (let i = 0; i < 12; i++) {
      const m = tryParseMon(bytes, postBase + i * MON_SIZE);
      if (!m || m.level == null || m.hp <= 0) break;
      post += 1;
    }

    // Prefer windows that look like SaveBlock1.playerParty (badge flags coherent).
    const badgesModern = readBadges(bytes, off, "modern");
    const badgesCrest = badgesModern.reliable
      ? badgesModern
      : readBadges(bytes, off, "crest");
    const saveblockBonus = badgesCrest.reliable ? 5000 : 0;

    scored.push({
      off,
      base: saveblockBonus + filled * 1000 + heal - off * 0.0001,
      post,
    });
  }

  const keepTop = (preferPostParty: boolean): number[] => {
    const sorted = [...scored].sort((a, b) => {
      const scoreA = a.base + (preferPostParty ? a.post * 100 : 0);
      const scoreB = b.base + (preferPostParty ? b.post * 100 : 0);
      return scoreB - scoreA;
    });
    // Dedupe overlapping windows — keep best only per ~600-byte neighborhood
    const kept: number[] = [];
    for (const s of sorted) {
      if (kept.some((k) => Math.abs(k - s.off) < PARTY_SLOTS * MON_SIZE)) {
        continue;
      }
      kept.push(s.off);
      if (kept.length >= 4) break;
    }
    return kept;
  };

  return {
    withPost: keepTop(true),
    withoutPost: keepTop(false),
  };
}

function readSlotArray(
  bytes: Uint8Array,
  base: number,
  maxSlots: number,
): RawMon[] {
  const out: RawMon[] = [];
  let empties = 0;
  for (let i = 0; i < maxSlots; i++) {
    const off = base + i * MON_SIZE;
    if (off + MON_SIZE > bytes.length) break;
    const pid = new DataView(bytes.buffer, bytes.byteOffset + off, 4).getUint32(
      0,
      true,
    );
    if (pid === 0) {
      empties += 1;
      if (empties >= 2 && out.length > 0) break;
      continue;
    }
    empties = 0;
    const mon = tryParseMon(bytes, off);
    if (mon && mon.level != null) out.push(mon);
    else if (out.length > 0) break;
  }
  return out;
}

function findTrainer(bytes: Uint8Array, partyOid: number | null): ParsedSaveTrainer | null {
  // SaveBlock2 starts with playerName[8]; gender at +8; trainerId at +0xA
  for (let i = 0; i + 16 < bytes.length; i++) {
    if (bytes[i + 7] !== 0xff && bytes[i + 3] !== 0xff) continue;
    const name = decodeGen3Text(bytes.subarray(i, i + 8));
    if (!/^[A-Za-z][A-Za-z0-9]{1,6}$/.test(name)) continue;
    const genderByte = bytes[i + 8] ?? 0xff;
    if (genderByte > 1) continue;
    const tid = new DataView(bytes.buffer, bytes.byteOffset + i + 0xa, 4).getUint32(
      0,
      true,
    );
    // Prefer names whose block is near a matching OT id from party
    if (partyOid != null) {
      // OT id is often nearby in summary structs; SB2 trainer id is related but not always equal
      void tid;
    }
    // Heuristic: next bytes after name look like SB2 (playtime / options small ints)
    const b9 = bytes[i + 9] ?? 0xff;
    if (b9 !== 0 && b9 !== 0xff) continue;
    return { name, gender: genderByte === 1 ? "F" : "M" };
  }
  return null;
}

function findTrainerNearParty(
  bytes: Uint8Array,
  partyMons: RawMon[],
): ParsedSaveTrainer | null {
  if (partyMons.length === 0) return findTrainer(bytes, null);
  const otName = decodeGen3Text(
    // OT is on the mon at +20; party OT name should match trainer
    bytes.subarray(partyMons[0]!.offset + 20, partyMons[0]!.offset + 27),
  );
  if (/^[A-Za-z][A-Za-z0-9]{1,6}$/.test(otName)) {
    return { name: otName, gender: null };
  }
  return findTrainer(bytes, partyMons[0]!.oid);
}

function readBadges(
  bytes: Uint8Array,
  partyBase: number | null,
  mode: SpeciesIdMode = "modern",
): ParsedSaveBadges {
  const empty: ParsedSaveBadges = { earnedKeys: [], reliable: false };
  if (partyBase == null) return empty;

  const flagsBase = partyBase + flagsAfterParty(mode);
  if (flagsBase + 0x120 >= bytes.length) return empty;

  const flagGet = (flag: number) => {
    const i = flag >> 3;
    const b = flag & 7;
    return ((bytes[flagsBase + i]! >> b) & 1) === 1;
  };

  // Require SYS_POKEMON_GET for a coherent flags block
  if (!flagGet(SYSTEM_FLAGS)) {
    return empty;
  }

  const earnedKeys: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (flagGet(FLAG_BADGE01 + i)) earnedKeys.push(`gym-${i + 1}`);
  }
  // Gym badges are earned in order — a non-prefix set means the wrong flags base.
  for (let i = 0; i < earnedKeys.length; i++) {
    if (earnedKeys[i] !== `gym-${i + 1}`) return empty;
  }
  return { earnedKeys, reliable: true };
}

function dexBitSet(bytes: Uint8Array, base: number, speciesId: number): boolean {
  const bit = speciesId - 1;
  const off = base + (bit >> 3);
  if (off < 0 || off >= bytes.length) return false;
  return ((bytes[off]! >> (bit & 7)) & 1) === 1;
}

function dexPopcount(bytes: Uint8Array, base: number, n: number): number {
  let c = 0;
  for (let i = 0; i < n; i++) {
    let b = bytes[base + i] ?? 0;
    while (b) {
      c += b & 1;
      b >>>= 1;
    }
  }
  return c;
}

function listDexBits(
  bytes: Uint8Array,
  base: number,
  maxSpecies: number,
): number[] {
  const out: number[] = [];
  for (let s = 1; s <= maxSpecies; s++) {
    if (dexBitSet(bytes, base, s)) out.push(s);
  }
  return out;
}

/**
 * Crest sometimes materializes a cleartext national-dex table
 * `{ u16 speciesId; u16 flags }` at stride 4 (bit0=seen, bit1=owned).
 */
function findDexSpeciesTable(bytes: Uint8Array): number | null {
  const scanEnd = Math.min(bytes.length, DEX_TABLE_SCAN_END);
  for (let off = 4; off + 4 * 40 < scanEnd; off += 2) {
    if ((bytes[off]! | (bytes[off + 1]! << 8)) !== 1) continue;
    let ok = true;
    for (let i = 0; i < 40; i++) {
      const o = off + i * 4;
      const id = bytes[o]! | (bytes[o + 1]! << 8);
      const flags = bytes[o + 2]! | (bytes[o + 3]! << 8);
      if (id !== 1 + i || flags > 7) {
        ok = false;
        break;
      }
    }
    if (ok) return off - 4; // species 0 slot
  }
  return null;
}

function dexTableFlags(
  bytes: Uint8Array,
  tableBase: number,
  speciesId: number,
): number | null {
  const off = tableBase + speciesId * 4;
  if (off + 3 >= bytes.length) return null;
  const id = bytes[off]! | (bytes[off + 1]! << 8);
  if (id !== speciesId) return null;
  return bytes[off + 2]! | (bytes[off + 3]! << 8);
}

/** Reject false-positive tables that don't mark party species as owned. */
function dexTableMatchesOwned(
  bytes: Uint8Array,
  tableBase: number,
  ownedMust: number[],
): boolean {
  if (ownedMust.length === 0) return false;
  for (const speciesId of ownedMust) {
    const flags = dexTableFlags(bytes, tableBase, speciesId);
    if (flags == null || (flags & 1) === 0 || (flags & 2) === 0) return false;
  }
  return true;
}

function readDexTableSeen(
  bytes: Uint8Array,
  tableBase: number,
  maxSpecies: number,
): number[] {
  const seen: number[] = [];
  for (let s = 1; s <= maxSpecies; s++) {
    const flags = dexTableFlags(bytes, tableBase, s);
    if (flags == null) {
      if (s > 100) break;
      continue;
    }
    if (flags & 1) seen.push(s);
  }
  return seen;
}

/**
 * Locate `seen[N]` + `owned[N]` bitfields. Owned must cover party species;
 * seen must cover party ∪ post-party encounter species.
 */
function locateDexSeenBitfieldInRange(
  bytes: Uint8Array,
  ownedMust: number[],
  seenMust: number[],
  rangeStart: number,
  rangeEnd: number,
  dexFlagBytes: number,
  maxSpecies: number,
): { base: number; seen: number[]; score: number } | null {
  const hardEnd = bytes.length - dexFlagBytes * 2;
  const start = Math.max(0, rangeStart);
  const end = Math.min(hardEnd, rangeEnd);
  if (start >= end) return null;

  let best: { base: number; seen: number[]; score: number } | null = null;
  const owned0 = ownedMust[0]!;

  for (let base = start; base < end; base++) {
    if (!dexBitSet(bytes, base + dexFlagBytes, owned0)) continue;

    let ok = true;
    for (let i = 1; i < ownedMust.length; i++) {
      if (!dexBitSet(bytes, base + dexFlagBytes, ownedMust[i]!)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (const s of seenMust) {
      if (!dexBitSet(bytes, base, s)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    const ownedPc = dexPopcount(bytes, base + dexFlagBytes, dexFlagBytes);
    const seenPc = dexPopcount(bytes, base, dexFlagBytes);
    if (ownedPc < ownedMust.length || ownedPc > ownedMust.length + 15) continue;
    if (seenPc < seenMust.length) continue;
    if (seenPc > Math.max(seenMust.length + 40, ownedPc + 40)) continue;
    if (seenPc < ownedPc) continue;

    const score = seenPc + ownedPc * 2;
    if (!best || score < best.score) {
      best = { base, seen: listDexBits(bytes, base, maxSpecies), score };
    }
  }
  return best;
}

function locateDexSeenBitfield(
  bytes: Uint8Array,
  ownedMust: number[],
  seenMust: number[],
  dexFlagBytes: number,
  maxSpecies: number,
): number[] | null {
  if (ownedMust.length === 0) return null;
  for (const [start, end] of DEX_BITFIELD_WINDOWS) {
    const hit = locateDexSeenBitfieldInRange(
      bytes,
      ownedMust,
      seenMust,
      start,
      end,
      dexFlagBytes,
      maxSpecies,
    );
    if (hit) return hit.seen;
  }
  return null;
}

function readModernSeen1(
  bytes: Uint8Array,
  partyBase: number,
  ownedMust: number[],
): number[] | null {
  const seenBase = partyBase + seen1AfterParty("modern");
  if (seenBase + MODERN_DEX_FLAG_BYTES > bytes.length) return null;
  if (ownedMust.length === 0) return null;
  for (const id of ownedMust) {
    if (!dexBitSet(bytes, seenBase, id)) return null;
  }
  const seen = listDexBits(bytes, seenBase, MODERN_NUM_SPECIES);
  if (seen.length < ownedMust.length) return null;
  if (seen.length > ownedMust.length + 120) return null;
  return seen;
}

/**
 * Locate Modern Emerald SaveBlock1 + national Pokédex bitfields in EWRAM.
 * gPlayerParty is often ASLR'd separately from SB1 — never trust party-relative
 * offsets for badges/revive/dex on screenshot states.
 */
function locateModernSaveMeta(
  bytes: Uint8Array,
  ownedMust: number[],
): {
  sb1: number;
  seen: number[];
  owned: number[];
  source: "seen1";
} | null {
  if (ownedMust.length === 0) return null;
  const n = MODERN_DEX_FLAG_BYTES;

  type Hit = { ownedBase: number; seenBase: number; owned: number[]; seen: number[] };
  const hits: Hit[] = [];

  for (let ownedBase = 0; ownedBase + n * 2 <= bytes.length; ownedBase++) {
    let ok = true;
    for (const id of ownedMust) {
      if (!dexBitSet(bytes, ownedBase, id)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const owned = listDexBits(bytes, ownedBase, 400);
    if (owned.length < ownedMust.length || owned.length > ownedMust.length + 12) {
      continue;
    }
    const seenBase = ownedBase + n;
    for (const id of ownedMust) {
      if (!dexBitSet(bytes, seenBase, id)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const seen = listDexBits(bytes, seenBase, 400);
    if (seen.length < owned.length || seen.length > owned.length + 40) continue;
    hits.push({ ownedBase, seenBase, owned, seen });
  }

  if (hits.length === 0) return null;

  // Anchoring is O(hits × buffer) — keep only the tightest candidates.
  hits.sort((a, b) => a.seen.length - b.seen.length);
  const candidates = hits.slice(0, 8);

  // Prefer the hit whose seen pattern also appears at SB1.seen1 (flags coherent).
  for (const hit of candidates) {
    const pat = bytes.subarray(hit.seenBase, hit.seenBase + n);
    const first = pat[0]!;
    for (let i = 0; i + n <= bytes.length; i++) {
      if (i === hit.seenBase || bytes[i] !== first) continue;
      let match = true;
      for (let j = 0; j < n; j++) {
        if (bytes[i + j] !== pat[j]) {
          match = false;
          break;
        }
      }
      if (!match) continue;
      const sb1 = i - SB1_SEEN1;
      if (sb1 < 0) continue;
      const badges = readBadgesAbsolute(bytes, sb1 + SB1_FLAGS);
      if (!badges.reliable && badges.earnedKeys.length > 0) continue;
      // SYS_POKEMON_GET must be set for a real flags block.
      if (!badges.reliable) {
        // readBadgesAbsolute returns unreliable when SYS flag missing OR non-prefix.
        // Early game with 0 badges is reliable when SYS is set — check directly.
        const flagsBase = sb1 + SB1_FLAGS;
        const sysIdx = SYSTEM_FLAGS >> 3;
        if (flagsBase + sysIdx >= bytes.length) continue;
        if (((bytes[flagsBase + sysIdx]! >> (SYSTEM_FLAGS & 7)) & 1) !== 1) {
          continue;
        }
      }
      return { sb1, seen: hit.seen, owned: hit.owned, source: "seen1" };
    }
  }

  // Dex found but SB1 not anchored — still return seen via first hit.
  const hit = hits[0]!;
  return { sb1: -1, seen: hit.seen, owned: hit.owned, source: "seen1" };
}

function nuzlockeFlagsLookCoherent(
  bytes: Uint8Array,
  nuzBase: number,
): boolean {
  if (nuzBase + SB1_NUZLOCKE_FLAGS_LEN > bytes.length) return false;
  const sample = bytes.subarray(nuzBase, nuzBase + SB1_NUZLOCKE_FLAGS_LEN);
  let ff03 = 0;
  for (let i = 0; i + 1 < sample.length; i += 2) {
    if (sample[i] === 0xff && sample[i + 1] === 0x03) ff03 += 1;
  }
  // Uninitialized / garbage often looks like repeating 0xff03 words.
  return ff03 < 3;
}

function readReviveAbsolute(sb1Bytes: Uint8Array, sb1Base = 0): ParsedSaveRevive {
  const flagsOff = sb1Base + SB1_REVIVES_USED;
  if (flagsOff >= sb1Bytes.length) return EMPTY_REVIVE;
  const nuzBase = sb1Base + SB1_NUZLOCKE_ENCOUNTER_FLAGS;
  if (!nuzlockeFlagsLookCoherent(sb1Bytes, nuzBase)) return EMPTY_REVIVE;
  const usedCount = (sb1Bytes[flagsOff]! & REVIVES_USED_MASK) >>> 0;
  return {
    used: usedCount >= MODERN_REVIVES_TOTAL,
    remaining: Math.max(0, MODERN_REVIVES_TOTAL - usedCount),
    reliable: true,
  };
}

function readReviveToken(
  bytes: Uint8Array,
  partyBase: number | null,
  mode: SpeciesIdMode = "modern",
  sb1Base: number | null = null,
): ParsedSaveRevive {
  if (mode !== "modern") return EMPTY_REVIVE;
  if (sb1Base != null && sb1Base >= 0) {
    return readReviveAbsolute(bytes, sb1Base);
  }
  if (partyBase == null) return EMPTY_REVIVE;
  const nuzBase = partyBase + nuzlockeFlagsAfterParty(mode);
  const flagsOff = nuzBase + SB1_NUZLOCKE_FLAGS_LEN + SB1_REVIVES_USED_BYTE;
  if (flagsOff >= bytes.length) return EMPTY_REVIVE;
  if (!nuzlockeFlagsLookCoherent(bytes, nuzBase)) return EMPTY_REVIVE;

  const usedCount = (bytes[flagsOff]! & REVIVES_USED_MASK) >>> 0;
  return {
    used: usedCount >= MODERN_REVIVES_TOTAL,
    remaining: Math.max(0, MODERN_REVIVES_TOTAL - usedCount),
    reliable: true,
  };
}

function readPokedexSeen(
  bytes: Uint8Array,
  ownedMust: number[],
  seenMust: number[],
  mode: SpeciesIdMode,
  partyBase: number | null,
): { seen: number[]; source: "table" | "bitfield" | "seen1" } | null {
  const maxSpecies =
    mode === "modern" ? MODERN_NUM_SPECIES : CREST_DEX_MAX_SPECIES;
  const dexFlagBytes =
    mode === "modern" ? MODERN_DEX_FLAG_BYTES : CREST_DEX_FLAG_BYTES;

  if (mode === "modern" && partyBase != null) {
    const seen1 = readModernSeen1(bytes, partyBase, ownedMust);
    if (seen1) return { seen: seen1, source: "seen1" };
  }

  const tableBase = findDexSpeciesTable(bytes);
  if (tableBase != null && dexTableMatchesOwned(bytes, tableBase, ownedMust)) {
    const seen = readDexTableSeen(bytes, tableBase, maxSpecies);
    if (seen.length > 0) return { seen, source: "table" };
  }
  const seen = locateDexSeenBitfield(
    bytes,
    ownedMust,
    seenMust,
    dexFlagBytes,
    maxSpecies,
  );
  if (seen && seen.length > 0) return { seen, source: "bitfield" };
  return null;
}

function dexSeenToParsed(speciesId: number): ParsedSavePokemon {
  const entry = findPokemonById(speciesId);
  return {
    pid: (DEX_SEEN_PID_BASE | (speciesId & 0xffff)) >>> 0,
    nickname: null,
    species: entry?.name ?? `Species #${speciesId}`,
    pokedexId: speciesId,
    level: null,
    isShiny: false,
    nature: null,
    ability: null,
    heldItem: null,
    catchRoute: null,
    moves: [],
    ivs: { ...EMPTY_IVS },
    evs: { ...EMPTY_EVS },
    category: "encountered",
  };
}

function classifyEwram(bytes: Uint8Array, formatLabel: string): ParseSaveResult {
  const warnings: string[] = [];
  // First pass: locate any party so we can detect Modern vs Crest species IDs.
  // Rank both weightings in one scan — Modern re-ranks without a second pass.
  const rankedParties = rankPartyBases(bytes);
  let partyBases = rankedParties.withPost;
  if (partyBases.length === 0) {
    return {
      ok: false,
      error:
        "No party block found. Use an Afterplay/mGBA save state (.sav/.srm/.state/.ss0–.ss9) or a Gen 3 flash save.",
    };
  }

  let partyBase = partyBases[0]!;
  let party: RawMon[] = [];
  for (let i = 0; i < PARTY_SLOTS; i++) {
    const m = tryParseMon(bytes, partyBase + i * MON_SIZE);
    if (m && m.level != null) party.push(m);
  }

  const speciesMode = detectSpeciesMode(
    party.map((m) => ({ speciesId: m.speciesId, nickname: m.nickname })),
  );
  let partyFainted: RawMon[] = [];
  if (speciesMode === "modern") {
    warnings.push("Species IDs mapped with Modern Emerald (Gen 3) table.");
    // Modern Emerald has no Crest-style post-party wild buffer — re-rank parties
    // by living HP only so fainted PC mons aren't glued onto the party window.
    partyBases = rankedParties.withoutPost;
    partyBase = partyBases[0]!;
    party = [];
    for (let i = 0; i < PARTY_SLOTS; i++) {
      const m = tryParseMon(bytes, partyBase + i * MON_SIZE);
      if (m && m.level != null) party.push(m);
    }
    // Nuzlocke: fainted party members belong in the cemetery, not Main Squad.
    partyFainted = party.filter((m) => m.maxHp > 0 && m.hp === 0);
    party = party.filter((m) => !(m.maxHp > 0 && m.hp === 0));
  } else {
    warnings.push("Species IDs treated as National Dex (Crest/expansion).");
  }

  const encounteredRaw =
    speciesMode === "crest"
      ? readSlotArray(bytes, partyBase + PARTY_SLOTS * MON_SIZE, 60).filter(
          (m) => !party.some((p) => p.pid === m.pid) && m.hp > 0,
        )
      : [];

  // Collect other unique mons (best healed copies) for box / rip.
  // Modern Emerald: cemetery = nuzlocke ribbon only. Stale 0-HP summary
  // buffers (e.g. old starter) must not become false R.I.P. entries.
  const bestByPid = new Map<number, RawMon>();
  const boxFormPids = new Set<number>();
  const deadPids = new Set<number>(partyFainted.map((m) => m.pid));
  for (let off = 0; off + BOX_SIZE <= bytes.length; off += 4) {
    const mon = tryParseMon(bytes, off);
    if (!mon) continue;
    if (mon.level == null) boxFormPids.add(mon.pid);
    if (speciesMode === "modern" && mon.nuzlockeRibbon) {
      deadPids.add(mon.pid);
    } else if (speciesMode === "crest" && mon.maxHp > 0 && mon.hp === 0) {
      deadPids.add(mon.pid);
    }
    const prev = bestByPid.get(mon.pid);
    if (!prev || monScore(mon) > monScore(prev)) bestByPid.set(mon.pid, mon);
  }

  const claimed = new Set([
    ...party.map((m) => m.pid),
    ...partyFainted.map((m) => m.pid),
    ...encounteredRaw.map((m) => m.pid),
  ]);

  const box: RawMon[] = [];
  const rip: RawMon[] = [...partyFainted];
  for (const mon of bestByPid.values()) {
    if (claimed.has(mon.pid)) continue;
    if (deadPids.has(mon.pid)) {
      rip.push(mon);
    } else if (
      speciesMode === "crest" ||
      boxFormPids.has(mon.pid) ||
      mon.level == null
    ) {
      box.push(mon);
    }
    // else: modern party-sized ghost (not in live party, no box form) — skip
  }
  box.sort((a, b) => a.offset - b.offset);
  rip.sort((a, b) => a.offset - b.offset);

  const partyParsed = party.map((m) => toParsed(m, "party", speciesMode));
  const boxParsed = box.map((m) => toParsed(m, "box", speciesMode));
  const ripParsed = rip.map((m) => toParsed(m, "rip", speciesMode));
  let encounteredParsed = encounteredRaw.map((m) =>
    toParsed(m, "encountered", speciesMode),
  );

  const maxDex =
    speciesMode === "modern" ? MODERN_NUM_SPECIES : CREST_DEX_MAX_SPECIES;
  // Include box mons in ownedMust — Modern dex owned covers PC living mons.
  const ownedMust = [
    ...new Set(
      [...partyParsed, ...boxParsed, ...ripParsed]
        .map((m) => m.pokedexId)
        .filter((id) => id > 0 && id <= maxDex),
    ),
  ];

  let badges = readBadges(bytes, partyBase, speciesMode);
  let revive =
    speciesMode === "modern"
      ? readReviveToken(bytes, partyBase, speciesMode)
      : EMPTY_REVIVE;
  let dex: { seen: number[]; source: "table" | "bitfield" | "seen1" } | null =
    null;

  if (speciesMode === "modern") {
    const meta = locateModernSaveMeta(bytes, ownedMust);
    if (meta) {
      if (meta.sb1 >= 0) {
        badges = readBadgesAbsolute(bytes, meta.sb1 + SB1_FLAGS);
        revive = readReviveAbsolute(bytes, meta.sb1);
        warnings.push("Anchored SaveBlock1 via Pokédex seen1 (ASLR-safe).");
      }
      // Encounter stubs = seen but not owned (failed catches / dex-only).
      const ownedSet = new Set(meta.owned);
      dex = {
        seen: meta.seen.filter((id) => !ownedSet.has(id)),
        source: "seen1",
      };
      warnings.push(
        `Pokédex: ${meta.seen.length} seen, ${meta.owned.length} owned.`,
      );
    }
  }

  const trainer = findTrainerNearParty(bytes, party);
  if (!badges.reliable) {
    warnings.push("Could not reliably read gym badge flags from this save.");
  } else if (badges.earnedKeys.length === 0) {
    warnings.push("No gym badges set in save (early game).");
  }

  if (speciesMode === "modern" && !revive.reliable) {
    warnings.push(
      "Could not read revive token (SaveBlock1 not anchored — try a full .sav/.srm export).",
    );
  }

  if (party.some((m) => m.crypto === "xor32")) {
    warnings.push("Decoded with xor32 encryption (pid⊕otId).");
  }

  const seenMust = [
    ...new Set([
      ...ownedMust,
      ...encounteredParsed
        .map((m) => m.pokedexId)
        .filter((id) => id > 0 && id <= maxDex),
    ]),
  ];
  if (!dex) {
    dex = readPokedexSeen(
      bytes,
      ownedMust,
      seenMust,
      speciesMode,
      partyBase,
    );
  }
  if (dex) {
    const already = new Set(
      [...partyParsed, ...boxParsed, ...ripParsed, ...encounteredParsed].map(
        (m) => m.pokedexId,
      ),
    );
    let truncated = 0;
    const dexOnly = dex.seen
      .filter((id) => !already.has(id))
      .sort((a, b) => a - b)
      .filter((_, i) => {
        if (i < DEX_SEEN_STUB_CAP) return true;
        truncated += 1;
        return false;
      })
      .map(dexSeenToParsed);
    encounteredParsed = [...encounteredParsed, ...dexOnly];
    if (!warnings.some((w) => w.startsWith("Pokédex:"))) {
      warnings.push(
        `Pokédex seen: ${dex.seen.length} species (${dex.source}` +
          (dexOnly.length ? `, +${dexOnly.length} not in party/box` : "") +
          (truncated ? `, capped ${truncated} more` : "") +
          ").",
      );
    } else if (dexOnly.length) {
      warnings.push(
        `Encounter stubs: +${dexOnly.length} seen-not-owned` +
          (truncated ? ` (capped ${truncated})` : "") +
          ".",
      );
    }
  }

  return {
    ok: true,
    format: formatLabel,
    warnings,
    trainer,
    badges,
    revive,
    party: partyParsed,
    box: boxParsed,
    rip: ripParsed,
    encountered: encounteredParsed,
  };
}

function readTrainerFromSaveBlock2(sb2: Uint8Array): ParsedSaveTrainer | null {
  if (sb2.length < 16) return null;
  const name = decodeGen3Text(sb2.subarray(0, 8));
  if (!/^[A-Za-z][A-Za-z0-9]{0,6}$/.test(name)) return null;
  const genderByte = sb2[8] ?? 0xff;
  if (genderByte > 1) return { name, gender: null };
  return { name, gender: genderByte === 1 ? "F" : "M" };
}

function readBadgesAbsolute(
  sb1: Uint8Array,
  flagsOffset: number,
): ParsedSaveBadges {
  const empty: ParsedSaveBadges = { earnedKeys: [], reliable: false };
  if (flagsOffset + 0x120 >= sb1.length) return empty;
  const flagGet = (flag: number) => {
    const i = flag >> 3;
    const b = flag & 7;
    return ((sb1[flagsOffset + i]! >> b) & 1) === 1;
  };
  if (!flagGet(SYSTEM_FLAGS)) return empty;
  const earnedKeys: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (flagGet(FLAG_BADGE01 + i)) earnedKeys.push(`gym-${i + 1}`);
  }
  for (let i = 0; i < earnedKeys.length; i++) {
    if (earnedKeys[i] !== `gym-${i + 1}`) return empty;
  }
  return { earnedKeys, reliable: true };
}

/**
 * Primary path for Afterplay .sav/.srm: sectorized flash → SaveBlock1/2 + PC.
 */
function classifyFlash(buf: Uint8Array): ParseSaveResult | null {
  const blocks = parseFlashSave(buf);
  if (!blocks) return null;

  const { saveBlock1: sb1, saveBlock2: sb2, storage } = blocks;
  const warnings: string[] = [
    `Flash save slot ${blocks.slot} (counter ${blocks.counter}).`,
  ];

  const partyCount = Math.min(PARTY_SLOTS, sb1[SB1_PARTY_COUNT] ?? 0);
  const party: RawMon[] = [];
  for (let i = 0; i < partyCount; i++) {
    const m = tryParseMon(sb1, SB1_PARTY + i * MON_SIZE);
    if (m) party.push(m);
  }
  // Fallback if partyCount is stale/zero but slots still hold mons.
  if (party.length === 0) {
    for (let i = 0; i < PARTY_SLOTS; i++) {
      const m = tryParseMon(sb1, SB1_PARTY + i * MON_SIZE);
      if (m && m.level != null) party.push(m);
      else if (m == null) break;
    }
  }

  if (party.length === 0) {
    return null;
  }

  const speciesMode = detectSpeciesMode(
    party.map((m) => ({ speciesId: m.speciesId, nickname: m.nickname })),
  );
  warnings.push(
    speciesMode === "modern"
      ? "Species IDs mapped with Modern Emerald (Gen 3) table."
      : "Species IDs treated as National Dex (Crest/expansion).",
  );

  let partyLiving = party;
  let partyFainted: RawMon[] = [];
  if (speciesMode === "modern") {
    partyFainted = party.filter((m) => m.maxHp > 0 && m.hp === 0);
    partyLiving = party.filter((m) => !(m.maxHp > 0 && m.hp === 0));
  }

  const box: RawMon[] = [];
  const rip: RawMon[] = [...partyFainted];
  const claimed = new Set(party.map((m) => m.pid));

  for (let boxId = 0; boxId < STORAGE_BOX_COUNT; boxId++) {
    for (let slot = 0; slot < STORAGE_BOX_CAPACITY; slot++) {
      const off =
        STORAGE_BOXES +
        (boxId * STORAGE_BOX_CAPACITY + slot) * BOX_SIZE;
      const mon = tryParseMon(storage, off);
      if (!mon || claimed.has(mon.pid)) continue;
      claimed.add(mon.pid);
      const dead = speciesMode === "modern" && mon.nuzlockeRibbon;
      if (dead) rip.push(mon);
      else box.push(mon);
    }
  }

  const trainer = readTrainerFromSaveBlock2(sb2) ?? findTrainerNearParty(sb1, partyLiving);
  const flagsOff = speciesMode === "modern" ? SB1_FLAGS : CREST_SB1_FLAGS;
  const badges = readBadgesAbsolute(sb1, flagsOff);
  if (!badges.reliable) {
    warnings.push("Could not reliably read gym badge flags from SaveBlock1.");
  }
  const revive =
    speciesMode === "modern" ? readReviveAbsolute(sb1) : EMPTY_REVIVE;
  if (speciesMode === "modern" && !revive.reliable) {
    warnings.push("Could not read revive token from SaveBlock1.");
  }

  const partyParsed = partyLiving.map((m) => toParsed(m, "party", speciesMode));
  const boxParsed = box.map((m) => toParsed(m, "box", speciesMode));
  const ripParsed = rip.map((m) => toParsed(m, "rip", speciesMode));

  const maxDex =
    speciesMode === "modern" ? MODERN_NUM_SPECIES : CREST_DEX_MAX_SPECIES;
  const ownedMust = [
    ...new Set(
      [...partyParsed, ...ripParsed]
        .map((m) => m.pokedexId)
        .filter((id) => id > 0 && id <= maxDex),
    ),
  ];

  let encounteredParsed: ParsedSavePokemon[] = [];
  if (speciesMode === "modern" && ownedMust.length > 0) {
    const seenBase = SB1_SEEN1;
    if (
      seenBase + MODERN_DEX_FLAG_BYTES <= sb1.length &&
      ownedMust.every((id) => dexBitSet(sb1, seenBase, id))
    ) {
      const seen = listDexBits(sb1, seenBase, MODERN_NUM_SPECIES);
      const already = new Set(
        [...partyParsed, ...boxParsed, ...ripParsed].map((m) => m.pokedexId),
      );
      let truncated = 0;
      const dexOnly = seen
        .filter((id) => !already.has(id))
        .sort((a, b) => a - b)
        .filter((_, i) => {
          if (i < DEX_SEEN_STUB_CAP) return true;
          truncated += 1;
          return false;
        })
        .map(dexSeenToParsed);
      encounteredParsed = dexOnly;
      warnings.push(
        `Pokédex seen: ${seen.length} species (seen1` +
          (dexOnly.length ? `, +${dexOnly.length} not in party/box` : "") +
          (truncated ? `, capped ${truncated} more` : "") +
          ").",
      );
    }
  }

  if (partyLiving.some((m) => m.crypto === "xor32")) {
    warnings.push("Decoded with xor32 encryption (pid⊕otId).");
  }

  return {
    ok: true,
    format: "Gen 3 flash save (.sav/.srm)",
    warnings,
    trainer,
    badges,
    revive,
    party: partyParsed,
    box: boxParsed,
    rip: ripParsed,
    encountered: encounteredParsed,
  };
}

function parseUncompressedState(
  state: Uint8Array,
  formatLabel = "Afterplay/mGBA EWRAM",
): ParseSaveResult {
  const mem = extractRastateMem(state) ?? state;
  const ewram = extractMgbaEwram(mem);
  if (ewram) return classifyEwram(ewram, formatLabel);
  return classifyEwram(mem, formatLabel);
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

  if (readPngChunks(buf)) {
    return {
      ok: false,
      error: "Screenshot save states (.ss0) require parsePokemonSaveAsync().",
    };
  }

  if (buf.length >= 16 && String.fromCharCode(...buf.subarray(0, 7)) === "RASTATE") {
    return parseUncompressedState(buf);
  }

  // Prefer sectorized flash reassembly for .sav/.srm (Afterplay primary export).
  if (looksLikeFlashSave(buf)) {
    const flash = classifyFlash(buf);
    if (flash) return flash;
  }

  if (buf.length >= GBA_STATE_SIZE) {
    const ewram = extractMgbaEwram(buf);
    if (ewram) return classifyEwram(ewram, "mGBA memory dump");
  }

  if (buf.length === 0x20000 || buf.length === 0x10000 || buf.length === 0x20010) {
    return classifyEwram(
      buf.subarray(0, Math.min(buf.length, 0x20000)),
      "Gen 3 flash save (raw scan)",
    );
  }

  return classifyEwram(buf, "Raw EWRAM/buffer");
}

/** Preferred browser entry: handles Afterplay RZIP and .ss0 PNG states. */
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
      return parseUncompressedState(inflated, "Afterplay RZIP state");
    }
  }

  if (readPngChunks(buf)) {
    const dumped = await extractGbaScreenshotStateAsync(buf);
    if (!dumped) {
      return {
        ok: false,
        error: "Couldn't extract mGBA memory from screenshot save state (.ss0).",
      };
    }
    return parseUncompressedState(dumped, "mGBA screenshot state (.ss0)");
  }

  return parsePokemonSave(buf);
}
