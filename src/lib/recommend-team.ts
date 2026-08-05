/**
 * Coverage-first Main recommendation from living MAIN + RESERVE.
 * Pure helper — no React, no storage.
 */

import type { PokemonEntry } from "@/lib/challenge-types";
import { competitiveTierFor } from "@/lib/competitive-tiers";
import {
  catchTierLabel,
  catchTierRank,
  ivCatchTier,
  type CatchTier,
} from "@/lib/iv-quality";
import {
  STAT_RANKS,
  baseStatRanksFor,
  type StatRank,
} from "@/lib/species-ranks";
import { TYPES } from "@/lib/type-chart";
import {
  SE_THRESHOLD,
  bestOffenseVsType,
  coverageVerdict,
  offensiveCoverage,
  teamDefensiveProfile,
  type CoverageVerdictLabel,
} from "@/lib/team-coverage";

export type RecommendTeamWeights = {
  /** Team coverage share of the objective (default 0.55). */
  coverage: number;
  /** Mean mon-quality share (default 0.45). Split below. */
  quality: number;
  /** Within mon quality: catch / BST / competitive shares. */
  catch: number;
  bst: number;
  competitive: number;
};

export type RecommendTeamOptions = {
  /** Max Main size (default 6). */
  size?: number;
  weights?: Partial<RecommendTeamWeights>;
  /**
   * Exhaustive search when pool size ≤ this (default 18).
   * Larger pools use greedy coverage-first growth.
   */
  exhaustiveMax?: number;
};

export type RecommendTeamPickQuality = {
  catchRank: number;
  catchTier: CatchTier;
  bstPct: number | null;
  bstRank: StatRank | null;
  competitive: StatRank | null;
};

export type RecommendTeamPick = {
  entryId: string;
  quality: RecommendTeamPickQuality;
  /** Mon quality 0–1 used in the objective. */
  qualityScore: number;
  reason: string;
};

export type RecommendTeamResult = {
  entryIds: string[];
  teamScore: number;
  coverageScore: number;
  meanQuality: number;
  coverageLabel: CoverageVerdictLabel;
  coverageTone: "good" | "warn" | "neutral";
  coverageLine: string;
  coveredCount: number;
  totalTypes: number;
  picks: RecommendTeamPick[];
};

const DEFAULT_WEIGHTS: RecommendTeamWeights = {
  coverage: 0.55,
  quality: 0.45,
  catch: 0.45,
  bst: 0.35,
  competitive: 0.2,
};

/** Soft gaps cost half a blind when normalizing coverage to 0–1. */
const SOFT_GAP_WEIGHT = 0.5;

/** Untiered / missing competitive → mid-low default. */
const COMPETITIVE_FALLBACK = 0.4;

/** Missing BST percentile → neutral mid. */
const BST_FALLBACK = 0.5;

type ScoredTeam = {
  entryIds: string[];
  teamScore: number;
  coverageScore: number;
  meanQuality: number;
};

function resolveWeights(
  partial?: Partial<RecommendTeamWeights>,
): RecommendTeamWeights {
  return { ...DEFAULT_WEIGHTS, ...partial };
}

function competitiveLetterScore(tier: StatRank | null): number {
  if (tier == null) return COMPETITIVE_FALLBACK;
  const idx = STAT_RANKS.indexOf(tier);
  if (idx < 0) return COMPETITIVE_FALLBACK;
  return idx / (STAT_RANKS.length - 1);
}

export function monQualityScore(
  entry: PokemonEntry,
  weights: RecommendTeamWeights = DEFAULT_WEIGHTS,
): { score: number; quality: RecommendTeamPickQuality } {
  const catchTier = ivCatchTier(entry.ivs);
  const catchRank = catchTierRank(catchTier);
  const ranks = baseStatRanksFor(entry.pokedexId);
  const bstPct = ranks?.bst.percentile ?? null;
  const bstRank = ranks?.bst.rank ?? null;
  const competitive = competitiveTierFor(entry.pokedexId)?.tier ?? null;

  const catchPart = catchRank / 5;
  const bstPart = bstPct ?? BST_FALLBACK;
  const compPart = competitiveLetterScore(competitive);

  const score =
    weights.catch * catchPart +
    weights.bst * bstPart +
    weights.competitive * compPart;

  return {
    score,
    quality: {
      catchRank,
      catchTier,
      bstPct,
      bstRank,
      competitive,
    },
  };
}

/** Per defending type: best offensive multiplier this mon can land. */
function monCoverageVector(mon: PokemonEntry): Float64Array {
  const vec = new Float64Array(TYPES.length);
  for (let i = 0; i < TYPES.length; i++) {
    vec[i] = bestOffenseVsType(mon, TYPES[i]!).mult;
  }
  return vec;
}

/**
 * Invert coverage gaps into 0–1 from element-wise max across mon vectors.
 * Blinds cost full weight; soft gaps half. Empty → 0.
 */
function coverageScoreFromVectors(
  vectors: readonly Float64Array[],
): number {
  const total = TYPES.length;
  if (vectors.length === 0) return 0;
  let penalty = 0;
  for (let i = 0; i < total; i++) {
    let best = 0;
    for (const vec of vectors) {
      if (vec[i]! > best) best = vec[i]!;
    }
    if (best >= SE_THRESHOLD) continue;
    penalty += best === 0 ? 1 : SOFT_GAP_WEIGHT;
  }
  return Math.max(0, 1 - penalty / total);
}

/**
 * Invert coverage gaps into 0–1. Blinds cost full weight; soft gaps half.
 * Empty team → 0. Public helper — search path uses precomputed vectors.
 */
export function coverageScoreFromTeam(
  team: readonly PokemonEntry[],
): number {
  if (team.length === 0) return 0;
  return coverageScoreFromVectors(team.map(monCoverageVector));
}

function teamObjectiveFromIds(
  entryIds: readonly string[],
  vectorsById: Map<string, Float64Array>,
  qualityById: Map<string, number>,
  weights: RecommendTeamWeights,
): { teamScore: number; coverageScore: number; meanQuality: number } {
  const vectors: Float64Array[] = [];
  let qualitySum = 0;
  for (const id of entryIds) {
    const vec = vectorsById.get(id);
    if (vec) vectors.push(vec);
    qualitySum += qualityById.get(id) ?? 0;
  }
  const coverageScore = coverageScoreFromVectors(vectors);
  const meanQuality = entryIds.length === 0 ? 0 : qualitySum / entryIds.length;
  const teamScore =
    weights.coverage * coverageScore + weights.quality * meanQuality;
  return { teamScore, coverageScore, meanQuality };
}

function compareTeamScores(
  a: { teamScore: number; entryIds: string[] },
  b: { teamScore: number; entryIds: string[] },
): number {
  if (b.teamScore !== a.teamScore) return b.teamScore - a.teamScore;
  // Deterministic: lexicographically smaller id list wins on ties.
  const len = Math.min(a.entryIds.length, b.entryIds.length);
  for (let i = 0; i < len; i++) {
    const cmp = a.entryIds[i]!.localeCompare(b.entryIds[i]!);
    if (cmp !== 0) return cmp;
  }
  return a.entryIds.length - b.entryIds.length;
}

/** Combinations of `k` indices from `0..n-1`, yielding id arrays. */
function* combinations(
  ids: readonly string[],
  k: number,
): Generator<string[]> {
  const n = ids.length;
  if (k <= 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => ids[i]!);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i -= 1;
    if (i < 0) return;
    idx[i]! += 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

function exhaustiveBest(
  pool: readonly PokemonEntry[],
  size: number,
  qualityById: Map<string, number>,
  vectorsById: Map<string, Float64Array>,
  weights: RecommendTeamWeights,
): ScoredTeam {
  // Prefer higher-quality seeds first so ties resolve toward quality when scores match.
  const sortedIds = [...pool]
    .sort((a, b) => {
      const qa = qualityById.get(a.id) ?? 0;
      const qb = qualityById.get(b.id) ?? 0;
      if (qb !== qa) return qb - qa;
      return a.id.localeCompare(b.id);
    })
    .map((m) => m.id);

  let best: ScoredTeam | null = null;

  for (const combo of combinations(sortedIds, size)) {
    const entryIds = [...combo].sort();
    const scored = teamObjectiveFromIds(
      entryIds,
      vectorsById,
      qualityById,
      weights,
    );
    const candidate = { entryIds, ...scored };
    if (!best || compareTeamScores(candidate, best) < 0) {
      best = candidate;
    }
  }

  return (
    best ?? {
      entryIds: [],
      teamScore: 0,
      coverageScore: 0,
      meanQuality: 0,
    }
  );
}

function greedyBest(
  pool: readonly PokemonEntry[],
  size: number,
  qualityById: Map<string, number>,
  vectorsById: Map<string, Float64Array>,
  weights: RecommendTeamWeights,
): ScoredTeam {
  const remaining = new Set(pool.map((m) => m.id));
  const chosen: string[] = [];

  // Seed with best mon quality (stable on entryId).
  let seedId: string | null = null;
  let seedQ = -1;
  for (const id of remaining) {
    const q = qualityById.get(id) ?? 0;
    if (
      q > seedQ ||
      (q === seedQ && (seedId == null || id.localeCompare(seedId) < 0))
    ) {
      seedQ = q;
      seedId = id;
    }
  }
  if (seedId == null) {
    return { entryIds: [], teamScore: 0, coverageScore: 0, meanQuality: 0 };
  }
  chosen.push(seedId);
  remaining.delete(seedId);

  while (chosen.length < size && remaining.size > 0) {
    let bestAdd: string | null = null;
    let bestIds: string[] | null = null;
    let bestScored: {
      teamScore: number;
      coverageScore: number;
      meanQuality: number;
    } | null = null;

    for (const id of remaining) {
      const trialIds = [...chosen, id].sort();
      const scored = teamObjectiveFromIds(
        trialIds,
        vectorsById,
        qualityById,
        weights,
      );
      if (
        !bestScored ||
        compareTeamScores(
          { teamScore: scored.teamScore, entryIds: trialIds },
          { teamScore: bestScored.teamScore, entryIds: bestIds! },
        ) < 0
      ) {
        bestAdd = id;
        bestIds = trialIds;
        bestScored = scored;
      }
    }

    if (bestAdd == null) break;
    chosen.push(bestAdd);
    remaining.delete(bestAdd);
  }

  const entryIds = [...chosen].sort();
  const scored = teamObjectiveFromIds(
    entryIds,
    vectorsById,
    qualityById,
    weights,
  );
  return { entryIds, ...scored };
}

function buildPickReason(
  entry: PokemonEntry,
  quality: RecommendTeamPickQuality,
  qualityScore: number,
  uniqueCovers: string[],
  sharedCovers: string[],
): string {
  const coverBits: string[] = [];
  if (uniqueCovers.length > 0) {
    const shown = uniqueCovers.slice(0, 3);
    coverBits.push(
      `only ≥2× into ${shown.join(", ")}${uniqueCovers.length > 3 ? "…" : ""}`,
    );
  } else if (sharedCovers.length > 0) {
    const shown = sharedCovers.slice(0, 2);
    coverBits.push(
      `helps cover ${shown.join(", ")}${sharedCovers.length > 2 ? "…" : ""}`,
    );
  }

  const qualityBits: string[] = [];
  if (quality.catchRank >= 3) {
    const label = catchTierLabel(quality.catchTier);
    if (label) qualityBits.push(label);
  }
  if (quality.bstRank === "S" || quality.bstRank === "A") {
    qualityBits.push(`BST ${quality.bstRank}`);
  }
  if (quality.competitive === "S" || quality.competitive === "A") {
    qualityBits.push(`Comp ${quality.competitive}`);
  }
  if (qualityBits.length === 0 && qualityScore >= 0.55) {
    if (quality.bstRank) qualityBits.push(`BST ${quality.bstRank}`);
    else if (quality.competitive) qualityBits.push(`Comp ${quality.competitive}`);
    else if (quality.catchRank >= 2) {
      const label = catchTierLabel(quality.catchTier);
      if (label) qualityBits.push(label);
    }
  }

  if (coverBits.length > 0 && qualityBits.length > 0) {
    return `${coverBits[0]}; ${qualityBits.join(" · ")}`;
  }
  if (coverBits.length > 0) return coverBits[0]!;
  if (qualityBits.length > 0) return qualityBits.join(" · ");
  return `${entry.species} fills the squad`;
}

function annotatePicks(
  team: readonly PokemonEntry[],
  qualityMap: Map<
    string,
    { score: number; quality: RecommendTeamPickQuality }
  >,
): RecommendTeamPick[] {
  const coverage = offensiveCoverage(team);
  const contributors = new Map<string, string[]>();
  for (const cell of coverage.cells) {
    if (cell.bestMult < SE_THRESHOLD || !cell.viaEntryId) continue;
    const list = contributors.get(cell.viaEntryId) ?? [];
    list.push(cell.defendingType);
    contributors.set(cell.viaEntryId, list);
  }

  const uniqueByMon = new Map<string, string[]>();
  const sharedByMon = new Map<string, string[]>();
  for (const mon of team) {
    const mine = contributors.get(mon.id) ?? [];
    const without = team.filter((m) => m.id !== mon.id);
    const withoutCov = without.length > 0 ? offensiveCoverage(without) : null;
    const unique: string[] = [];
    const shared: string[] = [];
    for (const t of mine) {
      const still =
        withoutCov?.cells.find((c) => c.defendingType === t)?.bestMult ?? 0;
      if (still < SE_THRESHOLD) unique.push(t);
      else shared.push(t);
    }
    uniqueByMon.set(mon.id, unique);
    sharedByMon.set(mon.id, shared);
  }

  return [...team]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => {
      const q = qualityMap.get(entry.id)!;
      return {
        entryId: entry.id,
        quality: q.quality,
        qualityScore: q.score,
        reason: buildPickReason(
          entry,
          q.quality,
          q.score,
          uniqueByMon.get(entry.id) ?? [],
          sharedByMon.get(entry.id) ?? [],
        ),
      };
    });
}

/**
 * Craft a Main of ≤ `size` from the living pool that maximizes type coverage,
 * weighted toward catch quality, BST, and competitive tier.
 *
 * Deterministic for a given pool (stable entryId tie-breaks).
 */
export function recommendTeam(
  pool: readonly PokemonEntry[],
  opts?: RecommendTeamOptions,
): RecommendTeamResult {
  const size = Math.max(1, Math.min(6, opts?.size ?? 6));
  const exhaustiveMax = opts?.exhaustiveMax ?? 18;
  const weights = resolveWeights(opts?.weights);

  if (pool.length === 0) {
    const emptyCoverage = offensiveCoverage([]);
    const emptyVerdict = coverageVerdict(
      [],
      emptyCoverage,
      teamDefensiveProfile([]),
    );
    return {
      entryIds: [],
      teamScore: 0,
      coverageScore: 0,
      meanQuality: 0,
      coverageLabel: emptyVerdict.label,
      coverageTone: emptyVerdict.tone,
      coverageLine: "Catch living Pokémon to recommend a Main.",
      coveredCount: emptyVerdict.coveredCount,
      totalTypes: emptyVerdict.total,
      picks: [],
    };
  }

  const byId = new Map(pool.map((m) => [m.id, m] as const));
  const qualityMap = new Map<
    string,
    { score: number; quality: RecommendTeamPickQuality }
  >();
  const qualityById = new Map<string, number>();
  const vectorsById = new Map<string, Float64Array>();
  for (const mon of pool) {
    const scored = monQualityScore(mon, weights);
    qualityMap.set(mon.id, scored);
    qualityById.set(mon.id, scored.score);
    vectorsById.set(mon.id, monCoverageVector(mon));
  }

  const target = Math.min(size, pool.length);
  const search =
    pool.length <= exhaustiveMax
      ? exhaustiveBest(pool, target, qualityById, vectorsById, weights)
      : greedyBest(pool, target, qualityById, vectorsById, weights);

  const team = search.entryIds
    .map((id) => byId.get(id))
    .filter((m): m is PokemonEntry => m != null);

  const coverage = offensiveCoverage(team);
  const defense = teamDefensiveProfile(team);
  const verdict = coverageVerdict(team, coverage, defense);
  const picks = annotatePicks(team, qualityMap).sort(
    (a, b) =>
      b.qualityScore - a.qualityScore || a.entryId.localeCompare(b.entryId),
  );

  return {
    entryIds: picks.map((p) => p.entryId),
    teamScore: search.teamScore,
    coverageScore: search.coverageScore,
    meanQuality: search.meanQuality,
    coverageLabel: verdict.label,
    coverageTone: verdict.tone,
    coverageLine: verdict.line,
    coveredCount: verdict.coveredCount,
    totalTypes: verdict.total,
    picks,
  };
}
