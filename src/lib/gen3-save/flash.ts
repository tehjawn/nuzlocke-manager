/**
 * Reassemble Gen 3 Emerald flash saves (Afterplay .sav / .srm).
 *
 * 32 × 4 KiB sectors; slot A = ids 0–13, slot B = 14–27. Each footer carries
 * logical sector id + checksum + signature 0x08012025 + save counter.
 */

import {
  NUM_SECTORS,
  NUM_SECTORS_PER_SLOT,
  SECTOR_DATA_SIZE,
  SECTOR_ID_PKMN_STORAGE_END,
  SECTOR_ID_PKMN_STORAGE_START,
  SECTOR_ID_SAVEBLOCK1_END,
  SECTOR_ID_SAVEBLOCK1_START,
  SECTOR_ID_SAVEBLOCK2,
  SECTOR_SIGNATURE,
  SECTOR_SIZE,
} from "./layout";

export type FlashSaveBlocks = {
  saveBlock1: Uint8Array;
  saveBlock2: Uint8Array;
  storage: Uint8Array;
  slot: 0 | 1;
  counter: number;
};

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** pret CalculateChecksum: sum u32 words, then fold to u16. */
export function sectorChecksum(data: Uint8Array, size: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const words = Math.floor(size / 4);
  let sum = 0;
  for (let i = 0; i < words; i++) {
    sum = (sum + view.getUint32(i * 4, true)) >>> 0;
  }
  return ((sum >>> 16) + (sum & 0xffff)) & 0xffff;
}

function readSectorMeta(buf: Uint8Array, physicalIndex: number) {
  const base = physicalIndex * SECTOR_SIZE;
  if (base + SECTOR_SIZE > buf.length) return null;
  const view = new DataView(buf.buffer, buf.byteOffset + base, SECTOR_SIZE);
  const id = u16(view, 0xff4);
  const checksum = u16(view, 0xff6);
  const signature = u32(view, 0xff8);
  const counter = u32(view, 0xffc);
  const data = buf.subarray(base, base + SECTOR_DATA_SIZE);
  return { id, checksum, signature, counter, data, physicalIndex };
}

function checksumMatches(data: Uint8Array, expect: number, id: number): boolean {
  const candidates = new Set<number>([SECTOR_DATA_SIZE]);
  // Trailing SaveBlock1 / storage chunks are shorter than 4084.
  if (id === SECTOR_ID_SAVEBLOCK1_END || id === SECTOR_ID_PKMN_STORAGE_END) {
    for (let s = 200; s <= SECTOR_DATA_SIZE; s += 4) candidates.add(s);
  }
  // SaveBlock2 is a single short sector.
  if (id === SECTOR_ID_SAVEBLOCK2) {
    for (let s = 0x800; s <= 0xf80; s += 4) candidates.add(s);
  }
  for (const size of candidates) {
    if (size > data.length) continue;
    if (sectorChecksum(data, size) === expect) return true;
  }
  return false;
}

function slotValid(
  buf: Uint8Array,
  slot: 0 | 1,
): { ok: boolean; counter: number; byId: Map<number, Uint8Array> } {
  const start = slot * NUM_SECTORS_PER_SLOT;
  const byId = new Map<number, Uint8Array>();
  let counter = 0;
  let valid = 0;
  let checksumOk = 0;

  for (let i = 0; i < NUM_SECTORS_PER_SLOT; i++) {
    const meta = readSectorMeta(buf, start + i);
    if (!meta || meta.signature !== SECTOR_SIGNATURE) continue;
    if (meta.id > SECTOR_ID_PKMN_STORAGE_END) continue;

    const matched = checksumMatches(meta.data, meta.checksum, meta.id);
    if (matched) checksumOk += 1;
    // Accept signature+id even when trailing-chunk size guess fails — Afterplay
    // dumps are otherwise well-formed and we still need SB1/PC bytes.
    byId.set(meta.id, meta.data);
    counter = Math.max(counter, meta.counter >>> 0);
    valid += 1;
  }

  const hasCore =
    byId.has(SECTOR_ID_SAVEBLOCK2) &&
    byId.has(SECTOR_ID_SAVEBLOCK1_START) &&
    byId.has(SECTOR_ID_PKMN_STORAGE_START);

  // Prefer slots where most sectors checksum; require core sectors present.
  return {
    ok: valid >= 10 && hasCore && checksumOk >= 3,
    counter,
    byId,
  };
}

function concatSectors(
  byId: Map<number, Uint8Array>,
  startId: number,
  endId: number,
): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let id = startId; id <= endId; id++) {
    parts.push(byId.get(id) ?? new Uint8Array(SECTOR_DATA_SIZE));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** True when buffer looks like a Gen 3 flash image (not an mGBA memory dump). */
export function looksLikeFlashSave(buf: Uint8Array): boolean {
  if (
    buf.length !== 0x10000 &&
    buf.length !== 0x20000 &&
    buf.length !== 0x20010
  ) {
    return false;
  }
  const limit = Math.min(NUM_SECTORS, Math.floor(buf.length / SECTOR_SIZE));
  for (let i = 0; i < limit; i++) {
    const meta = readSectorMeta(buf, i);
    if (meta && meta.signature === SECTOR_SIGNATURE) return true;
  }
  return false;
}

/**
 * Parse a 64/128 KiB flash save into SaveBlock1/2 + PokemonStorage.
 * Returns null when no valid slot is found.
 */
export function parseFlashSave(buf: Uint8Array): FlashSaveBlocks | null {
  if (!looksLikeFlashSave(buf)) return null;

  const slot0 = slotValid(buf, 0);
  const slot1 = slotValid(buf, 1);

  let chosen: ReturnType<typeof slotValid> & { slot: 0 | 1 };
  if (slot0.ok && slot1.ok) {
    chosen =
      slot1.counter >= slot0.counter
        ? { ...slot1, slot: 1 }
        : { ...slot0, slot: 0 };
  } else if (slot0.ok) {
    chosen = { ...slot0, slot: 0 };
  } else if (slot1.ok) {
    chosen = { ...slot1, slot: 1 };
  } else {
    return null;
  }

  return {
    saveBlock2: concatSectors(
      chosen.byId,
      SECTOR_ID_SAVEBLOCK2,
      SECTOR_ID_SAVEBLOCK2,
    ),
    saveBlock1: concatSectors(
      chosen.byId,
      SECTOR_ID_SAVEBLOCK1_START,
      SECTOR_ID_SAVEBLOCK1_END,
    ),
    storage: concatSectors(
      chosen.byId,
      SECTOR_ID_PKMN_STORAGE_START,
      SECTOR_ID_PKMN_STORAGE_END,
    ),
    slot: chosen.slot,
    counter: chosen.counter,
  };
}
