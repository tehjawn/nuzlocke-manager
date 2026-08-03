/**
 * Team-level type coverage helpers for the Team Planner tool.
 * Built on type-matchups — STAB first, then known damaging moves when present.
 */

import type { PokemonEntry } from "@/lib/challenge-types";
import { lookupMoveMeta } from "@/lib/move-meta";
import type { PokemonType as ChipType } from "@/lib/pokemon-types";
import {
  attackMultiplierVs,
  defensiveMatchups,
  formatMatchupMult,
  type DefensiveMatchups,
  type MatchupMult,
} from "@/lib/type-matchups";
import { TYPES, type PokemonType as ChartType } from "@/lib/type-chart";

export type OffensiveCoverageCell = {
  defendingType: ChartType;
  /** Best multiplier any draft mon can land on this mono-type. */
  bestMult: number;
  /** Attack type that achieves bestMult (STAB or move). */
  attackType: ChartType | null;
  /** Which draft mon contributes the best hit. */
  viaEntryId: string | null;
  /** Move name when the best hit comes from a stored move; null = STAB typing. */
  viaMove: string | null;
};

export type OffensiveCoverage = {
  cells: OffensiveCoverageCell[];
  /** Defending types where bestMult < SE_THRESHOLD (default 2). */
  gaps: OffensiveCoverageCell[];
};

export type SharedDefensiveHole = {
  attackType: ChartType;
  /** Worst (highest) incoming mult among draft mons for this attack type. */
  worstMult: MatchupMult;
  /** How many draft mons take ≥2× from this attack type. */
  weakCount: number;
  /** Entry ids of mons weak (≥2×) to this attack. */
  weakEntryIds: string[];
};

export type TeamDefensiveProfile = {
  /** Per-mon defensive buckets (for detail UI). */
  perMon: Array<{ entryId: string; matchups: DefensiveMatchups }>;
  /** Attack types that hit ≥2 draft mons for ≥2× (shared holes). */
  sharedHoles: SharedDefensiveHole[];
  /** Attack types the whole team is immune to (every mon has 0×). */
  teamImmunities: ChartType[];
};

const SE_THRESHOLD = 2;

function asChartType(type: string): ChartType | null {
  return (TYPES as readonly string[]).includes(type)
    ? (type as ChartType)
    : null;
}

function resolveTypes(mon: PokemonEntry): ChipType[] {
  return mon.types.filter((t) => asChartType(t) != null);
}

/**
 * Best offensive multiplier this mon can land on a mono-type defender,
 * preferring stored damaging moves, falling back to STAB typing.
 */
export function bestOffenseVsType(
  mon: PokemonEntry,
  defendingType: ChartType,
): {
  mult: number;
  attackType: ChartType | null;
  viaMove: string | null;
} {
  const defenders: ChipType[] = [defendingType];
  let bestMult = 0;
  let bestAttack: ChartType | null = null;
  let bestMove: string | null = null;

  for (const rawMove of mon.moves) {
    const meta = lookupMoveMeta(rawMove);
    if (!meta || meta.category === "Status") continue;
    const attackType = asChartType(meta.type);
    if (!attackType) continue;
    const mult = attackMultiplierVs(attackType, defenders);
    if (
      mult > bestMult ||
      (mult === bestMult && bestMove == null)
    ) {
      bestMult = mult;
      bestAttack = attackType;
      bestMove = meta.name;
    }
  }

  for (const t of resolveTypes(mon)) {
    const attackType = asChartType(t);
    if (!attackType) continue;
    const mult = attackMultiplierVs(attackType, defenders);
    // Prefer an equal STAB hit over a move only when no move found yet,
    // or when STAB beats the best move.
    if (mult > bestMult) {
      bestMult = mult;
      bestAttack = attackType;
      bestMove = null;
    } else if (mult === bestMult && bestAttack == null) {
      bestMult = mult;
      bestAttack = attackType;
      bestMove = null;
    }
  }

  return { mult: bestMult, attackType: bestAttack, viaMove: bestMove };
}

/** Offensive coverage grid + gap list for a planned Main of up to 6. */
export function offensiveCoverage(
  draft: readonly PokemonEntry[],
  options?: { seThreshold?: number },
): OffensiveCoverage {
  const threshold = options?.seThreshold ?? SE_THRESHOLD;
  const cells: OffensiveCoverageCell[] = [];

  for (const defendingType of TYPES) {
    let best: OffensiveCoverageCell = {
      defendingType,
      bestMult: 0,
      attackType: null,
      viaEntryId: null,
      viaMove: null,
    };

    for (const mon of draft) {
      const hit = bestOffenseVsType(mon, defendingType);
      if (hit.mult > best.bestMult) {
        best = {
          defendingType,
          bestMult: hit.mult,
          attackType: hit.attackType,
          viaEntryId: mon.id,
          viaMove: hit.viaMove,
        };
      }
    }

    cells.push(best);
  }

  return {
    cells,
    gaps: cells.filter((c) => c.bestMult < threshold),
  };
}

/** Shared defensive weaknesses across the draft party. */
export function teamDefensiveProfile(
  draft: readonly PokemonEntry[],
): TeamDefensiveProfile {
  const perMon = draft.map((mon) => ({
    entryId: mon.id,
    matchups: defensiveMatchups(resolveTypes(mon)),
  }));

  const sharedHoles: SharedDefensiveHole[] = [];
  const teamImmunities: ChartType[] = [];

  for (const attackType of TYPES) {
    const weakEntryIds: string[] = [];
    let worstMult: MatchupMult = 0;
    let immuneCount = 0;

    for (const mon of draft) {
      const types = resolveTypes(mon);
      if (types.length === 0) continue;
      const raw = attackMultiplierVs(attackType, types);
      const bucket: MatchupMult =
        raw === 0
          ? 0
          : raw >= 4
            ? 4
            : raw >= 2
              ? 2
              : raw >= 1
                ? 1
                : raw >= 0.5
                  ? 0.5
                  : 0.25;
      if (bucket === 0) immuneCount += 1;
      if (bucket >= 2) {
        weakEntryIds.push(mon.id);
        if (bucket > worstMult) worstMult = bucket;
      }
    }

    if (draft.length > 0 && immuneCount === draft.length) {
      teamImmunities.push(attackType);
    }

    if (weakEntryIds.length >= 2) {
      sharedHoles.push({
        attackType,
        worstMult: worstMult >= 2 ? worstMult : 2,
        weakCount: weakEntryIds.length,
        weakEntryIds,
      });
    }
  }

  sharedHoles.sort(
    (a, b) =>
      b.weakCount - a.weakCount ||
      b.worstMult - a.worstMult ||
      a.attackType.localeCompare(b.attackType),
  );

  return { perMon, sharedHoles, teamImmunities };
}

export type CoverageSummaryTone = "good" | "warn" | "neutral";

export type CoverageSummaryBullet = {
  text: string;
  tone: CoverageSummaryTone;
};

/**
 * Short deterministic TLDR bullets from coverage + defense math.
 * No LLM — safe to call on every draft change.
 */
export function teamCoverageSummary(
  draft: readonly PokemonEntry[],
  coverage: OffensiveCoverage,
  defense: TeamDefensiveProfile,
): CoverageSummaryBullet[] {
  if (draft.length === 0) {
    return [
      {
        text: "Empty team — place Pokémon to score coverage.",
        tone: "neutral",
      },
    ];
  }

  const bullets: CoverageSummaryBullet[] = [];
  const covered = coverage.cells.filter((c) => c.bestMult >= SE_THRESHOLD).length;
  const total = coverage.cells.length;
  const gapNames = coverage.gaps.map((g) => g.defendingType);

  if (coverage.gaps.length === 0) {
    bullets.push({
      text: `Offensive coverage looks solid — ≥2× into all ${total} types.`,
      tone: "good",
    });
  } else {
    bullets.push({
      text: `${covered}/${total} types covered at ≥2×. Soft into ${gapNames.slice(0, 4).join(", ")}${gapNames.length > 4 ? "…" : ""}.`,
      tone: coverage.gaps.length >= 4 ? "warn" : "neutral",
    });
  }

  const typeCounts = new Map<string, number>();
  for (const mon of draft) {
    for (const t of resolveTypes(mon)) {
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
  }
  const lean = [...typeCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  if (lean.length > 0) {
    bullets.push({
      text: `Typing leans ${lean.map(([t, n]) => `${t} (×${n})`).join(", ")}.`,
      tone: "neutral",
    });
  } else {
    bullets.push({
      text: "Typing is diverse — no repeated type across the six.",
      tone: "good",
    });
  }

  const topHole = defense.sharedHoles[0];
  if (topHole) {
    bullets.push({
      text: `Biggest shared hole: ${topHole.attackType} ${formatMatchupMult(topHole.worstMult)} hits ${topHole.weakCount}/${draft.length}.`,
      tone: topHole.weakCount >= 3 || topHole.worstMult >= 4 ? "warn" : "neutral",
    });
  } else {
    bullets.push({
      text: "No shared ≥2× defensive holes across the draft.",
      tone: "good",
    });
  }

  if (defense.teamImmunities.length > 0) {
    bullets.push({
      text: `Whole-team immunities: ${defense.teamImmunities.join(", ")}.`,
      tone: "good",
    });
  }

  const softGaps = coverage.gaps.filter((g) => g.bestMult === 0);
  if (softGaps.length > 0) {
    bullets.push({
      text: `Blind spots (0×): ${softGaps.map((g) => g.defendingType).join(", ")}.`,
      tone: "warn",
    });
  }

  return bullets.slice(0, 5);
}

export { formatMatchupMult };

export type DraftCoverageTip = {
  entryId: string;
  displayName: string;
  attackType: ChartType;
  mult: number;
  viaMove: string | null;
  reason: string;
};

/**
 * Rank draft mons that hit targetTypes for ≥ minMult.
 * Prefers stored damaging moves; falls back to STAB typing.
 */
export function recommendDraftCoverageTips(
  targetTypes: readonly ChipType[],
  draft: readonly PokemonEntry[],
  options?: { limit?: number; minMult?: number },
): DraftCoverageTip[] {
  if (targetTypes.length === 0 || draft.length === 0) return [];
  const limit = Math.max(1, options?.limit ?? 3);
  const minMult = options?.minMult ?? 2;
  const tips: DraftCoverageTip[] = [];

  for (const mon of draft) {
    let bestMult = 0;
    let bestAttack: ChartType | null = null;
    let bestMove: string | null = null;

    for (const rawMove of mon.moves) {
      const meta = lookupMoveMeta(rawMove);
      if (!meta || meta.category === "Status") continue;
      const attackType = asChartType(meta.type);
      if (!attackType) continue;
      const mult = attackMultiplierVs(attackType, targetTypes);
      if (mult > bestMult) {
        bestMult = mult;
        bestAttack = attackType;
        bestMove = meta.name;
      }
    }

    for (const t of resolveTypes(mon)) {
      const attackType = asChartType(t);
      if (!attackType) continue;
      const mult = attackMultiplierVs(attackType, targetTypes);
      if (mult > bestMult) {
        bestMult = mult;
        bestAttack = attackType;
        bestMove = null;
      }
    }

    if (!bestAttack || bestMult < minMult) continue;
    const nick = mon.nickname?.trim();
    const displayName = nick || mon.species;
    tips.push({
      entryId: mon.id,
      displayName,
      attackType: bestAttack,
      mult: bestMult,
      viaMove: bestMove,
      reason: bestMove
        ? `${formatMatchupMult(bestMult)} ${bestAttack} via ${bestMove}`
        : `${formatMatchupMult(bestMult)} ${bestAttack} STAB`,
    });
  }

  tips.sort(
    (a, b) =>
      b.mult - a.mult ||
      a.displayName.localeCompare(b.displayName) ||
      a.entryId.localeCompare(b.entryId),
  );
  return tips.slice(0, limit);
}
