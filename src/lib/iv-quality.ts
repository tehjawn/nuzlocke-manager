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

const EV_PERFECT = 252;
const EV_STRONG = 200;

const BATTLE_PERFECT = 0.95;
const BATTLE_STRONG = 0.82;
const BATTLE_DUMP = 0.45;

/**
 * Catch-tier ladder (#356): normalized weighted score by playstyle archetype.
 * Lower bands stay generous; God stays near the calibrated bar so middling
 * glass spreads (Atk 23 / Spe 26) don't clear it. Score is internal only.
 */
const CATCH_SCORE_GOD = 75;
const CATCH_SCORE_CRACKED = 65;
/** Great floor — also the trash-critical clamp ceiling (`<` this → Good max). */
const CATCH_SCORE_GREAT = 50;
const CATCH_SCORE_GOOD = 35;
const CATCH_SCORE_OOF = 15;

/** Weight ≥ this is a critical axis (trash IV soft-caps the tier). */
const CRITICAL_WEIGHT = 4;
/** Dump-weight floor: weight ≤ this uses max(iv, DUMP_FLOOR_IV) — true dumps (1) and soft dumps (2). */
const DUMP_WEIGHT_MAX = 2;
const DUMP_FLOOR_IV = 15;
const CRITICAL_TRASH_MAX = 10;
const BIG_OOF_HOT_IV = 15;
/** Any true perfect IV floors the tier at Oof (never Big oof). */
const PERFECT_IV = 31;
/** Flat bonus on the catch score per IV ≥31 (any stat). */
const PERFECT_IV_BONUS = 1;

/** @deprecated Kept for summarizeIvs legacy path without archetype. */
const LEGACY_GOD_NEAR_PERFECT_MIN = 3;

/**
 * Archetypes for catch scoring. Glass phys/spec/mixed are more specific than
 * the "Glass cannon" playstyle tag — see {@link catchArchetypeForSpecies}.
 */
export type CatchArchetype =
  | "Physical attacker"
  | "Special attacker"
  | "Mixed attacker"
  | "Physical wall"
  | "Special wall"
  | "Bulky"
  | "Slow"
  | "Fast"
  | "Balanced"
  | "Glass (physical)"
  | "Glass (special)"
  | "Glass (mixed)";

export type CatchWeightTable = Record<StatKey, number>;

/**
 * Per-archetype weights (1–5).
 *
 * True dumps (weight 1): unused Atk/SpA, Spe on walls / Slow. Soft dumps (≤2)
 * floor at 15 so trash rolls don't drag. Offense Spe sits at 3 so a Spe
 * lottery can't outweigh a middling attacking IV. Offense / Fast / Glass /
 * Balanced also get {@link bulkLiftBonus}. Walls / Bulky / Slow already lean
 * on bulk in the table. Glass bulk stays soft (2) rather than ignored (1).
 *
 * Top tiers also require {@link CATCH_PEAK_STATS} to clear floors — score alone
 * can't crown a letter when the starring IV is weak *and* the score is only
 * barely over that letter's threshold (Horsea SpA 19 stays off God).
 */
export const CATCH_ARCHETYPE_WEIGHTS: Record<
  CatchArchetype,
  CatchWeightTable
> = {
  "Physical attacker": { hp: 2, atk: 5, def: 2, spa: 1, spd: 2, spe: 3 },
  "Special attacker": { hp: 2, atk: 1, def: 2, spa: 5, spd: 2, spe: 3 },
  "Mixed attacker": { hp: 2, atk: 5, def: 2, spa: 5, spd: 2, spe: 3 },
  "Physical wall": { hp: 4, atk: 1, def: 5, spa: 1, spd: 4, spe: 1 },
  "Special wall": { hp: 4, atk: 1, def: 4, spa: 1, spd: 5, spe: 1 },
  Bulky: { hp: 5, atk: 2, def: 4, spa: 2, spd: 4, spe: 2 },
  Slow: { hp: 5, atk: 2, def: 4, spa: 2, spd: 4, spe: 1 },
  Fast: { hp: 2, atk: 3, def: 2, spa: 3, spd: 2, spe: 5 },
  Balanced: { hp: 3, atk: 3, def: 3, spa: 3, spd: 3, spe: 3 },
  "Glass (physical)": { hp: 2, atk: 5, def: 2, spa: 1, spd: 2, spe: 4 },
  "Glass (special)": { hp: 2, atk: 1, def: 2, spa: 5, spd: 2, spe: 4 },
  "Glass (mixed)": { hp: 2, atk: 4, def: 2, spa: 4, spd: 2, spe: 4 },
};

/**
 * Starring IV(s) for top-tier soft caps. Empty = score-only (Balanced).
 * God needs every peak ≥ {@link GOD_PEAK_MIN}; Cracked needs ≥ {@link CRACKED_PEAK_MIN}.
 */
const CATCH_PEAK_STATS: Record<CatchArchetype, readonly StatKey[]> = {
  "Physical attacker": ["atk"],
  "Special attacker": ["spa"],
  "Mixed attacker": ["atk", "spa"],
  "Physical wall": ["def"],
  "Special wall": ["spd"],
  Bulky: ["hp"],
  Slow: ["hp"],
  Fast: ["spe"],
  Balanced: [],
  "Glass (physical)": ["atk"],
  "Glass (special)": ["spa"],
  "Glass (mixed)": ["atk", "spa"],
};

/** Peak IV floor for God — below this, score caps at Cracked. */
const GOD_PEAK_MIN = 24;
/** Peak IV floor for Cracked — below this, score caps at Great. */
const CRACKED_PEAK_MIN = 20;
/** Peak IV floor for Great — below this, score caps at Good. */
const GREAT_PEAK_MIN = 15;
/**
 * Raw score above the tier's bypass skips that tier's peak clamp (~+5 over
 * each letter floor). Middling peaks only bite near the threshold.
 */
const GOD_PEAK_BYPASS_SCORE = 80;
const CRACKED_PEAK_BYPASS_SCORE = 70;
const GREAT_PEAK_BYPASS_SCORE = 55;

/** HP / Def / SpD — used for the offense bulk lift (not walls/TR). */
const BULK_STAT_KEYS: readonly StatKey[] = ["hp", "def", "spd"];

/**
 * Max score points added when all three bulk IVs are 31 on lift archetypes.
 * Scales linearly with how far each bulk IV sits above {@link DUMP_FLOOR_IV}.
 */
const BULK_LIFT_MAX = 6;

function archetypeUsesBulkLift(archetype: CatchArchetype): boolean {
  switch (archetype) {
    case "Physical attacker":
    case "Special attacker":
    case "Mixed attacker":
    case "Fast":
    case "Balanced":
    case "Glass (physical)":
    case "Glass (special)":
    case "Glass (mixed)":
      return true;
    default:
      return false;
  }
}

/**
 * Reward high bulk on attackers without dunking thin spreads (those stay at
 * the dump floor in the weighted average). 0 at ≤15 mean-equivalent; up to
 * {@link BULK_LIFT_MAX} at 31/31/31.
 */
function bulkLiftBonus(ivs: StatSpread): number {
  let above = 0;
  for (const key of BULK_STAT_KEYS) {
    above += Math.max(0, (ivs[key] ?? 0) - DUMP_FLOOR_IV);
  }
  const maxAbove = BULK_STAT_KEYS.length * (PERFECT_IV - DUMP_FLOOR_IV);
  if (maxAbove <= 0) return 0;
  return (above / maxAbove) * BULK_LIFT_MAX;
}

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
  if (band === "perfect") return "text-accent-2-ink";
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
   * Catch archetype from {@link catchArchetypeForSpecies}. Pass when known so
   * god/cracked flags match board chrome; omit for legacy count-based flags.
   */
  archetype?: CatchArchetype | null;
};

/**
 * Summarize which IVs stand out on a specimen.
 * Pure / render-time — does not persist.
 *
 * When `archetype` is provided, god/cracked flags match {@link ivCatchTier}
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

  const archetype = options?.archetype;
  let flags: { god?: boolean; cracked?: boolean } = {};
  if (archetype !== undefined) {
    const tier = ivCatchTier(ivs, { archetype });
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
 * Weighted points ladder (#356) when an archetype is supplied. Each playstyle
 * weights the six IVs differently (attackers care about SpA/Atk; walls care
 * about HP/defending stat). Unused Atk/SpA are the main dumps. Soft dumps (≤2)
 * floor at 15; offense archetypes get a bulk lift when HP/Def/SpD clear that
 * floor. Peak role IVs gate Cracked/God. Critical axes (weight ≥4) with IV ≤10
 * soft-cap at Good. Score stays internal.
 *
 * Thresholds: God ≥75 · Cracked ≥65 · Great ≥50 · Good ≥35 · Oof ≥15 ·
 * Big oof <15. Peak role IVs also gate Great (≥15) / Cracked (≥20) / God (≥24),
 * unless raw score clears that tier's bypass (55 / 70 / 80).
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

/** Hover tip body for the catch glyph — short name + vibe, optional score. */
export function catchTierTip(
  tier: CatchTier,
  score?: number | null,
): string {
  let tip: string;
  if (tier === "shit") {
    tip = "Big oof: I'm so sorry…";
  } else if (tier === "oof") {
    tip = "Oof: Below average — no standouts.";
  } else if (tier === "good") {
    tip = "Good: Average or better overall.";
  } else if (tier === "great") {
    tip = "Great: Solid overall for how this mon plays.";
  } else if (tier === "cracked") {
    tip = "Cracked: Strong genes where they matter.";
  } else {
    tip = "God: Incredible genes for this playstyle.";
  }
  if (score != null && Number.isFinite(score)) {
    tip = `${tip} Score ${Math.round(score)}.`;
  }
  return tip;
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
   * Playstyle archetype from {@link catchArchetypeForSpecies}.
   * - Named archetype: weighted scoring for that role.
   * - Omit / null: Balanced weights (unknown dex / species-blind fallback).
   */
  archetype?: CatchArchetype | null;
};

/** Piecewise quality of a single IV on [0, 1]. */
function ivQuality(iv: number): number {
  if (iv <= 5) return 0;
  if (iv >= 31) return 1;
  return (iv - 5) / 26;
}

/**
 * Normalized catch score for an archetype weight table, plus +1 per perfect IV
 * and an optional bulk lift for offense archetypes. Dump-weight stats (≤2) use
 * max(iv, 15) so low rolls don't drag; hot dump rolls still count above the
 * floor. Perfect bonus applies to every 31 (including dump stats) — soft caps
 * still gate the letter tier.
 */
function weightedCatchScore(
  ivs: StatSpread,
  weights: CatchWeightTable,
  options?: { bulkLift?: boolean },
): number {
  let weighted = 0;
  let totalWeight = 0;
  let perfects = 0;
  for (const key of STAT_KEYS) {
    const weight = weights[key];
    const iv = ivs[key] ?? 0;
    if (iv >= PERFECT_IV) perfects += 1;
    const effective =
      weight <= DUMP_WEIGHT_MAX ? Math.max(iv, DUMP_FLOOR_IV) : iv;
    weighted += weight * ivQuality(effective);
    totalWeight += weight;
  }
  const lift = options?.bulkLift ? bulkLiftBonus(ivs) : 0;
  if (totalWeight <= 0) return perfects * PERFECT_IV_BONUS + lift;
  return (100 * weighted) / totalWeight + perfects * PERFECT_IV_BONUS + lift;
}

function tierFromCatchScore(score: number): CatchTier {
  if (score >= CATCH_SCORE_GOD) return "god";
  if (score >= CATCH_SCORE_CRACKED) return "cracked";
  if (score >= CATCH_SCORE_GREAT) return "great";
  if (score >= CATCH_SCORE_GOOD) return "good";
  if (score >= CATCH_SCORE_OOF) return "oof";
  return "shit";
}

/**
 * Archetype-weighted catch grade: tier + score (weighted average + perfect
 * bonuses + optional bulk lift; may exceed 100 with stacked 31s).
 *
 * Soft caps may lower the tier without rewriting the raw score (tips show both):
 * 1. Critical trash — any weight ≥4 axis with IV ≤10 → at most Good
 * 2. Big oof override — every critical axis ≤10 and no IV ≥15 → shit
 * 3. Peak floors — starring role IV(s) must clear 15 / 20 / 24 for Great /
 *    Cracked / God (each skipped when raw score clears that tier's bypass)
 * 4. Perfect floor — any IV 31 → at least Oof
 *
 * Glass weight tables are only used when Glass cannon is the **primary**
 * playstyle tag; attacker+glass secondary keeps the attacker table (#356 retune).
 *
 * Feel-checks (approx):
 * - Taco Wobbuffet Bulky `31/31/25/30/24/4` → God
 * - Torkoal physical wall Def 27 / HP 29 / SpD 26 / Spe 9 → God (Spe dump)
 * - Horsea special attacker SpA 19 / Spe 31 / strong SpD → Cracked (score ~72
 *   bypasses the Cracked peak floor; still not God)
 * - Physical attacker thin bulk + hot Atk/Spe → Cracked; high bulk + Atk ≥24 → God
 * - Starmie special attacker SpA 24 / Spe 29 → God (peak gate at 24)
 * - Sneasel physical attacker Atk 23 / Spe 26 (thin bulk) → Great
 * - Dead wall + Perfect Spe → Oof (not Big oof; +1 on score)
 */
export function ivCatchGrade(
  ivs: StatSpread,
  options?: IvCatchTierOptions,
): { tier: CatchTier; score: number } {
  const archetype = options?.archetype ?? "Balanced";
  return weightedIvCatchGrade(ivs, archetype);
}

/**
 * IV catch tier (primary signal for randomizer catches).
 *
 * Takes a present spread on purpose: a missing spread is "not graded", not a
 * bad grade, and the tier is public season-wide. Callers go through
 * `catchTierFor`, which owns that null and supplies the catch archetype.
 */
export function ivCatchTier(
  ivs: StatSpread,
  options?: IvCatchTierOptions,
): CatchTier {
  return ivCatchGrade(ivs, options).tier;
}

/** Weighted catch score (may exceed 100 with stacked perfects), before soft-cap tier clamps. */
export function ivCatchScore(
  ivs: StatSpread,
  options?: IvCatchTierOptions,
): number {
  return ivCatchGrade(ivs, options).score;
}

function weightedIvCatchGrade(
  ivs: StatSpread,
  archetype: CatchArchetype,
): { tier: CatchTier; score: number } {
  const weights = CATCH_ARCHETYPE_WEIGHTS[archetype];
  const score = weightedCatchScore(ivs, weights, {
    bulkLift: archetypeUsesBulkLift(archetype),
  });

  const criticalKeys = STAT_KEYS.filter((k) => weights[k] >= CRITICAL_WEIGHT);
  let maxIv = 0;
  let hasPerfect = false;
  let criticalTrash = false;
  let allCriticalTrash = criticalKeys.length > 0;

  for (const key of STAT_KEYS) {
    const iv = ivs[key] ?? 0;
    if (iv > maxIv) maxIv = iv;
    if (iv >= PERFECT_IV) hasPerfect = true;
  }
  for (const key of criticalKeys) {
    const iv = ivs[key] ?? 0;
    if (iv <= CRITICAL_TRASH_MAX) criticalTrash = true;
    else allCriticalTrash = false;
  }

  // Big oof wins over the Good soft-cap when every critical axis is trash.
  if (allCriticalTrash && maxIv < BIG_OOF_HOT_IV) {
    return { tier: "shit", score };
  }

  let tier = tierFromCatchScore(score);
  // Critical trash → Good max (clamp anything that would be Great+).
  if (criticalTrash && score >= CATCH_SCORE_GREAT) {
    tier = "good";
  }
  // Peak role IV must show up for Great / Cracked / God — Spe lottery + bulk
  // lift shouldn't crown a mediocre starring IV. Raw scores that clearly clear
  // a letter floor (+~5) skip that letter's peak clamp.
  const peakKeys = CATCH_PEAK_STATS[archetype];
  if (peakKeys.length > 0) {
    const peakMin = Math.min(...peakKeys.map((key) => ivs[key] ?? 0));
    if (
      score <= GOD_PEAK_BYPASS_SCORE &&
      peakMin < GOD_PEAK_MIN &&
      catchTierRank(tier) > catchTierRank("cracked")
    ) {
      tier = "cracked";
    }
    if (
      score <= CRACKED_PEAK_BYPASS_SCORE &&
      peakMin < CRACKED_PEAK_MIN &&
      catchTierRank(tier) > catchTierRank("great")
    ) {
      tier = "great";
    }
    if (
      score <= GREAT_PEAK_BYPASS_SCORE &&
      peakMin < GREAT_PEAK_MIN &&
      catchTierRank(tier) > catchTierRank("good")
    ) {
      tier = "good";
    }
  }
  // A true perfect anywhere is still a lottery ticket — never Big oof.
  if (hasPerfect && catchTierRank(tier) < catchTierRank("oof")) {
    tier = "oof";
  }
  return { tier, score };
}
