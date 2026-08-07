"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Frame } from "@/components/Frame";
import { ModeTabs } from "@/components/ModeTabs";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { TypeBadge } from "@/components/TypeBadge";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  formatGymPrepLevelVerdict,
  formatGymPrepTypeMatch,
  gymPrepCapRole,
  hasTypingMatch,
  isGymPrepAnswered,
  levelVerdictForGymPrep,
  squadMatchesForGymPrep,
  type GymPrepCapRole,
  type GymPrepSquadMatch,
} from "@/features/guide/guide-gym-prep";
import type { GuideGymPrep } from "@/features/guide/guide-types";
import { ELITE_FOUR_PREP } from "@/features/planner/elite-four-prep";
import {
  clearPlannerDraft,
  PLANNER_DRAFT_MAX,
  plannerDraftStorageKey,
  readPlannerDraftState,
  setPlannerDraftIds,
} from "@/features/planner/planner-drafts";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import {
  catchTierHasChrome,
  catchTierLabel,
  catchTierToneClass,
} from "@/lib/iv-quality";
import type { PokemonType } from "@/lib/pokemon-types";
import { recommendTeam } from "@/lib/recommend-team";
import { statRankToneClass, type StatRank } from "@/lib/species-ranks";
import {
  coverageOffenseGrid,
  coverageVerdict,
  formatMatchupMult,
  offensiveCoverage,
  teamDefensiveProfile,
  vsTrainerMatchup,
  vsTrainerOffenseGrid,
} from "@/lib/team-coverage";
import {
  parsePlannerMode,
  toolsHref,
  type PlannerMode,
} from "@/lib/tools-routes";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";

type TeamPlannerViewProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  initialMode?: PlannerMode | null;
};

/** Sprites shown on a collapsed prep row before spilling into a "+N" count. */
const SUMMARY_MATCH_LIMIT = 4;

const MODES: ReadonlyArray<{ id: PlannerMode; label: string }> = [
  { id: "coverage", label: "Coverage" },
  { id: "prep", label: "Gym / League" },
  { id: "vs", label: "vs Trainer" },
  { id: "recommended", label: "Recommended" },
];

function livingBox(trainer: TrainerProfile): PokemonEntry[] {
  return [
    ...pokemonInSlot(trainer, "MAIN"),
    ...pokemonInSlot(trainer, "RESERVE"),
  ];
}

function defaultDraftIds(trainer: TrainerProfile): string[] {
  const main = pokemonInSlot(trainer, "MAIN");
  if (main.length > 0) {
    return main.slice(0, PLANNER_DRAFT_MAX).map((p) => p.id);
  }
  return livingBox(trainer)
    .slice(0, PLANNER_DRAFT_MAX)
    .map((p) => p.id);
}

function monLabel(entry: PokemonEntry): string {
  return entry.nickname?.trim() || entry.species;
}

/** e.g. "Swampert · Water, Electric via Thunderbolt" */
function prepMatchTip(
  match: GymPrepSquadMatch,
  aceLevel: number,
  capRole: GymPrepCapRole,
): string {
  const reasons = match.typeMatches.map(formatGymPrepTypeMatch).join(", ");
  const base = reasons
    ? `${monLabel(match.entry)} · ${reasons}`
    : monLabel(match.entry);
  const verdict = levelVerdictForGymPrep(match.entry.level, aceLevel);
  if (!verdict) return base;
  return `${base} · ${formatGymPrepLevelVerdict(verdict, capRole)}`;
}

/** Fixed-size status chip so ✓ / ! don’t shift the prep row. */
function PrepStatusIcon({
  kind,
  title,
}: {
  kind: "cleared" | "under";
  title: string;
}) {
  const cleared = kind === "cleared";
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${
        cleared ? "bg-accent/20 text-accent-deep" : "bg-danger/15 text-danger"
      }`}
      title={title}
      aria-label={cleared ? "Cleared" : "Underleveled"}
    >
      {cleared ? "✓" : "!"}
    </span>
  );
}

function firstEmptySlot(ids: readonly string[]): number {
  const idx = ids.findIndex((id) => !id);
  if (idx >= 0) return idx;
  if (ids.length < PLANNER_DRAFT_MAX) return ids.length;
  return 0;
}

function toSlots(ids: readonly string[]): string[] {
  const next = ids.filter(Boolean).slice(0, PLANNER_DRAFT_MAX);
  while (next.length < PLANNER_DRAFT_MAX) next.push("");
  return next;
}

function compactIds(slots: readonly string[]): string[] {
  return slots.filter(Boolean);
}

export function TeamPlannerView({
  slug,
  trainers,
  myTrainerId = null,
  initialMode = "coverage",
}: TeamPlannerViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = parsePlannerMode(searchParams.get("mode") ?? initialMode);
  const [viewerId, setViewerId] = useState(() => {
    if (myTrainerId) return myTrainerId;
    const withLiving = trainers.find((t) => livingBox(t).length > 0);
    return withLiving?.id ?? trainers[0]?.id ?? "";
  });
  const [opponentId, setOpponentId] = useState(() => {
    const self =
      myTrainerId ?? trainers.find((t) => livingBox(t).length > 0)?.id;
    const other = trainers.find(
      (t) => t.id !== self && pokemonInSlot(t, "MAIN").length > 0,
    );
    return (
      other?.id ??
      trainers.find((t) => t.id !== self)?.id ??
      trainers[0]?.id ??
      ""
    );
  });
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const skipPersistRef = useRef(false);

  const viewer = trainers.find((t) => t.id === viewerId) ?? null;
  const opponent = trainers.find((t) => t.id === opponentId) ?? null;
  const pool = useMemo(() => (viewer ? livingBox(viewer) : []), [viewer]);
  const poolById = useMemo(() => {
    const map = new Map<string, PokemonEntry>();
    for (const mon of pool) map.set(mon.id, mon);
    return map;
  }, [pool]);

  const slots = useMemo(() => toSlots(draftIds), [draftIds]);
  const draft = useMemo(
    () =>
      compactIds(slots)
        .map((id) => poolById.get(id))
        .filter((m): m is PokemonEntry => m != null),
    [slots, poolById],
  );
  const draftIdSet = useMemo(() => new Set(compactIds(slots)), [slots]);

  useEffect(() => {
    // Hydrate from localStorage (external store) when the viewer changes —
    // not derivable from props alone, so this belongs in an effect.
    if (!viewerId) {
      skipPersistRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydrate
      setDraftIds([]);
      setActiveSlot(0);
      setDraftHydrated(true);
      return;
    }
    const key = plannerDraftStorageKey(slug, viewerId);
    const { found, draft: stored } = readPlannerDraftState(key);
    const trainer = trainers.find((t) => t.id === viewerId);
    if (!trainer) {
      skipPersistRef.current = true;
      setDraftIds([]);
      setActiveSlot(0);
      setDraftHydrated(true);
      return;
    }
    const valid = new Set(livingBox(trainer).map((p) => p.id));
    // entryIds already capped in normalize(); filter to living pool.
    const fromStorage = stored.entryIds
      .filter((id) => valid.has(id))
      .slice(0, PLANNER_DRAFT_MAX);
    // Missing key → seed from Main. Found empty → intentional Clear.
    const next = found ? fromStorage : defaultDraftIds(trainer);
    skipPersistRef.current = true;
    setDraftIds(next);
    setActiveSlot(firstEmptySlot(toSlots(next)));
    setDraftHydrated(true);
  }, [slug, viewerId, trainers]);

  useEffect(() => {
    if (!draftHydrated || !viewerId) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    setPlannerDraftIds(plannerDraftStorageKey(slug, viewerId), draftIds);
  }, [draftIds, draftHydrated, slug, viewerId]);

  const coverage = useMemo(() => offensiveCoverage(draft), [draft]);
  const defense = useMemo(() => teamDefensiveProfile(draft), [draft]);
  const verdict = useMemo(
    () => coverageVerdict(draft, coverage, defense),
    [draft, coverage, defense],
  );
  const offenseGrid = useMemo(() => coverageOffenseGrid(draft), [draft]);

  const gymPreps = useMemo(
    () =>
      EMERALD_GUIDE.steps
        .filter((s) => s.gymPrep != null && s.chapterId !== "elite-four")
        .map((s) => ({
          id: s.id,
          chapterId: s.chapterId,
          title: s.title,
          prep: s.gymPrep!,
        })),
    [],
  );

  const opponentMain = useMemo(
    () => (opponent ? pokemonInSlot(opponent, "MAIN") : []),
    [opponent],
  );

  function selectMode(next: PlannerMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tool", "planner");
    params.set("mode", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function commitSlots(nextSlots: string[], preferAdvanceFrom?: number) {
    const compact = compactIds(nextSlots);
    const normalized = toSlots(compact);
    setDraftIds(compact);
    if (preferAdvanceFrom != null) {
      const from = preferAdvanceFrom;
      const nextEmpty = normalized.findIndex((id, i) => !id && i > from);
      if (nextEmpty >= 0) {
        setActiveSlot(nextEmpty);
        return;
      }
      const anyEmpty = normalized.findIndex((id) => !id);
      if (anyEmpty >= 0) {
        setActiveSlot(anyEmpty);
        return;
      }
      setActiveSlot((from + 1) % PLANNER_DRAFT_MAX);
      return;
    }
    setActiveSlot(firstEmptySlot(normalized));
  }

  function onSlotClick(index: number) {
    if (activeSlot === index && slots[index]) {
      // Second click on active filled slot clears it.
      const next = [...slots];
      next[index] = "";
      commitSlots(next);
      return;
    }
    setActiveSlot(index);
  }

  function placeFromBox(entryId: string) {
    const next = [...slots];
    const existing = next.indexOf(entryId);
    if (existing === activeSlot) {
      next[activeSlot] = "";
      commitSlots(next);
      return;
    }
    if (existing >= 0) {
      const displaced = next[activeSlot] ?? "";
      next[activeSlot] = entryId;
      next[existing] = displaced;
      commitSlots(next, activeSlot);
      return;
    }
    next[activeSlot] = entryId;
    commitSlots(next, activeSlot);
  }

  function resetToMain() {
    if (!viewer) return;
    const next = defaultDraftIds(viewer);
    setDraftIds(next);
    setActiveSlot(firstEmptySlot(toSlots(next)));
    setPlannerDraftIds(plannerDraftStorageKey(slug, viewerId), next);
  }

  function clearDraft() {
    setDraftIds([]);
    setActiveSlot(0);
    clearPlannerDraft(plannerDraftStorageKey(slug, viewerId));
  }

  if (trainers.length === 0) {
    return (
      <p className="text-sm text-muted">
        No trainers on this season yet — join a board to plan a team.
      </p>
    );
  }

  const filledCount = draft.length;
  const activeEntry = slots[activeSlot]
    ? poolById.get(slots[activeSlot]!)
    : undefined;
  const activeLabel = activeEntry
    ? monLabel(activeEntry)
    : `slot ${activeSlot + 1}`;

  return (
    <div className="space-y-4">
      {/* Quiet chrome: trainer + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[10rem] space-y-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
          Plan for
          <select
            value={viewerId}
            onChange={(e) => setViewerId(e.target.value)}
            className="w-full min-w-[12rem] rounded-md border border-frame bg-surface px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
          >
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {displayName(t)}
                {t.id === myTrainerId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>
        {mode === "vs" && (
          <label className="min-w-[10rem] space-y-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
            Opponent
            <select
              value={opponentId}
              onChange={(e) => setOpponentId(e.target.value)}
              className="w-full min-w-[12rem] rounded-md border border-frame bg-surface px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayName(t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5 pb-0.5">
          <button
            type="button"
            className={CTA_SECONDARY_SM}
            onClick={resetToMain}
          >
            Reset to Main
          </button>
          <button
            type="button"
            className={CTA_SECONDARY_SM}
            onClick={clearDraft}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Desktop: team+box left | analysis right. Mobile: stacked. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-3 lg:sticky lg:top-3 lg:self-start">
          <section aria-label="Planned team">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-ink">
                Planned team{" "}
                <span className="font-medium tabular-nums text-muted">
                  ({filledCount}/{PLANNER_DRAFT_MAX})
                </span>
              </h3>
            </div>
            <PartyStripSlots
              slots={slots}
              poolById={poolById}
              activeSlot={activeSlot}
              onSlotClick={onSlotClick}
              rail
            />
            <p className="mt-1.5 text-[11px] text-muted" aria-live="polite">
              Placing into {activeLabel} — pick a boxed mon, or tap the slot
              again to clear.
            </p>
          </section>

          <div
            id="planner-living-box"
            className="rounded-lg border border-frame/70 bg-surface-2/60 p-3"
          >
            <p className="mb-2.5 text-xs font-semibold text-ink">
              Boxed Pokémon{" "}
              <span className="font-medium tabular-nums text-muted">
                ({pool.length})
              </span>
            </p>
            {pool.length === 0 ? (
              <p className="text-xs text-muted">
                No Main or Reserve Pokémon on this board yet.
              </p>
            ) : (
              <LivingBoxGrid
                pokemon={pool}
                draftIds={draftIdSet}
                onPlace={placeFromBox}
                rail
              />
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <ModeTabs
            aria-label="Planner analysis"
            idPrefix="planner"
            value={mode}
            tabs={MODES}
            onValueChange={selectMode}
            panelClassName="min-w-0 space-y-3"
          >
            {mode === "coverage" && (
              <CoveragePanels
                draft={draft}
                verdict={verdict}
                offenseGrid={offenseGrid}
              />
            )}
            {mode === "prep" && (
              <PrepPanels
                slug={slug}
                draft={draft}
                gymPreps={gymPreps}
                earnedBadgeKeys={viewer?.earnedBadgeKeys ?? []}
              />
            )}
            {mode === "vs" && (
              <VsTrainerPanel
                draft={draft}
                opponent={opponent}
                opponentMain={opponentMain}
              />
            )}
            {mode === "recommended" && (
              <RecommendedPanel
                pool={pool}
                poolById={poolById}
                onApply={(entryIds) => commitSlots(toSlots(entryIds))}
              />
            )}
          </ModeTabs>
        </div>
      </div>
    </div>
  );
}

function PartyStripSlots({
  slots,
  poolById,
  activeSlot,
  onSlotClick,
  rail = false,
}: {
  slots: string[];
  poolById: Map<string, PokemonEntry>;
  activeSlot: number;
  onSlotClick: (index: number) => void;
  /** Narrow left-column layout: 2×3 instead of a long 6-wide strip. */
  rail?: boolean;
}) {
  return (
    <ul
      className={`grid items-stretch gap-1.5 ${
        rail
          ? "grid-cols-3 sm:grid-cols-3 lg:grid-cols-2"
          : "grid-cols-3 sm:grid-cols-6"
      }`}
    >
      {slots.map((id, index) => {
        const entry = id ? poolById.get(id) : undefined;
        const active = activeSlot === index;
        const label = entry ? monLabel(entry) : `Empty slot ${index + 1}`;
        return (
          <li key={`slot-${index}`} className="min-h-0">
            {entry ? (
              <PokemonHoverPreview pokemon={entry} className="h-full">
                <SlotButton
                  active={active}
                  filled
                  label={label}
                  onClick={() => onSlotClick(index)}
                >
                  <span className="absolute left-1 top-1 text-[9px] font-bold tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <PokemonSpriteImage
                    alt={label}
                    className="pixelated h-12 w-12 object-contain sm:h-14 sm:w-14"
                    height={56}
                    loading="lazy"
                    pokedexId={entry.pokedexId}
                    shiny={entry.isShiny}
                    species={entry.species}
                    width={56}
                  />
                  <span className="max-w-full truncate text-center text-[10px] font-semibold leading-tight text-ink">
                    {label}
                  </span>
                  <span className="flex min-h-[1.125rem] flex-wrap justify-center gap-0.5">
                    {entry.types.map((t) => (
                      <TypeBadge key={`${entry.id}-${t}`} type={t} size="sm" />
                    ))}
                  </span>
                </SlotButton>
              </PokemonHoverPreview>
            ) : (
              <SlotButton
                active={active}
                filled={false}
                label={label}
                onClick={() => onSlotClick(index)}
              >
                <span className="absolute left-1 top-1 text-[9px] font-bold tabular-nums text-muted">
                  {index + 1}
                </span>
                <span aria-hidden className="block h-12 w-12 sm:h-14 sm:w-14" />
                <span className="text-[10px] font-medium text-muted">
                  Empty
                </span>
                <span aria-hidden className="min-h-[1.125rem]" />
              </SlotButton>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SlotButton({
  active,
  filled,
  label,
  onClick,
  children,
}: {
  active: boolean;
  filled: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={
        active && filled
          ? `${label} — selected, click again to clear`
          : active
            ? `${label} — selected for place/swap`
            : filled
              ? `${label} — click to select`
              : `${label} — click to select`
      }
      aria-pressed={active}
      onClick={onClick}
      className={`pressable relative flex h-full min-h-[6.75rem] w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-2 transition-colors sm:min-h-[7.25rem] ${
        active
          ? "border-interactive bg-interactive-soft/50 ring-1 ring-interactive/40"
          : filled
            ? "border-frame/60 bg-surface hover:border-interactive/40"
            : "border-dashed border-frame/50 bg-surface-2/40 hover:border-interactive/35"
      }`}
    >
      {children}
    </button>
  );
}

function LivingBoxGrid({
  pokemon,
  draftIds,
  onPlace,
  rail = false,
}: {
  pokemon: PokemonEntry[];
  draftIds: Set<string>;
  onPlace: (id: string) => void;
  /** Left-rail density: fewer columns, taller scroll. */
  rail?: boolean;
}) {
  return (
    <ul
      className={`grid gap-2 overflow-y-auto pr-0.5 ${
        rail
          ? "max-h-[min(28rem,calc(100vh-22rem))] grid-cols-2 sm:grid-cols-3 lg:grid-cols-2"
          : "max-h-[min(20rem,45vh)] grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      }`}
    >
      {pokemon.map((entry) => {
        const onTeam = draftIds.has(entry.id);
        const label = monLabel(entry);
        return (
          <li key={entry.id}>
            <PokemonHoverPreview pokemon={entry}>
              <button
                type="button"
                aria-pressed={onTeam}
                aria-label={
                  onTeam
                    ? `${label} — on team, click to move into selected slot`
                    : `Place ${label} into selected slot`
                }
                onClick={() => onPlace(entry.id)}
                className={`pressable flex w-full flex-col items-center gap-1 rounded-md border px-1.5 py-2 transition-colors ${
                  onTeam
                    ? "border-interactive/45 bg-interactive-soft/35"
                    : "border-frame/45 bg-surface/80 hover:border-interactive/35"
                }`}
              >
                <PokemonSpriteImage
                  alt={label}
                  className="pixelated h-12 w-12 object-contain sm:h-14 sm:w-14"
                  height={56}
                  loading="lazy"
                  pokedexId={entry.pokedexId}
                  shiny={entry.isShiny}
                  species={entry.species}
                  width={56}
                />
                <span className="max-w-full truncate text-center text-[11px] font-semibold leading-tight text-ink">
                  {label}
                </span>
                <span className="flex flex-wrap justify-center gap-0.5">
                  {entry.types.slice(0, 2).map((t) => (
                    <TypeBadge key={`${entry.id}-${t}`} type={t} size="sm" />
                  ))}
                </span>
              </button>
            </PokemonHoverPreview>
          </li>
        );
      })}
    </ul>
  );
}

function RecommendScoreChip({
  kind,
  letter,
  title,
}: {
  kind: "BST" | "Comp";
  letter: StatRank;
  title: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold leading-tight ${statRankToneClass(letter)}`}
      title={title}
    >
      <span className="font-semibold tracking-tight opacity-80">{kind}</span>
      <span>{letter}</span>
    </span>
  );
}

function RecommendedPanel({
  pool,
  poolById,
  onApply,
}: {
  pool: PokemonEntry[];
  poolById: Map<string, PokemonEntry>;
  onApply: (entryIds: string[]) => void;
}) {
  const result = useMemo(() => recommendTeam(pool), [pool]);

  if (pool.length === 0) {
    return (
      <Frame dense title="Recommended">
        <p className="text-sm text-muted">
          No living Main or Reserve Pokémon to recommend from.
        </p>
      </Frame>
    );
  }

  const picks = result.picks;

  return (
    <Frame dense title="Recommended">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-lg font-semibold tracking-tight ${
              result.coverageTone === "good"
                ? "text-accent-deep"
                : result.coverageTone === "warn"
                  ? "text-danger"
                  : "text-ink"
            }`}
          >
            {result.coverageLabel}
            <span className="ml-2 align-middle text-xs font-bold tabular-nums text-muted">
              {result.coveredCount}/{result.totalTypes}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            {result.coverageLine}
          </p>
        </div>
        <button
          type="button"
          className={CTA_PRIMARY_SM}
          onClick={() => onApply(result.entryIds)}
          disabled={result.entryIds.length === 0}
        >
          Apply to Planned
        </button>
      </div>

      <ol className="mt-3 space-y-2">
        {picks.map((pick, index) => {
          const entry = poolById.get(pick.entryId);
          if (!entry) return null;
          // Null tier = no IVs on file; it earns no chip at all.
          const catchTier = pick.quality.catchTier;
          const catchLabel =
            catchTier && catchTierHasChrome(catchTier)
              ? catchTierLabel(catchTier)
              : null;
          return (
            <li
              key={pick.entryId}
              className="flex items-start gap-2 rounded border border-frame/50 bg-surface-2/40 px-2 py-1.5"
            >
              <span className="mt-2 w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-muted">
                {index + 1}
              </span>
              <PokemonHoverPreview pokemon={entry}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <PokemonSpriteImage
                    alt={monLabel(entry)}
                    className="pixelated h-10 w-10 object-contain"
                    height={40}
                    loading="lazy"
                    pokedexId={entry.pokedexId}
                    shiny={entry.isShiny}
                    species={entry.species}
                    width={40}
                  />
                </div>
              </PokemonHoverPreview>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-ink">
                    {monLabel(entry)}
                  </span>
                  <span className="flex flex-wrap gap-0.5">
                    {entry.types.slice(0, 2).map((t) => (
                      <TypeBadge key={`${entry.id}-${t}`} type={t} size="sm" />
                    ))}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-muted">
                  {pick.reason}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {catchTier && catchLabel && (
                    <span
                      className={`rounded border border-frame/40 px-1.5 py-0.5 text-[10px] font-bold leading-tight ${catchTierToneClass(catchTier)}`}
                    >
                      {catchLabel}
                    </span>
                  )}
                  {pick.quality.bstRank && (
                    <RecommendScoreChip
                      kind="BST"
                      letter={pick.quality.bstRank}
                      title={`BST Score: ${pick.quality.bstRank}`}
                    />
                  )}
                  {pick.quality.competitive && (
                    <RecommendScoreChip
                      kind="Comp"
                      letter={pick.quality.competitive}
                      title={`Competitive Score: ${pick.quality.competitive}`}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[10px] leading-snug text-muted">
        Optimizes type coverage plus catch / BST / competitive proxies from
        living Main + Reserve. Ignores level caps, gym answers, and rival
        matchups — use Gym / League or vs Trainer for those lenses. Apply fills
        Planned; you can still edit afterward.
      </p>
    </Frame>
  );
}

function CoveragePanels({
  draft,
  verdict,
  offenseGrid,
}: {
  draft: PokemonEntry[];
  verdict: ReturnType<typeof coverageVerdict>;
  offenseGrid: ReturnType<typeof coverageOffenseGrid>;
}) {
  const gapCount = offenseGrid.filter((r) => r.status !== "covered").length;
  // Prefer gaps-only when gaps exist; force all-types when the board is clean.
  const [preferAllTypes, setPreferAllTypes] = useState(false);
  const showAllTypes = gapCount === 0 || preferAllTypes;

  if (draft.length === 0) {
    return (
      <Frame dense title="Coverage">
        <p className="text-sm text-muted">
          Place Pokémon on the left to score type coverage.
        </p>
      </Frame>
    );
  }

  const draftById = new Map(draft.map((m) => [m.id, m] as const));
  const visibleRows = showAllTypes
    ? offenseGrid
    : offenseGrid.filter((r) => r.status !== "covered");

  const sortedRows = [...visibleRows].sort((a, b) => {
    const rank = (s: typeof a.status) =>
      s === "blind" ? 0 : s === "soft" ? 1 : 2;
    return (
      rank(a.status) - rank(b.status) ||
      a.bestMult - b.bestMult ||
      a.defendingType.localeCompare(b.defendingType)
    );
  });

  const verdictTone = verdict.tone;

  return (
    <Frame dense title="Coverage">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-lg font-semibold tracking-tight ${
              verdictTone === "good"
                ? "text-accent-deep"
                : verdictTone === "warn"
                  ? "text-danger"
                  : "text-ink"
            }`}
          >
            {verdict.label}
            <span className="ml-2 align-middle text-xs font-bold tabular-nums text-muted">
              {verdict.coveredCount}/{verdict.total}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            {verdict.line}
          </p>
        </div>
        <div
          className="flex max-w-[11rem] shrink-0 flex-wrap items-center justify-end gap-0.5"
          title={`${verdict.coveredCount} covered · ${verdict.softCount} soft · ${verdict.blindCount} blind`}
          aria-label={`${verdict.coveredCount} covered, ${verdict.softCount} soft, ${verdict.blindCount} blind`}
        >
          {offenseGrid.map((row) => (
            <span
              key={row.defendingType}
              className={`h-1.5 w-1.5 rounded-full ${
                row.status === "covered"
                  ? "bg-accent"
                  : row.status === "soft"
                    ? "bg-accent-2"
                    : "bg-danger"
              }`}
              title={`${row.defendingType}: ${formatMatchupMult(row.bestMult)}`}
            />
          ))}
        </div>
      </div>

      {verdict.callouts.length > 0 && (
        <ul className="mt-2 space-y-1">
          {verdict.callouts.map((bullet) => (
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
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {showAllTypes ? "All types" : `Gaps · ${gapCount}`}
        </p>
        {gapCount > 0 && (
          <button
            type="button"
            className={`${CTA_SECONDARY_SM} !px-2 !py-0.5 !text-[10px]`}
            onClick={() => setPreferAllTypes((v) => !v)}
          >
            {preferAllTypes ? "Gaps only" : "Show all 18"}
          </button>
        )}
      </div>

      <div className="mt-1.5 overflow-x-auto rounded-md border border-frame/60">
        <table className="w-full min-w-[18rem] border-collapse text-left">
          <caption className="sr-only">
            Coverage grid: rows are defending types, columns are your planned
            team. Cells show each Pokémon&apos;s best multiplier into that type.
          </caption>
          <thead>
            <tr className="border-b border-frame/50 bg-surface-2/60">
              <th
                scope="col"
                className="sticky left-0 z-[1] bg-surface-2/95 px-1.5 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted"
              >
                Type
              </th>
              {draft.map((mon) => (
                <th
                  key={mon.id}
                  scope="col"
                  className="px-0.5 py-1.5 text-center"
                  title={monLabel(mon)}
                >
                  <PokemonSpriteImage
                    alt={monLabel(mon)}
                    className="pixelated mx-auto h-7 w-7 object-contain"
                    height={28}
                    loading="lazy"
                    pokedexId={mon.pokedexId}
                    shiny={mon.isShiny}
                    species={mon.species}
                    width={28}
                  />
                  <span className="mt-0.5 block max-w-[2.75rem] truncate text-[0.55rem] font-semibold leading-tight text-muted">
                    {monLabel(mon)}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="px-1 py-1.5 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-muted"
                title="How many of your draft take ≥2× from this type"
              >
                Weak
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.defendingType}
                className={`border-b border-frame/40 last:border-b-0 ${
                  row.status === "blind"
                    ? "bg-danger/10"
                    : row.status === "soft"
                      ? "bg-accent-2/10"
                      : "bg-accent/5"
                }`}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-[1] bg-surface/95 px-1.5 py-1.5"
                >
                  <div className="flex min-w-[4.5rem] items-center gap-1.5">
                    <TypeBadge
                      type={row.defendingType as PokemonType}
                      size="sm"
                    />
                    <span className="text-[10px] font-bold tabular-nums text-muted">
                      {formatMatchupMult(row.bestMult)}
                    </span>
                  </div>
                </th>
                {row.cells.map((cell) => {
                  const answerMon = draftById.get(cell.draftId);
                  const strong = cell.mult >= 2;
                  const soft = cell.mult > 0 && cell.mult < 2;
                  const title = answerMon
                    ? `${monLabel(answerMon)} → ${row.defendingType}: ${formatMatchupMult(cell.mult)}${
                        cell.attackType
                          ? ` ${cell.attackType}${cell.viaMove ? ` via ${cell.viaMove}` : " STAB"}`
                          : ""
                      }`
                    : undefined;
                  return (
                    <td key={cell.draftId} className="px-0.5 py-1 text-center">
                      <span
                        title={title}
                        className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded px-1 text-[11px] font-bold tabular-nums ${
                          strong
                            ? "bg-accent/20 text-accent-deep ring-1 ring-accent/35"
                            : soft
                              ? "bg-surface-2 text-muted"
                              : "text-danger/70"
                        }`}
                      >
                        {cell.mult > 0 ? formatMatchupMult(cell.mult) : "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center">
                  {row.threatenedCount > 0 ? (
                    <span
                      className={`inline-flex min-w-[1.75rem] items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold tabular-nums ${
                        row.threatenedCount >= 3
                          ? "bg-danger/15 text-danger"
                          : row.threatenedCount >= 2
                            ? "bg-accent-2/20 text-ink"
                            : "bg-surface-2 text-muted"
                      }`}
                      title={`${row.threatenedCount}/${draft.length} of your draft take ≥2× from ${row.defendingType}`}
                    >
                      {row.threatenedCount}/{draft.length}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted/60">·</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted">
        Columns are your planned team. Green cells are ≥2× into that type;
        dashes are gaps. Weak = how many of yours take ≥2× from that attack
        type.
      </p>
    </Frame>
  );
}

function PrepPanels({
  slug,
  draft,
  gymPreps,
  earnedBadgeKeys,
}: {
  slug: string;
  draft: PokemonEntry[];
  gymPreps: Array<{
    id: string;
    chapterId: string;
    title: string;
    prep: GuideGymPrep;
  }>;
  earnedBadgeKeys: readonly string[];
}) {
  const draftAsSquad = useMemo(
    () => draft.map((p) => ({ ...p, slot: "MAIN" as const })),
    [draft],
  );

  const gymAnswered = useMemo(
    () =>
      gymPreps.filter((entry) =>
        isGymPrepAnswered(
          squadMatchesForGymPrep(draftAsSquad, entry.prep),
          entry.prep.aceLevel,
          gymPrepCapRole(entry.prep.badgeKey, earnedBadgeKeys),
        ),
      ).length,
    [gymPreps, draftAsSquad, earnedBadgeKeys],
  );

  const leagueAnswered = useMemo(
    () =>
      ELITE_FOUR_PREP.filter((prep) =>
        isGymPrepAnswered(
          squadMatchesForGymPrep(draftAsSquad, prep),
          prep.aceLevel,
          gymPrepCapRole(prep.badgeKey, earnedBadgeKeys),
        ),
      ).length,
    [draftAsSquad, earnedBadgeKeys],
  );

  const gymGaps = gymPreps.length - gymAnswered;
  const leagueGaps = ELITE_FOUR_PREP.length - leagueAnswered;

  return (
    <Frame dense title="Gym / League">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-lg font-semibold tracking-tight ${
              gymGaps === 0 && leagueGaps === 0
                ? "text-accent-deep"
                : gymGaps + leagueGaps >= 6
                  ? "text-danger"
                  : "text-ink"
            }`}
          >
            {gymGaps === 0 && leagueGaps === 0
              ? "Covered"
              : gymGaps === 0
                ? "Gyms covered"
                : "Prep checklist"}
            <span className="ml-2 align-middle text-xs font-bold tabular-nums text-muted">
              {gymAnswered}/{gymPreps.length} gyms · {leagueAnswered}/
              {ELITE_FOUR_PREP.length} league
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            {draft.length === 0
              ? "Place a planned Main to see draft answers."
              : gymGaps + leagueGaps === 0
                ? "Every specialty has a level-ready answer in this draft — typing or a known coverage move."
                : `Expand a row for bring / careful types and level gaps. ${
                    gymGaps > 0
                      ? `${gymGaps} gym${gymGaps === 1 ? "" : "s"} still open.`
                      : `${leagueGaps} league slot${leagueGaps === 1 ? "" : "s"} still open.`
                  }`}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Gym leaders
        </p>
        <ul className="divide-y divide-frame/50 overflow-hidden rounded-md border border-frame/60">
          {gymPreps.map((entry, index) => (
            <PrepCard
              key={entry.id}
              index={index + 1}
              prep={entry.prep}
              draft={draft}
              badge={gymBadgeFromTitle(entry.title)}
              earnedBadgeKeys={earnedBadgeKeys}
              guideHref={toolsHref(slug, "guide", {
                chapter: entry.chapterId,
              })}
            />
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Elite Four + Champion
          </p>
          <Link
            href={toolsHref(slug, "guide", { chapter: "elite-four" })}
            className="text-[10px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2"
          >
            Guide
          </Link>
        </div>
        <ul className="divide-y divide-frame/50 overflow-hidden rounded-md border border-frame/60">
          {ELITE_FOUR_PREP.map((prep, index) => (
            <PrepCard
              key={prep.id}
              index={index + 1}
              prep={prep}
              draft={draft}
              earnedBadgeKeys={earnedBadgeKeys}
            />
          ))}
        </ul>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted">
        Green dotted outline = species typing answer. Gold dashed outline =
        known damaging coverage move (expand a row to see which). Underleveled
        answers still show but don’t count as covered.
      </p>
    </Frame>
  );
}

function gymBadgeFromTitle(title: string): string | null {
  const match = title.match(/\(([^)]+)\)/);
  const badge = match?.[1]?.trim();
  return badge || null;
}

/** Drop repeated Modern Emerald boilerplate from gym party notes. */
function shortenPartyNotes(notes: string): string {
  return notes
    .replace(
      /\s*Modern Emerald Normal keeps(?: gym parties| core parties); Hard\+ may buff them\.?/gi,
      "",
    )
    .replace(/^Vanilla Emerald(?:\s*\([^)]*\))?:\s*/i, "")
    .trim();
}

function PrepCard({
  prep,
  draft,
  index,
  badge,
  guideHref,
  earnedBadgeKeys,
}: {
  prep: GuideGymPrep;
  draft: PokemonEntry[];
  index?: number;
  badge?: string | null;
  guideHref?: string;
  earnedBadgeKeys: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const matches = squadMatchesForGymPrep(
    draft.map((p) => ({ ...p, slot: "MAIN" as const })),
    prep,
  );
  const specialty = prep.specialtyTypes[0];
  const notes = prep.partyNotes ? shortenPartyNotes(prep.partyNotes) : "";
  const capRole = gymPrepCapRole(prep.badgeKey, earnedBadgeKeys);
  const cleared = capRole === "cleared";
  const hasTypeAnswer = matches.length > 0;
  const underOnly =
    hasTypeAnswer && !isGymPrepAnswered(matches, prep.aceLevel, capRole);

  return (
    <li className={cleared ? "opacity-70" : undefined}>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group open:bg-surface-2/40"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
          {index != null && (
            <span className="shrink-0 w-4 text-[11px] font-bold tabular-nums text-muted group-open:text-ink">
              {index}.
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            <span className={cleared ? "text-muted line-through" : "text-ink"}>
              {prep.leaderName}
              {badge && (
                <span className="ml-1.5 font-medium text-muted">{badge}</span>
              )}
            </span>
            <span
              className={`ml-1.5 font-medium tabular-nums ${
                cleared
                  ? "text-accent-deep"
                  : underOnly
                    ? "text-danger"
                    : capRole === "live"
                      ? "text-accent-2"
                      : "text-muted"
              }`}
              title={
                cleared
                  ? "Badge earned — checkpoint cleared"
                  : underOnly
                    ? "Type answers exist but all are underleveled"
                    : capRole === "live"
                      ? "Live house-rule level cap (next undefeated gym)"
                      : "Upcoming target level"
              }
            >
              {cleared ? "· Cleared!" : `· Lv. ${prep.aceLevel}`}
            </span>
          </span>
          {(specialty || !cleared || underOnly) && (
            <span className="flex shrink-0 items-center gap-3">
              {specialty && <TypeBadge type={specialty} size="sm" />}
              {!cleared && (
                <span className="flex items-center gap-0.5">
                  {matches.length > 0 ? (
                    matches.slice(0, SUMMARY_MATCH_LIMIT).map((match) => (
                      <span
                        key={match.entry.id}
                        className={`inline-flex rounded ${
                          hasTypingMatch(match)
                            ? "border border-dotted border-accent/60"
                            : "border border-dashed border-accent-2/60"
                        } ${
                          levelVerdictForGymPrep(
                            match.entry.level,
                            prep.aceLevel,
                          )?.state === "under"
                            ? "opacity-50"
                            : ""
                        }`}
                        title={prepMatchTip(match, prep.aceLevel, capRole)}
                      >
                        <PokemonSpriteImage
                          alt={monLabel(match.entry)}
                          className="pixelated h-6 w-6 object-contain"
                          height={24}
                          loading="lazy"
                          pokedexId={match.entry.pokedexId}
                          shiny={match.entry.isShiny}
                          species={match.entry.species}
                          width={24}
                        />
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-semibold text-danger/80">
                      —
                    </span>
                  )}
                  {matches.length > SUMMARY_MATCH_LIMIT && (
                    <span className="text-[10px] font-semibold tabular-nums text-muted">
                      +{matches.length - SUMMARY_MATCH_LIMIT}
                    </span>
                  )}
                </span>
              )}
              {cleared ? (
                <PrepStatusIcon kind="cleared" title="Badge earned" />
              ) : underOnly ? (
                <PrepStatusIcon
                  kind="under"
                  title="Type answers exist but all are underleveled"
                />
              ) : null}
            </span>
          )}
        </summary>
        <div className="space-y-2 border-t border-frame/40 px-2.5 py-2 pl-7">
          {matches.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {matches.map((match) => {
                const primary = match.typeMatches[0];
                const viaMove = primary?.viaMove ?? null;
                const verdict = levelVerdictForGymPrep(
                  match.entry.level,
                  prep.aceLevel,
                );
                return (
                  <li
                    key={match.entry.id}
                    className={`inline-flex items-center gap-1 rounded px-1 py-0.5 ${
                      verdict?.state === "under"
                        ? "border border-danger/40 bg-danger/5"
                        : verdict?.state === "over" && capRole === "live"
                          ? "border border-accent-2/50 bg-accent-2/10"
                          : viaMove
                            ? "border border-dashed border-accent-2/50 bg-accent-2/10"
                            : "border border-dotted border-accent/50 bg-accent/10"
                    }`}
                    title={prepMatchTip(match, prep.aceLevel, capRole)}
                  >
                    <PokemonSpriteImage
                      alt={monLabel(match.entry)}
                      className="pixelated h-5 w-5 object-contain"
                      height={20}
                      loading="lazy"
                      pokedexId={match.entry.pokedexId}
                      shiny={match.entry.isShiny}
                      species={match.entry.species}
                      width={20}
                    />
                    <span className="text-[10px] font-semibold text-ink">
                      {monLabel(match.entry)}
                    </span>
                    {primary && (
                      <TypeBadge type={primary.type} size="sm" variant="soft" />
                    )}
                    {viaMove && (
                      <span className="text-[10px] font-medium text-muted">
                        via {viaMove}
                      </span>
                    )}
                    {verdict && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums ${
                          verdict.state === "under"
                            ? "text-danger"
                            : verdict.state === "over" && capRole === "live"
                              ? "text-accent-2"
                              : "text-muted"
                        }`}
                      >
                        {formatGymPrepLevelVerdict(verdict, capRole)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[11px] text-danger">
              No recommended typing or coverage move in this draft.
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <TypeRow label="Bring" types={prep.recommendedTypes} />
            {prep.cautionTypes && prep.cautionTypes.length > 0 && (
              <TypeRow label="Careful" types={prep.cautionTypes} />
            )}
          </div>
          {notes && (
            <p className="text-[11px] leading-relaxed text-muted">{notes}</p>
          )}
          {guideHref && (
            <Link
              href={guideHref}
              className="inline-block text-[11px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2"
            >
              Open Guide
            </Link>
          )}
        </div>
      </details>
    </li>
  );
}

function TypeRow({
  label,
  types,
}: {
  label: string;
  types: readonly PokemonType[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {types.map((t) => (
        <TypeBadge key={`${label}-${t}`} type={t} size="sm" variant="soft" />
      ))}
    </div>
  );
}

function VsTrainerPanel({
  draft,
  opponent,
  opponentMain,
}: {
  draft: PokemonEntry[];
  opponent: TrainerProfile | null;
  opponentMain: PokemonEntry[];
}) {
  const matchup = useMemo(
    () => vsTrainerMatchup(draft, opponentMain),
    [draft, opponentMain],
  );
  const grid = useMemo(
    () => vsTrainerOffenseGrid(draft, opponentMain),
    [draft, opponentMain],
  );

  if (!opponent) {
    return (
      <Frame dense title="vs Trainer">
        <p className="text-sm text-muted">Pick an opponent board.</p>
      </Frame>
    );
  }

  if (opponentMain.length === 0) {
    return (
      <Frame dense title={`vs ${displayName(opponent)}`}>
        <p className="text-sm text-muted">
          {displayName(opponent)} has no Main Squad yet.
        </p>
      </Frame>
    );
  }

  if (draft.length === 0) {
    return (
      <Frame dense title={`vs ${displayName(opponent)}`}>
        <p className="text-sm text-muted">
          Place Pokémon on the left to score this matchup.
        </p>
      </Frame>
    );
  }

  const assessmentById = new Map(
    matchup.targets.map((t) => [t.targetId, t] as const),
  );
  const draftById = new Map(draft.map((m) => [m.id, m] as const));

  const verdictTone =
    matchup.verdict === "favorable"
      ? "good"
      : matchup.verdict === "even"
        ? "neutral"
        : "warn";

  const callouts = matchup.bullets.filter(
    (b) =>
      b.tone === "warn" || /pressure|blind|No ≥2|Only neutral/i.test(b.text),
  );

  return (
    <Frame dense title={`vs ${displayName(opponent)}`}>
      {/* Compact verdict */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-lg font-semibold tracking-tight ${
              verdictTone === "good"
                ? "text-accent-deep"
                : verdictTone === "warn"
                  ? "text-danger"
                  : "text-ink"
            }`}
          >
            {matchup.verdictLabel}
            <span className="ml-2 align-middle text-xs font-bold tabular-nums text-muted">
              {matchup.score}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            {matchup.recommendation}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5"
          title={`${matchup.answeredCount} answered · ${matchup.softCount} soft · ${matchup.blindCount} blind`}
          aria-label={`${matchup.answeredCount} answered, ${matchup.softCount} soft, ${matchup.blindCount} blind`}
        >
          {matchup.targets.map((t) => (
            <span
              key={t.targetId}
              className={`h-2 w-2 rounded-full ${
                t.status === "answered"
                  ? "bg-accent"
                  : t.status === "soft"
                    ? "bg-accent-2"
                    : "bg-danger"
              }`}
            />
          ))}
        </div>
      </div>

      {callouts.length > 0 && (
        <ul className="mt-2 space-y-1">
          {callouts.slice(0, 2).map((bullet) => (
            <li
              key={bullet.text}
              className={`text-[11px] leading-snug ${
                bullet.tone === "warn" ? "text-danger" : "text-muted"
              }`}
            >
              {bullet.text}
            </li>
          ))}
        </ul>
      )}

      {/* Answer matrix: their rows × your columns */}
      <div className="mt-3 overflow-x-auto rounded-md border border-frame/60">
        <table className="w-full min-w-[18rem] border-collapse text-left">
          <caption className="sr-only">
            Matchup grid: rows are {displayName(opponent)}&apos;s Main, columns
            are your planned team. Cells show your best type multiplier into
            that Pokémon.
          </caption>
          <thead>
            <tr className="border-b border-frame/50 bg-surface-2/60">
              <th
                scope="col"
                className="sticky left-0 z-[1] bg-surface-2/95 px-1.5 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted"
              >
                Them
              </th>
              {draft.map((mon) => (
                <th
                  key={mon.id}
                  scope="col"
                  className="px-0.5 py-1.5 text-center"
                  title={monLabel(mon)}
                >
                  <PokemonSpriteImage
                    alt={monLabel(mon)}
                    className="pixelated mx-auto h-7 w-7 object-contain"
                    height={28}
                    loading="lazy"
                    pokedexId={mon.pokedexId}
                    shiny={mon.isShiny}
                    species={mon.species}
                    width={28}
                  />
                  <span className="mt-0.5 block max-w-[2.75rem] truncate text-[0.55rem] font-semibold leading-tight text-muted">
                    {monLabel(mon)}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="px-1 py-1.5 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-muted"
                title="How many of your draft this mon hits for ≥2×"
              >
                Threat
              </th>
            </tr>
          </thead>
          <tbody>
            {opponentMain.map((target, rowIdx) => {
              const assessment = assessmentById.get(target.id);
              const status = assessment?.status ?? "soft";
              const rowCells = grid[rowIdx] ?? [];
              return (
                <tr
                  key={target.id}
                  className={`border-b border-frame/40 last:border-b-0 ${
                    status === "blind"
                      ? "bg-danger/10"
                      : status === "answered"
                        ? "bg-accent/5"
                        : "bg-transparent"
                  }`}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] bg-surface/95 px-1.5 py-1.5"
                  >
                    <div className="flex min-w-[5.5rem] max-w-[7.5rem] items-center gap-1.5">
                      <PokemonSpriteImage
                        alt={monLabel(target)}
                        className="pixelated h-8 w-8 shrink-0 object-contain"
                        height={32}
                        loading="lazy"
                        pokedexId={target.pokedexId}
                        shiny={target.isShiny}
                        species={target.species}
                        width={32}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-ink">
                          {monLabel(target)}
                        </p>
                        <span className="mt-0.5 flex flex-wrap gap-0.5">
                          {target.types.slice(0, 2).map((t) => (
                            <TypeBadge
                              key={`${target.id}-${t}`}
                              type={t}
                              size="sm"
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                  </th>
                  {rowCells.map((cell) => {
                    const answerMon = draftById.get(cell.draftId);
                    const strong = cell.mult >= 2;
                    const soft = cell.mult > 0 && cell.mult < 2;
                    const title = answerMon
                      ? `${monLabel(answerMon)} → ${monLabel(target)}: ${formatMatchupMult(cell.mult)}${
                          cell.attackType
                            ? ` ${cell.attackType}${cell.viaMove ? ` via ${cell.viaMove}` : " STAB"}`
                            : ""
                        }`
                      : undefined;
                    return (
                      <td
                        key={cell.draftId}
                        className="px-0.5 py-1 text-center"
                      >
                        <span
                          title={title}
                          className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded px-1 text-[11px] font-bold tabular-nums ${
                            strong
                              ? "bg-accent/20 text-accent-deep ring-1 ring-accent/35"
                              : soft
                                ? "bg-surface-2 text-muted"
                                : "text-danger/70"
                          }`}
                        >
                          {cell.mult > 0 ? formatMatchupMult(cell.mult) : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 text-center">
                    {assessment && assessment.threatenedCount > 0 ? (
                      <span
                        className={`inline-flex min-w-[1.75rem] items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold tabular-nums ${
                          assessment.threatenedCount >= 2
                            ? "bg-danger/15 text-danger"
                            : "bg-surface-2 text-muted"
                        }`}
                        title={
                          assessment.threatAttackType
                            ? `Hits ${assessment.threatenedCount}/${draft.length} of your draft for ≥2× (${formatMatchupMult(assessment.threatMult)} ${assessment.threatAttackType})`
                            : `Hits ${assessment.threatenedCount}/${draft.length} of your draft for ≥2×`
                        }
                      >
                        {assessment.threatenedCount}/{draft.length}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted/60">·</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted">
        Columns are your planned team. Green cells are ≥2× answers; dashes are
        gaps. Threat = how many of yours they hit for ≥2×.
      </p>
    </Frame>
  );
}
