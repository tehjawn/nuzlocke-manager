import type { PokemonSlot } from "@/lib/challenge-types";

export type LivingMergeExisting = {
  id: string;
  slot: PokemonSlot;
  personalityValue: number | null;
  causeOfDeath: string | null;
  notes: string | null;
};

export type LivingMergeIncoming = {
  personalityValue: number | null;
  slot: PokemonSlot;
};

export type LivingPidMergePlan<T extends LivingMergeIncoming> = {
  /** Same PID still living — update in place; keep id / memorial fields. */
  upserts: Array<{ existing: LivingMergeExisting; incoming: T }>;
  /**
   * Same PID now in GRAVEYARD — resolve Die + move row to memorial.
   * `incoming` is the grave payload mon when present; otherwise living chrome.
   */
  deaths: Array<{ existing: LivingMergeExisting; incoming: T }>;
  /** Real-PID living rows absent from living + grave → void then delete. */
  voidIds: string[];
  /** Null-PID living rows — wipe (no Survive/Die identity match). */
  wipeNullIds: string[];
  /** New living rows (new PID or no PID). */
  creates: T[];
  /** Grave PIDs already handled by a living→grave move (skip append create). */
  handledGravePids: Set<number>;
};

/**
 * Plan MAIN/RESERVE sticky-PID merge for save import.
 * Encountered / null-PID rows are wiped + recreated by the caller.
 */
export function planLivingPidMerge<T extends LivingMergeIncoming>(
  existing: LivingMergeExisting[],
  incomingLiving: T[],
  incomingGravesByPid: ReadonlyMap<number, T>,
): LivingPidMergePlan<T> {
  const existingByPid = new Map<number, LivingMergeExisting>();
  const wipeNullIds: string[] = [];
  for (const row of existing) {
    if (row.personalityValue != null) {
      existingByPid.set(row.personalityValue, row);
    } else {
      wipeNullIds.push(row.id);
    }
  }

  const incomingByPid = new Map<number, T>();
  const creates: T[] = [];
  for (const mon of incomingLiving) {
    if (mon.personalityValue != null) {
      // Last wins if the payload somehow repeats a PID across slots.
      incomingByPid.set(mon.personalityValue, mon);
    } else {
      creates.push(mon);
    }
  }

  const upserts: Array<{ existing: LivingMergeExisting; incoming: T }> = [];
  const deaths: Array<{ existing: LivingMergeExisting; incoming: T }> = [];
  const handledGravePids = new Set<number>();
  const matchedExistingIds = new Set<string>();

  for (const [pid, mon] of incomingByPid) {
    const row = existingByPid.get(pid);
    const graveMon = incomingGravesByPid.get(pid);
    if (!row) {
      // Brand-new PID: create living unless this snapshot already lists it as R.I.P.
      if (!graveMon) creates.push(mon);
      continue;
    }
    matchedExistingIds.add(row.id);
    if (graveMon) {
      deaths.push({ existing: row, incoming: graveMon });
      handledGravePids.add(pid);
    } else {
      upserts.push({ existing: row, incoming: mon });
    }
  }

  // Living PIDs that only appear as R.I.P. in this import.
  for (const [pid, row] of existingByPid) {
    if (matchedExistingIds.has(row.id)) continue;
    const graveMon = incomingGravesByPid.get(pid);
    if (!graveMon) continue;
    matchedExistingIds.add(row.id);
    handledGravePids.add(pid);
    deaths.push({ existing: row, incoming: graveMon });
  }

  const voidIds: string[] = [];
  for (const [, row] of existingByPid) {
    if (matchedExistingIds.has(row.id)) continue;
    voidIds.push(row.id);
  }

  return {
    upserts,
    deaths,
    voidIds,
    wipeNullIds,
    creates,
    handledGravePids,
  };
}
