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

/** Legacy god bar when no role keys are available (unknown species). */
const LEGACY_GOD_NEAR_PERFECT_MIN = 3;

/** Effective-mean floors for top tiers (filler dumps floored, not punished). */
const GOD_EFFECTIVE_MEAN_MIN = 22;
const GOD_SINGLE_KEY_MEAN_MIN = 20;
const CRACKED_EFFECTIVE_MEAN_MIN = 19;
/** Balanced (all-six) god needs a higher bar — 6× near-perfect is brutal. */
const BALANCED_GOD_NEAR_PERFECT_MIN = 4;
const BALANCED_GOD_MEAN_MIN = 24;

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
 * Role-aware when key stats are supplied (see {@link ivCatchTier}):
 * - shit (label: Big oof): mostly dump IVs / key-stat dumps
 * - oof: below average / nothing notable (no chrome)
 * - good / great: something useful where it matters (or mild off-role luck)
 * - cracked / god: key stats excellent + respectable effective spread
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
    return "Good: Not all bad!";
  }
  if (tier === "great") {
    return "Great: Pretty decent!";
  }
  if (tier === "cracked") {
    return "Cracked: A rare find.";
  }
  return "God: Born under a lucky star~";
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

type IvBands = {
  perfect: number;
  strong: number;
  dump: number;
  nearPerfect: number;
};

function countIvBands(ivs: StatSpread): IvBands {
  let perfect = 0;
  let strong = 0;
  let dump = 0;
  let nearPerfect = 0;
  for (const key of STAT_KEYS) {
    const value = ivs[key] ?? 0;
    if (value >= IV_NEAR_PERFECT) nearPerfect += 1;
    const band = classifyIv(value);
    if (band === "perfect") perfect += 1;
    else if (band === "strong") strong += 1;
    else if (band === "dump") dump += 1;
  }
  return { perfect, strong, dump, nearPerfect };
}

/** Species-blind fallback when playstyle keys are unavailable. */
function legacyIvCatchTier(ivs: StatSpread): CatchTier {
  const { perfect, strong, dump, nearPerfect } = countIvBands(ivs);
  if (nearPerfect >= LEGACY_GOD_NEAR_PERFECT_MIN) return "god";
  if (
    isCrackedSpread(perfect, strong, {
      perfectAlone: 2,
      combo: { perfect: 1, strong: 2 },
      strongAlone: 3,
    })
  ) {
    return "cracked";
  }
  if ((perfect >= 1 && strong >= 1) || strong >= 2) return "great";
  if (perfect >= 1 || strong >= 1) return "good";
  if (dump >= SHIT_DUMP_MIN) return "shit";
  return "oof";
}

/**
 * Role-weighted catch tier.
 *
 * Worked feel-checks (see #342):
 * - Skarmory wall, 31 HP / 31 Def / 28 SpD / dump Atk·SpA → god (filler dumps OK)
 * - Skarmory wall, 31 Atk / 31 SpA / 31 Spe / dump Def → not god (primary key dump)
 * - Special attacker + glass secondary, dump Atk / 31 SpA·Spe → still cracked/god OK
 * - Physical attacker, lone 31 Atk + mid rest → great, not god (needs breadth)
 * - Physical attacker, 31 Atk + two other ≥28 + solid rest → god
 */
function roleIvCatchTier(
  ivs: StatSpread,
  keyStats: SpeciesKeyStatsInput,
): CatchTier {
  const balanced = keyStats.primary.length === 0;
  const primaryKeys = balanced ? [...STAT_KEYS] : keyStats.primary;
  const secondaryKeys = balanced ? [] : (keyStats.secondary ?? []);
  const primarySet = new Set<StatKey>(primaryKeys);
  const secondarySet = new Set<StatKey>(
    secondaryKeys.filter((k) => !primarySet.has(k)),
  );
  const keyCount = primaryKeys.length;

  let keyNear = 0;
  let keyStrong = 0;
  let keyDump = 0;
  let perfect = 0;
  let strong = 0;
  let dump = 0;
  let nearPerfect = 0;
  let usefulNear = 0;
  let usefulStrong = 0;
  let effectiveSum = 0;

  for (const key of STAT_KEYS) {
    const value = ivs[key] ?? 0;
    const band = classifyIv(value);
    if (value >= IV_NEAR_PERFECT) nearPerfect += 1;
    if (band === "perfect") perfect += 1;
    else if (band === "strong") strong += 1;
    else if (band === "dump") dump += 1;

    if (primarySet.has(key)) {
      if (value >= IV_NEAR_PERFECT) keyNear += 1;
      if (value >= IV_STRONG) keyStrong += 1;
      if (band === "dump") keyDump += 1;
      effectiveSum += value;
    } else if (secondarySet.has(key)) {
      if (value >= IV_NEAR_PERFECT) usefulNear += 1;
      if (value >= IV_STRONG) usefulStrong += 1;
      // Dump secondary (e.g. Atk on a special attacker) shouldn't sink the mean.
      effectiveSum += band === "dump" ? FILLER_DUMP_FLOOR : value;
    } else {
      // Dump offenses on a wall are correct — don't sink the mean.
      effectiveSum += band === "dump" ? FILLER_DUMP_FLOOR : value;
    }
  }

  const effectiveMean = effectiveSum / STAT_KEYS.length;
  const allKeysNear = keyNear === keyCount;
  const allKeysStrong = keyStrong === keyCount;
  const breadthNear = nearPerfect;
  const breadthStrong = perfect + strong;

  // --- God -----------------------------------------------------------------
  if (keyDump === 0) {
    if (balanced) {
      if (
        nearPerfect >= BALANCED_GOD_NEAR_PERFECT_MIN &&
        dump === 0 &&
        effectiveMean >= BALANCED_GOD_MEAN_MIN
      ) {
        return "god";
      }
    } else if (allKeysNear) {
      // Multi-key roles: excellent keys + respectable effective mean.
      if (keyCount >= 2 && effectiveMean >= GOD_EFFECTIVE_MEAN_MIN) {
        return "god";
      }
      // Single-key roles need a useful secondary or raw breadth so one
      // perfect Attack with mid garbage isn't auto-god.
      if (
        keyCount === 1 &&
        effectiveMean >= GOD_SINGLE_KEY_MEAN_MIN &&
        (usefulNear >= 1 ||
          breadthNear >= 3 ||
          (keyNear >= 1 && breadthStrong >= 3))
      ) {
        return "god";
      }
    }
  }

  // --- Cracked -------------------------------------------------------------
  if (keyDump === 0) {
    if (balanced) {
      if (
        isCrackedSpread(perfect, strong, {
          perfectAlone: 2,
          combo: { perfect: 1, strong: 2 },
          strongAlone: 3,
        }) &&
        effectiveMean >= CRACKED_EFFECTIVE_MEAN_MIN
      ) {
        return "cracked";
      }
    } else if (allKeysStrong && effectiveMean >= CRACKED_EFFECTIVE_MEAN_MIN) {
      if (
        keyCount >= 2 ||
        (keyNear >= 1 && breadthStrong >= 2) ||
        (keyNear >= 1 && usefulStrong >= 1)
      ) {
        return "cracked";
      }
    } else if (
      keyNear >= Math.ceil(keyCount * 0.67) &&
      allKeysStrong &&
      effectiveMean >= CRACKED_EFFECTIVE_MEAN_MIN - 1
    ) {
      return "cracked";
    }
  }

  // Primary key dump caps the ceiling — off-role 31s are consolation only.
  if (keyDump > 0) {
    if (keyNear >= 1 || keyStrong >= 1) return "good";
    if (perfect >= 1 || strong >= 1) return "good";
    if (keyDump >= Math.ceil(keyCount / 2) || dump >= SHIT_DUMP_MIN) {
      return "shit";
    }
    return "oof";
  }

  // --- Great / good --------------------------------------------------------
  if (keyNear >= 1 || (keyStrong >= Math.ceil(keyCount / 2) && keyCount > 0)) {
    return "great";
  }
  if ((perfect >= 1 && strong >= 1) || strong >= 2) return "great";
  if (keyStrong >= 1 || perfect >= 1 || strong >= 1) return "good";

  if (dump >= SHIT_DUMP_MIN) return "shit";
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
