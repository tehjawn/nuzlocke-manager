/**
 * Modern Emerald legendary / mythical National Dex ids.
 *
 * Kept as an explicit set (not randomizer evo-slot tables) so the Pokédex
 * competitive ladder can filter independently of optional ROM tooling.
 */
const LEGENDARY_NATIONAL_IDS = new Set<number>([
  // Kanto
  144, // Articuno
  145, // Zapdos
  146, // Moltres
  150, // Mewtwo
  151, // Mew
  // Johto
  243, // Raikou
  244, // Entei
  245, // Suicune
  249, // Lugia
  250, // Ho-Oh
  251, // Celebi
  // Hoenn
  377, // Regirock
  378, // Regice
  379, // Registeel
  380, // Latias
  381, // Latios
  382, // Kyogre
  383, // Groudon
  384, // Rayquaza
  385, // Jirachi
  386, // Deoxys-Normal
  // Later ME extras
  486, // Regigigas
  493, // Arceus
  894, // Regieleki
  895, // Regidrago
  // Deoxys formes (ME national ids)
  10001, // Deoxys-Attack
  10002, // Deoxys-Defense
  10003, // Deoxys-Speed
]);

export function isLegendaryNationalId(
  pokedexId: number | null | undefined,
): boolean {
  if (pokedexId == null || pokedexId <= 0) return false;
  return LEGENDARY_NATIONAL_IDS.has(pokedexId);
}

export function legendaryNationalIds(): readonly number[] {
  return [...LEGENDARY_NATIONAL_IDS].sort((a, b) => a - b);
}
