/**
 * Typical first-visit order for Hoenn catch-map checklist labels.
 *
 * Soft / curated for a Modern Emerald nuzlocke — not a hard gate. Optional
 * detours, Surf returns, and fishing unlocks vary; post-game / ticket spots
 * sit at the end (same spirit as “Hide post-game areas”).
 *
 * Labels missing from this list sort after known ones (stable by name).
 */
export const HOENN_CATCH_VISIT_ORDER: readonly string[] = [
  // Prologue — nuzlocke usually locks after Route 103 rival + Pokédex
  "Littleroot Town",
  "Route 101",
  "Oldale Town",
  "Route 103",
  "Route 102",
  "Petalburg City",
  "Route 104",
  "Petalburg Woods",
  "Rustboro City",
  "Route 116",
  "Rusturf Tunnel",

  // Briney → Dewford → Slateport
  "Route 105",
  "Route 106",
  "Granite Cave",
  "Dewford Town",
  "Route 107",
  "Route 108",
  "Abandoned Ship",
  "Route 109",
  "Slateport City",
  "Route 110",
  "Mauville City",
  "New Mauville",
  "Route 117",
  "Verdanturf Town",

  // Meteor Falls / Magma / Lavaridge loop
  "Route 111",
  "Route 112",
  "Fiery Path",
  "Route 113",
  "Fallarbor Town",
  "Route 114",
  "Meteor Falls",
  "Route 115",
  "Mt. Chimney",
  "Jagged Pass",
  "Lavaridge Town",
  "Mirage Tower",

  // Weather institute → Fortree → Lilycove
  "Route 118",
  "Route 119",
  "Fortree City",
  "Route 120",
  "Scorched Slab",
  "Route 121",
  "Safari Zone",
  "Safari Zone (South)",
  "Safari Zone (Southwest)",
  "Safari Zone (Northwest)",
  "Safari Zone (North)",
  "Safari Zone (Southeast)",
  "Safari Zone (Northeast)",
  "Lilycove City",
  "Route 122",
  "Mt. Pyre",
  "Route 123",
  "Magma Hideout",
  "Aqua Hideout",

  // Dive / space center / legends
  "Route 124",
  "Underwater",
  "Mossdeep City",
  "Route 125",
  "Shoal Cave",
  "Route 127",
  "Route 128",
  "Seafloor Cavern",
  "Route 126",
  "Sootopolis City",
  "Cave of Origin",

  // Current circuit → Victory Road
  "Route 129",
  "Route 130",
  "Route 131",
  "Pacifidlog Town",
  "Route 132",
  "Route 133",
  "Route 134",
  "Sealed Chamber",
  "Sky Pillar",
  "Ever Grande City",
  "Victory Road",

  // Post-game / ticket / legendary doors
  "Island Cave",
  "Desert Ruins",
  "Ancient Tomb",
  "Altering Cave",
  "Artisan Cave",
  "Desert Underpass",
  "Trainer Hill",
  "Mirage Island",
  "Southern Island",
  "Battle Frontier",
] as const;

const VISIT_INDEX = new Map(
  HOENN_CATCH_VISIT_ORDER.map((label, index) => [label.toLowerCase(), index]),
);

/** Sort key for checklist rows — unknown labels sort after the curated list. */
export function catchVisitOrderIndex(label: string): number {
  return VISIT_INDEX.get(label.toLowerCase()) ?? HOENN_CATCH_VISIT_ORDER.length;
}
