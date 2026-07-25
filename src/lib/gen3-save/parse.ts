/**
 * Parse Pokémon + trainer meta from Gen 3–style saves and Afterplay states.
 *
 * Categories (Crest / expansion layout):
 * - party: 6-slot playerParty (only filled slots)
 * - encountered: Pokémon stored immediately after the party block
 * - box: remaining PC / storage Pokémon
 * - rip: storage copies with 0 HP (fainted / boxed dead)
 *
 * Crest encrypts the 48-byte data section with repeating `pid ^ otId`
 * (vanilla Emerald uses an LCG stream). Both are tried.
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

export type SaveMonCategory = "party" | "box" | "rip" | "encountered";

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

export type ParseSaveResult =
  | {
      ok: true;
      format: string;
      warnings: string[];
      trainer: ParsedSaveTrainer | null;
      badges: ParsedSaveBadges;
      party: ParsedSavePokemon[];
      box: ParsedSavePokemon[];
      rip: ParsedSavePokemon[];
      encountered: ParsedSavePokemon[];
    }
  | { ok: false; error: string };

const GBA_STATE_SIZE = 0x61000;
const EWRAM_OFFSET = 0x21000;
const EWRAM_SIZE = 0x40000;
const MON_SIZE = 100;
const BOX_SIZE = 80;
const PARTY_SLOTS = 6;
/** Vanilla Emerald: flags[] starts this many bytes after playerParty. */
const FLAGS_AFTER_PARTY = 0x1038;
const SYSTEM_FLAGS = 0x860;
const FLAG_BADGE01 = SYSTEM_FLAGS + 0x7;

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
  nature: string;
  ability: string | null;
  heldItem: string | null;
  catchRoute: string | null;
  moves: string[];
  ivs: StatSpread;
  evs: StatSpread;
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
  if (!findPokemonById(speciesId) && !/^[A-Z]/.test(nickname)) return null;

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
  const ability = abilityForSpecies(speciesId, abilitySlot);

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
    ability,
    heldItem,
    catchRoute,
    moves,
    ivs,
    evs,
    offset,
    crypto,
  };
}

function monScore(m: RawMon): number {
  return (m.level != null ? 1000 : 0) + (m.maxHp > 0 ? 100 : 0) + m.hp;
}

function toParsed(mon: RawMon, category: SaveMonCategory): ParsedSavePokemon {
  const entry = findPokemonById(mon.speciesId);
  const species =
    entry?.name ??
    (mon.nickname && /^[A-Z][a-z0-9-]*$/.test(mon.nickname)
      ? mon.nickname
      : `Species #${mon.speciesId}`);
  const nick =
    mon.nickname && mon.nickname.toLowerCase() !== species.toLowerCase()
      ? mon.nickname
      : null;

  return {
    pid: mon.pid,
    nickname: nick,
    species,
    pokedexId: mon.speciesId,
    level: mon.level,
    isShiny: mon.isShiny,
    nature: mon.nature,
    ability: mon.ability,
    heldItem: mon.heldItem,
    catchRoute: mon.catchRoute,
    moves: mon.moves,
    ivs: mon.ivs ?? { ...EMPTY_IVS },
    evs: mon.evs ?? { ...EMPTY_EVS },
    category,
  };
}

/** Find 6-slot party arrays; prefer healed storage copies with a post-party list. */
function findPartyBases(bytes: Uint8Array): number[] {
  const scored: { off: number; score: number }[] = [];

  for (let off = 0; off + PARTY_SLOTS * MON_SIZE <= bytes.length; off += 4) {
    let filled = 0;
    let heal = 0;
    let valid = true;
    for (let i = 0; i < PARTY_SLOTS; i++) {
      const slotOff = off + i * MON_SIZE;
      const pid = new DataView(
        bytes.buffer,
        bytes.byteOffset + slotOff,
        4,
      ).getUint32(0, true);
      if (pid === 0) continue;
      const mon = tryParseMon(bytes, slotOff);
      if (!mon || mon.level == null) {
        valid = false;
        break;
      }
      filled += 1;
      heal += mon.hp;
    }
    if (!valid || filled === 0) continue;

    // Prefer arrays followed by more Pokémon (Crest encounter list).
    let post = 0;
    const postBase = off + PARTY_SLOTS * MON_SIZE;
    for (let i = 0; i < 12; i++) {
      const m = tryParseMon(bytes, postBase + i * MON_SIZE);
      if (!m || m.level == null) break;
      post += 1;
    }

    scored.push({
      off,
      score: filled * 1000 + post * 100 + heal + off * 0.0001,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  // Dedupe overlapping windows — keep best only per ~600-byte neighborhood
  const kept: number[] = [];
  for (const s of scored) {
    if (kept.some((k) => Math.abs(k - s.off) < PARTY_SLOTS * MON_SIZE)) continue;
    kept.push(s.off);
    if (kept.length >= 4) break;
  }
  return kept;
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

function readBadges(bytes: Uint8Array, partyBase: number | null): ParsedSaveBadges {
  const empty: ParsedSaveBadges = { earnedKeys: [], reliable: false };
  if (partyBase == null) return empty;

  const flagsBase = partyBase + FLAGS_AFTER_PARTY;
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
  return { earnedKeys, reliable: true };
}

function classifyEwram(bytes: Uint8Array): ParseSaveResult {
  const warnings: string[] = [];
  const partyBases = findPartyBases(bytes);
  if (partyBases.length === 0) {
    return {
      ok: false,
      error:
        "No party block found. Use an Afterplay save state or a Gen 3 .sav/.srm.",
    };
  }

  // Highest-scoring base: healed party + post-party encounter list when present
  const partyBase = partyBases[0]!;

  const party: RawMon[] = [];
  for (let i = 0; i < PARTY_SLOTS; i++) {
    const m = tryParseMon(bytes, partyBase + i * MON_SIZE);
    if (m && m.level != null) party.push(m);
  }

  const encountered = readSlotArray(
    bytes,
    partyBase + PARTY_SLOTS * MON_SIZE,
    60,
  ).filter((m) => !party.some((p) => p.pid === m.pid));

  // Collect other unique mons (best healed copies) for box / rip
  const bestByPid = new Map<number, RawMon>();
  for (let off = 0; off + BOX_SIZE <= bytes.length; off += 4) {
    const mon = tryParseMon(bytes, off);
    if (!mon) continue;
    const prev = bestByPid.get(mon.pid);
    if (!prev || monScore(mon) > monScore(prev)) bestByPid.set(mon.pid, mon);
  }

  const claimed = new Set([
    ...party.map((m) => m.pid),
    ...encountered.map((m) => m.pid),
  ]);

  const box: RawMon[] = [];
  const rip: RawMon[] = [];
  for (const mon of bestByPid.values()) {
    if (claimed.has(mon.pid)) continue;
    if (mon.maxHp > 0 && mon.hp === 0) {
      rip.push(mon);
    } else if (mon.level != null || mon.speciesId > 0) {
      box.push(mon);
    }
  }
  box.sort((a, b) => a.offset - b.offset);
  rip.sort((a, b) => a.offset - b.offset);

  const trainer = findTrainerNearParty(bytes, party);
  const badges = readBadges(bytes, partyBase);
  if (!badges.reliable) {
    warnings.push("Could not reliably read gym badge flags from this save.");
  } else if (badges.earnedKeys.length === 0) {
    warnings.push("No gym badges set in save (early game).");
  }
  if (party.some((m) => m.crypto === "xor32")) {
    warnings.push("Decoded with Crest-style encryption (pid⊕otId).");
  }

  return {
    ok: true,
    format: "Afterplay/mGBA EWRAM",
    warnings,
    trainer,
    badges,
    party: party.map((m) => toParsed(m, "party")),
    box: box.map((m) => toParsed(m, "box")),
    rip: rip.map((m) => toParsed(m, "rip")),
    encountered: encountered.map((m) => toParsed(m, "encountered")),
  };
}

function parseUncompressedState(state: Uint8Array): ParseSaveResult {
  const mem = extractRastateMem(state) ?? state;
  const ewram = extractMgbaEwram(mem);
  if (ewram) return classifyEwram(ewram);
  return classifyEwram(mem);
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

  if (buf.length >= GBA_STATE_SIZE) {
    const ewram = extractMgbaEwram(buf);
    if (ewram) return classifyEwram(ewram);
  }

  if (buf.length === 0x20000 || buf.length === 0x10000 || buf.length === 0x20010) {
    return classifyEwram(buf.subarray(0, Math.min(buf.length, 0x20000)));
  }

  return classifyEwram(buf);
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
