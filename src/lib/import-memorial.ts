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
  /** Gen 3 PID when known — preferred dedupe key over species|nickname. */
  personalityValue?: number | null;
};

/** Species + nickname key for pre-PID / null-PID memorial rows. */
export function graveSpeciesNicknameKey(mon: GraveIdentity): string {
  return `${mon.species.trim().toLowerCase()}|${
    mon.nickname?.trim().toLowerCase() || ""
  }`;
}

/**
 * Stable key for light dedupe when appending imported R.I.P. rows.
 * Prefer PID when present so evolutions / renames still match.
 */
export function graveDedupeKey(mon: GraveIdentity): string {
  if (mon.personalityValue != null) {
    return `pid:${mon.personalityValue}`;
  }
  return `sn:${graveSpeciesNicknameKey(mon)}`;
}

export type ImportedGravesAppendResult<T extends GraveIdentity> = {
  toCreate: T[];
  /** Existing graves matched by PID — refresh chrome without clobbering memorial text. */
  toRefresh: Array<{ personalityValue: number; incoming: T }>;
  nextPartyIndex: number;
};

/**
 * Append-only memorial import: keep existing graves, add incoming R.I.P. that
 * are not already present. Prefer PID match when both sides have one; else
 * species + nickname (pre-PID rows).
 */
export function importedGravesToAppend<T extends GraveIdentity>(
  existingGraves: Array<GraveIdentity & { partyIndex: number }>,
  incoming: T[],
): ImportedGravesAppendResult<T> {
  const existingByPid = new Map<number, GraveIdentity & { partyIndex: number }>();
  const seenSn = new Set<string>();
  for (const grave of existingGraves) {
    if (grave.personalityValue != null) {
      existingByPid.set(grave.personalityValue, grave);
    }
    seenSn.add(graveSpeciesNicknameKey(grave));
  }

  const toCreate: T[] = [];
  const toRefresh: Array<{ personalityValue: number; incoming: T }> = [];
  const seenIncomingPids = new Set<number>();

  for (const mon of incoming) {
    if (mon.personalityValue != null) {
      if (
        existingByPid.has(mon.personalityValue) ||
        seenIncomingPids.has(mon.personalityValue)
      ) {
        if (
          existingByPid.has(mon.personalityValue) &&
          !seenIncomingPids.has(mon.personalityValue)
        ) {
          toRefresh.push({
            personalityValue: mon.personalityValue,
            incoming: mon,
          });
        }
        seenIncomingPids.add(mon.personalityValue);
        continue;
      }
      seenIncomingPids.add(mon.personalityValue);
    }

    const sn = graveSpeciesNicknameKey(mon);
    if (seenSn.has(sn)) continue;
    seenSn.add(sn);
    toCreate.push(mon);
  }

  const nextPartyIndex =
    existingGraves.reduce((max, p) => Math.max(max, p.partyIndex), -1) + 1;
  return { toCreate, toRefresh, nextPartyIndex };
}
