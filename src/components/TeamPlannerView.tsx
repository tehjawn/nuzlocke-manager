"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Frame, frameCountTitle } from "@/components/Frame";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { TypeBadge } from "@/components/TypeBadge";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import { squadMatchesForGymPrep } from "@/features/guide/guide-gym-prep";
import type { GuideGymPrep } from "@/features/guide/guide-types";
import { ELITE_FOUR_PREP } from "@/features/planner/elite-four-prep";
import {
  clearPlannerDraft,
  PLANNER_DRAFT_MAX,
  plannerDraftStorageKey,
  readPlannerDraft,
  setPlannerDraftIds,
} from "@/features/planner/planner-drafts";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import type { PokemonType } from "@/lib/pokemon-types";
import {
  formatMatchupMult,
  offensiveCoverage,
  recommendDraftCoverageTips,
  teamCoverageSummary,
  teamDefensiveProfile,
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

const MODES: ReadonlyArray<{ id: PlannerMode; label: string }> = [
  { id: "coverage", label: "Coverage" },
  { id: "prep", label: "Gym / League" },
  { id: "vs", label: "vs Trainer" },
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
  const [mode, setMode] = useState<PlannerMode>(
    parsePlannerMode(initialMode),
  );
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
  const [boxOpen, setBoxOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const skipPersistRef = useRef(false);
  const boxPanelRef = useRef<HTMLDivElement>(null);

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
    if (!viewerId) {
      skipPersistRef.current = true;
      setDraftIds([]);
      setActiveSlot(0);
      setDraftHydrated(true);
      return;
    }
    const key = plannerDraftStorageKey(slug, viewerId);
    const stored = readPlannerDraft(key);
    const trainer = trainers.find((t) => t.id === viewerId);
    if (!trainer) {
      skipPersistRef.current = true;
      setDraftIds([]);
      setActiveSlot(0);
      setDraftHydrated(true);
      return;
    }
    const valid = new Set(livingBox(trainer).map((p) => p.id));
    const fromStorage = stored.entryIds.filter((id) => valid.has(id));
    const next =
      fromStorage.length > 0 ? fromStorage : defaultDraftIds(trainer);
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

  // Close box drawer on Escape.
  useEffect(() => {
    if (!boxOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setBoxOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boxOpen]);

  const coverage = useMemo(() => offensiveCoverage(draft), [draft]);
  const defense = useMemo(() => teamDefensiveProfile(draft), [draft]);
  const summary = useMemo(
    () => teamCoverageSummary(draft, coverage, defense),
    [draft, coverage, defense],
  );

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
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tool", "planner");
    url.searchParams.set("mode", next);
    window.history.replaceState(window.history.state, "", url.href);
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
    setBoxOpen(true);
    queueMicrotask(() => boxPanelRef.current?.focus());
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
        {mode === "vs" ? (
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
        ) : null}
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
              <button
                type="button"
                className={`${CTA_PRIMARY_SM} lg:hidden`}
                aria-expanded={boxOpen}
                aria-controls="planner-living-box"
                onClick={() => {
                  setBoxOpen((open) => !open);
                  if (!boxOpen) {
                    queueMicrotask(() => boxPanelRef.current?.focus());
                  }
                }}
              >
                {boxOpen ? "Hide Boxed Pokémon" : "Show Boxed Pokémon"}
              </button>
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

          {/* Always visible on desktop; toggled on mobile */}
          <div
            id="planner-living-box"
            ref={boxPanelRef}
            tabIndex={-1}
            className={`rounded-lg border border-frame/70 bg-surface-2/60 p-3 outline-none ${
              boxOpen ? "block" : "hidden lg:block"
            }`}
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

        <div className="min-w-0 space-y-3">
          <div
            role="tablist"
            aria-label="Planner analysis"
            className="flex gap-1 border-b border-frame/70"
          >
            {MODES.map((entry) => {
              const active = mode === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`planner-tab-${entry.id}`}
                  onClick={() => selectMode(entry.id)}
                  className={`pressable -mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "border-interactive text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          <section
            role="tabpanel"
            aria-labelledby={`planner-tab-${mode}`}
            className="min-w-0 space-y-3"
            aria-live="polite"
          >
            {mode === "coverage" ? (
              <CoveragePanels
                coverage={coverage}
                defense={defense}
                draft={draft}
                summary={summary}
              />
            ) : null}
            {mode === "prep" ? (
              <PrepPanels slug={slug} draft={draft} gymPreps={gymPreps} />
            ) : null}
            {mode === "vs" ? (
              <VsTrainerPanel
                draft={draft}
                opponent={opponent}
                opponentMain={opponentMain}
              />
            ) : null}
          </section>
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
                      <TypeBadge
                        key={`${entry.id}-${t}`}
                        type={t}
                        size="sm"
                      />
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
                <span
                  aria-hidden
                  className="block h-12 w-12 sm:h-14 sm:w-14"
                />
                <span className="text-[10px] font-medium text-muted">Empty</span>
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

function CoveragePanels({
  coverage,
  defense,
  draft,
  summary,
}: {
  coverage: ReturnType<typeof offensiveCoverage>;
  defense: ReturnType<typeof teamDefensiveProfile>;
  draft: PokemonEntry[];
  summary: ReturnType<typeof teamCoverageSummary>;
}) {
  if (draft.length === 0) {
    return (
      <Frame dense title="Coverage">
        <p className="text-sm text-muted">
          Tap a team slot and show boxed Pokémon to see a live coverage TLDR.
        </p>
      </Frame>
    );
  }

  return (
    <div className="space-y-3">
      <Frame dense title="At a glance">
        <ul className="space-y-1.5">
          {summary.map((bullet) => (
            <li
              key={bullet.text}
              className={`flex gap-2 text-sm leading-snug ${
                bullet.tone === "good"
                  ? "text-accent-deep"
                  : bullet.tone === "warn"
                    ? "text-danger"
                    : "text-ink"
              }`}
            >
              <span aria-hidden className="mt-0.5 shrink-0 text-muted">
                {bullet.tone === "good"
                  ? "✓"
                  : bullet.tone === "warn"
                    ? "!"
                    : "·"}
              </span>
              <span>{bullet.text}</span>
            </li>
          ))}
        </ul>
      </Frame>

      <div className="grid gap-3 sm:grid-cols-2">
        <Frame dense title={frameCountTitle("Gaps", coverage.gaps.length)}>
          {coverage.gaps.length === 0 ? (
            <p className="text-xs text-muted">Full ≥2× coverage.</p>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {coverage.gaps.map((gap) => (
                <li
                  key={gap.defendingType}
                  className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/10 px-1.5 py-1"
                >
                  <TypeBadge
                    type={gap.defendingType as PokemonType}
                    size="sm"
                  />
                  <span className="text-[10px] font-bold tabular-nums text-muted">
                    {formatMatchupMult(gap.bestMult)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Frame>

        <Frame dense title="Shared holes">
          {defense.sharedHoles.length === 0 ? (
            <p className="text-xs text-muted">No shared ≥2× weaknesses.</p>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {defense.sharedHoles.map((hole) => (
                <li
                  key={hole.attackType}
                  className="inline-flex items-center gap-1 rounded-md border border-frame/40 bg-surface-2 px-1.5 py-1"
                >
                  <TypeBadge
                    type={hole.attackType as PokemonType}
                    size="sm"
                  />
                  <span className="text-[10px] font-bold tabular-nums text-muted">
                    {formatMatchupMult(hole.worstMult)} · {hole.weakCount}/
                    {draft.length}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {defense.teamImmunities.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-frame/40 pt-2">
              <span className="text-[10px] font-semibold text-muted">
                Immune
              </span>
              {defense.teamImmunities.map((t) => (
                <TypeBadge
                  key={t}
                  type={t as PokemonType}
                  size="sm"
                  variant="soft"
                />
              ))}
            </div>
          ) : null}
        </Frame>
      </div>

      <Frame dense collapsible defaultOpen={false} title="Full offensive grid">
        <p className="mb-2 text-[11px] text-muted">
          Best hit into each defending type. Accent = ≥2×.
        </p>
        <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
          {coverage.cells.map((cell) => {
            const good = cell.bestMult >= 2;
            const via = draft.find((p) => p.id === cell.viaEntryId);
            return (
              <li
                key={cell.defendingType}
                className={`rounded-md border px-1.5 py-1 ${
                  good
                    ? "border-accent/35 bg-accent/10"
                    : "border-frame/50 bg-surface-2/60"
                }`}
                title={
                  via
                    ? `${monLabel(via)}${cell.viaMove ? ` · ${cell.viaMove}` : " · STAB"}`
                    : "No hit"
                }
              >
                <div className="flex items-center justify-between gap-0.5">
                  <TypeBadge
                    type={cell.defendingType as PokemonType}
                    size="sm"
                  />
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      good ? "text-ink" : "text-danger"
                    }`}
                  >
                    {formatMatchupMult(cell.bestMult)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Frame>
    </div>
  );
}

function PrepPanels({
  slug,
  draft,
  gymPreps,
}: {
  slug: string;
  draft: PokemonEntry[];
  gymPreps: Array<{
    id: string;
    chapterId: string;
    title: string;
    prep: GuideGymPrep;
  }>;
}) {
  return (
    <div className="space-y-3">
      <Frame dense title="Gym leaders">
        <p className="mb-2 text-[11px] text-muted">
          Specialty + your draft answers. Expand a row for bring / careful types.
        </p>
        <ul className="divide-y divide-frame/50 overflow-hidden rounded-md border border-frame/60">
          {gymPreps.map((entry) => (
            <PrepCard
              key={entry.id}
              prep={entry.prep}
              draft={draft}
              subtitle={entry.title}
              guideHref={toolsHref(slug, "guide", {
                chapter: entry.chapterId,
              })}
            />
          ))}
        </ul>
      </Frame>

      <Frame
        dense
        collapsible
        defaultOpen={false}
        title="Elite Four + Champion"
        actions={
          <Link
            href={toolsHref(slug, "guide", { chapter: "elite-four" })}
            className="text-[11px] font-semibold text-[var(--on-chrome)] underline decoration-[var(--on-chrome)]/35 underline-offset-2"
          >
            Guide
          </Link>
        }
      >
        <ul className="divide-y divide-frame/50 overflow-hidden rounded-md border border-frame/60">
          {ELITE_FOUR_PREP.map((prep) => (
            <PrepCard key={prep.id} prep={prep} draft={draft} />
          ))}
        </ul>
      </Frame>
    </div>
  );
}

function PrepCard({
  prep,
  draft,
  subtitle,
  guideHref,
}: {
  prep: GuideGymPrep;
  draft: PokemonEntry[];
  subtitle?: string;
  guideHref?: string;
}) {
  const matches = squadMatchesForGymPrep(
    draft.map((p) => ({ ...p, slot: "MAIN" as const })),
    prep,
  );
  const specialty = prep.specialtyTypes[0];

  return (
    <li>
      <details className="group open:bg-surface-2/40">
        <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-2 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="shrink-0 text-[10px] text-muted transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {prep.leaderName}
              {subtitle ? (
                <span className="ml-1 font-medium text-muted">
                  · {subtitle.replace(/^Defeat\s+/i, "").split("—")[0]?.trim()}
                </span>
              ) : null}
            </span>
            {specialty ? <TypeBadge type={specialty} size="sm" /> : null}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1 sm:ml-auto sm:justify-end">
            {matches.length > 0 ? (
              matches.slice(0, 3).map(({ entry, matchedTypes }) => (
                <span
                  key={entry.id}
                  className="inline-flex max-w-[10rem] items-center gap-1 rounded border border-accent/30 bg-accent/10 px-1 py-0.5"
                >
                  <PokemonSpriteImage
                    alt={monLabel(entry)}
                    className="pixelated h-5 w-5 object-contain"
                    height={20}
                    loading="lazy"
                    pokedexId={entry.pokedexId}
                    shiny={entry.isShiny}
                    species={entry.species}
                    width={20}
                  />
                  <span className="truncate text-[10px] font-semibold text-ink">
                    {monLabel(entry)}
                  </span>
                  {matchedTypes[0] ? (
                    <TypeBadge type={matchedTypes[0]} size="sm" variant="soft" />
                  ) : null}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted">No answer</span>
            )}
          </span>
        </summary>
        <div className="space-y-2 border-t border-frame/40 px-2.5 py-2 pl-7">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <TypeRow label="Bring" types={prep.recommendedTypes} />
            {prep.cautionTypes?.length ? (
              <TypeRow label="Careful" types={prep.cautionTypes} />
            ) : null}
          </div>
          {prep.partyNotes ? (
            <p className="text-[11px] leading-relaxed text-muted">
              {prep.partyNotes}
            </p>
          ) : null}
          {guideHref ? (
            <Link
              href={guideHref}
              className="inline-block text-[11px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2"
            >
              Open Guide
            </Link>
          ) : null}
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
          Place Pokémon above to see counter tips update live.
        </p>
      </Frame>
    );
  }

  return (
    <Frame dense title={`vs ${displayName(opponent)}`}>
      <p className="mb-2 text-[11px] text-muted">
        Draft answers into their Main — moves when present, otherwise STAB.
      </p>
      <ul className="space-y-2">
        {opponentMain.map((target) => {
          const tips = recommendDraftCoverageTips(target.types, draft, {
            limit: 3,
            minMult: 2,
          });
          return (
            <li
              key={target.id}
              className="rounded-md border border-frame/60 bg-surface-2/50 p-2"
            >
              <div className="flex items-center gap-2">
                <PokemonSpriteImage
                  alt={monLabel(target)}
                  className="pixelated h-10 w-10 object-contain"
                  height={40}
                  loading="lazy"
                  pokedexId={target.pokedexId}
                  shiny={target.isShiny}
                  species={target.species}
                  width={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">
                    {monLabel(target)}
                  </p>
                  <span className="mt-0.5 flex flex-wrap gap-0.5">
                    {target.types.map((t) => (
                      <TypeBadge
                        key={`${target.id}-${t}`}
                        type={t}
                        size="sm"
                      />
                    ))}
                  </span>
                </div>
                {tips.length === 0 ? (
                  <span className="shrink-0 text-[10px] text-muted">
                    No ≥2×
                  </span>
                ) : null}
              </div>
              {tips.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1 border-t border-frame/40 pt-1.5">
                  {tips.map((tip) => {
                    const tipMon = draft.find((p) => p.id === tip.entryId);
                    return (
                      <li
                        key={tip.entryId}
                        className="inline-flex items-center gap-1 rounded border border-frame/40 bg-surface/70 px-1 py-0.5"
                        title={tip.reason}
                      >
                        {tipMon ? (
                          <PokemonSpriteImage
                            alt={tip.displayName}
                            className="pixelated h-5 w-5 object-contain"
                            height={20}
                            loading="lazy"
                            pokedexId={tipMon.pokedexId}
                            shiny={tipMon.isShiny}
                            species={tipMon.species}
                            width={20}
                          />
                        ) : null}
                        <span className="text-[10px] font-semibold text-ink">
                          {tip.displayName}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums text-accent">
                          {formatMatchupMult(tip.mult)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
