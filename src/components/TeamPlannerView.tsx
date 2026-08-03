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
import { CTA_SECONDARY_SM } from "@/lib/cta";
import type { PokemonType } from "@/lib/pokemon-types";
import {
  formatMatchupMult,
  offensiveCoverage,
  recommendDraftCoverageTips,
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

/** Normalize to a fixed-length slot array (empty string = vacant). */
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

  // Hydrate / reset draft when trainer changes.
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

  // Persist draft after user edits (skip the hydrate write).
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
      // Team full — step to the next slot for continued swaps.
      setActiveSlot((from + 1) % PLANNER_DRAFT_MAX);
      return;
    }
    setActiveSlot(firstEmptySlot(normalized));
  }

  /** Click a planned-team slot: select it, or clear if already active + filled. */
  function onSlotClick(index: number) {
    if (activeSlot === index && slots[index]) {
      const next = [...slots];
      next[index] = "";
      commitSlots(next);
      return;
    }
    setActiveSlot(index);
  }

  /** Place a living-box mon into the active slot (moves if already on the team). */
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

  return (
    <div className="space-y-3">
      {/* —— Options bar —— */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-frame/70 bg-surface-2/50 p-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <div
          role="group"
          aria-label="Team Planner modes"
          className="flex flex-wrap gap-1"
        >
          {MODES.map((entry) => {
            const active = mode === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectMode(entry.id)}
                className={`pressable rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
                    : "border-transparent bg-surface text-muted hover:bg-surface/80"
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        <label className="min-w-[9rem] flex-1 space-y-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted sm:max-w-[14rem]">
          Plan for
          <select
            value={viewerId}
            onChange={(e) => setViewerId(e.target.value)}
            className="w-full rounded-md border border-frame bg-surface px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
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
          <label className="min-w-[9rem] flex-1 space-y-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted sm:max-w-[14rem]">
            Opponent
            <select
              value={opponentId}
              onChange={(e) => setOpponentId(e.target.value)}
              className="w-full rounded-md border border-frame bg-surface px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-ink"
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayName(t)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex flex-wrap gap-1.5 sm:ml-auto sm:pb-0.5">
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

      {/* —— Workspace: squad rail + analysis —— */}
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-2 lg:sticky lg:top-3 lg:self-start">
          <Frame
            dense
            title={frameCountTitle("Planned team", filledCount)}
            actions={
              <span className="text-[10px] font-medium tabular-nums text-[var(--on-chrome)]/70">
                / {PLANNER_DRAFT_MAX}
              </span>
            }
          >
            <p className="mb-2 text-[11px] leading-snug text-muted">
              Select a slot, then tap a box mon to place or swap. Tap the active
              filled slot again to clear. Sandbox only — board unchanged.
            </p>
            <PlannedTeamSlots
              slots={slots}
              poolById={poolById}
              activeSlot={activeSlot}
              onSlotClick={onSlotClick}
            />
          </Frame>

          <Frame
            dense
            collapsible
            defaultOpen
            title={frameCountTitle("Living box", pool.length)}
          >
            {pool.length === 0 ? (
              <p className="text-xs text-muted">
                No Main or Reserve Pokémon on this board yet.
              </p>
            ) : (
              <LivingBoxGrid
                pokemon={pool}
                draftIds={draftIdSet}
                onPlace={placeFromBox}
              />
            )}
          </Frame>
        </aside>

        <section className="min-w-0 space-y-3" aria-live="polite">
          {mode === "coverage" ? (
            <CoveragePanels
              coverage={coverage}
              defense={defense}
              draft={draft}
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
  );
}

function PlannedTeamSlots({
  slots,
  poolById,
  activeSlot,
  onSlotClick,
}: {
  slots: string[];
  poolById: Map<string, PokemonEntry>;
  activeSlot: number;
  onSlotClick: (index: number) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-2">
      {slots.map((id, index) => {
        const entry = id ? poolById.get(id) : undefined;
        const active = activeSlot === index;
        const label = entry ? monLabel(entry) : `Empty slot ${index + 1}`;
        return (
          <li key={`slot-${index}`}>
            {entry ? (
              <PokemonHoverPreview pokemon={entry}>
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
                    className="pixelated h-11 w-11 object-contain"
                    height={44}
                    loading="lazy"
                    pokedexId={entry.pokedexId}
                    shiny={entry.isShiny}
                    species={entry.species}
                    width={44}
                  />
                  <span className="max-w-full truncate text-center text-[10px] font-semibold leading-tight text-ink">
                    {label}
                  </span>
                  <span className="flex flex-wrap justify-center gap-0.5">
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
                <span className="text-[9px] font-bold tabular-nums text-muted">
                  {index + 1}
                </span>
                <span className="text-[10px] font-medium text-muted">Empty</span>
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
      className={`pressable relative flex w-full flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 transition-colors ${
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
}: {
  pokemon: PokemonEntry[];
  draftIds: Set<string>;
  onPlace: (id: string) => void;
}) {
  return (
    <ul className="grid max-h-[min(28rem,55vh)] grid-cols-4 gap-1 overflow-y-auto pr-0.5 sm:grid-cols-3">
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
                className={`pressable flex w-full flex-col items-center gap-0.5 rounded-md border px-0.5 py-1 transition-colors ${
                  onTeam
                    ? "border-interactive/45 bg-interactive-soft/35"
                    : "border-frame/45 bg-surface/80 hover:border-interactive/35"
                }`}
              >
                <PokemonSpriteImage
                  alt={label}
                  className="pixelated h-9 w-9 object-contain"
                  height={36}
                  loading="lazy"
                  pokedexId={entry.pokedexId}
                  shiny={entry.isShiny}
                  species={entry.species}
                  width={36}
                />
                <span className="max-w-full truncate text-center text-[9px] font-semibold leading-tight text-ink">
                  {label}
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
}: {
  coverage: ReturnType<typeof offensiveCoverage>;
  defense: ReturnType<typeof teamDefensiveProfile>;
  draft: PokemonEntry[];
}) {
  if (draft.length === 0) {
    return (
      <Frame dense title="Coverage">
        <p className="text-sm text-muted">
          Place Pokémon on the left to see offensive coverage and defensive
          holes update live.
        </p>
      </Frame>
    );
  }

  return (
    <div className="space-y-3">
      <Frame dense title="Offensive coverage">
        <p className="mb-2 text-[11px] text-muted">
          Best hit into each defending type. Accent = ≥2×; danger = gap.
        </p>
        <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 xl:grid-cols-6">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Frame
          dense
          title={frameCountTitle("Gaps", coverage.gaps.length)}
        >
          {coverage.gaps.length === 0 ? (
            <p className="text-xs text-muted">Full ≥2× coverage.</p>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {coverage.gaps.map((gap) => (
                <li
                  key={gap.defendingType}
                  className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/10 px-1 py-0.5"
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
                  className="inline-flex items-center gap-1 rounded-md border border-frame/40 bg-surface-2 px-1 py-0.5"
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
      <Frame
        dense
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
        <ul className="space-y-2">
          {ELITE_FOUR_PREP.map((prep) => (
            <PrepCard key={prep.id} prep={prep} draft={draft} compact />
          ))}
        </ul>
      </Frame>

      <Frame dense collapsible defaultOpen title="Gym leaders">
        <ul className="space-y-2">
          {gymPreps.map((entry) => (
            <PrepCard
              key={entry.id}
              prep={entry.prep}
              draft={draft}
              compact
              subtitle={entry.title}
              guideHref={toolsHref(slug, "guide", {
                chapter: entry.chapterId,
              })}
            />
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
  compact = false,
}: {
  prep: GuideGymPrep;
  draft: PokemonEntry[];
  subtitle?: string;
  guideHref?: string;
  compact?: boolean;
}) {
  const matches = squadMatchesForGymPrep(
    draft.map((p) => ({ ...p, slot: "MAIN" as const })),
    prep,
  );

  return (
    <li
      className={`rounded-md border border-frame/60 bg-surface-2/50 ${
        compact ? "p-2" : "p-3"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <p className="text-xs font-semibold tracking-tight text-ink">
          {prep.leaderName}
          {subtitle ? (
            <span className="ml-1 font-medium text-muted">
              · {subtitle.replace(/^Defeat\s+/i, "")}
            </span>
          ) : null}
        </p>
        {guideHref ? (
          <Link
            href={guideHref}
            className="text-[10px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2"
          >
            Guide
          </Link>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        <TypeRow label="Vs" types={prep.specialtyTypes} />
        <TypeRow label="Bring" types={prep.recommendedTypes} />
        {prep.cautionTypes?.length ? (
          <TypeRow label="Careful" types={prep.cautionTypes} />
        ) : null}
      </div>
      {matches.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1 border-t border-frame/40 pt-1.5">
          {matches.map(({ entry, matchedTypes }) => (
            <li
              key={entry.id}
              className="inline-flex items-center gap-1 rounded border border-frame/40 bg-surface/70 px-1 py-0.5"
            >
              <PokemonSpriteImage
                alt={monLabel(entry)}
                className="pixelated h-6 w-6 object-contain"
                height={24}
                loading="lazy"
                pokedexId={entry.pokedexId}
                shiny={entry.isShiny}
                species={entry.species}
                width={24}
              />
              <span className="text-[10px] font-semibold text-ink">
                {monLabel(entry)}
              </span>
              {matchedTypes.map((t) => (
                <TypeBadge
                  key={`${entry.id}-${t}`}
                  type={t}
                  size="sm"
                  variant="soft"
                />
              ))}
            </li>
          ))}
        </ul>
      ) : draft.length > 0 ? (
        <p className="mt-1.5 text-[10px] text-muted">
          No draft overlap with {prep.recommendedTypes.join(" / ")}.
        </p>
      ) : null}
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
          Place Pokémon on the left to see counter tips update live.
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
