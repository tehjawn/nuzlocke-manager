import {
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
  type StatSpread,
} from "@/lib/stats";

/** Band for a single IV value (0–31). */
export type IvBand = "perfect" | "strong" | "average" | "dump";

export type IvQualitySummary = {
  perfect: StatKey[];
  strong: StatKey[];
  dump: StatKey[];
  /** Compact beginner-facing line, or null when nothing stands out. */
  headline: string | null;
  /** True when the spread looks unusually strong overall. */
  cracked: boolean;
};

const PERFECT = 31;
const STRONG = 25;
const DUMP = 5;

export function classifyIv(value: number): IvBand {
  if (value >= PERFECT) return "perfect";
  if (value >= STRONG) return "strong";
  if (value <= DUMP) return "dump";
  return "average";
}

function labelList(keys: StatKey[]): string {
  return keys.map((k) => STAT_LABELS[k]).join(" · ");
}

/**
 * Summarize which IVs stand out on a specimen.
 * Pure / render-time — does not persist.
 */
export function summarizeIvs(
  ivs: StatSpread | null | undefined,
): IvQualitySummary | null {
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

  if (perfect.length === 0 && strong.length === 0 && dump.length === 0) {
    return {
      perfect,
      strong,
      dump,
      headline: null,
      cracked: false,
    };
  }

  const cracked = perfect.length >= 3 || (perfect.length >= 2 && strong.length >= 1);

  const parts: string[] = [];
  if (perfect.length > 0) {
    parts.push(
      perfect.length >= 4
        ? `${perfect.length} perfect IVs`
        : `Perfect ${labelList(perfect)}`,
    );
  }
  if (strong.length > 0 && perfect.length < 4) {
    parts.push(`Strong ${labelList(strong)}`);
  }

  let headline = parts.join(" · ") || null;
  if (cracked && headline && !headline.toLowerCase().includes("perfect iv")) {
    headline = `Cracked — ${headline}`;
  } else if (cracked && perfect.length >= 4) {
    headline = `Cracked — ${perfect.length} perfect IVs`;
  }

  return { perfect, strong, dump, headline, cracked };
}
