import abilitiesData from "@/data/abilities.json";
import gen3ItemsData from "@/data/gen3-items.json";
import naturesData from "@/data/natures.json";
import speciesAbilitiesData from "@/data/species-abilities.json";
import { CATCH_ROUTES, searchCatchRoutes } from "@/data/catch-routes";
import { HELD_ITEMS, searchHeldItems } from "@/data/pokemon-index";

export type AbilityEntry = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

export const NATURES = naturesData.natures as string[];
export const ABILITIES = abilitiesData.abilities as AbilityEntry[];

const ABILITY_DESCRIPTION_BY_NAME: Record<string, string> = Object.fromEntries(
  ABILITIES.flatMap((a) => {
    const desc = a.description?.trim();
    if (!desc) return [];
    return [
      [a.name, desc],
      [a.name.toLowerCase(), desc],
    ];
  }),
);

/** Battle effect text for a known ability name (case-insensitive). */
export function abilityDescription(
  name: string | null | undefined,
): string | null {
  if (!name?.trim()) return null;
  return (
    ABILITY_DESCRIPTION_BY_NAME[name] ??
    ABILITY_DESCRIPTION_BY_NAME[name.toLowerCase()] ??
    null
  );
}

const SPECIES_ABILITIES = speciesAbilitiesData.species as Record<
  string,
  string[]
>;

export { CATCH_ROUTES, searchCatchRoutes, HELD_ITEMS, searchHeldItems };
export {
  heldItemDescription,
  heldItemIconStem,
  heldItemSpriteUrl,
} from "@/data/pokemon-index";
export {
  GEN3_MOVES,
  GEN3_MOVES_MODERN,
  gen3MoveName,
  resolveMoveName,
  resolveMoveNames,
  type Gen3MoveMode,
} from "@/lib/move-names";
export {
  gen3MetLocationName,
  type Gen3MapsecMode,
} from "@/data/gen3-mapsec";

export function natureFromPid(pid: number): string {
  return NATURES[pid % 25] ?? "Hardy";
}

/** Nature name for a ROM nature index (NATURE_HARDY = 0 … 24); null when out of range. */
export function natureFromIndex(index: number): string | null {
  return NATURES[index] ?? null;
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

export function abilityForSpecies(
  pokedexId: number,
  abilitySlot: number,
): string | null {
  const list = SPECIES_ABILITIES[String(pokedexId)];
  if (!list || list.length === 0) return null;
  const idx = abilitySlot > 0 && list.length > 1 ? 1 : 0;
  return list[idx] ?? list[0] ?? null;
}

/** All catalog abilities for a National Dex / forme id (empty when unknown). */
export function abilitiesForSpecies(pokedexId: number): string[] {
  return SPECIES_ABILITIES[String(pokedexId)] ?? [];
}

/** Gen 3 item IDs → display names (pret/pokeemerald constants). */
const GEN3_ITEMS = gen3ItemsData.items as Record<string, string>;

export function gen3ItemName(itemId: number): string | null {
  if (itemId <= 0) return null;
  return GEN3_ITEMS[String(itemId)] ?? null;
}
