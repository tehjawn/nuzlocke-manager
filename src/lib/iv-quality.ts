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
 * Catch-tier ladder (randomizer Nuzlocke feel) — slightly soft bars so mid-lucky
 * wild rolls still feel good.
 *
 * Overall floors use the **median** IV (not the mean) so a single dump stat
 * doesn't drag a otherwise-strong spread down. Each of God / Cracked has a
 * primary path and OR paths. Great stays single-path. Primary-key dumps still
 * block top tiers.
 */
const GOD_MEAN = 20;
const GOD_ROLE_IV = 27;
const GOD_ROLE_HITS = 2;
/** OR: stacked overall with solid (not near-perfect) role hits. */
const GOD_OR_MEAN = 23;
const GOD_OR_ROLE_IV = 23;
/**
 * OR: incredible overall + one near-perfect role IV + another hot IV anywhere
 * (covers Fast mons that rolled Spe + off-role heat instead of Atk/SpA).
 */
const GOD_BREADTH_MEAN = 23;
const GOD_BREADTH_ROLE_IV = 27;
const GOD_BREADTH_OTHER_IV = 25;
/** OR: raw wild luck — three near-perfects anywhere with a usable median. */
const GOD_LUCK_MEAN = 20;
const GOD_LUCK_NEAR_IV = 27;
const GOD_LUCK_NEAR_HITS = 3;

const CRACKED_MEAN = 19;
const CRACKED_ROLE_IV = 25;
/** OR: strong overall with one decent role hit. */
const CRACKED_OR_MEAN = 21;
const CRACKED_OR_ROLE_IV = 21;

const GREAT_MEAN = 17;
const GREAT_ROLE_IV = 23;

const GOOD_MEAN = 13;

const BIG_OOF_MEAN = 9;
const BIG_OOF_MAX_IV = 13;

/** Median of the six IVs — dump outliers don't sink the overall floor. */
function ivMedian(ivs: StatSpread): number {
  const values = STAT_KEYS.map((k) => ivs[k] ?? 0).sort((a, b) => a - b);
  // Six stats → average of the two middle values.
  return (values[2]! + values[3]!) / 2;
}

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
 * Role-aware ladder when key stats are supplied (see {@link ivCatchTier}).
 * Overall floors use IV **median** (not mean):
 * - god: (median ≥20 + ≥2 role ≥27) OR (median ≥23 + ≥2 role ≥23)
 *        OR (median ≥23 + ≥1 role ≥27 + ≥1 other IV ≥25)
 *        OR (median ≥20 + ≥3 IVs ≥27 anywhere)
 * - cracked: (median ≥19 + ≥1 role ≥25) OR (median ≥21 + ≥1 role ≥21)
 * - great: median ≥17 + ≥1 role ≥23
 * - good: median ≥13
 * - oof: below good, not abysmal
 * - shit (Big oof): median <9 and no IV ≥13
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
    return "Oof: Below average — no standouts.";
  }
  if (tier === "good") {
    return "Good: Average or better overall.";
  }
  if (tier === "great") {
    return "Great: Solid overall with a strong role IV.";
  }
  if (tier === "cracked") {
    return "Cracked: Strong overall with a near-perfect role IV.";
  }
  return "God: Incredible overall with role IVs nearly perfect.";
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
 * Role-weighted catch tier — eval order God → Cracked → Great → Good → Big oof → Oof.
 *
 * Worked feel-checks:
 * - Special glass Starmie, SpA 29 / Spe 28 → god (primary path)
 * - Fast Weedle, Spe 30 / Def 30 / SpA 28 → god (breadth OR)
 * - Physical Graveler, Atk 31 / Def 29 / dump Spe·SpA → god
 *   (bulky phys soft-key Def + median ≥20 primary path)
 * - Physical Annihilape, Atk 29 / SpD 31 / Def 7 / median 24 → god (breadth OR)
 * - Median ≥23 with three IVs ≥27 anywhere → god (raw-luck OR)
 * - Skarmory wall, 31 HP / 31 Def / dump Atk·SpA → god
 * - Flat mid teens → good; median <9 with nothing ≥13 → big oof
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

  let roleGod = 0;
  let roleGodOr = 0;
  let roleCracked = 0;
  let roleCrackedOr = 0;
  let roleGreat = 0;
  let roleBreadthNear = 0;
  let breadthHot = 0;
  let nearAnywhere = 0;
  let hardDump = 0;
  let maxIv = 0;

  for (const key of STAT_KEYS) {
    const value = ivs[key] ?? 0;
    const band = classifyIv(value);
    if (value > maxIv) maxIv = value;

    if (value >= GOD_BREADTH_OTHER_IV) breadthHot += 1;
    if (value >= GOD_LUCK_NEAR_IV) nearAnywhere += 1;

    if (roleKeys.has(key)) {
      if (value >= GOD_ROLE_IV) roleGod += 1;
      if (value >= GOD_OR_ROLE_IV) roleGodOr += 1;
      if (value >= CRACKED_ROLE_IV) roleCracked += 1;
      if (value >= CRACKED_OR_ROLE_IV) roleCrackedOr += 1;
      if (value >= GREAT_ROLE_IV) roleGreat += 1;
      if (value >= GOD_BREADTH_ROLE_IV) roleBreadthNear += 1;
    }

    if (primarySet.has(key) && band === "dump") {
      hardDump += 1;
    }
  }

  const overall = ivMedian(ivs);
  const isBigOof = overall < BIG_OOF_MEAN && maxIv < BIG_OOF_MAX_IV;
  const godBreadth =
    overall >= GOD_BREADTH_MEAN &&
    roleBreadthNear >= 1 &&
    breadthHot >= 2;
  const godLuck =
    overall >= GOD_LUCK_MEAN && nearAnywhere >= GOD_LUCK_NEAR_HITS;

  // Primary key dump caps the ceiling — off-role luck is consolation only.
  if (hardDump > 0) {
    if (isBigOof) return "shit";
    if (overall >= GOOD_MEAN || maxIv >= GREAT_ROLE_IV) return "good";
    return "oof";
  }

  // --- God (primary || role-OR || breadth-OR || luck-OR) -------------------
  if (
    (overall >= GOD_MEAN && roleGod >= GOD_ROLE_HITS) ||
    (overall >= GOD_OR_MEAN && roleGodOr >= GOD_ROLE_HITS) ||
    godBreadth ||
    godLuck
  ) {
    return "god";
  }

  // --- Cracked (primary || OR) ---------------------------------------------
  if (
    (overall >= CRACKED_MEAN && roleCracked >= 1) ||
    (overall >= CRACKED_OR_MEAN && roleCrackedOr >= 1)
  ) {
    return "cracked";
  }

  // --- Great (single path) -------------------------------------------------
  if (overall >= GREAT_MEAN && roleGreat >= 1) {
    return "great";
  }

  // --- Good ----------------------------------------------------------------
  if (overall >= GOOD_MEAN) {
    return "good";
  }

  // --- Big oof / Oof -------------------------------------------------------
  if (isBigOof) return "shit";
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
