import {
  planLivingPidMerge,
  type LivingMergeExisting,
} from "@/lib/import-save-identity";
import { importedGravesToAppend } from "@/lib/import-memorial";
import type { PokemonSlot } from "@/lib/challenge-types";

/** Living board row chrome needed for import review deltas. */
export type SaveImportBoardLiving = {
  id: string;
  slot: Extract<PokemonSlot, "MAIN" | "RESERVE">;
  personalityValue: number | null;
  species: string;
  nickname: string | null;
  level: number | null;
  pokedexId: number | null;
  isShiny: boolean;
  causeOfDeath: string | null;
  notes: string | null;
};

/** Existing memorial rows for R.I.P. append / PID refresh preview. */
export type SaveImportBoardGrave = {
  id: string;
  partyIndex: number;
  personalityValue: number | null;
  species: string;
  nickname: string | null;
  level: number | null;
  pokedexId: number | null;
  isShiny: boolean;
};

export type SaveImportReviewDraft = {
  /** Stable key within the current review list (category + index). */
  key: string;
  pid: number;
  isDexSeenStub: boolean;
  include: boolean;
  slot: PokemonSlot;
  species: string;
  nickname: string;
  level: string;
  pokedexId: number;
  isShiny: boolean;
};

export type ImportDraftReviewStatus = {
  kind: "updated" | "new" | "died" | "add";
  /** Short captions like `Shelgon → Salamence` or `Lv 34 → 48`. */
  changeLabels: string[];
};

export type ImportReviewClearedMon = {
  board: SaveImportBoardLiving;
  /** True when the row had no PID (manual / pre-migration wipe). */
  nullPid: boolean;
};

export type ImportSaveReview = {
  /** Status keyed by draft `key` for included living / grave rows. */
  byDraftKey: Map<string, ImportDraftReviewStatus>;
  updated: number;
  created: number;
  died: number;
  /** Existing memorial PIDs refreshed (not living→RIP deaths). */
  memorialUpdated: number;
  /** Brand-new memorial rows from this import. */
  memorialCreated: number;
  cleared: ImportReviewClearedMon[];
  /** Living board had rows — show sticky-merge voice. */
  hasBoardLiving: boolean;
};

function displayName(species: string, nickname: string | null | undefined): string {
  const nick = nickname?.trim();
  return nick || species;
}

function levelNum(level: string): number | null {
  const n = Number(level.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function changeLabelsForChrome(
  existing: {
    species: string;
    nickname: string | null;
    level: number | null;
    isShiny: boolean;
    slot?: PokemonSlot;
  },
  incoming: SaveImportReviewDraft,
): string[] {
  const labels: string[] = [];
  if (existing.species !== incoming.species) {
    labels.push(`${existing.species} → ${incoming.species}`);
  }
  const nextLevel = levelNum(incoming.level);
  if (
    existing.level != null &&
    nextLevel != null &&
    existing.level !== nextLevel
  ) {
    labels.push(`Lv ${existing.level} → ${nextLevel}`);
  } else if (existing.level == null && nextLevel != null) {
    labels.push(`Lv ${nextLevel}`);
  }
  if (existing.slot && existing.slot !== incoming.slot) {
    const from =
      existing.slot === "MAIN"
        ? "Main"
        : existing.slot === "RESERVE"
          ? "Reserves"
          : existing.slot === "GRAVEYARD"
            ? "R.I.P."
            : "Encountered";
    const to =
      incoming.slot === "MAIN"
        ? "Main"
        : incoming.slot === "RESERVE"
          ? "Reserves"
          : incoming.slot === "GRAVEYARD"
            ? "R.I.P."
            : "Encountered";
    labels.push(`${from} → ${to}`);
  }
  if (Boolean(existing.isShiny) !== Boolean(incoming.isShiny)) {
    labels.push(incoming.isShiny ? "shiny" : "not shiny");
  }
  const boardNick = existing.nickname?.trim() || "";
  const draftNick = incoming.nickname.trim();
  if (boardNick && draftNick && boardNick !== draftNick) {
    labels.push(`“${boardNick}” → “${draftNick}”`);
  }
  return labels;
}

/**
 * Client-side preview of sticky-PID living merge + memorial append for the
 * import review UI. Mirrors `planLivingPidMerge` / `importedGravesToAppend`.
 */
export function buildImportSaveReview(
  boardLiving: SaveImportBoardLiving[],
  drafts: SaveImportReviewDraft[],
  boardGraves: SaveImportBoardGrave[] = [],
): ImportSaveReview {
  const existing: LivingMergeExisting[] = boardLiving.map((row) => ({
    id: row.id,
    slot: row.slot,
    personalityValue: row.personalityValue,
    causeOfDeath: row.causeOfDeath,
    notes: row.notes,
  }));
  const boardById = new Map(boardLiving.map((row) => [row.id, row]));
  const gravesByPid = new Map<number, SaveImportBoardGrave>();
  for (const grave of boardGraves) {
    if (grave.personalityValue != null) {
      gravesByPid.set(grave.personalityValue, grave);
    }
  }

  const included = drafts.filter((d) => d.include);
  type ReviewIncoming = SaveImportReviewDraft & {
    personalityValue: number | null;
  };
  const incomingLiving: ReviewIncoming[] = included
    .filter((d) => d.slot === "MAIN" || d.slot === "RESERVE")
    .map((d) => ({
      ...d,
      personalityValue: d.isDexSeenStub ? null : d.pid,
    }));
  const incomingGravesByPid = new Map<number, ReviewIncoming>();
  for (const d of included) {
    if (d.slot !== "GRAVEYARD" || d.isDexSeenStub) continue;
    incomingGravesByPid.set(d.pid, {
      ...d,
      personalityValue: d.pid,
    });
  }

  const plan = planLivingPidMerge(
    existing,
    incomingLiving,
    incomingGravesByPid,
  );

  const byDraftKey = new Map<string, ImportDraftReviewStatus>();

  for (const { existing: ex, incoming } of plan.upserts) {
    const board = boardById.get(ex.id);
    byDraftKey.set(incoming.key, {
      kind: "updated",
      changeLabels: board ? changeLabelsForChrome(board, incoming) : [],
    });
  }

  for (const mon of plan.creates) {
    byDraftKey.set(mon.key, {
      kind: boardLiving.length > 0 ? "new" : "add",
      changeLabels: [],
    });
  }

  for (const { existing: ex, incoming } of plan.deaths) {
    const board = boardById.get(ex.id);
    const labels: string[] = [];
    if (board) {
      labels.push(
        `${displayName(board.species, board.nickname)} leaves the living board`,
      );
      if (board.species !== incoming.species) {
        labels.push(`${board.species} → ${incoming.species}`);
      }
    }
    byDraftKey.set(incoming.key, { kind: "died", changeLabels: labels });
  }

  // Memorial append (skip graves already handled as living→RIP deaths).
  const memorialIncoming: ReviewIncoming[] = included
    .filter(
      (d) =>
        d.slot === "GRAVEYARD" &&
        !d.isDexSeenStub &&
        !byDraftKey.has(d.key),
    )
    .map((d) => ({
      ...d,
      personalityValue: d.pid,
    }));
  const memorialPlan = importedGravesToAppend(
    boardGraves.map((g) => ({
      species: g.species,
      nickname: g.nickname,
      personalityValue: g.personalityValue,
      partyIndex: g.partyIndex,
    })),
    memorialIncoming,
  );

  let memorialUpdated = 0;
  let memorialCreated = 0;
  for (const { personalityValue, incoming } of memorialPlan.toRefresh) {
    const grave = gravesByPid.get(personalityValue);
    byDraftKey.set(incoming.key, {
      kind: "updated",
      changeLabels: grave ? changeLabelsForChrome(grave, incoming) : [],
    });
    memorialUpdated += 1;
  }
  for (const mon of memorialPlan.toCreate) {
    byDraftKey.set(mon.key, {
      kind:
        boardGraves.length > 0 || boardLiving.length > 0 ? "new" : "add",
      changeLabels: [],
    });
    memorialCreated += 1;
  }

  const cleared: ImportReviewClearedMon[] = [];
  const seenCleared = new Set<string>();
  for (const id of plan.voidIds) {
    const board = boardById.get(id);
    if (!board || seenCleared.has(id)) continue;
    seenCleared.add(id);
    cleared.push({ board, nullPid: false });
  }
  for (const id of plan.wipeNullIds) {
    const board = boardById.get(id);
    if (!board || seenCleared.has(id)) continue;
    seenCleared.add(id);
    cleared.push({ board, nullPid: true });
  }

  return {
    byDraftKey,
    updated: plan.upserts.length,
    created: plan.creates.length,
    died: plan.deaths.length,
    memorialUpdated,
    memorialCreated,
    cleared,
    hasBoardLiving: boardLiving.length > 0,
  };
}

export function importReviewPreviewParts(
  review: ImportSaveReview,
  opts: {
    encounteredIncluded: number;
    ripIncluded: number;
    trainerSyncParts: string[];
    /** Included Pokémon count when no sticky board living (first import). */
    includedCount: number;
  },
): string[] {
  const parts: string[] = [];
  const updatedTotal = review.updated + review.memorialUpdated;
  const createdTotal = review.created + review.memorialCreated;
  if (
    review.hasBoardLiving ||
    review.memorialUpdated > 0 ||
    review.memorialCreated > 0
  ) {
    const livingBits: string[] = [];
    if (updatedTotal) livingBits.push(`${updatedTotal} updated`);
    if (createdTotal) livingBits.push(`${createdTotal} new`);
    if (review.died) livingBits.push(`${review.died} → R.I.P.`);
    if (review.cleared.length) {
      livingBits.push(`${review.cleared.length} cleared`);
    }
    if (livingBits.length) parts.push(livingBits.join(" · "));
  } else if (opts.includedCount > 0) {
    parts.push(`${opts.includedCount} Pokémon`);
  }

  if (opts.encounteredIncluded > 0) {
    parts.push("Encountered replace");
  }
  if (opts.ripIncluded > 0) {
    parts.push("R.I.P. append");
  }
  if (opts.trainerSyncParts.length) {
    parts.push(opts.trainerSyncParts.join(" + "));
  }
  return parts;
}
