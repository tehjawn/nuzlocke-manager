/**
 * Gen 3 met-location (MAPSEC) → display name.
 *
 * Modern Emerald (nzl_modern) diverges from vanilla Emerald after the early
 * underwater block — e.g. Petalburg Woods is 0x3B in modern but was labeled
 * Battle Frontier when we used the vanilla table. Always prefer `modern` for
 * Trash Pack / nzl_modern saves.
 *
 * Sources:
 * - pret/pokeemerald include/constants/region_map_sections.h (vanilla table)
 * - resetes12/pokeemerald "Modern Emerald" (modern table, generated)
 */
import { MAPSEC_LABELS } from "@/data/catch-routes.generated";

export type Gen3MapsecMode = "modern" | "vanilla";

/** Special met-location sentinel values (shared). */
const METLOC_SPECIAL: Record<number, string> = {
  0xfd: "Starter gift",
  0xfe: "In-game trade",
  0xff: "Event / gift",
};

/**
 * Vanilla Emerald / Crest-friendly MAPSEC table (legacy).
 * Kept for non-modern species-mode saves.
 */
const VANILLA_EMERALD_MAPSEC: Record<number, string> = {
  0: "Littleroot Town",
  1: "Oldale Town",
  2: "Dewford Town",
  3: "Lavaridge Town",
  4: "Fallarbor Town",
  5: "Verdanturf Town",
  6: "Pacifidlog Town",
  7: "Petalburg City",
  8: "Slateport City",
  9: "Mauville City",
  10: "Rustboro City",
  11: "Fortree City",
  12: "Lilycove City",
  13: "Mossdeep City",
  14: "Sootopolis City",
  15: "Ever Grande City",
  16: "Route 101",
  17: "Route 102",
  18: "Route 103",
  19: "Route 104",
  20: "Route 105",
  21: "Route 106",
  22: "Route 107",
  23: "Route 108",
  24: "Route 109",
  25: "Route 110",
  26: "Route 111",
  27: "Route 112",
  28: "Route 113",
  29: "Route 114",
  30: "Route 115",
  31: "Route 116",
  32: "Route 117",
  33: "Route 118",
  34: "Route 119",
  35: "Route 120",
  36: "Route 121",
  37: "Route 122",
  38: "Route 123",
  39: "Route 124",
  40: "Route 125",
  41: "Route 126",
  42: "Route 127",
  43: "Route 128",
  44: "Route 129",
  45: "Route 130",
  46: "Route 131",
  47: "Route 132",
  48: "Route 133",
  49: "Route 134",
  50: "Underwater",
  51: "Underwater",
  52: "Underwater",
  53: "Underwater",
  54: "Underwater",
  55: "Underwater",
  56: "Granite Cave",
  57: "Mt. Chimney",
  58: "Safari Zone",
  59: "Battle Frontier",
  60: "Petalburg Woods",
  61: "Rusturf Tunnel",
  62: "Abandoned Ship",
  63: "New Mauville",
  64: "Meteor Falls",
  65: "Meteor Falls",
  66: "Mt. Pyre",
  67: "Aqua Hideout",
  68: "Shoal Cave",
  69: "Seafloor Cavern",
  70: "Underwater",
  71: "Victory Road",
  72: "Mirage Island",
  73: "Cave of Origin",
  74: "Southern Island",
  75: "Fiery Path",
  76: "Fiery Path",
  77: "Jagged Pass",
  78: "Jagged Pass",
  79: "Sealed Chamber",
  80: "Underwater",
  81: "Scorched Slab",
  82: "Island Cave",
  83: "Desert Ruins",
  84: "Ancient Tomb",
  85: "Inside of Truck",
  86: "Sky Pillar",
  87: "Secret Base",
  88: "Special area",
  194: "Battle Tower",
  196: "Artisan Cave",
  198: "Desert Underpass",
  199: "Altering Cave",
  200: "Navel Rock",
  201: "Birth Island",
  ...METLOC_SPECIAL,
};

/**
 * Modern Emerald MAPSEC table — generated, see `npm run data:catch-routes`.
 *
 * Differs from vanilla from Granite Cave onward (one fewer early underwater id),
 * and the hack repurposed dead FRLG slots for new areas (0x9D Route 132 North,
 * 0x9E Route 110 East, 0xD5/0xD6 the Regidrago/Regieleki chambers). The old
 * hand-written table stopped at 0xD4, so those imported with no location at all.
 *
 * Note this is deliberately wider than the catch-route catalog: it exists to
 * name a met location, not to decide whether the location is claimable. It also
 * carries the METLOC_* sentinels itself, including the honest name for 0xFD
 * (a daycare egg, not the starter).
 */
const MODERN_EMERALD_MAPSEC: Record<number, string> = MAPSEC_LABELS;

export function gen3MetLocationName(
  mapsec: number,
  mode: Gen3MapsecMode = "modern",
): string | null {
  if (!Number.isFinite(mapsec) || mapsec < 0) return null;
  const table =
    mode === "vanilla" ? VANILLA_EMERALD_MAPSEC : MODERN_EMERALD_MAPSEC;
  return table[mapsec] ?? METLOC_SPECIAL[mapsec] ?? null;
}
