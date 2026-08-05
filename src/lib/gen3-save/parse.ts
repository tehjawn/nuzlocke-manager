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
import { modernSafariZoneAreasFromEncounterFlags } from "@/data/safari-zone";
import {
  abilityForSpecies,
  gen3ItemName,
  gen3MetLocationName,
  natureFromPid,
} from "@/data/pokemon-lookups";
import { gen3MoveName } from "@/lib/move-names";
import type { StatSpread } from "@/lib/stats";
import { EMPTY_EVS, EMPTY_IVS } from "@/lib/stats";
import { levelFromExperienceForSpecies } from "./experience";
import { looksLikeFlashSave, parseFlashSave } from "./flash";
import { decryptGen3Money } from "./money";
import { decodeGen3Name, isValidGen3TrainerName } from "./text";
import {
  BOX_MON_SIZE,
  CREST_DEX_FLAG_BYTES,
  CREST_DEX_MAX_SPECIES,
  CREST_FLAGS_AFTER_PARTY,
  CREST_NUZLOCKE_FLAGS_AFTER_PARTY,
  CREST_SEEN1_AFTER_PARTY,
  DAYCARE_MON_COUNT,
  DAYCARE_MON_STRIDE,
  FLAG_BADGE01,
  FLAGS_AFTER_PARTY as MODERN_FLAGS_AFTER_PARTY,
  MODERN_DEX_FLAG_BYTES,
  MODERN_NUM_SPECIES,
  MODERN_REVIVES_TOTAL,
  MODERN_ROM_DEX_TO_NATIONAL,
  MODERN_SB1_DAYCARE,
  MODERN_SPECIES_TO_NATIONAL,
  NUZLOCKE_FLAGS_AFTER_PARTY as MODERN_NUZLOCKE_FLAGS_AFTER_PARTY,
  PARTY_MON_SIZE,
  PARTY_SLOTS,
  REVIVES_USED_MASK,
  SB1_DAYCARE,
  SB1_FLAGS,
  CREST_SB1_FLAGS,
  SB1_MONEY,
  SB1_NUZLOCKE_ENCOUNTER_FLAGS,
  SB1_NUZLOCKE_FLAGS_LEN,
  SB1_PARTY,
  SB1_PARTY_COUNT,
  SB1_REVIVES_USED,
  SB1_REVIVES_USED_BYTE,
  SB1_SEEN1,
  SB1_TX_SETTINGS,
  SB2_TRAINER_ID,
  TX_RANDOM_CHAOS_BIT,
  TX_RANDOM_INCLUDE_LEGENDARIES_BIT,
  TX_RANDOM_MAP_BASED_BIT,
  TX_RANDOM_SIMILAR_BIT,
  TX_RANDOM_STATIC,
  TX_RANDOM_WILD_POKEMON_BIT,
  CREST_SB2_ENCRYPTION_KEY,
  SB2_ENCRYPTION_KEY,
  SECTOR_SIGNATURE,
  SECTOR_SIZE,
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

/** Decrypted Pokédollars from SaveBlock1.money ⊕ SaveBlock2.encryptionKey. */
export type ParsedSaveMoney = {
  amount: number;
  reliable: boolean;
};

/** Modern Emerald Safari-area claims from the Nuzlocke encounter flagset. */
export type ParsedSaveSafariZoneAreas = {
  areas: string[];
  reliable: boolean;
};

/**
 * Everything needed to replay the wild-encounter randomizer offline.
 *
 * `otId` is the seed: `RandomSeededModulo` (src/random.c) mixes nothing else
 * per-save, so trainer ID + these five bits reproduce the ROM's entire
 * species → species mapping. See `@/lib/tx-randomizer`.
 */
export type ParsedSaveRandomizer = {
  /** 32-bit `GetTrainerId(playerTrainerId)` — the randomizer's only seed. */
  otId: number;
  /** `tx_Random_WildPokemon` — master switch for wild encounters. */
  wildPokemon: boolean;
  /** `tx_Random_Similar` — reroll within the species' own evolution stage. */
  similar: boolean;
  /** `tx_Random_MapBased` — fold the area's mapsec into the seed. */
  mapBased: boolean;
  /** `tx_Random_IncludeLegendaries` — legendaries become valid destinations. */
  includeLegendaries: boolean;
  /** `tx_Random_Chaos` — draws from live RNG; no offline answer exists. */
  chaos: boolean;
  /** `tx_Random_Static` — rerolls `setwildbattle` and `givemon` encounters. */
  statics: boolean;
  /** True when both the seed and the setting bits decoded coherently. */
  reliable: boolean;
};

/**
 * Which nuzlocke encounter slots the run has already spent.
 *
 * `NuzlockeEncounterFlags` is the ROM's own record, so it counts a fled or
 * fainted encounter that never produced a Pokémon — something a stored
 * `catchRoute` list can never reconstruct.
 */
export type ParsedSaveEncounterFlags = {
  /** `NuzlockeLUT` bit indices that are set. */
  usedBits: number[];
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
      money: ParsedSaveMoney;
      safariZoneAreas: ParsedSaveSafariZoneAreas;
      randomizer: ParsedSaveRandomizer;
      encounterFlags: ParsedSaveEncounterFlags;
      party: ParsedSavePokemon[];
      box: ParsedSavePokemon[];
      rip: ParsedSavePokemon[];
      encountered: ParsedSavePokemon[];
    }
  | { ok: false; error: string };

const EMPTY_MONEY: ParsedSaveMoney = { amount: 0, reliable: false };
const EMPTY_SAFARI_ZONE_AREAS: ParsedSaveSafariZoneAreas = {
  areas: [],
  reliable: false,
};
const EMPTY_RANDOMIZER: ParsedSaveRandomizer = {
  otId: 0,
  wildPokemon: false,
  similar: false,
  mapBased: false,
  includeLegendaries: false,
  chaos: false,
  statics: false,
  reliable: false,
};
const EMPTY_ENCOUNTER_FLAGS: ParsedSaveEncounterFlags = {
  usedBits: [],
  reliable: false,
};

const GBA_STATE_SIZE = 0x61000;
const EWRAM_OFFSET = 0x21000;
const EWRAM_SIZE = 0x40000;
const MON_SIZE = PARTY_MON_SIZE;
const BOX_SIZE = BOX_MON_SIZE;
/**
 * Cap dex-only stubs. Modern Emerald's ROM dex is ~462 species — a filled
 * national dex must be able to import without silent truncation.
 */
const DEX_SEEN_STUB_CAP = MODERN_NUM_SPECIES;
/**
 * Max seen−owned delta when validating Pokédex bitfield pairs in EWRAM.
 * Late-game Nuzlockes can see most of the dex while owning far fewer
 * (e.g. 75 owned / 255 seen). Rank by owned tightness instead of a low cap.
 */
const DEX_SEEN_OWNED_DELTA_MAX = MODERN_NUM_SPECIES;
/**
 * Owned bitfield may include released / evolved / traded forms beyond the
 * party∪box∪rip set we recovered from the dump. Elite-4 saves need ~+25;
 * keep headroom without accepting near-full-dex false positives.
 */
const DEX_OWNED_SLACK_MAX = 80;

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

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
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

/** Compacted ROM NATIONAL_DEX bit index → real National Dex. */
function modernRomDexToNational(romDex: number): number {
  if (romDex <= 0 || romDex >= MODERN_ROM_DEX_TO_NATIONAL.length) {
    return romDex;
  }
  const nd = MODERN_ROM_DEX_TO_NATIONAL[romDex] ?? 0;
  return nd > 0 ? nd : romDex;
}

const MODERN_NATIONAL_TO_ROM_DEX = (() => {
  const map = new Map<number, number>();
  for (let romDex = 1; romDex < MODERN_ROM_DEX_TO_NATIONAL.length; romDex++) {
    const nd = MODERN_ROM_DEX_TO_NATIONAL[romDex] ?? 0;
    if (nd > 0 && !map.has(nd)) map.set(nd, romDex);
  }
  return map;
})();

/** Real National Dex → ROM dex bit index (for GetSetPokedexFlag bitfields). */
function modernNationalToRomDex(nationalId: number): number | null {
  return MODERN_NATIONAL_TO_ROM_DEX.get(nationalId) ?? null;
}

/**
 * Dex bitfield indices for owned/seen checks.
 * Modern Emerald stores compacted ROM NATIONAL_DEX bits, not always real ND.
 */
function dexBitIdsForMode(
  pokedexIds: number[],
  mode: SpeciesIdMode,
): number[] {
  if (mode !== "modern") {
    return [...new Set(pokedexIds.filter((id) => id > 0))];
  }
  const out: number[] = [];
  for (const id of pokedexIds) {
    const rom = modernNationalToRomDex(id);
    if (rom != null && rom > 0 && rom < MODERN_NUM_SPECIES) out.push(rom);
  }
  return [...new Set(out)];
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
  /** Raw MAPSEC byte; resolved to a name once species mode is known. */
  metLocation: number;
  /** Raw move IDs; resolved to names once species mode is known. */
  moveIds: number[];
  ivs: StatSpread;
  evs: StatSpread;
  nuzlockeRibbon: boolean;
  /** Modern Emerald growth.box_hp (0 on party; PC uses 0 for fainted). */
  boxHp: number | null;
  /** Growth experience (u32) — used to derive level for box / daycare forms. */
  experience: number;
  offset: number;
  crypto: "xor32" | "lcg";
};

function tryParseMon(bytes: Uint8Array, offset: number): RawMon | null {
  if (offset + BOX_SIZE > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, BOX_SIZE);
  const pid = u32(view, 0);
  const oid = u32(view, 4);
  if (pid === 0) return null;

  const nickname = decodeGen3Name(bytes.subarray(offset + 8, offset + 18));
  if (!nickname || nickname.length > 10) {
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
  // Nickname already validated by decodeGen3Name (Western name alphabet). Do not
  // re-apply ASCII-only heuristics here — they rejected accented / symbol nicks.

  const itemId = growthView.getUint16(2, true);
  const heldItem = gen3ItemName(itemId);
  const experience = growthView.getUint32(4, true);

  const moveIds: number[] = [];
  for (let i = 0; i < 4; i++) {
    const moveId = attacksView.getUint16(i * 2, true);
    if (moveId > 0) moveIds.push(moveId);
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
    metLocation,
    moveIds,
    ivs,
    evs,
    nuzlockeRibbon,
    boxHp: maxHp > 0 ? null : boxHp, // only meaningful for BoxPokemon
    experience,
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

  // Prefer party trailer level; box / daycare forms derive from experience.
  const level =
    mon.level ??
    levelFromExperienceForSpecies(mon.experience, pokedexId);

  return {
    pid: mon.pid,
    nickname: nick,
    species,
    pokedexId,
    level,
    isShiny: mon.isShiny,
    nature: mon.nature,
    ability: abilityForSpecies(pokedexId, mon.abilitySlot),
    heldItem: mon.heldItem,
    catchRoute: gen3MetLocationName(
      mon.metLocation,
      mode === "modern" ? "modern" : "vanilla",
    ),
    moves: mon.moveIds
      .map((id) => gen3MoveName(id, mode === "modern" ? "modern" : "crest"))
      .filter((name): name is string => Boolean(name)),
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
  const scored: {
    off: number;
    base: number;
    post: number;
  }[] = [];

  // Best (highest monScore) copy per PID — used as a soft ranking signal.
  const bestOffsetByPid = new Map<number, number>();
  const bestScoreByPid = new Map<number, number>();
  /** PIDs that also exist as PC/box (80-byte) forms — stale party snapshots often still list them. */
  const boxFormPids = new Set<number>();
  /** PIDs marked dead via Modern Emerald nuzlocke ribbon. */
  const ribbonedPids = new Set<number>();

  for (let off = 0; off + BOX_SIZE <= bytes.length; off += 4) {
    const mon = tryParseMon(bytes, off);
    if (!mon) continue;
    if (mon.level == null) {
      boxFormPids.add(mon.pid);
      continue;
    }
    if (mon.nuzlockeRibbon) ribbonedPids.add(mon.pid);
    const score = monScore(mon);
    const prev = bestScoreByPid.get(mon.pid);
    if (prev == null || score > prev) {
      bestScoreByPid.set(mon.pid, score);
      bestOffsetByPid.set(mon.pid, mon.offset);
    }
  }

  for (let off = 0; off + PARTY_SLOTS * MON_SIZE <= bytes.length; off += 4) {
    let filled = 0;
    let liveFilled = 0;
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
      // Boxed or nuzlocke-dead mons in a party window usually mean a stale snapshot
      // (SB1/heal buffer), not the live gPlayerParty.
      if (
        !boxFormPids.has(mon.pid) &&
        !ribbonedPids.has(mon.pid) &&
        !(mon.maxHp > 0 && mon.hp === 0)
      ) {
        liveFilled += 1;
      }
    }
    if (!valid || filled === 0 || liveFilled === 0) continue;

    // Crest: post-party living mons (wild buffer). Always scored so Modern can
    // re-rank without a second full-buffer scan.
    let post = 0;
    const postBase = off + PARTY_SLOTS * MON_SIZE;
    for (let i = 0; i < 12; i++) {
      const m = tryParseMon(bytes, postBase + i * MON_SIZE);
      if (!m || m.level == null || m.hp <= 0) break;
      post += 1;
    }

    // Prefer more currently-live members; penalize windows padded with boxed/dead
    // leftovers. bestCopies is a soft bonus only (live party can be more damaged
    // than PC copies — hard-requiring it rejected pmv4_4 / pmv4_5).
    const freshness = liveFilled / filled;
    scored.push({
      off,
      base:
        liveFilled * 1000 +
        freshness * 200 +
        bestCopies * 10 +
        heal * 0.01 -
        off * 0.0001,
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
    const name = decodeGen3Name(bytes.subarray(i, i + 8));
    if (!name || !isValidGen3TrainerName(name)) continue;
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
  const otName = decodeGen3Name(
    // OT is on the mon at +20; party OT name should match trainer
    bytes.subarray(partyMons[0]!.offset + 20, partyMons[0]!.offset + 27),
  );
  if (otName && isValidGen3TrainerName(otName)) {
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
    if (
      ownedPc < ownedMust.length ||
      ownedPc > ownedMust.length + DEX_OWNED_SLACK_MAX
    ) {
      continue;
    }
    if (seenPc < seenMust.length) continue;
    if (
      seenPc >
      Math.max(seenMust.length + DEX_SEEN_OWNED_DELTA_MAX, ownedPc + DEX_SEEN_OWNED_DELTA_MAX)
    ) {
      continue;
    }
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
  if (seen.length > ownedMust.length + DEX_SEEN_OWNED_DELTA_MAX) return null;
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
    const owned = listDexBits(bytes, ownedBase, MODERN_NUM_SPECIES);
    // Late-game Nuzlockes own far more than party∪box∪rip (released /
    // evolved / traded forms still set owned). Slack must cover that gap.
    if (
      owned.length < ownedMust.length ||
      owned.length > ownedMust.length + DEX_OWNED_SLACK_MAX
    ) {
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
    const seen = listDexBits(bytes, seenBase, MODERN_NUM_SPECIES);
    if (
      seen.length < owned.length ||
      seen.length > owned.length + DEX_SEEN_OWNED_DELTA_MAX
    ) {
      continue;
    }
    hits.push({ ownedBase, seenBase, owned, seen });
  }

  if (hits.length === 0) return null;

  // Prefer tightest owned (closest to party/box), then shortest seen.
  // Anchoring is O(hits × buffer) — keep only the best candidates.
  hits.sort(
    (a, b) =>
      a.owned.length - b.owned.length || a.seen.length - b.seen.length,
  );
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
      if (!badgeFlagsLookCoherent(bytes, sb1 + SB1_FLAGS)) continue;
      return { sb1, seen: hit.seen, owned: hit.owned, source: "seen1" };
    }
  }

  // Dex found but SB1 not anchored — still return seen via first hit.
  const hit = hits[0]!;
  return { sb1: -1, seen: hit.seen, owned: hit.owned, source: "seen1" };
}

/**
 * A real flags block has SYS_POKEMON_GET set and gym badges as an ordered
 * prefix. Badge 3 without 1–2 is impossible, so such a block is a stale or
 * coincidental match rather than the live SaveBlock1.
 */
function badgeFlagsLookCoherent(bytes: Uint8Array, flagsBase: number): boolean {
  if (flagsBase < 0 || flagsBase + 0x120 >= bytes.length) return false;
  const flagGet = (flag: number) =>
    ((bytes[flagsBase + (flag >> 3)]! >> (flag & 7)) & 1) === 1;
  if (!flagGet(SYSTEM_FLAGS)) return false;
  let earned = 0;
  for (let i = 0; i < 8; i++) {
    if (!flagGet(FLAG_BADGE01 + i)) break;
    earned += 1;
  }
  for (let i = earned; i < 8; i++) {
    if (flagGet(FLAG_BADGE01 + i)) return false;
  }
  return true;
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

/**
 * The randomizer's seed is `GetTrainerId(gSaveBlock2Ptr->playerTrainerId)` —
 * the same 32-bit value stamped as OT ID on every Pokémon the player caught
 * themselves. SaveBlock2 is only anchored on the flash path, so elsewhere take
 * the modal OT ID across the recovered mons: traded mons are a small minority,
 * and a wrong seed shows up immediately in the catch cross-check downstream.
 */
function modalOtId(mons: readonly RawMon[]): number | null {
  const votes = new Map<number, number>();
  for (const mon of mons) {
    if (!mon.oid) continue;
    votes.set(mon.oid, (votes.get(mon.oid) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [oid, count] of votes) {
    if (count > bestCount) {
      best = oid;
      bestCount = count;
    }
  }
  return best;
}

/**
 * `tx_Random_*` bits, gated on the same coherence check the revive token uses —
 * the settings byte sits in the packed block right after the nuzlocke flags, so
 * if those look like garbage the settings do too.
 */
function readRandomizerAbsolute(
  sb1Bytes: Uint8Array,
  sb1Base: number,
  otId: number | null,
): ParsedSaveRandomizer {
  const settingsOff = sb1Base + SB1_TX_SETTINGS;
  if (settingsOff >= sb1Bytes.length) return EMPTY_RANDOMIZER;
  if (!nuzlockeFlagsLookCoherent(sb1Bytes, sb1Base + SB1_NUZLOCKE_ENCOUNTER_FLAGS)) {
    return EMPTY_RANDOMIZER;
  }
  // `tx_Random_Static` lives at settingsOff + 5; a truncated buffer must not
  // report reliable tables while that bit falls back to 0.
  const settingsComplete =
    settingsOff + TX_RANDOM_STATIC[0] < sb1Bytes.length;
  const bits = sb1Bytes[settingsOff]!;
  const bit = (index: number) => ((bits >>> index) & 1) === 1;
  const at = ([byte, index]: readonly [number, number]) =>
    settingsComplete &&
    (((sb1Bytes[settingsOff + byte] ?? 0) >>> index) & 1) === 1;
  return {
    otId: otId ?? 0,
    wildPokemon: bit(TX_RANDOM_WILD_POKEMON_BIT),
    similar: bit(TX_RANDOM_SIMILAR_BIT),
    mapBased: bit(TX_RANDOM_MAP_BASED_BIT),
    includeLegendaries: bit(TX_RANDOM_INCLUDE_LEGENDARIES_BIT),
    chaos: bit(TX_RANDOM_CHAOS_BIT),
    statics: at(TX_RANDOM_STATIC),
    reliable: otId != null && otId !== 0 && settingsComplete,
  };
}

/** Every set bit in `NuzlockeEncounterFlags[9]` — the spent encounter slots. */
function readEncounterFlagsAbsolute(
  sb1Bytes: Uint8Array,
  sb1Base: number,
): ParsedSaveEncounterFlags {
  const nuzBase = sb1Base + SB1_NUZLOCKE_ENCOUNTER_FLAGS;
  if (!nuzlockeFlagsLookCoherent(sb1Bytes, nuzBase)) return EMPTY_ENCOUNTER_FLAGS;
  const usedBits: number[] = [];
  for (let byte = 0; byte < SB1_NUZLOCKE_FLAGS_LEN; byte++) {
    const value = sb1Bytes[nuzBase + byte] ?? 0;
    for (let bit = 0; bit < 8; bit++) {
      if ((value >>> bit) & 1) usedBits.push(byte * 8 + bit);
    }
  }
  return { usedBits, reliable: true };
}

function readSafariZoneAreasAbsolute(
  sb1Bytes: Uint8Array,
  sb1Base = 0,
): ParsedSaveSafariZoneAreas {
  const nuzBase = sb1Base + SB1_NUZLOCKE_ENCOUNTER_FLAGS;
  if (!nuzlockeFlagsLookCoherent(sb1Bytes, nuzBase)) {
    return EMPTY_SAFARI_ZONE_AREAS;
  }
  return {
    areas: modernSafariZoneAreasFromEncounterFlags(
      sb1Bytes.subarray(nuzBase, nuzBase + SB1_NUZLOCKE_FLAGS_LEN),
    ),
    reliable: true,
  };
}

function readSafariZoneAreas(
  bytes: Uint8Array,
  partyBase: number | null,
  mode: SpeciesIdMode = "modern",
  sb1Base: number | null = null,
): ParsedSaveSafariZoneAreas {
  if (mode !== "modern") return EMPTY_SAFARI_ZONE_AREAS;
  if (sb1Base != null && sb1Base >= 0) {
    return readSafariZoneAreasAbsolute(bytes, sb1Base);
  }
  if (partyBase == null) return EMPTY_SAFARI_ZONE_AREAS;
  const nuzBase = partyBase + nuzlockeFlagsAfterParty(mode);
  if (!nuzlockeFlagsLookCoherent(bytes, nuzBase)) {
    return EMPTY_SAFARI_ZONE_AREAS;
  }
  return {
    areas: modernSafariZoneAreasFromEncounterFlags(
      bytes.subarray(nuzBase, nuzBase + SB1_NUZLOCKE_FLAGS_LEN),
    ),
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

function dexSeenToParsed(romDexOrNational: number, mode: SpeciesIdMode): ParsedSavePokemon {
  const pokedexId =
    mode === "modern"
      ? modernRomDexToNational(romDexOrNational)
      : romDexOrNational;
  const entry = findPokemonById(pokedexId);
  return {
    pid: (DEX_SEEN_PID_BASE | (pokedexId & 0xffff)) >>> 0,
    nickname: null,
    species: entry?.name ?? `Species #${pokedexId}`,
    pokedexId,
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

function daycareBaseCandidates(mode: SpeciesIdMode): number[] {
  return mode === "modern"
    ? [MODERN_SB1_DAYCARE, SB1_DAYCARE, MODERN_SB1_DAYCARE + 4]
    : [SB1_DAYCARE, MODERN_SB1_DAYCARE];
}

/**
 * Pull up to 2 Day Care BoxPokemon into the box/Reserves path.
 * Prefers the mode-native SB1 offset; falls back when a shifted layout holds mons.
 */
function readDaycareMons(
  sb1: Uint8Array,
  mode: SpeciesIdMode,
  claimed: Set<number>,
): RawMon[] {
  for (const base of daycareBaseCandidates(mode)) {
    if (base + DAYCARE_MON_COUNT * DAYCARE_MON_STRIDE > sb1.length) continue;
    const mons: RawMon[] = [];
    let anySlot = false;
    for (let i = 0; i < DAYCARE_MON_COUNT; i++) {
      const mon = tryParseMon(sb1, base + i * DAYCARE_MON_STRIDE);
      if (!mon) continue;
      anySlot = true;
      if (!claimed.has(mon.pid)) mons.push(mon);
    }
    if (anySlot) return mons;
  }
  return [];
}

/** Prefer Modern Emerald key@0xBC; fall back to vanilla/Crest@0xAC. */
function encryptionKeyOffsets(mode: SpeciesIdMode): number[] {
  return mode === "modern"
    ? [SB2_ENCRYPTION_KEY, CREST_SB2_ENCRYPTION_KEY]
    : [CREST_SB2_ENCRYPTION_KEY, SB2_ENCRYPTION_KEY];
}

function readMoney(
  sb1: Uint8Array,
  sb2: Uint8Array,
  mode: SpeciesIdMode = "modern",
): ParsedSaveMoney {
  if (sb1.length < SB1_MONEY + 4) return EMPTY_MONEY;
  const enc = new DataView(
    sb1.buffer,
    sb1.byteOffset + SB1_MONEY,
    4,
  ).getUint32(0, true);
  for (const keyOff of encryptionKeyOffsets(mode)) {
    if (sb2.length < keyOff + 4) continue;
    const key = new DataView(
      sb2.buffer,
      sb2.byteOffset + keyOff,
      4,
    ).getUint32(0, true);
    const amount = decryptGen3Money(enc, key);
    if (amount != null) return { amount, reliable: true };
  }
  return EMPTY_MONEY;
}

/**
 * Locate SaveBlock2 candidates for money decryption. ASLR .state dumps contain
 * multiple trainer-name ghosts — callers must try each key against SB1.money.
 */
function findSaveBlock2Offsets(
  bytes: Uint8Array,
  trainerName?: string | null,
  mode: SpeciesIdMode = "modern",
): number[] {
  const keyOffs = encryptionKeyOffsets(mode);
  const span = Math.max(...keyOffs) + 4;
  const named: number[] = [];
  const fallback: number[] = [];
  for (let i = 0; i + span <= bytes.length; i++) {
    // Cheap structural rejects before allocating a name subarray.
    const genderByte = bytes[i + 8] ?? 0xff;
    if (genderByte > 1) continue;
    let hasEos = false;
    for (let j = 0; j < 8; j++) {
      if (bytes[i + j] === 0xff) {
        hasEos = true;
        break;
      }
    }
    if (!hasEos) continue;
    const name = decodeGen3Name(bytes.subarray(i, i + 8));
    if (!name || !isValidGen3TrainerName(name)) continue;
    if (trainerName && name !== trainerName) continue;
    let key = 0;
    for (const keyOff of keyOffs) {
      key = new DataView(
        bytes.buffer,
        bytes.byteOffset + i + keyOff,
        4,
      ).getUint32(0, true);
      if (key !== 0) break;
    }
    if (key === 0) continue;
    if (trainerName && name === trainerName) named.push(i);
    else if (!trainerName) fallback.push(i);
  }
  return trainerName ? named : fallback;
}

function readMoneyFromEwram(
  bytes: Uint8Array,
  sb1Base: number,
  trainerName?: string | null,
  mode: SpeciesIdMode = "modern",
): ParsedSaveMoney {
  if (sb1Base + SB1_MONEY + 4 > bytes.length) return EMPTY_MONEY;
  const enc = new DataView(
    bytes.buffer,
    bytes.byteOffset + sb1Base + SB1_MONEY,
    4,
  ).getUint32(0, true);
  const sb2Bases = findSaveBlock2Offsets(bytes, trainerName, mode);
  // A wrong SB2 key almost always decrypts outside 0…MAX_MONEY; the matching
  // live/flash pair is typically unique for a given SB1.money word.
  for (const sb2Base of sb2Bases) {
    for (const keyOff of encryptionKeyOffsets(mode)) {
      if (sb2Base + keyOff + 4 > bytes.length) continue;
      const key = new DataView(
        bytes.buffer,
        bytes.byteOffset + sb2Base + keyOff,
        4,
      ).getUint32(0, true);
      if (key === 0) continue;
      const amount = decryptGen3Money(enc, key);
      if (amount != null) return { amount, reliable: true };
    }
  }
  return EMPTY_MONEY;
}

/**
 * mGBA/Afterplay .state dumps often embed a copy of the 128 KiB flash image as
 * save sectors (footer signature 0x08012025). When ASLR prevents anchoring live
 * SaveBlock1, money can still be recovered from that embedded flash.
 */
function extractEmbeddedFlash(mem: Uint8Array): Uint8Array | null {
  const view = new DataView(mem.buffer, mem.byteOffset, mem.byteLength);
  const byId = new Map<number, { base: number; counter: number }>();
  for (let i = 0; i + 4 <= mem.length; i += 4) {
    if (view.getUint32(i, true) !== SECTOR_SIGNATURE) continue;
    const base = i - 0xff8;
    if (base < 0 || base + SECTOR_SIZE > mem.length) continue;
    const id = view.getUint16(base + 0xff4, true);
    if (id > 27) continue;
    const counter = view.getUint32(base + 0xffc, true);
    const prev = byId.get(id);
    if (!prev || counter >= prev.counter) byId.set(id, { base, counter });
  }
  // Need SaveBlock2 + SaveBlock1 start at minimum.
  if (!byId.has(0) || !byId.has(1)) return null;
  const flash = new Uint8Array(0x20000);
  for (const [id, sec] of byId) {
    flash.set(mem.subarray(sec.base, sec.base + SECTOR_SIZE), id * SECTOR_SIZE);
  }
  return flash;
}

function readMoneyFromEmbeddedFlash(
  bytes: Uint8Array,
  mode: SpeciesIdMode,
): ParsedSaveMoney {
  const flash = extractEmbeddedFlash(bytes);
  if (!flash) return EMPTY_MONEY;
  const blocks = parseFlashSave(flash);
  if (!blocks) return EMPTY_MONEY;
  return readMoney(blocks.saveBlock1, blocks.saveBlock2, mode);
}

/**
 * When live EWRAM Pokédex pairing fails (late-game ASLR / slack), fall back to
 * the embedded flash SaveBlock1 seen1 copy — same sectors money already uses.
 */
function readModernDexFromEmbeddedFlash(
  bytes: Uint8Array,
  ownedMust: number[],
): {
  seen: number[];
  badges: ParsedSaveBadges;
  revive: ParsedSaveRevive;
  safariZoneAreas: ParsedSaveSafariZoneAreas;
  randomizer: ParsedSaveRandomizer;
  encounterFlags: ParsedSaveEncounterFlags;
} | null {
  const flash = extractEmbeddedFlash(bytes);
  if (!flash) return null;
  const blocks = parseFlashSave(flash);
  if (!blocks) return null;
  const sb1 = blocks.saveBlock1;
  const sb2 = blocks.saveBlock2;
  if (SB1_SEEN1 + MODERN_DEX_FLAG_BYTES > sb1.length) return null;
  if (
    ownedMust.length > 0 &&
    !ownedMust.every((id) => dexBitSet(sb1, SB1_SEEN1, id))
  ) {
    return null;
  }
  const trainerId = readTrainerIdFromSaveBlock2(sb2);
  return {
    seen: listDexBits(sb1, SB1_SEEN1, MODERN_NUM_SPECIES),
    badges: readBadgesAbsolute(sb1, SB1_FLAGS),
    revive: readReviveAbsolute(sb1),
    safariZoneAreas: readSafariZoneAreasAbsolute(sb1),
    randomizer: readRandomizerAbsolute(sb1, 0, trainerId),
    encounterFlags: readEncounterFlagsAbsolute(sb1, 0),
  };
}

function classifyEwram(
  bytes: Uint8Array,
  formatLabel: string,
  /** Full dump for embedded-flash money when `bytes` is an EWRAM window. */
  flashSource?: Uint8Array,
): ParseSaveResult {
  const warnings: string[] = [];
  // First pass: locate any party so we can detect Modern vs Crest species IDs.
  // Rank both weightings in one scan — Modern re-ranks without a second pass.
  const rankedParties = rankPartyBases(bytes);
  let partyBases = rankedParties.withPost;
  if (partyBases.length === 0) {
    // Pre-starter Afterplay states have no party block yet — still a valid import.
    if (bytes.length >= 0x10000) {
      return {
        ok: true,
        format: formatLabel,
        warnings: [
          "No party Pokémon found (pre-starter or empty party).",
        ],
        trainer: null,
        badges: { earnedKeys: [], reliable: false },
        revive: EMPTY_REVIVE,
        money: EMPTY_MONEY,
        safariZoneAreas: EMPTY_SAFARI_ZONE_AREAS,
        randomizer: EMPTY_RANDOMIZER,
        encounterFlags: EMPTY_ENCOUNTER_FLAGS,
        party: [],
        box: [],
        rip: [],
        encountered: [],
      };
    }
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

  const maxDex =
    speciesMode === "modern" ? MODERN_NUM_SPECIES : CREST_DEX_MAX_SPECIES;
  // Include box mons in ownedMust — Modern dex owned covers PC living mons.
  // Bitfield indices are ROM NATIONAL_DEX for modern, real ND for crest.
  // `boxParsed` is rebuilt after Day Care merge below; other collections are
  // unaffected by that merge.
  const partyParsed = party.map((m) => toParsed(m, "party", speciesMode));
  let boxParsed = box.map((m) => toParsed(m, "box", speciesMode));
  const ripParsed = rip.map((m) => toParsed(m, "rip", speciesMode));
  let encounteredParsed = encounteredRaw.map((m) =>
    toParsed(m, "encountered", speciesMode),
  );

  const ownedMust = dexBitIdsForMode(
    [...partyParsed, ...boxParsed, ...ripParsed].map((m) => m.pokedexId),
    speciesMode,
  ).filter((id) => id <= maxDex);

  let badges = readBadges(bytes, partyBase, speciesMode);
  let revive =
    speciesMode === "modern"
      ? readReviveToken(bytes, partyBase, speciesMode)
      : EMPTY_REVIVE;
  let money = EMPTY_MONEY;
  let safariZoneAreas =
    speciesMode === "modern"
      ? readSafariZoneAreas(bytes, partyBase, speciesMode)
      : EMPTY_SAFARI_ZONE_AREAS;
  let randomizer = EMPTY_RANDOMIZER;
  let encounterFlags = EMPTY_ENCOUNTER_FLAGS;
  let dex: { seen: number[]; source: "table" | "bitfield" | "seen1" } | null =
    null;

  const trainer = findTrainerNearParty(bytes, party);

  if (speciesMode === "modern") {
    const meta = locateModernSaveMeta(bytes, ownedMust);
    if (meta) {
      if (meta.sb1 >= 0) {
        badges = readBadgesAbsolute(bytes, meta.sb1 + SB1_FLAGS);
        revive = readReviveAbsolute(bytes, meta.sb1);
        safariZoneAreas = readSafariZoneAreasAbsolute(bytes, meta.sb1);
        randomizer = readRandomizerAbsolute(
          bytes,
          meta.sb1,
          modalOtId([...party, ...box, ...rip]),
        );
        encounterFlags = readEncounterFlagsAbsolute(bytes, meta.sb1);
        money = readMoneyFromEwram(
          bytes,
          meta.sb1,
          trainer?.name ?? null,
          speciesMode,
        );
        // Generic EWRAM BOX_SIZE scan can land on Day Care slots before the
        // explicit reader runs — strip those hits so ownership + warning stay
        // on the Day Care path.
        const daycareSlotOffsets = new Set<number>();
        for (const base of daycareBaseCandidates(speciesMode)) {
          for (let i = 0; i < DAYCARE_MON_COUNT; i++) {
            daycareSlotOffsets.add(
              meta.sb1 + base + i * DAYCARE_MON_STRIDE,
            );
          }
        }
        for (let i = box.length - 1; i >= 0; i--) {
          if (daycareSlotOffsets.has(box[i]!.offset)) box.splice(i, 1);
        }
        const claimedPids = new Set(
          [...party, ...box, ...rip].map((m) => m.pid),
        );
        const sb1View = bytes.subarray(meta.sb1);
        const daycare = readDaycareMons(sb1View, speciesMode, claimedPids);
        for (const mon of daycare) {
          box.push(mon);
        }
        if (daycare.length > 0) {
          boxParsed = box.map((m) => toParsed(m, "box", speciesMode));
          warnings.push(
            `Day Care: imported ${daycare.length} Pokémon into Reserves.`,
          );
        }
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
    } else {
      // Late-game .state: EWRAM pair heuristic may still miss; flash seen1 is
      // stable for Encountered stubs + badges when sectors are embedded.
      const fromFlash = readModernDexFromEmbeddedFlash(
        flashSource ?? bytes,
        ownedMust,
      );
      if (fromFlash) {
        dex = { seen: fromFlash.seen, source: "seen1" };
        if (!badges.reliable && fromFlash.badges.reliable) {
          badges = fromFlash.badges;
        }
        if (!revive.reliable && fromFlash.revive.reliable) {
          revive = fromFlash.revive;
        }
        if (!safariZoneAreas.reliable && fromFlash.safariZoneAreas.reliable) {
          safariZoneAreas = fromFlash.safariZoneAreas;
        }
        if (!randomizer.reliable && fromFlash.randomizer.reliable) {
          randomizer = fromFlash.randomizer;
        }
        if (!encounterFlags.reliable && fromFlash.encounterFlags.reliable) {
          encounterFlags = fromFlash.encounterFlags;
        }
        warnings.push(
          `Pokédex: ${fromFlash.seen.length} seen (embedded flash seen1).`,
        );
      }
    }
  }

  if (!money.reliable) {
    const fromFlash = readMoneyFromEmbeddedFlash(
      flashSource ?? bytes,
      speciesMode,
    );
    if (fromFlash.reliable) {
      money = fromFlash;
      warnings.push("Money read from embedded flash sectors in save state.");
    }
  }

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
      ...dexBitIdsForMode(
        encounteredParsed.map((m) => m.pokedexId),
        speciesMode,
      ).filter((id) => id <= maxDex),
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
      .map((id) =>
        speciesMode === "modern" ? modernRomDexToNational(id) : id,
      )
      .filter((id) => !already.has(id))
      .sort((a, b) => a - b)
      .filter((_, i) => {
        if (i < DEX_SEEN_STUB_CAP) return true;
        truncated += 1;
        return false;
      })
      // Values are already real National Dex ids.
      .map((id) => dexSeenToParsed(id, "crest"));
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
    money,
    safariZoneAreas,
    randomizer,
    encounterFlags,
    party: partyParsed,
    box: boxParsed,
    rip: ripParsed,
    encountered: encounteredParsed,
  };
}

function readTrainerFromSaveBlock2(sb2: Uint8Array): ParsedSaveTrainer | null {
  if (sb2.length < 16) return null;
  const name = decodeGen3Name(sb2.subarray(0, 8));
  if (!name || !isValidGen3TrainerName(name)) return null;
  const genderByte = sb2[8] ?? 0xff;
  if (genderByte > 1) return { name, gender: null };
  return { name, gender: genderByte === 1 ? "F" : "M" };
}

/** `GetTrainerId(gSaveBlock2Ptr->playerTrainerId)` — little-endian u32 at 0x0A. */
function readTrainerIdFromSaveBlock2(sb2: Uint8Array): number | null {
  if (sb2.length < SB2_TRAINER_ID + 4) return null;
  return new DataView(sb2.buffer, sb2.byteOffset + SB2_TRAINER_ID, 4).getUint32(
    0,
    true,
  );
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

  const daycare = readDaycareMons(sb1, speciesMode, claimed);
  for (const mon of daycare) {
    claimed.add(mon.pid);
    box.push(mon);
  }
  if (daycare.length > 0) {
    warnings.push(
      `Day Care: imported ${daycare.length} Pokémon into Reserves.`,
    );
  }

  const trainer = readTrainerFromSaveBlock2(sb2) ?? findTrainerNearParty(sb1, partyLiving);
  const flagsOff = speciesMode === "modern" ? SB1_FLAGS : CREST_SB1_FLAGS;
  const badges = readBadgesAbsolute(sb1, flagsOff);
  if (!badges.reliable) {
    warnings.push("Could not reliably read gym badge flags from SaveBlock1.");
  }
  const revive =
    speciesMode === "modern" ? readReviveAbsolute(sb1) : EMPTY_REVIVE;
  const safariZoneAreas =
    speciesMode === "modern"
      ? readSafariZoneAreasAbsolute(sb1)
      : EMPTY_SAFARI_ZONE_AREAS;
  if (speciesMode === "modern" && !revive.reliable) {
    warnings.push("Could not read revive token from SaveBlock1.");
  }
  // SaveBlock2 is anchored here, so the seed comes from `playerTrainerId` when
  // the block is long enough, else falls back to modalOtId([...party, ...box, ...rip]).
  const trainerId = readTrainerIdFromSaveBlock2(sb2);
  const randomizer =
    speciesMode === "modern"
      ? readRandomizerAbsolute(sb1, 0, trainerId ?? modalOtId([...party, ...box, ...rip]))
      : EMPTY_RANDOMIZER;
  const encounterFlags =
    speciesMode === "modern"
      ? readEncounterFlagsAbsolute(sb1, 0)
      : EMPTY_ENCOUNTER_FLAGS;
  const money = readMoney(sb1, sb2, speciesMode);

  const partyParsed = partyLiving.map((m) => toParsed(m, "party", speciesMode));
  const boxParsed = box.map((m) => toParsed(m, "box", speciesMode));
  const ripParsed = rip.map((m) => toParsed(m, "rip", speciesMode));

  const maxDex =
    speciesMode === "modern" ? MODERN_NUM_SPECIES : CREST_DEX_MAX_SPECIES;
  const ownedMust = dexBitIdsForMode(
    [...partyParsed, ...ripParsed].map((m) => m.pokedexId),
    speciesMode,
  ).filter((id) => id <= maxDex);

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
        .map((id) => modernRomDexToNational(id))
        .filter((id) => !already.has(id))
        .sort((a, b) => a - b)
        .filter((_, i) => {
          if (i < DEX_SEEN_STUB_CAP) return true;
          truncated += 1;
          return false;
        })
        .map((id) => dexSeenToParsed(id, "crest"));
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
    money,
    safariZoneAreas,
    randomizer,
    encounterFlags,
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
  // Party/dex scan the EWRAM window; flash sectors often live outside it in
  // the full mGBA dump — pass `mem` so money fallback uses the detected mode.
  return classifyEwram(ewram ?? mem, formatLabel, mem);
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
    if (ewram) return classifyEwram(ewram, "mGBA memory dump", buf);
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
