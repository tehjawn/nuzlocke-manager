/**
 * Survive/Die Floor board helpers (#344) — pure sort / filter / pulse math on
 * list rows so the panel stays presentational.
 */

import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { hasBeatenChampionship } from "@/lib/championship";
import type { SurvivalMarketListItem } from "@/lib/survival-market-types";
import type { MarketsMode, MarketsSort } from "@/lib/tools-routes";

/** Contested / longshot badges need enough volume to mean anything. */
export const MARKETS_DRAMA_MIN_VOTES = 3;

/** Crowd lock threshold for “longshot / doomed favorite” flavor. */
export const MARKETS_LONGSHOT_PCT = 75;

/** Same band as SurvivalPollChip SPLIT_BAND_PCT — keep in sync by eye. */
export const MARKETS_SPLIT_BAND_PCT = 8;

export type QuietMarketRow = {
  kind: "quiet";
  key: string;
  pokemon: PokemonEntry;
  trainer: { id: string; handle: string };
};

export type ActiveMarketRow = {
  kind: "market";
  key: string;
  market: SurvivalMarketListItem;
  pokemon: PokemonEntry | null;
};

export type MarketsBoardRow = ActiveMarketRow | QuietMarketRow;

export type MarketsPulse = {
  openRaces: number;
  closest: SurvivalMarketListItem | null;
  hottest: SurvivalMarketListItem | null;
  record: { correct: number; scored: number } | null;
};

/**
 * Survive/Die open takes only apply while a run can still fail.
 * Championship clear (full E4 + Champ badges) or a recorded finish locks polls —
 * those mons already made it; Vote now / Open must not list them.
 */
export function isTrainerOpenForPolls(
  trainer: Pick<TrainerProfile, "runEnded" | "earnedBadgeKeys">,
): boolean {
  if (trainer.runEnded) return false;
  if (hasBeatenChampionship(trainer.earnedBadgeKeys)) return false;
  return true;
}

export function isOpenMarket(status: SurvivalMarketListItem["status"]): boolean {
  return status === "OPEN";
}

export function isResolvedMarket(
  status: SurvivalMarketListItem["status"],
): boolean {
  return status === "RESOLVED_SURVIVE" || status === "RESOLVED_DIE";
}

export function contestDistance(market: SurvivalMarketListItem): number {
  return Math.abs(market.survivePct - 50);
}

export function isContested(market: SurvivalMarketListItem): boolean {
  return (
    market.total >= MARKETS_DRAMA_MIN_VOTES &&
    contestDistance(market) <= MARKETS_SPLIT_BAND_PCT
  );
}

export function isLongshot(market: SurvivalMarketListItem): boolean {
  return (
    market.total >= MARKETS_DRAMA_MIN_VOTES &&
    contestDistance(market) >= MARKETS_LONGSHOT_PCT - 50
  );
}

/** Final-tally proxy for “crowd was wrong” — no odds-at-resolve snapshot. */
export function isUpset(market: SurvivalMarketListItem): boolean {
  if (!isResolvedMarket(market.status) || market.total < MARKETS_DRAMA_MIN_VOTES) {
    return false;
  }
  if (market.status === "RESOLVED_DIE") return market.survivePct > 60;
  return market.survivePct < 40;
}

export function viewerCalledIt(market: SurvivalMarketListItem): boolean | null {
  if (!market.myPrediction || !isResolvedMarket(market.status)) return null;
  if (market.status === "RESOLVED_SURVIVE") {
    return market.myPrediction === "SURVIVE";
  }
  return market.myPrediction === "DIE";
}

export function monLabel(species: string, nickname: string | null): string {
  const nick = nickname?.trim();
  return nick || species;
}

export function buildQuietRows(
  trainers: TrainerProfile[],
  marketByPokemonId: Map<string, SurvivalMarketListItem>,
): QuietMarketRow[] {
  const quiet: QuietMarketRow[] = [];
  for (const trainer of trainers) {
    if (!isTrainerOpenForPolls(trainer)) continue;
    for (const mon of trainer.pokemon) {
      if (mon.slot !== "MAIN" && mon.slot !== "RESERVE") continue;
      if (marketByPokemonId.has(mon.id)) continue;
      quiet.push({
        kind: "quiet",
        key: `quiet-${mon.id}`,
        pokemon: mon,
        trainer: { id: trainer.id, handle: trainer.handle },
      });
    }
  }
  return quiet;
}

export function computeViewerRecord(
  markets: SurvivalMarketListItem[],
): { correct: number; scored: number } | null {
  let correct = 0;
  let scored = 0;
  for (const market of markets) {
    const hit = viewerCalledIt(market);
    if (hit === null) continue;
    scored += 1;
    if (hit) correct += 1;
  }
  if (scored === 0) return null;
  return { correct, scored };
}

export function computeMarketsPulse(
  markets: SurvivalMarketListItem[],
  viewerUserId: string | null,
  pollableTrainerIds?: Set<string>,
): MarketsPulse {
  const openWithVotes = markets.filter((m) => {
    if (!isOpenMarket(m.status) || m.total < 1) return false;
    if (pollableTrainerIds && !pollableTrainerIds.has(m.trainer.id)) {
      return false;
    }
    return true;
  });
  let closest: SurvivalMarketListItem | null = null;
  let hottest: SurvivalMarketListItem | null = null;
  for (const market of openWithVotes) {
    if (
      market.total >= MARKETS_DRAMA_MIN_VOTES &&
      (!closest || contestDistance(market) < contestDistance(closest))
    ) {
      closest = market;
    }
    if (!hottest || market.total > hottest.total) {
      hottest = market;
    }
  }
  return {
    openRaces: openWithVotes.length,
    closest,
    hottest,
    record: viewerUserId ? computeViewerRecord(markets) : null,
  };
}

function compareAlpha(a: MarketsBoardRow, b: MarketsBoardRow): number {
  const aLabel =
    a.kind === "market"
      ? monLabel(a.market.species, a.market.nickname)
      : monLabel(a.pokemon.species, a.pokemon.nickname);
  const bLabel =
    b.kind === "market"
      ? monLabel(b.market.species, b.market.nickname)
      : monLabel(b.pokemon.species, b.pokemon.nickname);
  return aLabel.localeCompare(bLabel);
}

function compareTrainer(a: MarketsBoardRow, b: MarketsBoardRow): number {
  const aHandle =
    a.kind === "market" ? a.market.trainer.handle : a.trainer.handle;
  const bHandle =
    b.kind === "market" ? b.market.trainer.handle : b.trainer.handle;
  const byHandle = aHandle.localeCompare(bHandle);
  if (byHandle !== 0) return byHandle;
  return compareAlpha(a, b);
}

function sortMarketRows(
  rows: ActiveMarketRow[],
  sort: MarketsSort,
): ActiveMarketRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const ma = a.market;
    const mb = b.market;
    switch (sort) {
      case "hottest":
        if (mb.total !== ma.total) return mb.total - ma.total;
        return mb.updatedAt.localeCompare(ma.updatedAt);
      case "contested":
        if (contestDistance(ma) !== contestDistance(mb)) {
          return contestDistance(ma) - contestDistance(mb);
        }
        return mb.total - ma.total;
      case "longshots":
        if (contestDistance(ma) !== contestDistance(mb)) {
          return contestDistance(mb) - contestDistance(ma);
        }
        return mb.total - ma.total;
      case "survive":
        if (mb.survivePct !== ma.survivePct) return mb.survivePct - ma.survivePct;
        return mb.total - ma.total;
      case "die":
        if (ma.survivePct !== mb.survivePct) return ma.survivePct - mb.survivePct;
        return mb.total - ma.total;
      case "resolved": {
        const aAt = ma.resolvedAt ?? "";
        const bAt = mb.resolvedAt ?? "";
        return bAt.localeCompare(aAt);
      }
      case "upsets": {
        const aUpset = isUpset(ma) ? 1 : 0;
        const bUpset = isUpset(mb) ? 1 : 0;
        if (bUpset !== aUpset) return bUpset - aUpset;
        return mb.total - ma.total;
      }
      case "voted":
        return mb.total - ma.total;
      case "hits": {
        const aHit = viewerCalledIt(ma) === true ? 1 : 0;
        const bHit = viewerCalledIt(mb) === true ? 1 : 0;
        if (bHit !== aHit) return bHit - aHit;
        return (mb.resolvedAt ?? "").localeCompare(ma.resolvedAt ?? "");
      }
      case "misses": {
        const aMiss = viewerCalledIt(ma) === false ? 1 : 0;
        const bMiss = viewerCalledIt(mb) === false ? 1 : 0;
        if (bMiss !== aMiss) return bMiss - aMiss;
        return (mb.resolvedAt ?? "").localeCompare(ma.resolvedAt ?? "");
      }
      case "trainer":
        return compareTrainer(a, b);
      case "alpha":
        return compareAlpha(a, b);
      case "fresh":
      default:
        return mb.updatedAt.localeCompare(ma.updatedAt);
    }
  });
  return copy;
}

export type MarketsBoardFilters = {
  query: string;
  trainerId: string;
  needsMyVote: boolean;
  contestedOnly: boolean;
  minVotes: 0 | 1 | 3 | 5;
  slot: "all" | "MAIN" | "RESERVE";
};

function rowMatchesFilters(
  row: MarketsBoardRow,
  filters: MarketsBoardFilters,
  viewerUserId: string | null,
): boolean {
  const q = filters.query.trim().toLowerCase();
  if (row.kind === "quiet") {
    if (filters.contestedOnly) return false;
    if (filters.minVotes > 0) return false;
    if (filters.needsMyVote && !viewerUserId) return false;
    if (filters.trainerId && row.trainer.id !== filters.trainerId) return false;
    if (filters.slot !== "all" && row.pokemon.slot !== filters.slot) return false;
    if (!q) return true;
    const label = monLabel(row.pokemon.species, row.pokemon.nickname);
    return (
      label.toLowerCase().includes(q) ||
      row.pokemon.species.toLowerCase().includes(q) ||
      row.trainer.handle.toLowerCase().includes(q)
    );
  }

  const market = row.market;
  if (filters.trainerId && market.trainer.id !== filters.trainerId) return false;
  if (filters.contestedOnly && !isContested(market)) return false;
  if (market.total < filters.minVotes) return false;
  if (filters.needsMyVote) {
    if (!viewerUserId) return false;
    if (!isOpenMarket(market.status) || market.myPrediction) return false;
  }
  // Settled history may lack a live PokemonEntry (wipe) — don't hide it on slot filter.
  if (
    filters.slot !== "all" &&
    row.pokemon &&
    row.pokemon.slot !== filters.slot
  ) {
    return false;
  }
  if (!q) return true;
  const label = monLabel(market.species, market.nickname);
  return (
    label.toLowerCase().includes(q) ||
    market.species.toLowerCase().includes(q) ||
    market.trainer.handle.toLowerCase().includes(q)
  );
}

/**
 * Build the visible board for a lens + sort + filters.
 * Fresh sort on Floor leads with quiet / zero-vote rows.
 */
export function buildMarketsBoard(input: {
  mode: MarketsMode;
  sort: MarketsSort;
  markets: SurvivalMarketListItem[];
  quiet: QuietMarketRow[];
  pokemonById: Map<string, PokemonEntry>;
  filters: MarketsBoardFilters;
  viewerUserId: string | null;
  /** Trainers still on an active run — finished Championship clears leave Floor. */
  pollableTrainerIds: Set<string>;
}): MarketsBoardRow[] {
  const {
    mode,
    sort,
    markets,
    quiet,
    pokemonById,
    filters,
    viewerUserId,
    pollableTrainerIds,
  } = input;

  const asMarketRow = (market: SurvivalMarketListItem): ActiveMarketRow => ({
    kind: "market",
    key: `market-${market.id}`,
    market,
    pokemon: market.pokemonId
      ? (pokemonById.get(market.pokemonId) ?? null)
      : null,
  });

  let marketPool: SurvivalMarketListItem[];
  let includeQuiet = false;

  if (mode === "floor") {
    marketPool = markets.filter(
      (m) =>
        isOpenMarket(m.status) && pollableTrainerIds.has(m.trainer.id),
    );
    if (sort === "fresh") {
      // Zero-vote opens + quiet living mons; hide races with volume.
      marketPool = marketPool.filter((m) => m.total === 0);
      includeQuiet = true;
    } else if (sort === "contested" || sort === "longshots") {
      marketPool = marketPool.filter((m) => m.total >= MARKETS_DRAMA_MIN_VOTES);
      if (sort === "contested") {
        marketPool = marketPool.filter(isContested);
      } else {
        marketPool = marketPool.filter(isLongshot);
      }
    } else if (sort === "survive" || sort === "die") {
      marketPool = marketPool.filter((m) => m.total >= 1);
    } else {
      // Hottest / trainer / alpha — races with votes first; quiet stays out.
      marketPool = marketPool.filter((m) => m.total >= 1);
    }
  } else if (mode === "settled") {
    marketPool = markets.filter((m) => isResolvedMarket(m.status));
    if (sort === "hits") {
      marketPool = marketPool.filter((m) => viewerCalledIt(m) === true);
    } else if (sort === "misses") {
      marketPool = marketPool.filter((m) => viewerCalledIt(m) === false);
    } else if (sort === "upsets") {
      // Prefer upsets but still show the rest below via sort key.
    }
  } else {
    // My takes — anything I voted on.
    marketPool = markets.filter((m) => m.myPrediction != null);
    if (sort === "hits") {
      marketPool = marketPool.filter((m) => viewerCalledIt(m) === true);
    } else if (sort === "misses") {
      marketPool = marketPool.filter((m) => viewerCalledIt(m) === false);
    } else if (sort === "resolved") {
      marketPool = marketPool.filter((m) => isResolvedMarket(m.status));
    } else if (sort === "hottest") {
      // Still-open takes only on active runs; finished runs should be Settled.
      marketPool = marketPool.filter(
        (m) =>
          isOpenMarket(m.status) && pollableTrainerIds.has(m.trainer.id),
      );
    }
  }

  let rows: MarketsBoardRow[] = sortMarketRows(
    marketPool.map(asMarketRow),
    sort,
  );

  if (mode === "book" && sort === "hottest") {
    // Open book already filtered; if empty fall through — caller may show settled.
  }

  if (includeQuiet) {
    const quietSorted = [...quiet].sort((a, b) => compareAlpha(a, b));
    rows = [...rows, ...quietSorted];
  }

  if (mode === "book" && sort === "hottest") {
    // Append settled book entries after open positions when browsing “open first”.
    const settledBook = sortMarketRows(
      markets
        .filter(
          (m) => m.myPrediction != null && isResolvedMarket(m.status),
        )
        .map(asMarketRow),
      "resolved",
    );
    rows = [...rows, ...settledBook];
  }

  return rows.filter((row) =>
    rowMatchesFilters(row, filters, viewerUserId),
  );
}

export const FLOOR_SORTS: ReadonlyArray<{ id: MarketsSort; label: string }> = [
  { id: "hottest", label: "Hottest" },
  { id: "contested", label: "Contested" },
  { id: "longshots", label: "Longshots" },
  { id: "fresh", label: "Fresh / no votes" },
  { id: "survive", label: "Survive lean" },
  { id: "die", label: "Die lean" },
  { id: "trainer", label: "Trainer" },
  { id: "alpha", label: "A–Z" },
];

export const SETTLED_SORTS: ReadonlyArray<{ id: MarketsSort; label: string }> =
  [
    { id: "resolved", label: "Just resolved" },
    { id: "upsets", label: "Biggest upsets" },
    { id: "voted", label: "Most voted" },
    { id: "hits", label: "My hits" },
    { id: "misses", label: "My misses" },
    { id: "alpha", label: "A–Z" },
  ];

export const BOOK_SORTS: ReadonlyArray<{ id: MarketsSort; label: string }> = [
  { id: "hottest", label: "Open first" },
  { id: "resolved", label: "Settled only" },
  { id: "hits", label: "Hits" },
  { id: "misses", label: "Misses" },
  { id: "alpha", label: "A–Z" },
];

export function sortsForMode(
  mode: MarketsMode,
): ReadonlyArray<{ id: MarketsSort; label: string }> {
  if (mode === "settled") return SETTLED_SORTS;
  if (mode === "book") return BOOK_SORTS;
  return FLOOR_SORTS;
}

/** One living mon the viewer still needs to weigh in on. */
export type UnvotedBallotItem = {
  pokemonId: string;
  pokemon: PokemonEntry;
  market: SurvivalMarketListItem | null;
};

export type UnvotedBallotTrainerGroup = {
  trainer: TrainerProfile;
  badgeCount: number;
  items: UnvotedBallotItem[];
};

export type UnvotedBallotSlotFilter = "MAIN" | "all";

/**
 * Vote-now list: living MAIN/RESERVE on **active** runs without the viewer's
 * prediction (including quiet). Finished Championship runs are excluded —
 * those mons already cleared the finish line. Trainers ordered by badge depth;
 * within a trainer Main before Reserve, then crowd volume, then name.
 */
export function buildUnvotedBallot(input: {
  trainers: TrainerProfile[];
  markets: SurvivalMarketListItem[];
  slot: UnvotedBallotSlotFilter;
}): { groups: UnvotedBallotTrainerGroup[]; total: number } {
  const marketByPokemonId = new Map<string, SurvivalMarketListItem>();
  for (const market of input.markets) {
    if (market.pokemonId) marketByPokemonId.set(market.pokemonId, market);
  }

  const groups: UnvotedBallotTrainerGroup[] = [];
  let total = 0;

  for (const trainer of input.trainers) {
    if (!isTrainerOpenForPolls(trainer)) continue;
    const items: UnvotedBallotItem[] = [];
    for (const pokemon of trainer.pokemon) {
      if (pokemon.slot !== "MAIN" && pokemon.slot !== "RESERVE") continue;
      if (input.slot === "MAIN" && pokemon.slot !== "MAIN") continue;
      const market = marketByPokemonId.get(pokemon.id) ?? null;
      if (market) {
        if (!isOpenMarket(market.status)) continue;
        if (market.myPrediction) continue;
      }
      items.push({ pokemonId: pokemon.id, pokemon, market });
    }
    if (items.length === 0) continue;

    items.sort((a, b) => {
      const aMain = a.pokemon.slot === "MAIN" ? 0 : 1;
      const bMain = b.pokemon.slot === "MAIN" ? 0 : 1;
      if (aMain !== bMain) return aMain - bMain;
      const aVotes = a.market?.total ?? 0;
      const bVotes = b.market?.total ?? 0;
      if (bVotes !== aVotes) return bVotes - aVotes;
      if (a.market && b.market) {
        const aDist = contestDistance(a.market);
        const bDist = contestDistance(b.market);
        if (aDist !== bDist) return aDist - bDist;
      }
      return monLabel(a.pokemon.species, a.pokemon.nickname).localeCompare(
        monLabel(b.pokemon.species, b.pokemon.nickname),
      );
    });

    total += items.length;
    groups.push({
      trainer,
      badgeCount: trainer.earnedBadgeKeys.length,
      items,
    });
  }

  groups.sort((a, b) => {
    if (b.badgeCount !== a.badgeCount) return b.badgeCount - a.badgeCount;
    if (b.items.length !== a.items.length) return b.items.length - a.items.length;
    return a.trainer.handle.localeCompare(b.trainer.handle);
  });

  return { groups, total };
}

