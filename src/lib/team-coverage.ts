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

export type CoverageTypeStatus = "covered" | "soft" | "blind";

export type CoverageGridCell = {
  draftId: string;
  defendingType: ChartType;
  mult: number;
  attackType: ChartType | null;
  viaMove: string | null;
};

export type CoverageGridRow = {
  defendingType: ChartType;
  bestMult: number;
  status: CoverageTypeStatus;
  cells: CoverageGridCell[];
  /** How many draft mons take ≥2× from this type as an attack. */
  threatenedCount: number;
};

/** Full draft × defending-type offense grid (every cell, not just team-best). */
export function coverageOffenseGrid(
  draft: readonly PokemonEntry[],
): CoverageGridRow[] {
  return TYPES.map((defendingType) => {
    const cells: CoverageGridCell[] = draft.map((mon) => {
      const hit = bestOffenseVsType(mon, defendingType);
      return {
        draftId: mon.id,
        defendingType,
        mult: hit.mult,
        attackType: hit.attackType,
        viaMove: hit.viaMove,
      };
    });
    const bestMult = cells.reduce((best, c) => Math.max(best, c.mult), 0);
    const status: CoverageTypeStatus =
      bestMult >= SE_THRESHOLD
        ? "covered"
        : bestMult > 0
          ? "soft"
          : "blind";

    let threatenedCount = 0;
    for (const mon of draft) {
      const types = resolveTypes(mon);
      if (types.length === 0) continue;
      if (attackMultiplierVs(defendingType, types) >= SE_THRESHOLD) {
        threatenedCount += 1;
      }
    }

    return {
      defendingType,
      bestMult,
      status,
      cells,
      threatenedCount,
    };
  });
}

export type CoverageOffenseTierId = "S" | "A" | "B" | "F";

export type CoverageOffenseTier = {
  /** ≥2× — squad answers this defending type. */
  S: ChartType[];
  /** 1× — only neutral pressure. */
  A: ChartType[];
  /** ½× — resisted; soft gap. */
  B: ChartType[];
  /** 0× — blind spot. */
  F: ChartType[];
};

export const COVERAGE_OFFENSE_TIER_META: ReadonlyArray<{
  id: CoverageOffenseTierId;
  label: string;
  hint: string;
}> = [
  { id: "S", label: "Super", hint: "Best hit ≥2×" },
  { id: "A", label: "Neutral", hint: "Best hit 1×" },
  { id: "B", label: "Resist", hint: "Best hit ½×" },
  { id: "F", label: "Blind", hint: "Best hit 0×" },
];

/**
 * Bucket defending types by the squad's best offensive multiplier.
 * Same thresholds as the planner coverage grid, split so 1× and ½×
 * read as separate tiers (A vs B) for a classic tier-list scan.
 */
export function coverageOffenseTiers(
  coverage: OffensiveCoverage,
): CoverageOffenseTier {
  const tiers: CoverageOffenseTier = { S: [], A: [], B: [], F: [] };
  for (const cell of coverage.cells) {
    if (cell.bestMult >= SE_THRESHOLD) tiers.S.push(cell.defendingType);
    else if (cell.bestMult >= 1) tiers.A.push(cell.defendingType);
    else if (cell.bestMult > 0) tiers.B.push(cell.defendingType);
    else tiers.F.push(cell.defendingType);
  }
  return tiers;
}

export type CoverageVerdictLabel = "Solid" | "Soft" | "Thin" | "Leaky";

export type CoverageVerdict = {
  label: CoverageVerdictLabel;
  tone: CoverageSummaryTone;
  coveredCount: number;
  softCount: number;
  blindCount: number;
  total: number;
  line: string;
  callouts: CoverageSummaryBullet[];
};

/**
 * Compact Coverage strip copy — verdict + one line + warn-only callouts.
 */
export function coverageVerdict(
  draft: readonly PokemonEntry[],
  coverage: OffensiveCoverage,
  defense: TeamDefensiveProfile,
): CoverageVerdict {
  const total = coverage.cells.length;
  if (draft.length === 0) {
    return {
      label: "Soft",
      tone: "neutral",
      coveredCount: 0,
      softCount: 0,
      blindCount: total,
      total,
      line: "Place Pokémon to score type coverage.",
      callouts: [],
    };
  }

  const coveredCount = coverage.cells.filter(
    (c) => c.bestMult >= SE_THRESHOLD,
  ).length;
  const softCount = coverage.gaps.filter((g) => g.bestMult > 0).length;
  const blindCount = coverage.gaps.filter((g) => g.bestMult === 0).length;
  const gapNames = coverage.gaps.map((g) => g.defendingType);

  let label: CoverageVerdictLabel;
  let tone: CoverageSummaryTone;
  if (coverage.gaps.length === 0) {
    label = "Solid";
    tone = "good";
  } else if (coverage.gaps.length <= 2 && blindCount === 0) {
    label = "Soft";
    tone = "neutral";
  } else if (coverage.gaps.length <= 5) {
    label = "Thin";
    tone = coverage.gaps.length >= 4 || blindCount > 0 ? "warn" : "neutral";
  } else {
    label = "Leaky";
    tone = "warn";
  }

  const line =
    coverage.gaps.length === 0
      ? `≥2× into all ${total} types.`
      : `Soft into ${gapNames.slice(0, 5).join(", ")}${gapNames.length > 5 ? "…" : ""}.`;

  const callouts: CoverageSummaryBullet[] = [];
  if (blindCount > 0) {
    callouts.push({
      text: `Blind (0×): ${coverage.gaps
        .filter((g) => g.bestMult === 0)
        .map((g) => g.defendingType)
        .join(", ")}.`,
      tone: "warn",
    });
  }
  const bigHoles = defense.sharedHoles.filter(
    (h) => h.weakCount >= 3 || h.worstMult >= 4,
  );
  for (const hole of bigHoles.slice(0, 2)) {
    callouts.push({
      text: `${hole.attackType} pressures ${hole.weakCount}/${draft.length} (${formatMatchupMult(hole.worstMult)}).`,
      tone: "warn",
    });
  }
  if (defense.teamImmunities.length > 0 && callouts.length < 3) {
    callouts.push({
      text: `Team immunities: ${defense.teamImmunities.join(", ")}.`,
      tone: "good",
    });
  }

  return {
    label,
    tone,
    coveredCount,
    softCount,
    blindCount,
    total,
    line,
    callouts: callouts.slice(0, 3),
  };
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

/** Best damaging hit (moves, else STAB) this mon can land on targetTypes. */
export function bestOffenseVsDefender(
  mon: PokemonEntry,
  targetTypes: readonly ChipType[],
): {
  mult: number;
  attackType: ChartType | null;
  viaMove: string | null;
} {
  if (targetTypes.length === 0) {
    return { mult: 0, attackType: null, viaMove: null };
  }
  let bestMult = 0;
  let bestAttack: ChartType | null = null;
  let bestMove: string | null = null;

  for (const rawMove of mon.moves) {
    const meta = lookupMoveMeta(rawMove);
    if (!meta || meta.category === "Status") continue;
    const attackType = asChartType(meta.type);
    if (!attackType) continue;
    const mult = attackMultiplierVs(attackType, targetTypes);
    if (mult > bestMult || (mult === bestMult && bestMove == null)) {
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
    } else if (mult === bestMult && bestAttack == null) {
      bestMult = mult;
      bestAttack = attackType;
      bestMove = null;
    }
  }

  return { mult: bestMult, attackType: bestAttack, viaMove: bestMove };
}

export type VsTrainerGridCell = {
  draftId: string;
  targetId: string;
  mult: number;
  attackType: ChartType | null;
  viaMove: string | null;
};

/**
 * Full draft × opponent Main offense grid (every cell, not just ≥2× tips).
 * Rows follow opponentMain order; columns follow draft order.
 */
export function vsTrainerOffenseGrid(
  draft: readonly PokemonEntry[],
  opponentMain: readonly PokemonEntry[],
): VsTrainerGridCell[][] {
  return opponentMain.map((target) =>
    draft.map((mon) => {
      const hit = bestOffenseVsDefender(mon, target.types);
      return {
        draftId: mon.id,
        targetId: target.id,
        mult: hit.mult,
        attackType: hit.attackType,
        viaMove: hit.viaMove,
      };
    }),
  );
}

export type VsTrainerTargetStatus = "answered" | "soft" | "blind";

export type VsTrainerTargetAssessment = {
  targetId: string;
  displayName: string;
  status: VsTrainerTargetStatus;
  bestOffenseMult: number;
  answerTips: DraftCoverageTip[];
  /** Best mult this opponent can land into any draft mon. */
  threatMult: number;
  threatAttackType: ChartType | null;
  /** Draft mons this opponent hits for ≥2×. */
  threatenedCount: number;
};

export type VsTrainerVerdict =
  | "favorable"
  | "even"
  | "risky"
  | "unfavorable";

export type VsTrainerMatchup = {
  targets: VsTrainerTargetAssessment[];
  answeredCount: number;
  softCount: number;
  blindCount: number;
  /** Opponents that hit ≥2 draft mons for ≥2×. */
  pressureCount: number;
  /** 0–100 type-edge score (offense answers minus threat pressure). */
  score: number;
  verdict: VsTrainerVerdict;
  verdictLabel: string;
  recommendation: string;
  bullets: CoverageSummaryBullet[];
};

function monDisplayName(mon: PokemonEntry): string {
  const nick = mon.nickname?.trim();
  return nick || mon.species;
}

function targetStatus(bestOffenseMult: number): VsTrainerTargetStatus {
  if (bestOffenseMult >= SE_THRESHOLD) return "answered";
  if (bestOffenseMult > 0) return "soft";
  return "blind";
}

/**
 * High-level draft-vs-opponent Main assessment: answers, threats, verdict.
 * Deterministic type math only (STAB + known damaging moves).
 */
export function vsTrainerMatchup(
  draft: readonly PokemonEntry[],
  opponentMain: readonly PokemonEntry[],
): VsTrainerMatchup {
  if (draft.length === 0 || opponentMain.length === 0) {
    return {
      targets: [],
      answeredCount: 0,
      softCount: 0,
      blindCount: 0,
      pressureCount: 0,
      score: 0,
      verdict: "even",
      verdictLabel: "No matchup yet",
      recommendation: "Place a planned Main and pick an opponent with Pokémon.",
      bullets: [
        {
          text: "Need both sides filled to score the matchup.",
          tone: "neutral",
        },
      ],
    };
  }

  const targets: VsTrainerTargetAssessment[] = opponentMain.map((target) => {
    const answerTips = recommendDraftCoverageTips(target.types, draft, {
      limit: 3,
      minMult: SE_THRESHOLD,
    });
    const bestFromDraft = draft.reduce(
      (best, mon) => {
        const hit = bestOffenseVsDefender(mon, target.types);
        return hit.mult > best.mult ? hit : best;
      },
      { mult: 0, attackType: null as ChartType | null, viaMove: null as string | null },
    );

    let threatMult = 0;
    let threatAttackType: ChartType | null = null;
    let threatenedCount = 0;
    for (const mon of draft) {
      const hit = bestOffenseVsDefender(target, resolveTypes(mon));
      if (hit.mult > threatMult) {
        threatMult = hit.mult;
        threatAttackType = hit.attackType;
      }
      if (hit.mult >= SE_THRESHOLD) threatenedCount += 1;
    }

    return {
      targetId: target.id,
      displayName: monDisplayName(target),
      status: targetStatus(bestFromDraft.mult),
      bestOffenseMult: bestFromDraft.mult,
      answerTips,
      threatMult,
      threatAttackType,
      threatenedCount,
    };
  });

  const answeredCount = targets.filter((t) => t.status === "answered").length;
  const softCount = targets.filter((t) => t.status === "soft").length;
  const blindCount = targets.filter((t) => t.status === "blind").length;
  const pressureCount = targets.filter((t) => t.threatenedCount >= 2).length;
  const n = targets.length;

  // Offense: full credit for ≥2× answers, partial for neutral/resisted hits.
  let offensePts = 0;
  for (const t of targets) {
    if (t.status === "answered") offensePts += 1;
    else if (t.bestOffenseMult >= 1) offensePts += 0.45;
    else if (t.bestOffenseMult > 0) offensePts += 0.2;
  }
  const offenseRatio = offensePts / n;

  // Defense pressure: shared threats and unanswered walls.
  let pressure = 0;
  for (const t of targets) {
    if (t.threatenedCount >= 3) pressure += 0.22;
    else if (t.threatenedCount === 2) pressure += 0.14;
    else if (t.threatenedCount === 1 && t.status !== "answered") pressure += 0.08;
    if (t.status === "blind") pressure += 0.12;
    else if (t.status === "soft") pressure += 0.05;
  }
  pressure = Math.min(0.55, pressure / Math.max(1, n * 0.35));

  const raw = Math.max(0, Math.min(1, offenseRatio - pressure));
  const score = Math.round(raw * 100);

  let verdict: VsTrainerVerdict;
  if (score >= 72) verdict = "favorable";
  else if (score >= 48) verdict = "even";
  else if (score >= 28) verdict = "risky";
  else verdict = "unfavorable";

  const verdictLabel =
    verdict === "favorable"
      ? "Favorable"
      : verdict === "even"
        ? "Even"
        : verdict === "risky"
          ? "Risky"
          : "Unfavorable";

  const blinds = targets.filter((t) => t.status === "blind");
  const softs = targets.filter((t) => t.status === "soft");
  const answered = targets.filter((t) => t.status === "answered");
  const topThreats = [...targets]
    .filter((t) => t.threatenedCount >= 2 || (t.threatenedCount >= 1 && t.status === "blind"))
    .sort(
      (a, b) =>
        b.threatenedCount - a.threatenedCount ||
        b.threatMult - a.threatMult ||
        a.displayName.localeCompare(b.displayName),
    );

  let recommendation: string;
  if (verdict === "favorable") {
    recommendation =
      blinds.length > 0
        ? `Type edge is yours — still watch ${blinds.map((t) => t.displayName).slice(0, 2).join(" / ")} with no ≥2× answer.`
        : "Type edge is yours — lean on the answered matchups and keep the answered cores in."
  } else if (verdict === "even") {
    recommendation =
      blinds.length > 0 || softs.length > 0
        ? `Playable, but shore up ${[...blinds, ...softs]
            .map((t) => t.displayName)
            .slice(0, 3)
            .join(", ")} before locking this six.`
        : "Playable on types — small swaps won't change much; play the strong answers carefully.";
  } else if (verdict === "risky") {
    const focus = [...blinds, ...softs].slice(0, 3).map((t) => t.displayName);
    recommendation =
      focus.length > 0
        ? `Thin type spread — prioritize answers for ${focus.join(", ")}, or expect rough trades.`
        : "Thin type spread into this board — expect rough trades unless you outplay pivots.";
  } else {
    recommendation =
      blinds.length > 0
        ? `Poor type spread — rebuild around answers for ${blinds
            .map((t) => t.displayName)
            .slice(0, 3)
            .join(", ")} or pick a different six.`
        : "Poor type spread into this board — rebuild coverage before committing.";
  }

  const bullets: CoverageSummaryBullet[] = [
    {
      text: `You answer ${answeredCount}/${n} of their Main at ≥2×${
        softCount > 0 ? ` · ${softCount} soft` : ""
      }${blindCount > 0 ? ` · ${blindCount} blind` : ""}.`,
      tone:
        answeredCount === n
          ? "good"
          : blindCount >= Math.ceil(n / 2)
            ? "warn"
            : "neutral",
    },
  ];

  if (answered.length > 0) {
    bullets.push({
      text: `Strong into ${answered
        .slice(0, 4)
        .map((t) => t.displayName)
        .join(", ")}${answered.length > 4 ? "…" : ""}.`,
      tone: "good",
    });
  }

  if (blinds.length > 0) {
    bullets.push({
      text: `No ≥2× into ${blinds.map((t) => t.displayName).join(", ")}.`,
      tone: "warn",
    });
  } else if (softs.length > 0) {
    bullets.push({
      text: `Only neutral/resisted into ${softs
        .map((t) => t.displayName)
        .join(", ")}.`,
      tone: "neutral",
    });
  }

  if (topThreats[0]) {
    const threat = topThreats[0];
    bullets.push({
      text: `${threat.displayName} pressures ${threat.threatenedCount}/${draft.length} of your draft${
        threat.threatAttackType
          ? ` (${formatMatchupMult(threat.threatMult)} ${threat.threatAttackType})`
          : ""
      }.`,
      tone:
        threat.threatenedCount >= 3 || threat.status === "blind"
          ? "warn"
          : "neutral",
    });
  } else if (pressureCount === 0) {
    bullets.push({
      text: "No opponent hits 2+ of your draft for ≥2×.",
      tone: "good",
    });
  }

  return {
    targets,
    answeredCount,
    softCount,
    blindCount,
    pressureCount,
    score,
    verdict,
    verdictLabel,
    recommendation,
    bullets: bullets.slice(0, 5),
  };
}
