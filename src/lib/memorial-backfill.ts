import type { PokemonEntry } from "@/lib/challenge-types";
import type { BoardSnapshotTrigger } from "@/lib/board-snapshot";
import { graveDedupeKey } from "@/lib/import-memorial";
import { wipeCauseOfDeath } from "@/lib/wipe-memorial";

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
  source: "snapshot_grave";
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
  if (trigger === "WIPE" || trigger === "VICTORY") return 0;
  if (trigger === "GM_RESET") return 1;
  return 2;
}

/** Prefer the end-of-run capture (wipe or victory), then GM reset, then newest import/other. */
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

export type SnapshotGrave = {
  /** Normalized grave — diedOnRun / runId / cause filled in for `run`. */
  pokemon: PokemonEntry;
  /**
   * Payload row carried no `diedOnRun`, so attributing it to `run` is a guess.
   * Legacy graves (pre-`diedOnRun`) were carried across wipes, so the same mon
   * can sit untagged in several runs' snapshots — callers dedupe these globally.
   */
  untagged: boolean;
};

/**
 * GRAVEYARD rows in one snapshot payload that belong to `run`.
 *
 * The single extraction rule shared by the GM backfill and the read-time
 * Memorial merge. A wipe/GM-reset snapshot is captured *before* the board is
 * cleared, so the graves of the closing run are sitting right there in the
 * payload — there is nothing to reconstruct from the living party.
 */
export function snapshotGravesForRun(
  snap: MemorialBackfillSnapshot,
  run: MemorialBackfillRun,
): SnapshotGrave[] {
  const out: SnapshotGrave[] = [];
  for (const p of snap.pokemon) {
    if (p.slot !== "GRAVEYARD") continue;
    const untagged = p.diedOnRun == null;
    if (!untagged && p.diedOnRun !== run.runNumber) continue;
    out.push({
      untagged,
      pokemon: {
        ...p,
        slot: "GRAVEYARD",
        diedOnRun: run.runNumber,
        runId: run.id,
        causeOfDeath:
          p.causeOfDeath?.trim() ||
          (run.status === "CLOSED"
            ? wipeCauseOfDeath(run.runNumber)
            : `Restored from board history (run ${run.runNumber})`),
      },
    });
  }
  return out;
}

/**
 * Occurrence counts per dedupe key.
 *
 * A Set collapses genuine duplicates — two unnicknamed Poochyena that died in
 * the same run share a key — so overlap is settled by budget, not membership.
 */
function graveBudget(rows: Array<Parameters<typeof graveDedupeKey>[0]>) {
  const budget = new Map<string, number>();
  for (const row of rows) {
    const key = graveDedupeKey(row);
    budget.set(key, (budget.get(key) ?? 0) + 1);
  }
  return {
    /** True when `key` is covered by a not-yet-claimed row; claims it. */
    claim(key: string): boolean {
      const left = budget.get(key) ?? 0;
      if (left <= 0) return false;
      budget.set(key, left - 1);
      return true;
    },
  };
}

/**
 * Reconstruct missing memorial rows for the trainer's **active** run from its
 * last useful snapshot. Does not mutate inputs. Assigns temporary ids; apply
 * should mint fresh DB ids.
 *
 * Deliberately active-run only: this path writes live `PokemonEntry` rows, and
 * the live board's R.I.P. section is current-run only (a wipe empties it).
 * Graves from closed runs are surfaced read-only by `crossRunGraves` instead —
 * materializing them here would put them back on the live board.
 */
export function memorialBackfillCandidates(input: {
  runs: MemorialBackfillRun[];
  snapshots: MemorialBackfillSnapshot[];
  existingGraves: MemorialBackfillExistingGrave[];
}): MemorialBackfillResult {
  const { runs, snapshots, existingGraves } = input;
  // Group over every run so orphan snapshots land on the run they came from,
  // then restore only the active one.
  const byRun = groupSnapshotsByRun(runs, snapshots);
  const budget = graveBudget(existingGraves);
  const candidates: MemorialBackfillCandidate[] = [];
  const runsRestored: number[] = [];
  const runsSkipped: number[] = [];

  const nextPartyIndex =
    existingGraves.reduce((max, p) => Math.max(max, p.partyIndex), -1) + 1;

  const run = runs.find((r) => r.status === "ACTIVE");
  if (!run) return { candidates, nextPartyIndex, runsRestored, runsSkipped };

  const source = pickMemorialSourceSnapshot(byRun.get(run.id) ?? []);
  if (!source) {
    runsSkipped.push(run.runNumber);
  } else {
    for (const { pokemon } of snapshotGravesForRun(source, run)) {
      const key = graveDedupeKey(pokemon);
      if (budget.claim(key)) continue;
      const causeOfDeath =
        pokemon.causeOfDeath?.trim() || wipeCauseOfDeath(run.runNumber);
      candidates.push({
        label: displayLabel(pokemon),
        species: pokemon.species,
        nickname: pokemon.nickname,
        pokedexId: pokemon.pokedexId,
        isShiny: pokemon.isShiny,
        diedOnRun: run.runNumber,
        runId: run.id,
        causeOfDeath,
        sourceSnapshotId: source.id,
        source: "snapshot_grave",
        pokemon: {
          ...pokemon,
          id: `backfill-${run.runNumber}-${candidates.length}`,
          slot: "GRAVEYARD",
          diedOnRun: run.runNumber,
          runId: run.id,
          causeOfDeath,
        },
      });
    }
    if (candidates.length > 0) runsRestored.push(run.runNumber);
  }

  return { candidates, nextPartyIndex, runsRestored, runsSkipped };
}

/** A grave rendered in Memorial / trainer history. */
export type MemorialGrave = {
  /** React key — snapshot ids are not unique across runs, so runNumber is in it. */
  key: string;
  /** Live `PokemonEntry` id (editable); null when derived from a snapshot. */
  pokemonId: string | null;
  source: "live" | "snapshot";
  /** 1-based attempt this grave is attributed to. */
  runNumber: number;
  runId: string | null;
  pokemon: PokemonEntry;
};

export type CrossRunGravesResult = {
  /** Ascending by run, then partyIndex. */
  graves: MemorialGrave[];
  /** Graves that exist only in board history (source === "snapshot"). */
  recoveredCount: number;
};

/** Flatten a cross-run graves map to the bare rows the aggregators consume. */
export function gravesPokemonByTrainerId(
  gravesByTrainerId: Record<string, CrossRunGravesResult>,
): Record<string, PokemonEntry[]> {
  return Object.fromEntries(
    Object.entries(gravesByTrainerId).map(([trainerId, result]) => [
      trainerId,
      result.graves.map((grave) => grave.pokemon),
    ]),
  );
}

/** Run a live grave belongs to, falling back for legacy rows with neither tag. */
function liveGraveRunNumber(
  grave: PokemonEntry,
  runNumberById: Map<string, number>,
  activeRunNumber: number,
): number {
  if (grave.diedOnRun != null) return grave.diedOnRun;
  if (grave.runId) {
    const fromRun = runNumberById.get(grave.runId);
    if (fromRun != null) return fromRun;
  }
  return activeRunNumber;
}

/**
 * Every grave across every run: live `GRAVEYARD` rows for the active run,
 * plus graves recovered from retained board snapshots for the runs a wipe
 * already cleared. Read-only — snapshot graves are never persisted, so the
 * live board stays current-run only.
 *
 * Shares `snapshotGravesForRun` with the GM backfill so the two can't drift.
 */
export function crossRunGraves(input: {
  runs: MemorialBackfillRun[];
  snapshots: MemorialBackfillSnapshot[];
  liveGraves: PokemonEntry[];
  /** `currentRunNumber(wipeCount)` — attribution fallback for untagged rows. */
  activeRunNumber: number;
}): CrossRunGravesResult {
  const { runs, snapshots, liveGraves, activeRunNumber } = input;
  const byRun = groupSnapshotsByRun(runs, snapshots);
  const runNumberById = new Map(runs.map((run) => [run.id, run.runNumber]));

  const liveByRun = new Map<number, PokemonEntry[]>();
  for (const grave of liveGraves) {
    const runNumber = liveGraveRunNumber(grave, runNumberById, activeRunNumber);
    const bucket = liveByRun.get(runNumber);
    if (bucket) bucket.push(grave);
    else liveByRun.set(runNumber, [grave]);
  }

  const graves: MemorialGrave[] = [];
  const claimedRunNumbers = new Set(runs.map((run) => run.runNumber));
  let recoveredCount = 0;
  // Snapshot rows keep the id of the row they were captured from, so an id
  // match means "same physical row" wherever it was bucketed. Legacy graves
  // land in the active-run bucket while their snapshot copy sits under a closed
  // run, so this has to span every run, not just the one being recovered.
  const liveIdsAll = new Set(liveGraves.map((p) => p.id));
  // Legacy untagged graves were carried across wipes, so the same mon can sit
  // in several runs' snapshots. First (earliest) run to claim one keeps it —
  // keyed by row id, since two nameless mons of one species are not the same
  // grave.
  const claimedUntagged = new Set<string>();

  const ordered = [...runs].sort((a, b) => a.runNumber - b.runNumber);
  for (const run of ordered) {
    const live = [...(liveByRun.get(run.runNumber) ?? [])].sort(
      (a, b) => a.partyIndex - b.partyIndex,
    );
    for (const pokemon of live) {
      graves.push({
        key: pokemon.id,
        pokemonId: pokemon.id,
        source: "live",
        runNumber: run.runNumber,
        runId: run.id,
        pokemon,
      });
    }

    // Only closed runs need recovery: the active run's live rows are the whole
    // truth, so reading its snapshots back would resurrect graves the trainer
    // deleted on purpose. A gap there is what the GM restore tool is for.
    if (run.status !== "CLOSED") continue;

    // No retained snapshot (pruned by retention, or history cleared): this
    // run's graves are simply unrecoverable.
    const source = pickMemorialSourceSnapshot(byRun.get(run.id) ?? []);
    if (!source) continue;

    // The budget stays run-scoped — same species in two runs are two different
    // mons — and absorbs rows a past GM backfill re-minted under a fresh id.
    const liveIds = new Set(live.map((p) => p.id));
    const budget = graveBudget(live);
    const recovered = snapshotGravesForRun(source, run).sort(
      (a, b) => a.pokemon.partyIndex - b.pokemon.partyIndex,
    );
    for (const { pokemon, untagged } of recovered) {
      const key = graveDedupeKey(pokemon);
      if (liveIdsAll.has(pokemon.id)) {
        if (liveIds.has(pokemon.id)) budget.claim(key);
        continue;
      }
      if (budget.claim(key)) continue;
      if (untagged) {
        if (claimedUntagged.has(pokemon.id)) continue;
        claimedUntagged.add(pokemon.id);
      }
      recoveredCount += 1;
      graves.push({
        key: `snap:${source.id}:${run.runNumber}:${pokemon.id}`,
        pokemonId: null,
        source: "snapshot",
        runNumber: run.runNumber,
        runId: run.id,
        pokemon,
      });
    }
  }

  // Live graves attributed to a run that no longer exists (a GM reset deletes
  // TrainerRun rows) still belong in the memorial.
  const orphanRunNumbers = [...liveByRun.keys()]
    .filter((runNumber) => !claimedRunNumbers.has(runNumber))
    .sort((a, b) => a - b);
  for (const runNumber of orphanRunNumbers) {
    const live = [...(liveByRun.get(runNumber) ?? [])].sort(
      (a, b) => a.partyIndex - b.partyIndex,
    );
    for (const pokemon of live) {
      graves.push({
        key: pokemon.id,
        pokemonId: pokemon.id,
        source: "live",
        runNumber,
        runId: pokemon.runId,
        pokemon,
      });
    }
  }
  graves.sort((a, b) => a.runNumber - b.runNumber);

  return { graves, recoveredCount };
}
