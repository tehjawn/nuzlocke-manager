import {
  modernEmeraldNationalIds,
  modernEmeraldSpeciesRef,
} from "@/lib/modern-emerald-dex";
import {
  baseStatsForSpecies,
  bstOf,
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
} from "@/lib/stats";

/** Worst → best, so array order doubles as the tier ladder. */
export const STAT_RANKS = ["F", "D", "C", "B", "A", "S"] as const;

export type StatRank = (typeof STAT_RANKS)[number];

/** Best → worst — tier-list row order and "best first" filters. */
export const STAT_RANKS_BEST_FIRST: readonly StatRank[] = [
  "S",
  "A",
  "B",
  "C",
  "D",
  "F",
];

export type StatRankResult = {
  value: number;
  /** Share of the peer set this value beats, 0–1 (ties count as half). */
  percentile: number;
  rank: StatRank;
};

export type SpeciesStatRanks = {
  pokedexId: number;
  perStat: Record<StatKey, StatRankResult>;
  bst: StatRankResult;
  /** Species in the comparison pool (Modern Emerald with catalogued stats). */
  peerCount: number;
  /** Up to two S/A stats, best first. */
  standouts: StatKey[];
  /** Up to two D/F stats, worst first. */
  shortfalls: StatKey[];
  /** One-line beginner read of the whole spread. */
  headline: string;
};

/**
 * Percentile → letter. Cutoffs are deliberately not evenly spaced: base stats
 * bunch hard in the middle of the pool, so the top and bottom bands stay
 * narrow enough that an S or an F actually means something.
 */
const RANK_CUTOFFS: ReadonlyArray<{ min: number; rank: StatRank }> = [
  { min: 0.9, rank: "S" },
  { min: 0.75, rank: "A" },
  { min: 0.55, rank: "B" },
  { min: 0.35, rank: "C" },
  { min: 0.15, rank: "D" },
  { min: 0, rank: "F" },
];

export function rankForPercentile(percentile: number): StatRank {
  for (const band of RANK_CUTOFFS) {
    if (percentile >= band.min) return band.rank;
  }
  return "F";
}

/**
 * Inclusive floor / exclusive ceiling for a letter's percentile band, matching
 * `RANK_CUTOFFS`. S opens at 0.9 and closes at 1; F opens at 0 and closes at
 * 0.15. Used by the tier-list headers so "S" reads as *top 10% of the roster*
 * rather than a vibe grade.
 */
export function rankBandPercentileRange(rank: StatRank): {
  min: number;
  max: number;
} {
  const index = RANK_CUTOFFS.findIndex((band) => band.rank === rank);
  const min = RANK_CUTOFFS[index]?.min ?? 0;
  const max = index <= 0 ? 1 : (RANK_CUTOFFS[index - 1]?.min ?? 1);
  return { min, max };
}

/** Short band copy for tier-list row headers — e.g. "top 10%" / "75–90%". */
export function rankBandLabel(rank: StatRank): string {
  const { min, max } = rankBandPercentileRange(rank);
  const lo = Math.round(min * 100);
  const hi = Math.round(max * 100);
  if (max >= 1) return `top ${100 - lo}%`;
  if (min <= 0) return `bottom ${hi}%`;
  return `${lo}–${hi}%`;
}

/**
 * Chip tone per rank — same gold-top / green-strong / muted-tail ramp as
 * `qualityToneClass`, so a rank letter never disagrees with the stat value
 * beside it. Deliberately not `danger`: in this codebase that token means
 * "something went wrong", not "this stat is low".
 */
export function statRankToneClass(rank: StatRank): string {
  if (rank === "S") return "border-accent-2/45 bg-accent-2/15 text-accent-2";
  if (rank === "A") return "border-accent/35 bg-accent/10 text-accent-deep";
  if (rank === "B") return "border-frame/50 bg-surface-2 text-ink";
  if (rank === "C") return "border-frame/40 bg-surface-2/70 text-muted";
  if (rank === "D") return "border-frame/30 bg-surface/60 text-muted";
  return "border-ink/25 bg-ink/10 text-muted";
}

/** Tooltip copy that spells out what the letter is measured against. */
export function statRankHint(
  label: string,
  result: StatRankResult,
  peerCount: number,
): string {
  const pct = Math.round(result.percentile * 100);
  return `${label} ${result.value} — rank ${result.rank}, ahead of ${pct}% of ${peerCount} Modern Emerald species`;
}

/** Every ranked column: the six base stats plus their total. */
const RANK_COLUMNS = [...STAT_KEYS, "bst"] as const;

type RankColumn = (typeof RANK_COLUMNS)[number];

type PeerPool = {
  /** Ascending values per column. */
  sorted: Record<RankColumn, number[]>;
  count: number;
};

let cachedPool: PeerPool | null = null;

/**
 * Modern Emerald species that actually have catalogued base stats. Ranking
 * against the ROM's roster (not the full National Dex) keeps an "S" honest —
 * a Gen 3 wall shouldn't read as mid because Gen 9 legendaries exist.
 */
function peerPool(): PeerPool {
  if (cachedPool) return cachedPool;

  const columns: Record<RankColumn, number[]> = {
    hp: [],
    atk: [],
    def: [],
    spa: [],
    spd: [],
    spe: [],
    bst: [],
  };

  let count = 0;
  for (const id of modernEmeraldNationalIds()) {
    const stats = baseStatsForSpecies(id);
    if (!stats) continue;
    count += 1;
    for (const key of STAT_KEYS) columns[key].push(stats[key]);
    columns.bst.push(bstOf(stats));
  }

  for (const key of RANK_COLUMNS) {
    columns[key].sort((a, b) => a - b);
  }

  cachedPool = { sorted: columns, count };
  return cachedPool;
}

/** First index whose value is >= target in an ascending array. */
function lowerBound(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose value is > target in an ascending array. */
function upperBound(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Mid-rank percentile: ties split the band they sit in. Base stats repeat a
 * lot (dozens of species share base 70 Speed), so counting ties as wins would
 * hand out free S ranks at every common value.
 */
function percentileIn(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  const below = lowerBound(sorted, value);
  const ties = upperBound(sorted, value) - below;
  return (below + ties / 2) / sorted.length;
}

function rankValue(sorted: number[], value: number): StatRankResult {
  const percentile = percentileIn(sorted, value);
  return { value, percentile, rank: rankForPercentile(percentile) };
}

const OVERALL_READS: Record<StatRank, string> = {
  S: "Elite raw stats",
  A: "Strong raw stats",
  B: "Above-average raw stats",
  C: "Middling raw stats",
  D: "Below-average raw stats",
  F: "Very low raw stats",
};

/** "Spe" / "Spe and Atk", with the verb agreeing. */
function statClause(keys: StatKey[], one: string, many: string): string {
  const labels = keys.map((k) => STAT_LABELS[k]).join(" and ");
  return `${labels} ${keys.length === 1 ? one : many}`;
}

function buildHeadline(
  bst: StatRankResult,
  standouts: StatKey[],
  shortfalls: StatKey[],
): string {
  const pct = Math.round(bst.percentile * 100);
  const parts = [
    `${OVERALL_READS[bst.rank]} — BST ${bst.value} tops ${pct}% of the Modern Emerald roster.`,
  ];
  if (standouts.length > 0) {
    parts.push(`${statClause(standouts, "leads", "lead")} the spread.`);
  }
  if (shortfalls.length > 0) {
    parts.push(`${statClause(shortfalls, "lags", "lag")} behind.`);
  }
  return parts.join(" ");
}

/**
 * Rank a species' base stats F→S against the Modern Emerald roster.
 * Returns null when the species has no catalogued base stats (most formes) —
 * callers should fall back to plain numbers rather than guessing a tier.
 *
 * Species outside Modern Emerald (a Gen 9 mon browsed in the National Dex)
 * are still ranked: the percentile of a value against the pool is well
 * defined either way, and the label tells the reader what the peer set is.
 */
export function baseStatRanksFor(
  pokedexId: number | null | undefined,
): SpeciesStatRanks | null {
  const stats = baseStatsForSpecies(pokedexId);
  if (!stats || pokedexId == null) return null;

  const pool = peerPool();
  if (pool.count === 0) return null;

  const perStat: Record<StatKey, StatRankResult> = {
    hp: rankValue(pool.sorted.hp, stats.hp),
    atk: rankValue(pool.sorted.atk, stats.atk),
    def: rankValue(pool.sorted.def, stats.def),
    spa: rankValue(pool.sorted.spa, stats.spa),
    spd: rankValue(pool.sorted.spd, stats.spd),
    spe: rankValue(pool.sorted.spe, stats.spe),
  };
  const bst = rankValue(pool.sorted.bst, bstOf(stats));

  const byPercentile = [...STAT_KEYS].sort(
    (a, b) => perStat[b].percentile - perStat[a].percentile,
  );
  const standouts = byPercentile
    .filter((k) => perStat[k].rank === "S" || perStat[k].rank === "A")
    .slice(0, 2);
  const shortfalls = [...byPercentile]
    .reverse()
    .filter((k) => perStat[k].rank === "F" || perStat[k].rank === "D")
    .slice(0, 2);

  return {
    pokedexId,
    perStat,
    bst,
    peerCount: pool.count,
    standouts,
    shortfalls,
    headline: buildHeadline(bst, standouts, shortfalls),
  };
}

export type SpeciesTierEntry = {
  pokedexId: number;
  species: string;
  /** 0 when unranked (no catalogued base stats). */
  bst: number;
  percentile: number;
  /** Null for the Unranked bucket. */
  rank: StatRank | null;
};

export type SpeciesTierBucket = {
  /** Letter band, or `unranked` for species with no catalogued base stats. */
  key: StatRank | "unranked";
  entries: SpeciesTierEntry[];
  peerCount: number;
};

let cachedTier: SpeciesTierBucket[] | null = null;

/**
 * Inverse of `baseStatRanksFor`: every Modern Emerald species bucketed by BST
 * letter (S→F), plus an explicit Unranked bucket for formes/lines with no
 * catalogued base stats. Reuses the cached `peerPool()` — no second percentile
 * implementation — so a letter here always matches the species briefing.
 */
export function speciesTierList(): SpeciesTierBucket[] {
  if (cachedTier) return cachedTier;

  const pool = peerPool();
  const byRank: Record<StatRank, SpeciesTierEntry[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    F: [],
  };
  const unranked: SpeciesTierEntry[] = [];

  for (const pokedexId of modernEmeraldNationalIds()) {
    const ref = modernEmeraldSpeciesRef(pokedexId);
    const stats = baseStatsForSpecies(pokedexId);
    if (!stats) {
      unranked.push({
        pokedexId,
        species: ref.species,
        bst: 0,
        percentile: 0,
        rank: null,
      });
      continue;
    }
    const bst = bstOf(stats);
    const result = rankValue(pool.sorted.bst, bst);
    byRank[result.rank].push({
      pokedexId,
      species: ref.species,
      bst: result.value,
      percentile: result.percentile,
      rank: result.rank,
    });
  }

  for (const rank of STAT_RANKS) {
    byRank[rank].sort((a, b) => {
      if (b.bst !== a.bst) return b.bst - a.bst;
      return a.pokedexId - b.pokedexId;
    });
  }
  unranked.sort((a, b) => a.pokedexId - b.pokedexId);

  cachedTier = [
    ...STAT_RANKS_BEST_FIRST.map((rank) => ({
      key: rank,
      entries: byRank[rank],
      peerCount: pool.count,
    })),
    {
      key: "unranked" as const,
      entries: unranked,
      peerCount: pool.count,
    },
  ];
  return cachedTier;
}
