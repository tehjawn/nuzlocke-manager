/**
 * Modern Emerald (nzl_modern) SaveBlock layout constants.
 *
 * Party/money/bag pocket *starts* match pret Emerald (BAG_ITEMS_COUNT stays 30).
 * After `seen1`, fields shift because NUM_DEX_FLAG_BYTES is 58 (vanilla 52):
 * +6 after seen1, +6 again after seen2 → +12 for NuzlockeEncounterFlags onward.
 *
 * Header comments in global.h are stale vanilla addresses — do not trust them
 * past seen1.
 */

import modernSpeciesData from "@/data/modern-emerald-species.json";

export const SECTOR_SIZE = 0x1000;
export const SECTOR_DATA_SIZE = 4084;
export const SECTOR_SIGNATURE = 0x08012025;
export const NUM_SECTORS = 32;
export const NUM_SECTORS_PER_SLOT = 14;

export const SECTOR_ID_SAVEBLOCK2 = 0;
export const SECTOR_ID_SAVEBLOCK1_START = 1;
export const SECTOR_ID_SAVEBLOCK1_END = 4;
export const SECTOR_ID_PKMN_STORAGE_START = 5;
export const SECTOR_ID_PKMN_STORAGE_END = 13;

/** SaveBlock1 — absolute offsets within the reassembled block. */
export const SB1_PARTY_COUNT = 0x234;
export const SB1_PARTY = 0x238;
export const SB1_MONEY = 0x490;
/** Unchanged vs vanilla (bag still 30 slots). */
export const SB1_SEEN1 = 0x988;
/**
 * Vanilla 0x1270 + (58-52). Gym badges live in flags[SYSTEM_FLAGS…].
 */
export const SB1_FLAGS = 0x1276;
/**
 * Vanilla 0x3D88 + 12 (seen1 + seen2 growth).
 */
export const SB1_NUZLOCKE_ENCOUNTER_FLAGS = 0x3d94;
export const SB1_NUZLOCKE_FLAGS_LEN = 9;
/**
 * After the 9-byte encounter flags, packed u8 bitfields; ARM packing places
 * tx_Nuzlocke_RevivesUsed:4 at byte 11, bits 0–3.
 */
export const SB1_REVIVES_USED_BYTE = 11;
export const REVIVES_USED_MASK = 0xf;
export const MODERN_REVIVES_TOTAL = 1;

/** Relatives from playerParty (for EWRAM-anchored parses). */
export const SEEN1_AFTER_PARTY = SB1_SEEN1 - SB1_PARTY; // 0x750
export const FLAGS_AFTER_PARTY = SB1_FLAGS - SB1_PARTY; // 0x103E
export const NUZLOCKE_FLAGS_AFTER_PARTY =
  SB1_NUZLOCKE_ENCOUNTER_FLAGS - SB1_PARTY; // 0x3B5C

/** Crest / vanilla Emerald relatives (bag 30, dex 52). */
export const CREST_FLAGS_AFTER_PARTY = 0x1038;
export const CREST_SEEN1_AFTER_PARTY = 0x750;
export const CREST_NUZLOCKE_FLAGS_AFTER_PARTY = 0x3b50;

/** SaveBlock2 */
export const SB2_PLAYER_NAME = 0x00;
export const SB2_PLAYER_GENDER = 0x08;
export const SB2_TRAINER_ID = 0x0a;

/** PokemonStorage */
export const STORAGE_CURRENT_BOX = 0x00;
/** boxes[][] starts immediately after currentBox (no padding). */
export const STORAGE_BOXES = 0x01;
export const STORAGE_BOX_COUNT = 15;
export const STORAGE_BOX_CAPACITY = 30;
export const BOX_MON_SIZE = 80;
export const PARTY_MON_SIZE = 100;
export const PARTY_SLOTS = 6;

export const SYSTEM_FLAGS = 0x860;
export const FLAG_BADGE01 = SYSTEM_FLAGS + 0x7;

export const MODERN_DEX_FLAG_BYTES = modernSpeciesData.dexFlagBytes as number;
export const MODERN_NUM_SPECIES = modernSpeciesData.numSpecies as number;
export const MODERN_SPECIES_TO_NATIONAL = modernSpeciesData.table as number[];

/** Crest / expansion national-dex bitfield size (fallback path only). */
export const CREST_DEX_FLAG_BYTES = 129;
export const CREST_DEX_MAX_SPECIES = 1025;
