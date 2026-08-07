import {
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
  type StatSpread,
} from "@/lib/stats";

/** Shared highlight band for IVs, EVs, and battle stats vs max. */
export type StatQualityBand = "perfect" | "strong" | "average" | "dump";

/** @deprecated Prefer StatQualityBand — kept for existing call sites. */
export type IvBand = StatQualityBand;

export type StatQualitySummary = {
  perfect: StatKey[];
  strong: StatKey[];
  dump: StatKey[];
  /** Compact beginner-facing line, or null when nothing stands out. */
  headline: string | null;
  /** True when the spread looks unusually strong overall. */
  cracked: boolean;
  /** True when IVs look absurd for a wild catch (subset of cracked). */
  god: boolean;
};

export type IvQualitySummary = StatQualitySummary;

const IV_PERFECT = 31;
const IV_NEAR_PERFECT = 28;
const IV_STRONG = 25;
const IV_DUMP = 5;

/** Neutral floor for filler dumps in effective-mean (walls want dump Atk/SpA). */
const FILLER_DUMP_FLOOR = 20;

const EV_PERFECT = 252;
const EV_STRONG = 200;

const BATTLE_PERFECT = 0.95;
const BATTLE_STRONG = 0.82;
const BATTLE_DUMP = 0.45;

/** Dump IVs needed (with no strong/perfect) to call a catch "big oof" (`shit`). */
const SHIT_DUMP_MIN = 4;

/**
 * Catch-tier overall floors (filler dumps floored — walls aren't punished for
 * dump Atk/SpA). Mid IV expectation is ~15.5.
 */
const ABOVE_MID_MEAN = 16;
const AMAZING_MEAN = 22;

/** @deprecated Kept for summarizeIvs legacy path without keyStats. */
const LEGACY_GOD_NEAR_PERFECT_MIN = 3;

export function classifyIv(value: number): StatQualityBand {
  if (value >= IV_PERFECT) return "perfect";
  if (value >= IV_STRONG) return "strong";
  if (value <= IV_DUMP) return "dump";
  return "average";
}

/**
 * EV investment bands. Unused (0) stats stay average — dump highlighting
 * would paint most of the grid muted.
 */
export function classifyEv(value: number): StatQualityBand {
  if (value >= EV_PERFECT) return "perfect";
  if (value >= EV_STRONG) return "strong";
  return "average";
}

/** Battle stat quality vs theoretical max at this level (31/252/boosting nature). */
export function classifyBattleStat(
  value: number,
  max: number,
): StatQualityBand {
  if (!(max > 0)) return "average";
  const pct = value / max;
  if (pct >= BATTLE_PERFECT) return "perfect";
  if (pct >= BATTLE_STRONG) return "strong";
  if (pct <= BATTLE_DUMP) return "dump";
  return "average";
}

/** Tailwind text tone matching IV / EV / battle highlight bands. */
export function qualityToneClass(band: StatQualityBand): string {
  if (band === "perfect") return "text-accent-2";
  if (band === "strong") return "text-accent-deep";
  if (band === "dump") return "text-muted";
  return "";
}

function labelList(keys: StatKey[]): string {
  return keys.map((k) => STAT_LABELS[k]).join(" · ");
}

type SummaryKind = "iv" | "ev" | "battle";

function perfectPhrase(keys: StatKey[], kind: SummaryKind): string {
  if (keys.length >= 4) {
    if (kind === "iv") return `${keys.length} perfect IVs`;
    if (kind === "ev") return `${keys.length} max EVs`;
    return `${keys.length} near-max stats`;
  }
  const word = kind === "iv" ? "Perfect" : kind === "ev" ? "Max" : "Near-max";
  return `${word} ${labelList(keys)}`;
}

function strongPhrase(keys: StatKey[], kind: SummaryKind): string {
  const word = kind === "ev" ? "High" : "Strong";
  return `${word} ${labelList(keys)}`;
}

type CrackedRule = {
  /** Perfect count alone is enough. */
  perfectAlone: number;
  /** Perfect + strong combo (e.g. 1×31 and 2×≥25). */
  combo?: { perfect: number; strong: number };
  /** Strong count alone is enough (IVs in a randomizer). */
  strongAlone?: number;
};

function isCrackedSpread(
  perfectCount: number,
  strongCount: number,
  rule: CrackedRule,
): boolean {
  if (perfectCount >= rule.perfectAlone) return true;
  if (
    rule.combo &&
    perfectCount >= rule.combo.perfect &&
    strongCount >= rule.combo.strong
  ) {
    return true;
  }
  if (rule.strongAlone != null && strongCount >= rule.strongAlone) {
    return true;
  }
  return false;
}

function summarizeBands(
  perfect: StatKey[],
  strong: StatKey[],
  dump: StatKey[],
  kind: SummaryKind,
  crackedRule: CrackedRule,
  flags: { god?: boolean; cracked?: boolean } = {},
): StatQualitySummary {
  if (perfect.length === 0 && strong.length === 0 && dump.length === 0) {
    return {
      perfect,
      strong,
      dump,
      headline: null,
      cracked: false,
      god: false,
    };
  }

  const god = kind === "iv" && Boolean(flags.god);
  const cracked =
    god ||
    (flags.cracked !== undefined
      ? flags.cracked
      : isCrackedSpread(perfect.length, strong.length, crackedRule));

  const parts: string[] = [];
  if (perfect.length > 0) parts.push(perfectPhrase(perfect, kind));
  if (strong.length > 0 && perfect.length < 4) {
    parts.push(strongPhrase(strong, kind));
  }

  let headline = parts.join(" · ") || null;
  if (god && headline) {
    headline = `God — ${headline}`;
  } else if (cracked && headline) {
    headline = `Cracked — ${headline}`;
  }

  return { perfect, strong, dump, headline, cracked, god };
}

export type SummarizeIvsOptions = {
  /**
   * Role-critical stats from playstyle. Pass {@link SpeciesKeyStats} when
   * known; omit / null for legacy count-based god/cracked flags.
   */
  keyStats?: SpeciesKeyStatsInput | null;
};

/**
 * Summarize which IVs stand out on a specimen.
 * Pure / render-time — does not persist.
 *
 * When `keyStats` is provided, god/cracked flags match {@link ivCatchTier}
 * so the details headline agrees with board chrome.
 */
export function summarizeIvs(
  ivs: StatSpread | null | undefined,
  options?: SummarizeIvsOptions,
): StatQualitySummary | null {
  if (!ivs) return null;

  const perfect: StatKey[] = [];
  const strong: StatKey[] = [];
  const dump: StatKey[] = [];

  for (const key of STAT_KEYS) {
    const value = ivs[key] ?? 0;
    const band = classifyIv(value);
    if (band === "perfect") perfect.push(key);
    else if (band === "strong") strong.push(key);
    else if (band === "dump") dump.push(key);
  }

  const keyStats = options?.keyStats;
  let flags: { god?: boolean; cracked?: boolean } = {};
  if (keyStats !== undefined) {
    const tier = ivCatchTier(ivs, { keyStats });
    flags = {
      god: tier === "god",
      cracked: catchTierRank(tier) >= catchTierRank("cracked"),
    };
  } else {
    let nearPerfect = 0;
    for (const key of STAT_KEYS) {
      if ((ivs[key] ?? 0) >= IV_NEAR_PERFECT) nearPerfect += 1;
    }
    flags = { god: nearPerfect >= LEGACY_GOD_NEAR_PERFECT_MIN };
  }

  return summarizeBands(
    perfect,
    strong,
    dump,
    "iv",
    {
      perfectAlone: 2,
      combo: { perfect: 1, strong: 2 },
      strongAlone: 3,
    },
    flags,
  );
}

/** Notable EV investments (max / near-max). */
export function summarizeEvs(
  evs: StatSpread | null | undefined,
): StatQualitySummary | null {
  if (!evs) return null;

  const perfect: StatKey[] = [];
  const strong: StatKey[] = [];

  for (const key of STAT_KEYS) {
    const band = classifyEv(evs[key] ?? 0);
    if (band === "perfect") perfect.push(key);
    else if (band === "strong") strong.push(key);
  }

  return summarizeBands(perfect, strong, [], "ev", {
    perfectAlone: 2,
    combo: { perfect: 1, strong: 1 },
  });
}

/** Notable battle stats vs theoretical max at this level. */
export function summarizeBattleStats(
  spread: StatSpread | null | undefined,
  maxSpread: StatSpread | null | undefined,
): StatQualitySummary | null {
  if (!spread || !maxSpread) return null;

  const perfect: StatKey[] = [];
  const strong: StatKey[] = [];
  const dump: StatKey[] = [];

  for (const key of STAT_KEYS) {
    const band = classifyBattleStat(spread[key] ?? 0, maxSpread[key] ?? 0);
    if (band === "perfect") perfect.push(key);
    else if (band === "strong") strong.push(key);
    else if (band === "dump") dump.push(key);
  }

  return summarizeBands(perfect, strong, dump, "battle", {
    perfectAlone: 3,
    combo: { perfect: 2, strong: 1 },
  });
}

/**
 * Randomizer catch quality for board-card chrome + details labels.
 *
 * Role-aware ladder when key stats are supplied (see {@link ivCatchTier}):
 * - shit (Big oof): mostly dump IVs / nothing redeeming
 * - oof: all mid-or-below, nothing notable
 * - good: overall above mid
 * - great: above mid + ≥1 strong role IV
 * - cracked: above mid + ≥2 strong role IVs
 * - god: amazing overall + ≥2 near-perfect role IVs
 */
/** Worst → best, so array order doubles as the tier ladder. */
export const CATCH_TIERS = [
  "shit",
  "oof",
  "good",
  "great",
  "cracked",
  "god",
] as const;

export type CatchTier = (typeof CATCH_TIERS)[number];

/** Ladder position, worst = 0. Sort keys read this rather than re-listing it. */
export function catchTierRank(tier: CatchTier): number {
  return CATCH_TIERS.indexOf(tier);
}

const CATCH_TIER_LABEL: Record<CatchTier, string | null> = {
  shit: "Big oof catch",
  oof: "Oof catch",
  good: "Good catch",
  great: "Great catch",
  cracked: "Cracked catch",
  god: "God catch",
};

/** Beginner-facing label; null only when tier chrome should stay silent. */
export function catchTierLabel(tier: CatchTier): string | null {
  return CATCH_TIER_LABEL[tier];
}

/** Hover tip body for the catch glyph — short name + vibe, no IV jargon. */
export function catchTierTip(tier: CatchTier): string {
  if (tier === "shit") {
    return "Big oof: I'm so sorry…";
  }
  if (tier === "oof") {
    return "Oof: Not even mid.";
  }
  if (tier === "good") {
    return "Good: Above mid — usable.";
  }
  if (tier === "great") {
    return "Great: A strong roll where it matters.";
  }
  if (tier === "cracked") {
    return "Cracked: Two strong rolls on-role.";
  }
  return "God: Amazing luck on the stats that count.";
}

/** Board / modal ring + sprite wash — oof stays plain. */
export function catchTierHasChrome(tier: CatchTier): boolean {
  return tier !== "oof";
}

/** Label tone class — brightness ramps with catch tier. */
export function catchTierToneClass(tier: CatchTier): string {
  return `pokemon-catch-label--${tier}`;
}

export type IvCatchTierOptions = {
  /**
   * Role-critical stats from {@link keyStatsForSpecies} in playstyle.ts.
   * - Object with primary (/ secondary): role-weighted grading.
   * - Omit / null: legacy species-blind count ladder (unknown dex).
   */
  keyStats?: SpeciesKeyStatsInput | null;
};

/** Primary (+ optional secondary) key axes — mirrors playstyle.SpeciesKeyStats. */
export type SpeciesKeyStatsInput = {
  primary: StatKey[];
  secondary?: StatKey[];
};

/** Species-blind fallback when playstyle keys are unavailable. */
function legacyIvCatchTier(ivs: StatSpread): CatchTier {
  return roleIvCatchTier(ivs, { primary: [...STAT_KEYS], secondary: [] });
}

/**
 * Role-weighted catch tier — randomizer Nuzlocke feel ladder.
 *
 * Worked feel-checks:
 * - Special glass Starmie, SpA 29 / Spe 28 / Atk 26 mid filler → god
 *   (Attack is not a role key for special glass)
 * - Skarmory wall, 31 HP / 31 Def / 28 SpD / dump Atk·SpA → god
 * - Skarmory wall, 31 Atk / 31 SpA / 31 Spe / dump Def → not god (primary dump)
 * - Physical attacker, lone 31 Atk + mid rest → great (needs 2 role hits)
 * - Physical attacker, 31 Atk + 29 Spe + solid rest (≥22 mean) → god
 * - Physical attacker, 31 Atk + 29 Spe + merely good rest → cracked (not amazing)
 * - All dumps → big oof; all mid, no strong → oof
 */
function roleIvCatchTier(
  ivs: StatSpread,
  keyStats: SpeciesKeyStatsInput,
): CatchTier {
  const balanced = keyStats.primary.length === 0;
  const primaryKeys = balanced ? [...STAT_KEYS] : keyStats.primary;
  const secondaryKeys = balanced ? [] : (keyStats.secondary ?? []);
  const primarySet = new Set<StatKey>(primaryKeys);
  const roleKeys = new Set<StatKey>([
    ...primaryKeys,
    ...secondaryKeys.filter((k) => !primarySet.has(k)),
  ]);

  let roleNear = 0;
  let roleStrong = 0;
  let hardDump = 0;
  let perfect = 0;
  let strong = 0;
  let dump = 0;
  let effectiveSum = 0;

  for (const key of STAT_KEYS) {
    const value = ivs[key] ?? 0;
    const band = classifyIv(value);
    if (band === "perfect") perfect += 1;
    else if (band === "strong") strong += 1;
    else if (band === "dump") dump += 1;

    if (roleKeys.has(key)) {
      if (value >= IV_NEAR_PERFECT) roleNear += 1;
      if (value >= IV_STRONG) roleStrong += 1;
    }

    if (primarySet.has(key)) {
      if (band === "dump") hardDump += 1;
      effectiveSum += value;
    } else {
      // Dump filler (wall offenses, unused glass axis) shouldn't sink the mean.
      effectiveSum += band === "dump" ? FILLER_DUMP_FLOOR : value;
    }
  }

  const effectiveMean = effectiveSum / STAT_KEYS.length;
  const aboveMid = effectiveMean >= ABOVE_MID_MEAN;
  const amazing = effectiveMean >= AMAZING_MEAN;
  const anyHot = perfect + strong > 0;
  const roleHot = roleStrong > 0 || roleNear > 0;

  // --- God: amazing overall + ≥2 near-perfect role IVs --------------------
  if (hardDump === 0 && amazing && roleNear >= 2) {
    return "god";
  }

  // --- Cracked: above mid + ≥2 strong role IVs ----------------------------
  if (hardDump === 0 && aboveMid && roleStrong >= 2) {
    return "cracked";
  }

  // Primary key dump caps the ceiling — off-role 31s are consolation only.
  if (hardDump > 0) {
    if (roleHot || anyHot) return "good";
    if (hardDump >= Math.ceil(primaryKeys.length / 2) || dump >= SHIT_DUMP_MIN) {
      return "shit";
    }
    return "oof";
  }

  // --- Great: above mid + ≥1 strong role IV -------------------------------
  if (aboveMid && roleStrong >= 1) {
    return "great";
  }

  // --- Good: overall above mid (or mild off-role luck) --------------------
  if (aboveMid || anyHot) {
    return "good";
  }

  // --- Big oof: mostly dumps / all very low -------------------------------
  if (dump >= SHIT_DUMP_MIN) {
    return "shit";
  }

  // --- Oof: all mid or below, nothing notable -----------------------------
  return "oof";
}

/**
 * IV catch tier (primary signal for randomizer catches).
 *
 * Takes a present spread on purpose: a missing spread is "not graded", not a
 * bad grade, and the tier is public season-wide. Callers go through
 * `catchTierFor`, which owns that null and supplies role key stats.
 */
export function ivCatchTier(
  ivs: StatSpread,
  options?: IvCatchTierOptions,
): CatchTier {
  const keyStats = options?.keyStats;
  if (keyStats == null) return legacyIvCatchTier(ivs);
  return roleIvCatchTier(ivs, keyStats);
}
