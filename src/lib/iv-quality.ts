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
};

export type IvQualitySummary = StatQualitySummary;

const IV_PERFECT = 31;
const IV_STRONG = 25;
const IV_DUMP = 5;

const EV_PERFECT = 252;
const EV_STRONG = 200;

const BATTLE_PERFECT = 0.95;
const BATTLE_STRONG = 0.82;
const BATTLE_DUMP = 0.45;

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
): StatQualitySummary {
  if (perfect.length === 0 && strong.length === 0 && dump.length === 0) {
    return {
      perfect,
      strong,
      dump,
      headline: null,
      cracked: false,
    };
  }

  const cracked = isCrackedSpread(perfect.length, strong.length, crackedRule);

  const parts: string[] = [];
  if (perfect.length > 0) parts.push(perfectPhrase(perfect, kind));
  if (strong.length > 0 && perfect.length < 4) {
    parts.push(strongPhrase(strong, kind));
  }

  let headline = parts.join(" · ") || null;
  if (cracked && headline) {
    headline = `Cracked — ${headline}`;
  }

  return { perfect, strong, dump, headline, cracked };
}

/**
 * Summarize which IVs stand out on a specimen.
 * Pure / render-time — does not persist.
 *
 * Cracked bar is tuned for randomizer Nuzlockes (no breeding): a single 31
 * plus two strong IVs (like Snoop) counts, not only multi-perfect spreads.
 */
export function summarizeIvs(
  ivs: StatSpread | null | undefined,
): StatQualitySummary | null {
  if (!ivs) return null;

  const perfect: StatKey[] = [];
  const strong: StatKey[] = [];
  const dump: StatKey[] = [];

  for (const key of STAT_KEYS) {
    const band = classifyIv(ivs[key] ?? 0);
    if (band === "perfect") perfect.push(key);
    else if (band === "strong") strong.push(key);
    else if (band === "dump") dump.push(key);
  }

  return summarizeBands(perfect, strong, dump, "iv", {
    perfectAlone: 2,
    combo: { perfect: 1, strong: 2 },
    strongAlone: 3,
  });
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
 * True when IVs, EVs, or battle stats vs max look unusually strong.
 * Used for board-card chrome (e.g. cracked revolving border).
 */
export function specimenIsCracked(input: {
  ivs?: StatSpread | null;
  evs?: StatSpread | null;
  battle?: StatSpread | null;
  battleMax?: StatSpread | null;
}): boolean {
  return specimenCatchTier(input) === "cracked";
}

/** Randomizer catch quality for subtle board-card chrome. */
export type CatchTier = "oof" | "good" | "great" | "cracked";

const CATCH_TIER_RANK: Record<CatchTier, number> = {
  oof: 0,
  good: 1,
  great: 2,
  cracked: 3,
};

function maxCatchTier(a: CatchTier, b: CatchTier): CatchTier {
  return CATCH_TIER_RANK[a] >= CATCH_TIER_RANK[b] ? a : b;
}

/** IV-only tier (primary signal for randomizer catches). */
export function ivCatchTier(ivs: StatSpread | null | undefined): CatchTier {
  if (!ivs) return "oof";
  let perfect = 0;
  let strong = 0;
  for (const key of STAT_KEYS) {
    const band = classifyIv(ivs[key] ?? 0);
    if (band === "perfect") perfect += 1;
    else if (band === "strong") strong += 1;
  }
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
  return "oof";
}

/**
 * Board catch tier: IVs drive Good/Great/Cracked; cracked EVs or near-max
 * battle spreads can promote up to Cracked only.
 */
export function specimenCatchTier(input: {
  ivs?: StatSpread | null;
  evs?: StatSpread | null;
  battle?: StatSpread | null;
  battleMax?: StatSpread | null;
}): CatchTier {
  let tier = ivCatchTier(input.ivs);
  if (
    summarizeEvs(input.evs)?.cracked ||
    summarizeBattleStats(input.battle, input.battleMax)?.cracked
  ) {
    tier = maxCatchTier(tier, "cracked");
  }
  return tier;
}
