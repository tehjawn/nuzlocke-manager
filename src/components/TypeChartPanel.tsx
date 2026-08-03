"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { TrainerProfile } from "@/lib/challenge-types";
import { contrastInkForHex } from "@/lib/pokemon-types";
import {
  formatMatchupMult,
  offensiveCoverage,
  teamCoverageSummary,
  teamDefensiveProfile,
  type OffensiveCoverageCell,
  type SharedDefensiveHole,
} from "@/lib/team-coverage";
import { toolsHref } from "@/lib/tools-routes";
import {
  formatMultiplier,
  TYPE_COLORS,
  typeMultiplier,
  TYPES,
  type PokemonType,
} from "@/lib/type-chart";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";

const LEGEND: Array<{
  label: string;
  multiplier: 0 | 0.5 | 1 | 2;
  swatch: string;
}> = [
  { label: "Neutral", multiplier: 1, swatch: "·" },
  { label: "Resist", multiplier: 0.5, swatch: "½" },
  { label: "Super", multiplier: 2, swatch: "2" },
  { label: "Immune", multiplier: 0, swatch: "0" },
];

type ChartHover = {
  atk: PokemonType | null;
  def: PokemonType | null;
};

function sameTarget(a: ChartHover | null, b: ChartHover): boolean {
  return a != null && a.atk === b.atk && a.def === b.def;
}

type TypeChartPanelProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
};

/**
 * Inline type-chart table for the Tools tab. Reference chart by default;
 * picking a trainer overlays their live Main Squad's coverage (reusing
 * Team Planner's team-coverage.ts — no separate coverage math here) and
 * pins highlighting via tap/keyboard, not just desktop hover.
 */
export function TypeChartPanel({
  slug,
  trainers,
  myTrainerId = null,
}: TypeChartPanelProps) {
  const [hover, setHover] = useState<ChartHover | null>(null);
  const [pinned, setPinned] = useState<ChartHover | null>(null);
  const [viewerId, setViewerId] = useState(() => myTrainerId ?? "");

  // Pinned (tap/keyboard) wins over transient hover so touch users get the
  // same scanning behavior desktop mouse-hover always had.
  const active = pinned ?? hover;
  const scanning = active != null;

  const viewer = trainers.find((t) => t.id === viewerId) ?? null;
  const mainSquad = useMemo(
    () => (viewer ? pokemonInSlot(viewer, "MAIN") : []),
    [viewer],
  );

  const coverage = useMemo(
    () => (mainSquad.length > 0 ? offensiveCoverage(mainSquad) : null),
    [mainSquad],
  );
  const defense = useMemo(
    () => (mainSquad.length > 0 ? teamDefensiveProfile(mainSquad) : null),
    [mainSquad],
  );
  const summary = useMemo(
    () =>
      coverage && defense
        ? teamCoverageSummary(mainSquad, coverage, defense)
        : [],
    [mainSquad, coverage, defense],
  );

  const coverageByType = useMemo(() => {
    const map = new Map<PokemonType, OffensiveCoverageCell>();
    if (!coverage) return map;
    for (const cell of coverage.cells) map.set(cell.defendingType, cell);
    return map;
  }, [coverage]);

  const sharedHoleByType = useMemo(() => {
    const map = new Map<PokemonType, SharedDefensiveHole>();
    if (!defense) return map;
    for (const hole of defense.sharedHoles) map.set(hole.attackType, hole);
    return map;
  }, [defense]);

  const immuneTypes = useMemo(
    () => new Set(defense?.teamImmunities ?? []),
    [defense],
  );

  function togglePin(next: ChartHover) {
    setPinned((prev) => (sameTarget(prev, next) ? null : next));
  }

  function onHeaderKeyDown(next: ChartHover) {
    return (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      togglePin(next);
    };
  }

  const hasSquadOverlay = viewer != null && mainSquad.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Type chart legend">
          {LEGEND.map((item) => (
            <li key={item.label}>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${cellTone(item.multiplier)}`}
              >
                <span className="inline-flex min-w-4 justify-center" aria-hidden>
                  {item.swatch}
                </span>
                <span className="font-medium text-current/85">{item.label}</span>
              </span>
            </li>
          ))}
        </ul>

        {trainers.length > 0 ? (
          <label className="ml-auto min-w-[11rem] space-y-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
            Show coverage for
            <select
              value={viewerId}
              onChange={(e) => setViewerId(e.target.value)}
              className="w-full min-w-[12rem] rounded-md border border-frame bg-surface px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
            >
              <option value="">Reference only</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayName(t)}
                  {t.id === myTrainerId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {viewer && mainSquad.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2 text-xs text-muted">
          {displayName(viewer)} has no Main Squad yet — showing the plain
          reference chart.
        </p>
      ) : null}

      {hasSquadOverlay ? (
        <div className="space-y-2 rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink">
              {displayName(viewer)}&apos;s Main Squad vs. the chart
            </p>
            <Link
              href={toolsHref(slug, "planner")}
              className="text-[11px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
            >
              Plan this squad →
            </Link>
          </div>
          <ul className="space-y-0.5">
            {summary.map((bullet) => (
              <li
                key={bullet.text}
                className={`text-[11px] leading-snug ${
                  bullet.tone === "warn"
                    ? "text-danger"
                    : bullet.tone === "good"
                      ? "text-accent-deep"
                      : "text-muted"
                }`}
              >
                {bullet.text}
              </li>
            ))}
          </ul>
          <ul
            className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted"
            aria-label="Squad overlay legend"
          >
            <li className="flex items-center gap-1">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-deep" />
              You hit this ≥2×
            </li>
            <li className="flex items-center gap-1">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
              Shared weakness
            </li>
            <li className="flex items-center gap-1">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-2" />
              Whole squad immune
            </li>
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted/80 sm:hidden" aria-hidden>
        Swipe the grid sideways to see every type →
      </p>
      <div className="overflow-x-auto [scrollbar-gutter:stable]">
        <div className="inline-flex min-w-full flex-col gap-1">
          <p className="pl-10 text-center text-[11px] font-semibold tracking-wide text-muted">
            Defender
          </p>
          <div className="flex items-stretch gap-1">
            <p
              className="flex w-6 shrink-0 items-center justify-center text-[11px] font-semibold tracking-wide text-muted"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Attacker
            </p>
            <table
              className="border-collapse text-[11px] leading-none sm:text-xs"
              onMouseLeave={() => setHover(null)}
            >
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-surface p-0.5" />
                  {TYPES.map((t) => {
                    const colActive = active?.def === t;
                    const covered = coverageByType.get(t);
                    const isCovered = (covered?.bestMult ?? 0) >= 2;
                    const target: ChartHover = { atk: null, def: t };
                    return (
                      <th
                        key={t}
                        role="button"
                        tabIndex={0}
                        aria-pressed={sameTarget(pinned, target)}
                        className={`p-0.5 font-semibold transition-opacity duration-100 ${
                          scanning && !colActive ? "opacity-35" : ""
                        }`}
                        title={
                          isCovered && covered
                            ? `${t} — your Main Squad already hits ≥2× here${
                                covered.viaMove
                                  ? ` (${covered.viaMove})`
                                  : " (STAB)"
                              }`
                            : t
                        }
                        onMouseEnter={() => setHover(target)}
                        onFocus={() => setHover(target)}
                        onClick={() => togglePin(target)}
                        onKeyDown={onHeaderKeyDown(target)}
                      >
                        <TypePip type={t} short emphasis={colActive} />
                        {isCovered ? (
                          <span
                            aria-hidden
                            className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-accent-deep"
                          />
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TYPES.map((atk) => {
                  const rowActive = active?.atk === atk;
                  const hole = sharedHoleByType.get(atk);
                  const isImmune = immuneTypes.has(atk);
                  const target: ChartHover = { atk, def: null };
                  return (
                    <tr key={atk}>
                      <th
                        role="button"
                        tabIndex={0}
                        aria-pressed={sameTarget(pinned, target)}
                        className={`sticky left-0 z-[1] bg-surface p-0.5 text-left font-semibold transition-opacity duration-100 ${
                          scanning && !rowActive ? "opacity-35" : ""
                        }`}
                        title={
                          hole
                            ? `${atk} — a shared weakness: hits ${hole.weakCount} of your squad for ${formatMatchupMult(hole.worstMult)}`
                            : isImmune
                              ? `${atk} — your whole Main Squad is immune`
                              : atk
                        }
                        onMouseEnter={() => setHover(target)}
                        onFocus={() => setHover(target)}
                        onClick={() => togglePin(target)}
                        onKeyDown={onHeaderKeyDown(target)}
                      >
                        <span className="flex items-center gap-1">
                          <TypePip type={atk} emphasis={rowActive} />
                          {hole ? (
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                            />
                          ) : isImmune ? (
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2"
                            />
                          ) : null}
                        </span>
                      </th>
                      {TYPES.map((def) => {
                        const m = typeMultiplier(atk, def);
                        const label = formatMultiplier(m);
                        const colActive = active?.def === def;
                        const cross = rowActive && colActive;
                        const band = rowActive || colActive;
                        const dimmed = isDimmed(active, atk, def);
                        const cellTarget: ChartHover = { atk, def };

                        return (
                          <td
                            key={def}
                            className={`min-w-7 cursor-pointer p-0.5 text-center font-bold tabular-nums transition-[opacity,box-shadow] duration-100 ${cellTone(m)} ${
                              dimmed ? "opacity-30" : ""
                            } ${
                              cross
                                ? "relative z-[1] shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--ink)_55%,transparent)]"
                                : band
                                  ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_22%,transparent)]"
                                  : ""
                            }`}
                            title={`${atk} → ${def}: ${m}×`}
                            onMouseEnter={() => setHover(cellTarget)}
                            onClick={() => togglePin(cellTarget)}
                          >
                            {label || "·"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function isDimmed(
  hover: ChartHover | null,
  atk: PokemonType,
  def: PokemonType,
): boolean {
  if (!hover) return false;
  if (hover.atk && hover.def) return atk !== hover.atk && def !== hover.def;
  if (hover.atk) return atk !== hover.atk;
  if (hover.def) return def !== hover.def;
  return false;
}

function TypePip({
  type,
  short = false,
  emphasis = false,
}: {
  type: PokemonType;
  short?: boolean;
  emphasis?: boolean;
}) {
  const fill = TYPE_COLORS[type];
  return (
    <span
      className={`inline-flex min-w-7 items-center justify-center rounded px-1 py-0.5 font-bold transition-[box-shadow,transform] duration-100 ${
        emphasis
          ? "scale-105 shadow-[0_0_0_2px_color-mix(in_srgb,var(--ink)_45%,transparent)]"
          : ""
      }`}
      style={{ backgroundColor: fill, color: contrastInkForHex(fill) }}
    >
      {short ? type.slice(0, 3) : type}
    </span>
  );
}

function cellTone(m: 0 | 0.5 | 1 | 2): string {
  // Attacker lens: green = hit hard, red = don't, muted = immune wall.
  if (m === 2) return "bg-accent/15 text-accent-deep";
  if (m === 0.5) return "bg-danger/15 text-danger";
  if (m === 0) return "bg-ink/12 text-muted";
  return "bg-surface-2 text-muted/70";
}
