import type { PokemonEntry } from "@/lib/challenge-types";
import type { BoardSnapshotTrigger } from "@/lib/board-snapshot";
import { graveDedupeKey } from "@/lib/import-memorial";
import {
  memorialPokemonAfterWipe,
  wipeCauseOfDeath,
} from "@/lib/wipe-memorial";

export type MemorialBackfillRun = {
  id: string;
  runNumber: number;
  status: "ACTIVE" | "CLOSED";
};

export type MemorialBackfillSnapshot = {
  id: string;
  trigger: BoardSnapshotTrigger;
  createdAt: string;
  runId: string | null;
  /** Payload wipeCount at capture time. */
  wipeCount: number;
  pokemon: PokemonEntry[];
};

export type MemorialBackfillExistingGrave = {
  species: string;
  nickname: string | null;
  partyIndex: number;
};

export type MemorialBackfillCandidate = {
  label: string;
  species: string;
  nickname: string | null;
  pokedexId: number | null;
  isShiny: boolean;
  diedOnRun: number;
  runId: string;
  causeOfDeath: string;
  sourceSnapshotId: string;
  source: "wipe_end" | "snapshot_grave";
  /** Full entry to persist (new id; partyIndex assigned at apply time). */
  pokemon: PokemonEntry;
};

export type MemorialBackfillResult = {
  candidates: MemorialBackfillCandidate[];
  nextPartyIndex: number;
  /** Closed / active runs that contributed at least one candidate. */
  runsRestored: number[];
  /** Runs with no usable snapshot. */
  runsSkipped: number[];
};

function snapTime(a: MemorialBackfillSnapshot, b: MemorialBackfillSnapshot): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function triggerRank(trigger: BoardSnapshotTrigger): number {
  if (trigger === "WIPE") return 0;
  if (trigger === "GM_RESET") return 1;
  return 2;
}

/** Prefer end-of-run wipe, then GM reset, then newest import/other. */
export function pickMemorialSourceSnapshot(
  snapshots: MemorialBackfillSnapshot[],
): MemorialBackfillSnapshot | null {
  if (snapshots.length === 0) return null;
  return [...snapshots].sort((a, b) => {
    const byTrigger = triggerRank(a.trigger) - triggerRank(b.trigger);
    if (byTrigger !== 0) return byTrigger;
    return snapTime(a, b);
  })[0]!;
}

/**
 * Attach snapshots to runs (by runId, else orphan wipeCount → closed run number).
 */
export function groupSnapshotsByRun(
  runs: MemorialBackfillRun[],
  snapshots: MemorialBackfillSnapshot[],
): Map<string, MemorialBackfillSnapshot[]> {
  const byRun = new Map<string, MemorialBackfillSnapshot[]>();
  for (const run of runs) byRun.set(run.id, []);

  const orphans: MemorialBackfillSnapshot[] = [];
  for (const snap of snapshots) {
    if (snap.runId && byRun.has(snap.runId)) {
      byRun.get(snap.runId)!.push(snap);
    } else {
      orphans.push(snap);
    }
  }

  const active = runs.find((run) => run.status === "ACTIVE") ?? runs[0];
  for (const snap of orphans) {
    const match =
      runs.find(
        (run) =>
          run.status === "CLOSED" && run.runNumber === snap.wipeCount + 1,
      ) ?? active;
    if (match) byRun.get(match.id)?.push(snap);
  }

  return byRun;
}

function displayLabel(mon: Pick<PokemonEntry, "nickname" | "species">): string {
  return mon.nickname?.trim() || mon.species;
}

function gravesFromSource(
  snap: MemorialBackfillSnapshot,
  run: MemorialBackfillRun,
): Array<{ pokemon: PokemonEntry; source: MemorialBackfillCandidate["source"] }> {
  const endOfRun =
    run.status === "CLOSED" &&
    (snap.trigger === "WIPE" || snap.trigger === "GM_RESET");

  if (endOfRun) {
    return memorialPokemonAfterWipe(snap.pokemon, run.runNumber, run.id)
      .filter((p) => p.diedOnRun === run.runNumber)
      .map((pokemon) => ({ pokemon, source: "wipe_end" as const }));
  }

  // Mid-run import / active-run archive: graves already tagged to this attempt.
  return snap.pokemon
    .filter(
      (p) =>
        p.slot === "GRAVEYARD" &&
        (p.diedOnRun === run.runNumber ||
          (p.diedOnRun == null && run.status === "ACTIVE")),
    )
    .map((p) => {
      const diedOnRun = p.diedOnRun ?? run.runNumber;
      const pokemon: PokemonEntry = {
        ...p,
        slot: "GRAVEYARD",
        diedOnRun,
        runId: run.id,
        causeOfDeath:
          p.causeOfDeath?.trim() ||
          (run.status === "CLOSED"
            ? wipeCauseOfDeath(run.runNumber)
            : `Restored from board history (run ${run.runNumber})`),
      };
      return { pokemon, source: "snapshot_grave" as const };
    });
}

/**
 * Reconstruct missing season memorial rows from the last useful snapshot per run.
 * Does not mutate inputs. Assigns temporary ids; apply should mint fresh DB ids.
 */
export function memorialBackfillCandidates(input: {
  runs: MemorialBackfillRun[];
  snapshots: MemorialBackfillSnapshot[];
  existingGraves: MemorialBackfillExistingGrave[];
}): MemorialBackfillResult {
  const { runs, snapshots, existingGraves } = input;
  const byRun = groupSnapshotsByRun(runs, snapshots);
  const seen = new Set(existingGraves.map(graveDedupeKey));
  const candidates: MemorialBackfillCandidate[] = [];
  const runsRestored: number[] = [];
  const runsSkipped: number[] = [];

  const ordered = [...runs].sort((a, b) => a.runNumber - b.runNumber);
  for (const run of ordered) {
    const source = pickMemorialSourceSnapshot(byRun.get(run.id) ?? []);
    if (!source) {
      runsSkipped.push(run.runNumber);
      continue;
    }

    let addedForRun = 0;
    for (const { pokemon, source: origin } of gravesFromSource(source, run)) {
      const key = graveDedupeKey(pokemon);
      if (seen.has(key)) continue;
      seen.add(key);
      addedForRun += 1;
      candidates.push({
        label: displayLabel(pokemon),
        species: pokemon.species,
        nickname: pokemon.nickname,
        pokedexId: pokemon.pokedexId,
        isShiny: pokemon.isShiny,
        diedOnRun: pokemon.diedOnRun ?? run.runNumber,
        runId: run.id,
        causeOfDeath:
          pokemon.causeOfDeath?.trim() || wipeCauseOfDeath(run.runNumber),
        sourceSnapshotId: source.id,
        source: origin,
        pokemon: {
          ...pokemon,
          id: `backfill-${run.runNumber}-${candidates.length}`,
          slot: "GRAVEYARD",
          diedOnRun: pokemon.diedOnRun ?? run.runNumber,
          runId: run.id,
          causeOfDeath:
            pokemon.causeOfDeath?.trim() || wipeCauseOfDeath(run.runNumber),
        },
      });
    }

    if (addedForRun > 0) runsRestored.push(run.runNumber);
  }

  const nextPartyIndex =
    existingGraves.reduce((max, p) => Math.max(max, p.partyIndex), -1) + 1;

  return { candidates, nextPartyIndex, runsRestored, runsSkipped };
}
