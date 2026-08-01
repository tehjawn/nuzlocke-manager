import type { PokemonSlot } from "@/lib/challenge-types";

/** Slots that mirror the save 1:1 on import. Memorial is season-wide and merges. */
export const DEFAULT_IMPORT_REPLACE_SLOTS: PokemonSlot[] = [
  "MAIN",
  "RESERVE",
  "ENCOUNTERED",
];

export type GraveIdentity = {
  species: string;
  nickname?: string | null;
};

/** Stable key for light dedupe when appending imported R.I.P. rows. */
export function graveDedupeKey(mon: GraveIdentity): string {
  return `${mon.species.trim().toLowerCase()}|${
    mon.nickname?.trim().toLowerCase() || ""
  }`;
}

/**
 * Append-only memorial import: keep existing graves, add incoming R.I.P. that
 * are not already present (species + nickname). Returns the rows to create and
 * the next partyIndex to assign.
 */
export function importedGravesToAppend<T extends GraveIdentity>(
  existingGraves: Array<GraveIdentity & { partyIndex: number }>,
  incoming: T[],
): { toCreate: T[]; nextPartyIndex: number } {
  const seen = new Set(existingGraves.map(graveDedupeKey));
  const toCreate: T[] = [];
  for (const mon of incoming) {
    const key = graveDedupeKey(mon);
    if (seen.has(key)) continue;
    seen.add(key);
    toCreate.push(mon);
  }
  const nextPartyIndex =
    existingGraves.reduce((max, p) => Math.max(max, p.partyIndex), -1) + 1;
  return { toCreate, nextPartyIndex };
}
