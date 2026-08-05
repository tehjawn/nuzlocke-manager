/**
 * Modern Emerald (nzl_modern) SaveBlock layout constants.
 *
 * Party/money start like pret Emerald; bag is expanded (BAG_ITEMS_COUNT 90 →
 * +0xF0 vs vanilla from seen1 onward). Dex bitfields use the ROM's compacted
 * NATIONAL_DEX_* indices (GetSetPokedexFlag), size 58 — those diverge from real
 * National Dex numbers for later additions (e.g. Leafeon is ROM dex 414, real
 * National Dex 470).
 *
 * SB1_FLAGS is 0x1364 (not 0x1270+0xF0+6): confirmed against Afterplay .srm
 * where gym-1 + Rustboro visited decode cleanly; 0x1366 reads as a bogus
 * non-prefix badge set.
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
/** Gen 3 wallet cap (GetMoney / SetMoney). */
export const MAX_MONEY = 999_999;
/**
 * Pokémon Day Care — vanilla Emerald `SaveBlock1.daycare`.
 * Modern Emerald shifts later SB1 fields by the bag expansion (~+0xF0).
 */
export const SB1_DAYCARE = 0x3030;
export const MODERN_SB1_DAYCARE = 0x3120;
/** `struct DaycareMon` stride (BoxPokemon + mail + steps). */
export const DAYCARE_MON_STRIDE = 0x8c;
export const DAYCARE_MON_COUNT = 2;
/** National dex seen[1]; owned bitfield immediately precedes this (58 bytes). */
export const SB1_SEEN1 = 0xa78;
/**
 * Second seen copy (seen1 + 0x30B0).
 */
export const SB1_SEEN2 = 0x3b28;
/**
 * Gym badges live in flags[SYSTEM_FLAGS…].
 * Empirically 0x1364 on Modern Emerald flash saves (see file header).
 */
export const SB1_FLAGS = 0x1364;
/** Vanilla/Crest Emerald SaveBlock1.flags (52-byte dex). */
export const CREST_SB1_FLAGS = 0x1270;
/**
 * NuzlockeEncounterFlags[9] then packed challenge bitfields.
 */
export const SB1_NUZLOCKE_ENCOUNTER_FLAGS = 0x3d94;
export const SB1_NUZLOCKE_FLAGS_LEN = 9;
/**
 * `tx_Random_*` bitfields, packed immediately after `NuzlockeEncounterFlags[9]`
 * (include/global.h). The first byte is Chaos … Abilities, LSB first — the five
 * bits below are the ones that decide how a wild species is rerolled.
 */
export const SB1_TX_SETTINGS =
  SB1_NUZLOCKE_ENCOUNTER_FLAGS + SB1_NUZLOCKE_FLAGS_LEN;
export const TX_RANDOM_CHAOS_BIT = 0;
export const TX_RANDOM_WILD_POKEMON_BIT = 1;
export const TX_RANDOM_SIMILAR_BIT = 2;
export const TX_RANDOM_MAP_BASED_BIT = 3;
export const TX_RANDOM_INCLUDE_LEGENDARIES_BIT = 4;
/**
 * tx_Nuzlocke_RevivesUsed:4 — absolute offset (= nuz flags + 9 + 11).
 */
export const SB1_REVIVES_USED = 0x3da8;
export const SB1_REVIVES_USED_BYTE = 11;
export const REVIVES_USED_MASK = 0xf;
export const MODERN_REVIVES_TOTAL = 1;

/** Relatives from playerParty (only valid when partyBase is SaveBlock1.playerParty). */
export const SEEN1_AFTER_PARTY = SB1_SEEN1 - SB1_PARTY; // 0x750
export const FLAGS_AFTER_PARTY = SB1_FLAGS - SB1_PARTY; // 0x112C
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
/**
 * XOR key for money / coins / encrypted bag fields.
 * Vanilla/Crest pokeemerald: offsetof(SaveBlock2, encryptionKey) == 0xAC.
 * Modern Emerald inserts ~0x10 bytes before the key (confirmed on Afterplay
 * .srm/.state: 0xAC holds a small junk field; bag qty ⊕ key@0xBC decodes cleanly).
 */
export const SB2_ENCRYPTION_KEY = 0xbc;
/** Vanilla / Crest SaveBlock2.encryptionKey. */
export const CREST_SB2_ENCRYPTION_KEY = 0xac;

/** PokemonStorage */
export const STORAGE_CURRENT_BOX = 0x00;
/**
 * boxes[][] — 4-byte aligned after currentBox (u8 + 3 pad before first u32 PID).
 * Stale ROM comments say 0x0001; real layout is 0x0004.
 */
export const STORAGE_BOXES = 0x04;
export const STORAGE_BOX_COUNT = 15;
export const STORAGE_BOX_CAPACITY = 30;
export const BOX_MON_SIZE = 80;
export const PARTY_MON_SIZE = 100;
export const PARTY_SLOTS = 6;

export const SYSTEM_FLAGS = 0x860;
export const FLAG_BADGE01 = SYSTEM_FLAGS + 0x7;

export const MODERN_DEX_FLAG_BYTES = modernSpeciesData.dexFlagBytes as number;
export const MODERN_NUM_SPECIES = modernSpeciesData.numSpecies as number;
/** SPECIES_* (party/box growth) → real National Dex / catalog id. */
export const MODERN_SPECIES_TO_NATIONAL = modernSpeciesData.table as number[];
/** Compacted ROM NATIONAL_DEX_* index (dex bitfields) → real National Dex. */
export const MODERN_ROM_DEX_TO_NATIONAL =
  modernSpeciesData.romDexToNational as number[];

/** Crest / expansion national-dex bitfield size (fallback path only). */
export const CREST_DEX_FLAG_BYTES = 129;
export const CREST_DEX_MAX_SPECIES = 1025;
