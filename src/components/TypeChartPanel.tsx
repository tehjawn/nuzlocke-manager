"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { TrainerProfile } from "@/lib/challenge-types";
import { contrastInkForHex } from "@/lib/pokemon-types";
import {
  formatMatchupMult,
  COVERAGE_OFFENSE_TIER_META,
  coverageOffenseTiers,
  offensiveCoverage,
  teamCoverageSummary,
  teamDefensiveProfile,
  type CoverageOffenseTierId,
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

function matchupPlain(m: 0 | 0.5 | 1 | 2): string {
  if (m === 2) return "Super effective";
  if (m === 0.5) return "Not very effective";
  if (m === 0) return "No effect";
  return "Neutral";
}

type TypeChartPanelProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
};

/**
 * Chart-first type tool: one toolbar (squad picker + matchup readout +
 * legend), a slim squad status line when overlaying, then the grid.
 * Coverage math reuses Team Planner's team-coverage.ts.
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

  const offenseTiers = useMemo(
    () => (coverage ? coverageOffenseTiers(coverage) : null),
    [coverage],
  );

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
  // Lead with coverage + shared hole — the two decisions the chart answers.
  const statusLine = summary.filter(
    (b) =>
      b.text.includes("covered") ||
      b.text.includes("coverage looks solid") ||
      b.text.includes("shared hole") ||
      b.text.includes("No shared"),
  );

  const cellMatchup =
    active?.atk && active?.def
      ? typeMultiplier(active.atk, active.def)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {trainers.length > 0 ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <span className="font-medium text-ink">Squad</span>
            <select
              value={viewerId}
              onChange={(e) => setViewerId(e.target.value)}
              className="min-w-[10.5rem] rounded-md border border-frame bg-surface px-2.5 py-1.5 text-sm text-ink"
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

        <MatchupReadout active={active} mult={cellMatchup} pinned={pinned != null} />

        <ul
          className="flex flex-wrap gap-1.5 sm:ml-auto"
          aria-label="Type chart legend"
        >
          {LEGEND.map((item) => (
            <li key={item.label}>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${cellTone(item.multiplier)}`}
              >
                <span className="inline-flex min-w-4 justify-center" aria-hidden>
                  {item.swatch}
                </span>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {viewer && mainSquad.length === 0 ? (
        <p className="text-sm text-muted">
          {displayName(viewer)} has no Main Squad yet — showing the reference
          chart.
        </p>
      ) : null}

      {hasSquadOverlay ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-frame/40 pt-3 text-sm">
          <p className="min-w-0 flex-1 leading-snug text-ink">
            <span className="font-semibold">
              {displayName(viewer)}
              {viewer.id === myTrainerId ? " (you)" : ""}
            </span>
            <span className="text-muted"> · </span>
            {statusLine.map((bullet, i) => (
              <span key={bullet.text}>
                {i > 0 ? (
                  <span className="text-muted"> · </span>
                ) : null}
                <span
                  className={
                    bullet.tone === "warn"
                      ? "text-danger"
                      : bullet.tone === "good"
                        ? "text-accent-deep"
                        : "text-muted"
                  }
                >
                  {bullet.text}
                </span>
              </span>
            ))}
          </p>
          <span
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
            aria-label="Squad overlay marks"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-accent-deep"
              />
              Hits ≥2×
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
              Shared weak
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-accent-2"
              />
              Immune
            </span>
          </span>
          <Link
            href={toolsHref(slug, "planner")}
            className="shrink-0 font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
          >
            Plan this squad →
          </Link>
        </div>
      ) : null}

      <p className="text-xs text-muted/80 sm:hidden" aria-hidden>
        Swipe the grid sideways to see every type →
      </p>
      <div className="overflow-x-auto [scrollbar-gutter:stable]">
        {/*
          Fill the Frame on desktop; keep a readable floor width on narrow
          viewports so the grid scrolls instead of crushing labels.
        */}
        <div className="flex w-full min-w-[36rem] flex-col gap-1.5 sm:min-w-0">
          <p className="pl-[calc(1.5rem+5.75rem)] text-center text-xs font-semibold tracking-wide text-muted">
            Defender
          </p>
          <div className="flex w-full items-stretch gap-1.5">
            <p
              className="flex w-5 shrink-0 items-center justify-center text-xs font-semibold tracking-wide text-muted sm:w-6"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Attacker
            </p>
            <table
              className="w-full table-fixed border-collapse text-xs leading-none"
              onMouseLeave={() => setHover(null)}
            >
              <colgroup>
                <col className="w-[5.75rem]" />
                {TYPES.map((t) => (
                  <col key={t} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-surface p-px" />
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
                        className={`p-px font-semibold transition-opacity duration-100 ${
                          scanning && !colActive ? "opacity-35" : ""
                        }`}
                        title={
                          isCovered && covered
                            ? `${t} — Main Squad hits ≥2× here${
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
                        <TypePip type={t} short fill emphasis={colActive} />
                        {isCovered ? (
                          <span
                            aria-hidden
                            className="mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full bg-accent-deep"
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
                        className={`sticky left-0 z-[1] bg-surface p-px text-left font-semibold transition-opacity duration-100 ${
                          scanning && !rowActive ? "opacity-35" : ""
                        }`}
                        title={
                          hole
                            ? `${atk} — shared weakness: hits ${hole.weakCount} of the squad for ${formatMatchupMult(hole.worstMult)}`
                            : isImmune
                              ? `${atk} — whole Main Squad is immune`
                              : atk
                        }
                        onMouseEnter={() => setHover(target)}
                        onFocus={() => setHover(target)}
                        onClick={() => togglePin(target)}
                        onKeyDown={onHeaderKeyDown(target)}
                      >
                        <span className="flex w-full items-center gap-1">
                          <TypePip type={atk} fill emphasis={rowActive} />
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
                            className={`h-7 cursor-pointer p-px text-center align-middle text-xs font-bold tabular-nums transition-[opacity,box-shadow] duration-100 sm:h-8 ${cellTone(m)} ${
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

      <CoverageTier
        tiers={offenseTiers}
        coverageByType={coverageByType}
        activeDef={active?.def ?? null}
        hasViewer={viewer != null}
        onSelectDef={(def) => togglePin({ atk: null, def })}
      />
    </div>
  );
}

function CoverageTier({
  tiers,
  coverageByType,
  activeDef,
  hasViewer,
  onSelectDef,
}: {
  tiers: ReturnType<typeof coverageOffenseTiers> | null;
  coverageByType: Map<PokemonType, OffensiveCoverageCell>;
  activeDef: PokemonType | null;
  hasViewer: boolean;
  onSelectDef: (def: PokemonType) => void;
}) {
  const tierTone: Record<CoverageOffenseTierId, string> = {
    S: "border-accent/35 bg-accent/10 text-accent-deep",
    A: "border-frame/50 bg-surface-2 text-muted",
    B: "border-danger/30 bg-danger/10 text-danger",
    F: "border-ink/25 bg-ink/10 text-muted",
  };

  return (
    <section className="space-y-2 border-t border-frame/40 pt-3" aria-label="Coverage tier list">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Coverage tiers</h3>
        <p className="text-xs text-muted">
          Defending types ranked by your Main Squad&apos;s best hit
        </p>
      </div>

      {!hasViewer ? (
        <p className="text-sm text-muted">
          Pick a squad above to tier how hard you hit each type.
        </p>
      ) : !tiers ? (
        <p className="text-sm text-muted">
          No Main Squad yet — nothing to tier.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {COVERAGE_OFFENSE_TIER_META.map((meta) => {
            const types = tiers[meta.id];
            return (
              <li
                key={meta.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center"
              >
                <span
                  className={`inline-flex min-w-[3.25rem] items-baseline justify-center gap-1 rounded-md border px-2 py-1 text-xs font-bold tabular-nums sm:min-w-0 sm:justify-start ${tierTone[meta.id]}`}
                  title={meta.hint}
                >
                  <span className="text-sm leading-none">{meta.id}</span>
                  <span className="hidden font-semibold sm:inline">
                    {meta.label}
                  </span>
                </span>
                {types.length === 0 ? (
                  <p className="py-1 text-sm text-muted/70">—</p>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {types.map((t) => {
                      const cell = coverageByType.get(t);
                      const selected = activeDef === t;
                      return (
                        <li key={t}>
                          <button
                            type="button"
                            className={`rounded transition-[box-shadow,transform] duration-100 ${
                              selected
                                ? "scale-105 shadow-[0_0_0_2px_color-mix(in_srgb,var(--ink)_45%,transparent)]"
                                : "hover:scale-105"
                            }`}
                            title={
                              cell
                                ? `${t}: best ${formatMatchupMult(cell.bestMult)}${
                                    cell.viaMove
                                      ? ` via ${cell.viaMove}`
                                      : cell.attackType
                                        ? ` (${cell.attackType} STAB)`
                                        : ""
                                  }`
                                : t
                            }
                            aria-pressed={selected}
                            onClick={() => onSelectDef(t)}
                          >
                            <TypePip type={t} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MatchupReadout({
  active,
  mult,
  pinned,
}: {
  active: ChartHover | null;
  mult: 0 | 0.5 | 1 | 2 | null;
  pinned: boolean;
}) {
  let body: ReactNode;
  if (active?.atk && active?.def && mult != null) {
    body = (
      <>
        <TypePip type={active.atk} />
        <span className="text-muted" aria-hidden>
          →
        </span>
        <TypePip type={active.def} />
        <span
          className={`rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${cellTone(mult)}`}
        >
          {formatMultiplier(mult) || "1×"}
        </span>
        <span className="font-medium text-ink">{matchupPlain(mult)}</span>
        {pinned ? (
          <span className="text-xs text-muted">Pinned · tap again to clear</span>
        ) : null}
      </>
    );
  } else if (active?.atk) {
    body = (
      <>
        <TypePip type={active.atk} />
        <span className="font-medium text-ink">attacking row</span>
        <span className="text-muted">— hover a cell for the full matchup</span>
      </>
    );
  } else if (active?.def) {
    body = (
      <>
        <span className="font-medium text-ink">vs</span>
        <TypePip type={active.def} />
        <span className="text-muted">— hover a cell for the full matchup</span>
      </>
    );
  } else {
    body = (
      <span className="text-muted">
        Hover or tap a cell to read the matchup
      </span>
    );
  }

  return (
    <div
      className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-2 text-sm"
      aria-live="polite"
    >
      {body}
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
  fill: stretch = false,
  emphasis = false,
}: {
  type: PokemonType;
  short?: boolean;
  /** Stretch to the table cell so headers share the widened columns. */
  fill?: boolean;
  emphasis?: boolean;
}) {
  const fill = TYPE_COLORS[type];
  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold transition-[box-shadow,transform] duration-100 ${
        stretch ? "w-full min-w-0" : "min-w-7"
      } ${
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
