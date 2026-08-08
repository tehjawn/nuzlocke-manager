/**
 * GM console Analytics (#404) — multi-section pack intel over claimed trainers.
 *
 * Sections:
 * - App — season engagement pulse (product DAU/session not instrumented yet)
 * - Trainers — badge / playtime / money / wipe medians & leaders
 * - Pokemon — species, typing meta, held items, catch/bond grades on Mains
 * - Game — missed claims & deadliest routes
 */

import { CATCH_ROUTE_TABLE, findCatchRoute } from "@/data/catch-routes";
import { MODERN_SAFARI_ZONE_AREAS } from "@/data/safari-zone";
import type { PokemonEntry } from "@/lib/challenge-types";
import { formatPlayTime } from "@/lib/gen3-save/playtime";
import {
  SE_THRESHOLD,
  offensiveCoverage,
} from "@/lib/team-coverage";
import { catchScoreFor, trainingTierFor } from "@/lib/pokemon-grades";
import { attackMultiplierVs } from "@/lib/type-matchups";
import { TYPES, type PokemonType } from "@/lib/type-chart";
import {
  TRAINING_TIERS,
  type TrainingTier,
} from "@/lib/training-quality";

export const GM_ANALYTICS_SECTIONS = [
  "app",
  "trainers",
  "pokemon",
  "game",
] as const;

export type GmAnalyticsSection = (typeof GM_ANALYTICS_SECTIONS)[number];

export type GmRankRow = {
  label: string;
  score: number;
  detail?: string;
};

export type GmTypeRankRow = {
  type: PokemonType;
  score: number;
  mainCount: number;
};

export type GmSpeciesRankRow = {
  species: string;
  pokedexId: number | null;
  count: number;
};

export type GmStatCallout = {
  label: string;
  value: string;
  hint?: string;
};

export type GmAppReport = {
  claimedTrainers: number;
  openTrainers: number;
  introDone: number;
  introPending: number;
  /** Distinct trainers with board activity in the last 7 days. */
  activeTrainers7d: number;
  activityLast7d: number;
  activityByType: GmRankRow[];
  callouts: string[];
};

export type GmTrainersReport = {
  claimedCount: number;
  callouts: GmStatCallout[];
  badgeLeaders: GmRankRow[];
  playtimeLeaders: GmRankRow[];
  moneyLeaders: GmRankRow[];
  wipeLeaders: GmRankRow[];
};

export type GmPokemonReport = {
  mainsWithPokemon: number;
  mainPokemonCount: number;
  callouts: string[];
  popularTyping: GmTypeRankRow[];
  bestAnswers: GmTypeRankRow[];
  biggestThreats: GmTypeRankRow[];
  mainSpecies: GmSpeciesRankRow[];
  caughtSpecies: GmSpeciesRankRow[];
  seenSpecies: GmSpeciesRankRow[];
  heldItems: GmRankRow[];
  medianCatchScore: number | null;
  catchScoreSample: number;
  trainingTierCounts: GmRankRow[];
};

export type GmGameReport = {
  trainersWithFlags: number;
  callouts: string[];
  missedClaimRoutes: GmRankRow[];
  deadliestRoutes: GmRankRow[];
  mostClaimedRoutes: GmRankRow[];
};

export type GmAnalyticsTrainerLite = {
  id: string;
  handle: string;
  sortOrder: number;
  userId: string | null;
  wipeCount: number;
  completionCount: number;
  money: number | null;
  playTimeSeconds: number | null;
  introCompletedAt: Date | string | null;
  earnedBadgeKeys: string[];
  nuzlockeEncounterBits: number[];
  nuzlockeEncounterBitsReliable: boolean;
  safariZoneAreas: string[];
  safariZoneAreasReliable: boolean;
};

const LIST_TOP = 8;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function chartTypesOn(mon: PokemonEntry): PokemonType[] {
  return mon.types.filter((t): t is PokemonType =>
    (TYPES as readonly string[]).includes(t),
  );
}

function mainPressuredBy(
  pokemon: readonly PokemonEntry[],
  attackType: PokemonType,
): boolean {
  for (const mon of pokemon) {
    const types = chartTypesOn(mon);
    if (types.length === 0) continue;
    if (attackMultiplierVs(attackType, types) >= SE_THRESHOLD) return true;
  }
  return false;
}

function sortByScoreDesc(a: { score: number; label?: string; type?: string; species?: string }, b: typeof a): number {
  const aKey = a.label ?? a.type ?? a.species ?? "";
  const bKey = b.label ?? b.type ?? b.species ?? "";
  return b.score - a.score || aKey.localeCompare(bKey);
}

function rankSpecies(
  mons: readonly PokemonEntry[],
  limit = LIST_TOP,
): GmSpeciesRankRow[] {
  const map = new Map<
    string,
    { species: string; pokedexId: number | null; count: number }
  >();
  for (const mon of mons) {
    const key = mon.species.trim().toLowerCase();
    if (!key) continue;
    const row = map.get(key) ?? {
      species: mon.species.trim(),
      pokedexId: mon.pokedexId,
      count: 0,
    };
    row.count += 1;
    if (row.pokedexId == null && mon.pokedexId != null) {
      row.pokedexId = mon.pokedexId;
    }
    map.set(key, row);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.species.localeCompare(b.species))
    .slice(0, limit);
}

function isOwned(slot: PokemonEntry["slot"]): boolean {
  return slot === "MAIN" || slot === "RESERVE" || slot === "GRAVEYARD";
}

/** App / season pulse — not product analytics (DAU / session duration). */
export function buildGmAppReport(input: {
  trainers: readonly GmAnalyticsTrainerLite[];
  activityLast7d: number;
  activeTrainers7d: number;
  activityByType: ReadonlyArray<{ type: string; count: number }>;
}): GmAppReport {
  const claimed = input.trainers.filter((t) => t.userId);
  const open = input.trainers.filter((t) => !t.userId);
  const introDone = claimed.filter((t) => t.introCompletedAt).length;
  const introPending = claimed.length - introDone;

  const activityByType = [...input.activityByType]
    .map((row) => ({
      label: humanActivityType(row.type),
      score: row.count,
    }))
    .sort(sortByScoreDesc)
    .slice(0, LIST_TOP);

  const callouts: string[] = [];
  if (claimed.length === 0) {
    callouts.push("No claimed trainers yet — the season pulse fills in after joins.");
  } else {
    callouts.push(
      `${claimed.length} claimed · ${open.length} open slots · ${introDone} finished intro.`,
    );
    if (input.activeTrainers7d > 0) {
      callouts.push(
        `${input.activeTrainers7d} trainer${input.activeTrainers7d === 1 ? "" : "s"} posted board activity in the last 7 days.`,
      );
    } else {
      callouts.push("No board activity in the last 7 days.");
    }
  }

  return {
    claimedTrainers: claimed.length,
    openTrainers: open.length,
    introDone,
    introPending,
    activeTrainers7d: input.activeTrainers7d,
    activityLast7d: input.activityLast7d,
    activityByType,
    callouts,
  };
}

function humanActivityType(type: string): string {
  switch (type) {
    case "CATCH":
      return "Catches";
    case "DEATH":
      return "Deaths";
    case "BADGE_EARNED":
      return "Badges earned";
    case "WIPE":
      return "Wipes";
    case "RUN_COMPLETED":
      return "Championships";
    case "RUN_STARTED":
      return "New runs";
    case "MEMBER_JOINED":
      return "Members joined";
    case "TRAINER_CLAIMED":
      return "Boards claimed";
    case "STATUS_UPDATE":
      return "Status updates";
    case "REVIVE_USED":
      return "Revives";
    default:
      return type
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

export function buildGmTrainersReport(
  trainers: readonly GmAnalyticsTrainerLite[],
): GmTrainersReport {
  const claimed = trainers.filter((t) => t.userId);
  const badgeCounts = claimed.map((t) => t.earnedBadgeKeys.length);
  const playtimes = claimed
    .map((t) => t.playTimeSeconds)
    .filter((n): n is number => n != null && n >= 0);
  const monies = claimed
    .map((t) => t.money)
    .filter((n): n is number => n != null && n >= 0);
  const wipes = claimed.map((t) => t.wipeCount);
  const completions = claimed.map((t) => t.completionCount);

  const medBadges = median(badgeCounts);
  const medPlay = median(playtimes);
  const medMoney = median(monies);
  const medWipes = median(wipes);

  const callouts: GmStatCallout[] = [
    {
      label: "Median badges",
      value: medBadges == null ? "—" : String(round1(medBadges)),
      hint: `${claimed.length} claimed`,
    },
    {
      label: "Median playtime",
      value: medPlay == null ? "—" : formatPlayTime(Math.round(medPlay)),
      hint:
        playtimes.length < claimed.length
          ? `${playtimes.length} imported`
          : undefined,
    },
    {
      label: "Median money",
      value:
        medMoney == null
          ? "—"
          : `₽${Math.round(medMoney).toLocaleString("en-US")}`,
      hint:
        monies.length < claimed.length
          ? `${monies.length} imported`
          : undefined,
    },
    {
      label: "Median wipes",
      value: medWipes == null ? "—" : String(round1(medWipes)),
    },
    {
      label: "Championships",
      value: String(completions.reduce((a, b) => a + b, 0)),
      hint: "season total",
    },
  ];

  const badgeLeaders = [...claimed]
    .map((t) => ({
      label: t.handle,
      score: t.earnedBadgeKeys.length,
      detail: `${t.earnedBadgeKeys.length} badge${t.earnedBadgeKeys.length === 1 ? "" : "s"}`,
    }))
    .sort(sortByScoreDesc)
    .slice(0, LIST_TOP);

  const playtimeLeaders = [...claimed]
    .filter((t) => t.playTimeSeconds != null && t.playTimeSeconds >= 0)
    .map((t) => ({
      label: t.handle,
      score: t.playTimeSeconds ?? 0,
      detail: formatPlayTime(t.playTimeSeconds ?? 0),
    }))
    .sort(sortByScoreDesc)
    .slice(0, LIST_TOP);

  const moneyLeaders = [...claimed]
    .filter((t) => t.money != null && t.money >= 0)
    .map((t) => ({
      label: t.handle,
      score: t.money ?? 0,
      detail: `₽${(t.money ?? 0).toLocaleString("en-US")}`,
    }))
    .sort(sortByScoreDesc)
    .slice(0, LIST_TOP);

  const wipeLeaders = [...claimed]
    .map((t) => ({
      label: t.handle,
      score: t.wipeCount,
      detail: `${t.wipeCount} wipe${t.wipeCount === 1 ? "" : "s"}`,
    }))
    .sort(sortByScoreDesc)
    .slice(0, LIST_TOP);

  return {
    claimedCount: claimed.length,
    callouts,
    badgeLeaders,
    playtimeLeaders,
    moneyLeaders,
    wipeLeaders,
  };
}

export function buildGmPokemonReport(input: {
  claimedTrainerCount: number;
  trainers: ReadonlyArray<{
    id: string;
    handle: string;
    pokemon: PokemonEntry[];
  }>;
}): GmPokemonReport {
  const activeMains = input.trainers.filter((t) =>
    t.pokemon.some((p) => p.slot === "MAIN"),
  );
  const mainCount = activeMains.length;
  const allPokemon = input.trainers.flatMap((t) => t.pokemon);
  const mains = allPokemon.filter((p) => p.slot === "MAIN");
  const caught = allPokemon.filter((p) => isOwned(p.slot));
  const seen = allPokemon;

  const answeredByType = new Map<PokemonType, number>(
    TYPES.map((t) => [t, 0]),
  );
  const pressuredByType = new Map<PokemonType, number>(
    TYPES.map((t) => [t, 0]),
  );
  const typeCounts = new Map<PokemonType, number>(TYPES.map((t) => [t, 0]));

  for (const trainer of activeMains) {
    const mainMons = trainer.pokemon.filter((p) => p.slot === "MAIN");
    const coverage = offensiveCoverage(mainMons);
    for (const cell of coverage.cells) {
      if (cell.bestMult >= SE_THRESHOLD) {
        answeredByType.set(
          cell.defendingType,
          (answeredByType.get(cell.defendingType) ?? 0) + 1,
        );
      }
    }
    for (const attackType of TYPES) {
      if (mainPressuredBy(mainMons, attackType)) {
        pressuredByType.set(
          attackType,
          (pressuredByType.get(attackType) ?? 0) + 1,
        );
      }
    }
    for (const mon of mainMons) {
      for (const t of chartTypesOn(mon)) {
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    }
  }

  const popularTyping: GmTypeRankRow[] = TYPES.map((type) => ({
    type,
    score: typeCounts.get(type) ?? 0,
    mainCount: 0,
  })).sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));

  const bestAnswers: GmTypeRankRow[] = TYPES.map((type) => ({
    type,
    score: answeredByType.get(type) ?? 0,
    mainCount,
  })).sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));

  const biggestThreats: GmTypeRankRow[] = TYPES.map((type) => ({
    type,
    score: pressuredByType.get(type) ?? 0,
    mainCount,
  })).sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));

  const heldMap = new Map<string, number>();
  for (const mon of mains) {
    const item = mon.heldItem?.trim();
    if (!item) continue;
    heldMap.set(item, (heldMap.get(item) ?? 0) + 1);
  }
  const heldItems: GmRankRow[] = [...heldMap.entries()]
    .map(([label, score]) => ({ label, score }))
    .sort(sortByScoreDesc)
    .slice(0, LIST_TOP);

  const catchScores = mains
    .map((mon) => catchScoreFor(mon))
    .filter((n): n is number => n != null);
  const medianCatchScore =
    catchScores.length > 0 ? round1(median(catchScores) ?? 0) : null;

  const tierCounts = new Map<TrainingTier, number>(
    TRAINING_TIERS.map((t) => [t, 0]),
  );
  let trainingSample = 0;
  for (const mon of mains) {
    const tier = trainingTierFor(mon);
    if (!tier) continue;
    trainingSample += 1;
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
  }
  const trainingTierCounts: GmRankRow[] = TRAINING_TIERS.map((tier) => ({
    label: tier,
    score: tierCounts.get(tier) ?? 0,
    detail:
      trainingSample > 0
        ? `${tierCounts.get(tier) ?? 0}/${trainingSample} Mains`
        : undefined,
  })).filter((r) => r.score > 0);

  const callouts: string[] = [];
  if (mainCount === 0) {
    callouts.push("No Main Squads yet — Pokémon meta unlocks once Mains fill in.");
  } else {
    const topType = popularTyping.find((r) => r.score > 0);
    if (topType) {
      callouts.push(`Most common Main typing: ${topType.type}.`);
    }
    const soft = [...bestAnswers].sort(
      (a, b) => a.score - b.score || a.type.localeCompare(b.type),
    )[0];
    if (soft && soft.score < mainCount) {
      callouts.push(
        `Softest answer: ${soft.type} (${soft.score}/${soft.mainCount} Mains).`,
      );
    }
    if (medianCatchScore != null) {
      callouts.push(
        `Median Main catch score: ${medianCatchScore} (${catchScores.length} graded).`,
      );
    }
  }

  return {
    mainsWithPokemon: mainCount,
    mainPokemonCount: mains.length,
    callouts,
    popularTyping,
    bestAnswers,
    biggestThreats,
    mainSpecies: rankSpecies(mains),
    caughtSpecies: rankSpecies(caught),
    seenSpecies: rankSpecies(seen),
    heldItems,
    medianCatchScore,
    catchScoreSample: catchScores.length,
    trainingTierCounts,
  };
}

/**
 * Routes where a trainer spent the encounter flag but has no owned catch —
 * pack-wide “missed claims.”
 */
export function missedClaimRouteLabels(input: {
  bits: readonly number[];
  bitsReliable: boolean;
  safariAreas: readonly string[];
  safariReliable: boolean;
  ownedCatchRoutes: readonly string[];
}): string[] {
  const {
    bits,
    bitsReliable,
    safariAreas,
    safariReliable,
    ownedCatchRoutes,
  } = input;

  if (!bitsReliable && !safariReliable) return [];

  const ownedSlots = new Set<number>();
  let hasUmbrellaSafari = false;
  for (const label of ownedCatchRoutes) {
    const catalog = findCatchRoute(label);
    if (!catalog) continue;
    if (catalog.label === "Safari Zone") hasUmbrellaSafari = true;
    if (catalog.slotKey != null) ownedSlots.add(catalog.slotKey);
  }

  const safariBits = new Set<number>(
    MODERN_SAFARI_ZONE_AREAS.map((area) => area.encounterFlag),
  );

  if (bitsReliable) {
    const used = new Set(bits);
    const missed: string[] = [];
    for (const route of CATCH_ROUTE_TABLE) {
      if (route.nuzlockeBit == null || !used.has(route.nuzlockeBit)) continue;
      if (route.slotKey == null) continue;
      if (ownedSlots.has(route.slotKey)) continue;
      if (hasUmbrellaSafari && safariBits.has(route.nuzlockeBit)) continue;
      missed.push(route.label);
    }
    return missed;
  }

  if (hasUmbrellaSafari) return [];
  return safariAreas.filter((route) =>
    MODERN_SAFARI_ZONE_AREAS.some((area) => area.route === route),
  );
}

export function buildGmGameReport(input: {
  trainers: ReadonlyArray<{
    id: string;
    handle: string;
    bits: number[];
    bitsReliable: boolean;
    safariAreas: string[];
    safariReliable: boolean;
    pokemon: PokemonEntry[];
  }>;
}): GmGameReport {
  const missedMap = new Map<string, number>();
  const claimedMap = new Map<string, number>();
  const graveMap = new Map<string, number>();
  let trainersWithFlags = 0;

  for (const trainer of input.trainers) {
    const ownedRoutes = trainer.pokemon
      .filter((p) => isOwned(p.slot))
      .map((p) => p.catchRoute?.trim() ?? "")
      .filter(Boolean);

    for (const route of ownedRoutes) {
      claimedMap.set(route, (claimedMap.get(route) ?? 0) + 1);
    }

    for (const mon of trainer.pokemon) {
      if (mon.slot !== "GRAVEYARD") continue;
      const route = mon.catchRoute?.trim();
      if (!route) continue;
      graveMap.set(route, (graveMap.get(route) ?? 0) + 1);
    }

    if (!trainer.bitsReliable && !trainer.safariReliable) continue;
    trainersWithFlags += 1;
    for (const route of missedClaimRouteLabels({
      bits: trainer.bits,
      bitsReliable: trainer.bitsReliable,
      safariAreas: trainer.safariAreas,
      safariReliable: trainer.safariReliable,
      ownedCatchRoutes: ownedRoutes,
    })) {
      missedMap.set(route, (missedMap.get(route) ?? 0) + 1);
    }
  }

  const toRank = (map: Map<string, number>, detailWord: string): GmRankRow[] =>
    [...map.entries()]
      .map(([label, score]) => ({
        label,
        score,
        detail: `${score} ${detailWord}${score === 1 ? "" : "s"}`,
      }))
      .sort(sortByScoreDesc)
      .slice(0, LIST_TOP);

  const missedClaimRoutes = toRank(missedMap, "miss");
  const deadliestRoutes = toRank(graveMap, "death");
  const mostClaimedRoutes = toRank(claimedMap, "catch");

  const callouts: string[] = [];
  if (trainersWithFlags === 0) {
    callouts.push(
      "No imported encounter flags yet — missed-claim routes need a save import.",
    );
  } else if (missedClaimRoutes[0]) {
    callouts.push(
      `Most missed claims: ${missedClaimRoutes[0].label} (${missedClaimRoutes[0].score}).`,
    );
  } else {
    callouts.push("No missed claims detected across imported flags.");
  }
  if (deadliestRoutes[0]) {
    callouts.push(
      `Deadliest route: ${deadliestRoutes[0].label} (${deadliestRoutes[0].score} deaths).`,
    );
  }

  return {
    trainersWithFlags,
    callouts,
    missedClaimRoutes,
    deadliestRoutes,
    mostClaimedRoutes,
  };
}
