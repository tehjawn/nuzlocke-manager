/**
 * Modern Emerald (nzl_modern) SaveBlock layout constants.
 *
 * Party/money/bag pocket *starts* match pret Emerald (BAG_ITEMS_COUNT stays 30).
 * Dex bitfields use National Dex indices (GetSetPokedexFlag), size 58.
 *
 * Offsets past seen1 were confirmed against live Afterplay .ss0 fixtures
 * (global.h comments are stale vanilla addresses).
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
 * Empirical: seen1 + 0x30B0 (vanilla gap shrank vs +6-only estimate).
 */
export const SB1_SEEN2 = 0x3a38;
/**
 * Vanilla 0x1270 + (58-52). Gym badges live in flags[SYSTEM_FLAGS…].
 */
export const SB1_FLAGS = 0x1276;
/** Vanilla/Crest Emerald SaveBlock1.flags (52-byte dex). */
export const CREST_SB1_FLAGS = 0x1270;
/**
 * Empirical from .ss0 fixtures (seen2 + ~0x26C).
 * NuzlockeEncounterFlags[9] then packed challenge bitfields.
 */
export const SB1_NUZLOCKE_ENCOUNTER_FLAGS = 0x3ca4;
export const SB1_NUZLOCKE_FLAGS_LEN = 9;
/**
 * tx_Nuzlocke_RevivesUsed:4 — empirical absolute offset (= nuz flags + 9 + 11).
 */
export const SB1_REVIVES_USED = 0x3cb8;
export const SB1_REVIVES_USED_BYTE = 11;
export const REVIVES_USED_MASK = 0xf;
export const MODERN_REVIVES_TOTAL = 1;

/** Relatives from playerParty (only valid when partyBase is SaveBlock1.playerParty). */
export const SEEN1_AFTER_PARTY = SB1_SEEN1 - SB1_PARTY; // 0x750
export const FLAGS_AFTER_PARTY = SB1_FLAGS - SB1_PARTY; // 0x103E
export const NUZLOCKE_FLAGS_AFTER_PARTY =
  SB1_NUZLOCKE_ENCOUNTER_FLAGS - SB1_PARTY; // 0x3A6C

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
