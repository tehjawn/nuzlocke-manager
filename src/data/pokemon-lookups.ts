import abilitiesData from "@/data/abilities.json";
import gen3ItemsData from "@/data/gen3-items.json";
import gen3MovesData from "@/data/gen3-moves.json";
import naturesData from "@/data/natures.json";
import speciesAbilitiesData from "@/data/species-abilities.json";
import { CATCH_ROUTES, searchCatchRoutes } from "@/data/catch-routes";
import { HELD_ITEMS, searchHeldItems } from "@/data/pokemon-index";

export type AbilityEntry = {
  id: number;
  name: string;
  slug: string;
};

export const NATURES = naturesData.natures as string[];
export const ABILITIES = abilitiesData.abilities as AbilityEntry[];
export const GEN3_MOVES = gen3MovesData.moves as (string | null)[];

const SPECIES_ABILITIES = speciesAbilitiesData.species as Record<
  string,
  string[]
>;

export { CATCH_ROUTES, searchCatchRoutes, HELD_ITEMS, searchHeldItems };

export function natureFromPid(pid: number): string {
  return NATURES[pid % 25] ?? "Hardy";
}

export function searchNatures(query: string, limit = 25): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return NATURES.slice(0, limit);
  return NATURES.filter((n) => n.toLowerCase().includes(q)).slice(0, limit);
}

export function searchAbilities(query: string, limit = 40): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return ABILITIES.slice(0, limit).map((a) => a.name);
  return ABILITIES.filter(
    (a) => a.name.toLowerCase().includes(q) || a.slug.includes(q),
  )
    .slice(0, limit)
    .map((a) => a.name);
}

export function gen3MoveName(moveId: number): string | null {
  if (moveId <= 0) return null;
  return GEN3_MOVES[moveId] ?? `Move #${moveId}`;
}

export function abilityForSpecies(
  pokedexId: number,
  abilitySlot: number,
): string | null {
  const list = SPECIES_ABILITIES[String(pokedexId)];
  if (!list || list.length === 0) return null;
  const idx = abilitySlot > 0 && list.length > 1 ? 1 : 0;
  return list[idx] ?? list[0] ?? null;
}

/** Emerald mapsec → display name (subset used by catch logging). */
const GEN3_MAPSEC: Record<number, string> = {
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
  88: "Busy",
  194: "Battle Tower",
  196: "Artisan Cave",
  198: "Desert Underpass",
  199: "Altering Cave",
  200: "Navel Rock",
  201: "Birth Island",
};

export function gen3MetLocationName(mapsec: number): string | null {
  return GEN3_MAPSEC[mapsec] ?? null;
}

/** Gen 3 item IDs → display names (pret/pokeemerald constants). */
const GEN3_ITEMS = gen3ItemsData.items as Record<string, string>;

export function gen3ItemName(itemId: number): string | null {
  if (itemId <= 0) return null;
  return GEN3_ITEMS[String(itemId)] ?? null;
}
