import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { hasBeatenChampionship } from "@/lib/championship";
import { catchTierFor } from "@/lib/pokemon-grades";
import type { MemorialSeasonHighlights } from "@/lib/memorial-stats";

/**
 * Season Stats aggregators (issue 178) — cross-trainer leaderboards that
 * didn't exist anywhere yet: badge race, full wallet standings, god-tier
 * catches, and shinies. Companions to `memorialSeasonHighlights` /
 * `encounterSeasonHighlights`, which the Season Stats tool reuses as-is.
 */

export type SeasonStandingRow = {
  trainerId: string;
  /** Competition ranking — tied trainers share a rank. */
  rank: number;
  value: number;
  tied: boolean;
};

/** Full standings, best first; sortOrder keeps tied rows stable. */
function standings(
  trainers: TrainerProfile[],
  valueOf: (trainer: TrainerProfile) => number,
): SeasonStandingRow[] {
  const rows = trainers
    .map((trainer) => ({ trainer, value: valueOf(trainer) }))
    .sort(
      (a, b) => b.value - a.value || a.trainer.sortOrder - b.trainer.sortOrder,
    );
  const valueCounts = new Map<number, number>();
  for (const row of rows) {
    valueCounts.set(row.value, (valueCounts.get(row.value) ?? 0) + 1);
  }
  let rank = 0;
  let prevValue: number | null = null;
  return rows.map((row, index) => {
    if (prevValue === null || row.value !== prevValue) {
      rank = index + 1;
      prevValue = row.value;
    }
    return {
      trainerId: row.trainer.id,
      rank,
      value: row.value,
      tied: (valueCounts.get(row.value) ?? 0) > 1,
    };
  });
}

export type BadgeStandingRow = SeasonStandingRow & { champion: boolean };

/** Cross-trainer badge race — every trainer, most badges first. */
export function badgeStandings(
  trainers: TrainerProfile[],
): BadgeStandingRow[] {
  const champions = new Set(
    trainers
      .filter((trainer) => hasBeatenChampionship(trainer.earnedBadgeKeys))
      .map((trainer) => trainer.id),
  );
  return standings(trainers, (trainer) => trainer.earnedBadgeKeys.length).map(
    (row) => ({ ...row, champion: champions.has(row.trainerId) }),
  );
}

export type MoneyStandings = {
  /** Trainers with an imported wallet, richest first. */
  rows: SeasonStandingRow[];
  /** Trainers with no imported wallet (`money` unknown). */
  unreportedCount: number;
};

/** Richest-to-poorest — same wallet pool as `memorialSeasonHighlights`. */
export function moneyStandings(trainers: TrainerProfile[]): MoneyStandings {
  const reported = trainers.filter(
    (trainer) => trainer.money != null && trainer.money >= 0,
  );
  return {
    rows: standings(reported, (trainer) => trainer.money ?? 0),
    unreportedCount: trainers.length - reported.length,
  };
}

/**
 * Per-trainer season catches: living party & box rows plus cross-run graves
 * (a wipe clears the live board, so past-run graves only exist in board
 * history — pass `getSeasonMemorialGraves` output through
 * `gravesPokemonByTrainerId`). Seen-only ENCOUNTERED stubs are not catches.
 *
 * Known gap: snapshot recovery keeps GRAVEYARD rows only, so a catch that was
 * still alive when its run wiped is not recoverable and won't count.
 */
export function seasonCatchesByTrainer(
  trainers: TrainerProfile[],
  gravesByTrainerId: Record<string, PokemonEntry[]>,
): Record<string, PokemonEntry[]> {
  const out: Record<string, PokemonEntry[]> = {};
  for (const trainer of trainers) {
    const living = trainer.pokemon.filter(
      (mon) => mon.slot === "MAIN" || mon.slot === "RESERVE",
    );
    out[trainer.id] = [...living, ...(gravesByTrainerId[trainer.id] ?? [])];
  }
  return out;
}

export type GodCatchBoard = {
  /** God-tier catches across the season (party, box & cross-run graves). */
  total: number;
  /** Trainers with at least one god catch, best first. */
  rows: SeasonStandingRow[];
};

/**
 * Season-wide god-tier IV leaderboard (role-aware `catchTierFor` === "god").
 *
 * Must run server-side on unredacted boards: IV spreads are competitive
 * details nulled by `toPublicPokemonEntry` for rival viewers.
 * Only trainer-level counts leave this function, so raw spreads — and even
 * which specific Pokémon is the god catch — stay gated behind
 * `canViewCompetitiveDetails`.
 */
export function godCatchBoard(
  trainers: TrainerProfile[],
  catchesByTrainerId: Record<string, PokemonEntry[]>,
): GodCatchBoard {
  const counts = new Map<string, number>();
  let total = 0;
  for (const trainer of trainers) {
    let count = 0;
    for (const mon of catchesByTrainerId[trainer.id] ?? []) {
      if (catchTierFor(mon) === "god") count += 1;
    }
    counts.set(trainer.id, count);
    total += count;
  }
  const withGods = trainers.filter(
    (trainer) => (counts.get(trainer.id) ?? 0) > 0,
  );
  return {
    total,
    rows: standings(withGods, (trainer) => counts.get(trainer.id) ?? 0),
  };
}

export type ShinyCatchEntry = {
  /** Stable render key — grave rows recovered from snapshots can reuse ids. */
  key: string;
  trainerId: string;
  trainerLabel: string;
  species: string;
  nickname: string | null;
  pokedexId: number | null;
  /** Fallen shinies still count — they were caught this season. */
  fallen: boolean;
};

export type ShinyBoard = {
  total: number;
  /** Trainers with at least one shiny, best first. */
  rows: SeasonStandingRow[];
  /** Every shiny caught, in board order per trainer. */
  catches: ShinyCatchEntry[];
};

/** Shiny tracker (issue 193) — `isShiny` finally aggregated season-wide. */
export function shinySeasonBoard(
  trainers: TrainerProfile[],
  catchesByTrainerId: Record<string, PokemonEntry[]>,
): ShinyBoard {
  const catches: ShinyCatchEntry[] = [];
  const counts = new Map<string, number>();
  const ordered = [...trainers].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const trainer of ordered) {
    let count = 0;
    for (const mon of catchesByTrainerId[trainer.id] ?? []) {
      if (!mon.isShiny) continue;
      count += 1;
      catches.push({
        key: `${trainer.id}:${mon.id}:${count}`,
        trainerId: trainer.id,
        trainerLabel: trainer.handle,
        species: mon.species,
        nickname: mon.nickname,
        pokedexId: mon.pokedexId,
        fallen: mon.slot === "GRAVEYARD",
      });
    }
    counts.set(trainer.id, count);
  }
  const withShinies = trainers.filter(
    (trainer) => (counts.get(trainer.id) ?? 0) > 0,
  );
  return {
    total: catches.length,
    rows: standings(withShinies, (trainer) => counts.get(trainer.id) ?? 0),
    catches,
  };
}

/**
 * Server-computed half of the Season Stats tool. The rest of the page derives
 * client-side from the redacted `trainers` prop; these need data the tools
 * payload doesn't carry — cross-run graves and unredacted IVs.
 */
export type SeasonStatsData = {
  badgesTotal: number;
  memorial: MemorialSeasonHighlights;
  /** Null when the full board (IV source) couldn't be fetched. */
  godCatches: GodCatchBoard | null;
  shinies: ShinyBoard;
};
