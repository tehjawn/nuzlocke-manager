/**
 * Resolve an item name to its ItemDex slug, without pulling the catalog in.
 *
 * `items.ts` carries sources, descriptions and the evolution join — ~100 KB
 * once bundled. The surfaces that only need "is this a known item, and what do
 * I link to" (`PokemonDetailsModal` on the trainer board, evolution condition
 * chips, the Jump index) import this instead.
 */
import {
  ITEM_NAME_ALIASES,
  ITEM_SLUGS,
} from "@/data/items-lite.generated";

/**
 * Shared key for every item lookup. Handles the three ways an item name
 * reaches us: a catalog slug (`kings-rock`), a ROM/display name
 * (`King's Rock`, `TwistedSpoon`), and the evolution param strings, which
 * `generate-species-evolutions.mjs` derives from the same `ITEM_*` constants
 * the catalog is keyed on.
 *
 * `generate-items.mjs` has a copy of this — they must stay in lockstep, since
 * it is what decides which name aliases need emitting.
 */
export function itemKey(nameOrSlug: string): string {
  return nameOrSlug
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_SET: ReadonlySet<string> = new Set(ITEM_SLUGS);
const ALIAS_TO_SLUG: ReadonlyMap<string, string> = new Map(ITEM_NAME_ALIASES);

/** ItemDex slug for a name/slug, or null when the ROM has no such item. */
export function itemDexSlug(
  nameOrSlug: string | null | undefined,
): string | null {
  if (!nameOrSlug?.trim()) return null;
  const key = itemKey(nameOrSlug);
  if (SLUG_SET.has(key)) return key;
  return ALIAS_TO_SLUG.get(key) ?? null;
}
