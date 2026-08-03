"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { contrastInkForHex } from "@/lib/pokemon-types";
import {
  formatMatchupMult,
  COVERAGE_OFFENSE_TIER_META,
  coverageOffenseTiers,
  offensiveCoverage,
  teamDefensiveProfile,
  type CoverageOffenseTiersId,
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

function monLabel(entry: PokemonEntry): string {
  const nick = entry.nickname?.trim();
  return nick || entry.species;
}

type TypeChartPanelProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
};

/**
 * Type Chart first: persistent 18×18 grid, then optional Main Squad coverage
 * scored underneath (sprites → who answers each type).
 */
export function TypeChartPanel({
  slug,
  trainers,
  myTrainerId = null,
}: TypeChartPanelProps) {
  const [hover, setHover] = useState<ChartHover | null>(null);
  const [pinned, setPinned] = useState<ChartHover | null>(null);
  const [viewerId, setViewerId] = useState(() => myTrainerId ?? "");
  const [focusDef, setFocusDef] = useState<PokemonType | null>(null);

  const active = pinned ?? hover;
  const scanning = active != null;

  const viewer = trainers.find((t) => t.id === viewerId) ?? null;
  const mainSquad = useMemo(
    () => (viewer ? pokemonInSlot(viewer, "MAIN") : []),
    [viewer],
  );
  const squadById = useMemo(() => {
    const map = new Map<string, PokemonEntry>();
    for (const mon of mainSquad) map.set(mon.id, mon);
    return map;
  }, [mainSquad]);

  const coverage = useMemo(
    () => (mainSquad.length > 0 ? offensiveCoverage(mainSquad) : null),
    [mainSquad],
  );
  const defense = useMemo(
    () => (mainSquad.length > 0 ? teamDefensiveProfile(mainSquad) : null),
    [mainSquad],
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

  const coveredCount = useMemo(
    () =>
      coverage
        ? coverage.cells.filter((c) => c.bestMult >= 2).length
        : 0,
    [coverage],
  );

  function togglePin(next: ChartHover) {
    setPinned((prev) => (sameTarget(prev, next) ? null : next));
  }

  function selectDefendingType(def: PokemonType) {
    setFocusDef((prev) => (prev === def ? null : def));
    togglePin({ atk: null, def });
  }

  const hasSquad = viewer != null && mainSquad.length > 0;
  const cellMatchup =
    active?.atk && active?.def
      ? typeMultiplier(active.atk, active.def)
      : null;
  const focusCell = focusDef ? coverageByType.get(focusDef) ?? null : null;
  const focusMon =
    focusCell?.viaEntryId != null
      ? squadById.get(focusCell.viaEntryId) ?? null
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1 text-sm">
          <span className="block font-semibold text-ink">Whose Main Squad?</span>
          <select
            value={viewerId}
            onChange={(e) => {
              setViewerId(e.target.value);
              setFocusDef(null);
              setPinned(null);
            }}
            className="min-w-[14rem] rounded-md border border-frame bg-surface px-2.5 py-2 text-sm text-ink"
          >
            <option value="">Reference chart only</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {displayName(t)}
                {t.id === myTrainerId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>
        {hasSquad ? (
          <Link
            href={toolsHref(slug, "planner")}
            className="text-sm font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
          >
            Draft coverage in Team Planner →
          </Link>
        ) : (
          <p className="max-w-md text-sm text-muted">
            Pick a trainer to score Main Squad coverage under the chart.
          </p>
        )}
      </div>

      <section className="space-y-3" aria-label="Type chart">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">Type chart</h3>
          <p className="text-sm text-muted">
            Attack → defense multipliers
            {hasSquad ? " · squad marks on the axes" : ""}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <MatchupReadout
            active={active}
            mult={cellMatchup}
            pinned={pinned != null}
          />
          <ul
            className="flex flex-wrap gap-1.5 sm:ml-auto"
            aria-label="Type chart legend"
          >
            {LEGEND.map((item) => (
              <li key={item.label}>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${cellTone(item.multiplier)}`}
                >
                  <span
                    className="inline-flex min-w-4 justify-center"
                    aria-hidden
                  >
                    {item.swatch}
                  </span>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {hasSquad ? (
          <p className="text-xs text-muted">
            Green dots on defender headers = this squad already hits ≥2×. Red
            dots on attacker rows = shared weakness. Amber = whole squad immune.
          </p>
        ) : null}

        <p className="text-xs text-muted/80 sm:hidden" aria-hidden>
          Swipe the grid sideways to see every type →
        </p>
        <div className="overflow-x-auto [scrollbar-gutter:stable]">
          <div className="flex w-full min-w-[36rem] flex-col gap-1.5 sm:min-w-0">
            <p className="pl-[calc(1.5rem+5.75rem)] text-center text-xs font-semibold tracking-wide text-muted">
              Defender
            </p>
            <div className="flex w-full items-stretch gap-1.5">
              <p
                className="flex w-5 shrink-0 items-center justify-center text-xs font-semibold tracking-wide text-muted sm:w-6"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
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
                          scope="col"
                          className={`p-px font-semibold transition-opacity duration-100 ${
                            scanning && !colActive ? "opacity-35" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full rounded"
                            aria-pressed={sameTarget(pinned, target)}
                            title={
                              isCovered && covered
                                ? `${t} — this squad hits ≥2×${
                                    covered.viaMove
                                      ? ` (${covered.viaMove})`
                                      : " (STAB)"
                                  }`
                                : t
                            }
                            onMouseEnter={() => setHover(target)}
                            onFocus={() => setHover(target)}
                            onClick={() => {
                              setFocusDef(t);
                              togglePin(target);
                            }}
                          >
                            <TypePip type={t} short fill emphasis={colActive} />
                            {isCovered ? (
                              <span
                                aria-hidden
                                className="mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full bg-accent-deep"
                              />
                            ) : null}
                          </button>
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
                          scope="row"
                          className={`sticky left-0 z-[1] bg-surface p-px text-left font-semibold transition-opacity duration-100 ${
                            scanning && !rowActive ? "opacity-35" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-1 rounded text-left"
                            aria-pressed={sameTarget(pinned, target)}
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
                          >
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
                          </button>
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
                              onClick={() => {
                                setFocusDef(def);
                                togglePin(cellTarget);
                              }}
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
      </section>

      <section
        className="space-y-4 border-t border-frame/40 pt-5"
        aria-label="Main Squad coverage"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">
            Main Squad coverage
          </h3>
          {hasSquad ? (
            <p className="text-sm tabular-nums text-muted">
              <span className="font-semibold text-accent-deep">
                {coveredCount}
              </span>
              /{TYPES.length} types hit ≥2×
            </p>
          ) : null}
        </div>

        {!viewer ? (
          <p className="text-sm text-muted">
            Pick a trainer above to see their six Pokémon and how they cover
            each type.
          </p>
        ) : mainSquad.length === 0 ? (
          <p className="text-sm text-muted">
            {displayName(viewer)} has no Main Squad yet — nothing to score.
          </p>
        ) : (
          <>
            <SquadStrip
              viewer={viewer}
              isYou={viewer.id === myTrainerId}
              squad={mainSquad}
              coveredCount={coveredCount}
              total={TYPES.length}
            />
            {offenseTiers && coverage ? (
              <CoverageStory
                squad={mainSquad}
                squadById={squadById}
                tiers={offenseTiers}
                coverageByType={coverageByType}
                sharedHoles={defense?.sharedHoles ?? []}
                focusDef={focusDef}
                focusCell={focusCell}
                focusMon={focusMon}
                onSelectDef={selectDefendingType}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}


function SquadStrip({
  viewer,
  isYou,
  squad,
}: {
  viewer: TrainerProfile;
  isYou: boolean;
  squad: PokemonEntry[];
  coveredCount: number;
  total: number;
}) {
  return (
    <div className="rounded-md border border-frame/50 bg-surface/50 px-3 py-3">
      <p className="mb-2 text-sm text-ink">
        <span className="font-semibold">
          {displayName(viewer)}
          {isYou ? " (you)" : ""}
        </span>
        <span className="text-muted">
          {" "}
          · Main Squad ({squad.length}) — coverage is scored from these Pokémon
        </span>
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {squad.map((mon) => (
          <li
            key={mon.id}
            className="flex flex-col items-center gap-1 rounded-md border border-frame/40 bg-surface px-1.5 py-2"
          >
            <PokemonSpriteImage
              alt={monLabel(mon)}
              className="pixelated h-12 w-12 object-contain"
              height={48}
              loading="lazy"
              pokedexId={mon.pokedexId}
              shiny={mon.isShiny}
              species={mon.species}
              width={48}
            />
            <span className="max-w-full truncate text-center text-xs font-semibold text-ink">
              {monLabel(mon)}
            </span>
            <span className="flex flex-wrap justify-center gap-0.5">
              {mon.types.map((t) => (
                <TypePip key={t} type={t as PokemonType} short />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverageStory({
  squad,
  squadById,
  tiers,
  coverageByType,
  sharedHoles,
  focusDef,
  focusCell,
  focusMon,
  onSelectDef,
}: {
  squad: PokemonEntry[];
  squadById: Map<string, PokemonEntry>;
  tiers: ReturnType<typeof coverageOffenseTiers>;
  coverageByType: Map<PokemonType, OffensiveCoverageCell>;
  sharedHoles: SharedDefensiveHole[];
  focusDef: PokemonType | null;
  focusCell: OffensiveCoverageCell | null;
  focusMon: PokemonEntry | null;
  onSelectDef: (def: PokemonType) => void;
}) {
  const tierTone: Record<CoverageOffenseTierId, string> = {
    S: "border-accent/40 bg-accent/10",
    A: "border-frame/50 bg-surface-2/80",
    B: "border-danger/35 bg-danger/10",
    F: "border-ink/30 bg-ink/10",
  };

  return (
    <section className="space-y-4" aria-label="Squad coverage story">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">
          What can this squad hit?
        </h3>
        <p className="text-sm text-muted">
          Each tile is a defending type. The sprite is the Pokémon that answers
          it best — tap a tile to see why.
        </p>
      </div>

      {focusDef && focusCell ? (
        <FocusCallout
          def={focusDef}
          cell={focusCell}
          mon={focusMon}
          onClear={() => onSelectDef(focusDef)}
        />
      ) : null}

      <ul className="space-y-3">
        {COVERAGE_OFFENSE_TIER_META.map((meta) => {
          const types = tiers[meta.id];
          return (
            <li key={meta.id} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold ${tierTone[meta.id]}`}
                >
                  <span className="text-sm">{meta.id}</span>
                  {meta.label}
                </span>
                <span className="text-xs text-muted">{meta.hint}</span>
                <span className="text-xs tabular-nums text-muted">
                  {types.length}
                </span>
              </div>
              {types.length === 0 ? (
                <p className="pl-1 text-sm text-muted/70">None</p>
              ) : (
                <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {types.map((t) => {
                    const cell = coverageByType.get(t)!;
                    const mon =
                      cell.viaEntryId != null
                        ? squadById.get(cell.viaEntryId)
                        : undefined;
                    const selected = focusDef === t;
                    return (
                      <li key={t}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onSelectDef(t)}
                          className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-[box-shadow,transform] duration-100 ${tierTone[meta.id]} ${
                            selected
                              ? "scale-[1.02] shadow-[0_0_0_2px_color-mix(in_srgb,var(--ink)_40%,transparent)]"
                              : "hover:scale-[1.01]"
                          }`}
                          title={
                            mon
                              ? `${monLabel(mon)} → ${t}: ${formatMatchupMult(cell.bestMult)}`
                              : t
                          }
                        >
                          <TypePip type={t} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold tabular-nums text-ink">
                              {formatMatchupMult(cell.bestMult)}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {mon ? monLabel(mon) : "—"}
                            </span>
                          </span>
                          {mon ? (
                            <PokemonSpriteImage
                              alt=""
                              className="pixelated h-8 w-8 shrink-0 object-contain"
                              height={32}
                              loading="lazy"
                              pokedexId={mon.pokedexId}
                              shiny={mon.isShiny}
                              species={mon.species}
                              width={32}
                            />
                          ) : null}
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

      {sharedHoles.length > 0 ? (
        <div className="space-y-2 border-t border-frame/40 pt-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink">
              What hits this squad hard?
            </h3>
            <p className="text-sm text-muted">
              Attack types that deal ≥2× to more than one of these Pokémon.
            </p>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {sharedHoles.slice(0, 6).map((hole) => {
              const weakMons = hole.weakEntryIds
                .map((id) => squadById.get(id))
                .filter((m): m is PokemonEntry => m != null);
              return (
                <li
                  key={hole.attackType}
                  className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-2"
                >
                  <TypePip type={hole.attackType} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {hole.attackType}{" "}
                      <span className="tabular-nums text-danger">
                        {formatMatchupMult(hole.worstMult)}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      Hits {hole.weakCount}/{squad.length} of the squad
                    </p>
                  </div>
                  <ul className="flex shrink-0 -space-x-1.5">
                    {weakMons.slice(0, 4).map((mon) => (
                      <li key={mon.id} title={monLabel(mon)}>
                        <PokemonSpriteImage
                          alt={monLabel(mon)}
                          className="pixelated h-7 w-7 object-contain"
                          height={28}
                          loading="lazy"
                          pokedexId={mon.pokedexId}
                          shiny={mon.isShiny}
                          species={mon.species}
                          width={28}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="border-t border-frame/40 pt-4 text-sm text-accent-deep">
          No shared ≥2× weaknesses across this Main Squad.
        </p>
      )}
    </section>
  );
}

function FocusCallout({
  def,
  cell,
  mon,
  onClear,
}: {
  def: PokemonType;
  cell: OffensiveCoverageCell;
  mon: PokemonEntry | null;
  onClear: () => void;
}) {
  const covered = cell.bestMult >= 2;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
        covered
          ? "border-accent/40 bg-accent/10"
          : cell.bestMult > 0
            ? "border-frame/50 bg-surface-2"
            : "border-danger/35 bg-danger/10"
      }`}
      aria-live="polite"
    >
      <TypePip type={def} />
      <span className="text-muted" aria-hidden>
        ←
      </span>
      {mon ? (
        <PokemonSpriteImage
          alt={monLabel(mon)}
          className="pixelated h-10 w-10 object-contain"
          height={40}
          loading="lazy"
          pokedexId={mon.pokedexId}
          shiny={mon.isShiny}
          species={mon.species}
          width={40}
        />
      ) : (
        <span className="text-sm font-semibold text-danger">No answer</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {mon ? (
            <>
              {monLabel(mon)} hits {def} for{" "}
              <span className="tabular-nums">
                {formatMatchupMult(cell.bestMult)}
              </span>
            </>
          ) : (
            <>Nobody on this squad damages {def}</>
          )}
        </p>
        <p className="text-xs text-muted">
          {mon
            ? cell.viaMove
              ? `via ${cell.viaMove}${cell.attackType ? ` (${cell.attackType})` : ""}`
              : cell.attackType
                ? `${cell.attackType} STAB`
                : "Best available hit"
            : "Add coverage in Team Planner"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-semibold text-muted underline decoration-muted/40 underline-offset-2 hover:text-ink"
      >
        Clear
      </button>
    </div>
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
      </>
    );
  } else if (active?.def) {
    body = (
      <>
        <span className="font-medium text-ink">vs</span>
        <TypePip type={active.def} />
      </>
    );
  } else {
    body = (
      <span className="text-muted">
        Hover or tap a cell to read Attack → Defense
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
  if (m === 2) return "bg-accent/15 text-accent-deep";
  if (m === 0.5) return "bg-danger/15 text-danger";
  if (m === 0) return "bg-ink/12 text-muted";
  return "bg-surface-2 text-muted/70";
}
