import type { PokemonEntry } from "@/lib/challenge-types";

/** Slots that count toward held-item / species dupe soft warnings. */
const ACTIVE_SLOTS = new Set(["MAIN", "RESERVE"]);

function normalizeItem(item: string | null | undefined): string | null {
  const t = item?.trim().toLowerCase();
  return t ? t : null;
}

function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase();
}

export type HeldItemWarning = {
  item: string;
  holders: { id: string; label: string }[];
};

export type SpeciesWarning = {
  species: string;
  holders: { id: string; label: string }[];
};

function monLabel(mon: PokemonEntry): string {
  return mon.nickname?.trim() || mon.species;
}

/** Duplicate held items across Main + Reserves (RIP / Encountered ignored). */
export function findDuplicateHeldItems(
  pokemon: PokemonEntry[],
  options?: { excludeId?: string | null; draftItem?: string | null },
): HeldItemWarning[] {
  const counts = new Map<string, { display: string; holders: HeldItemWarning["holders"] }>();

  for (const mon of pokemon) {
    if (!ACTIVE_SLOTS.has(mon.slot)) continue;
    if (options?.excludeId && mon.id === options.excludeId) continue;
    const key = normalizeItem(mon.heldItem);
    if (!key) continue;
    const entry = counts.get(key) ?? {
      display: mon.heldItem!.trim(),
      holders: [],
    };
    entry.holders.push({ id: mon.id, label: monLabel(mon) });
    counts.set(key, entry);
  }

  const draftKey = normalizeItem(options?.draftItem);
  if (draftKey) {
    const entry = counts.get(draftKey) ?? {
      display: options!.draftItem!.trim(),
      holders: [],
    };
    // Draft itself is not a holder — we only care if others already have it.
    counts.set(draftKey, entry);
  }

  const warnings: HeldItemWarning[] = [];
  for (const [key, entry] of counts) {
    const hitsOthers = entry.holders.length > 0;
    const draftConflicts = draftKey === key && hitsOthers;
    const multiOnBoard = entry.holders.length > 1;
    if (draftConflicts || multiOnBoard) {
      warnings.push({ item: entry.display, holders: entry.holders });
    }
  }
  return warnings;
}

/** Same species already on Main / Reserves (soft dupe-clause nudge). */
export function findDuplicateSpecies(
  pokemon: PokemonEntry[],
  options?: { excludeId?: string | null; draftSpecies?: string | null },
): SpeciesWarning[] {
  const draft = options?.draftSpecies?.trim();
  if (!draft) return [];
  const key = normalizeSpecies(draft);
  const holders = pokemon
    .filter(
      (mon) =>
        ACTIVE_SLOTS.has(mon.slot) &&
        (!options?.excludeId || mon.id !== options.excludeId) &&
        normalizeSpecies(mon.species) === key,
    )
    .map((mon) => ({ id: mon.id, label: monLabel(mon) }));
  if (holders.length === 0) return [];
  return [{ species: draft, holders }];
}
