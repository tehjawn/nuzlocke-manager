"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
    const self = myTrainerId ?? trainers.find((t) => livingBox(t).length > 0)?.id;
    const other = trainers.find(
      (t) => t.id !== self && pokemonInSlot(t, "MAIN").length > 0,
    );
    return other?.id ?? trainers.find((t) => t.id !== self)?.id ?? trainers[0]?.id ?? "";
  });
  const [draftIds, setDraftIds] = useState<string[]>([]);
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

  // Hydrate / reset draft when trainer changes.
  useEffect(() => {
    if (!viewerId) {
      skipPersistRef.current = true;
      setDraftIds([]);
      setDraftHydrated(true);
      return;
    }
    const key = plannerDraftStorageKey(slug, viewerId);
    const stored = readPlannerDraft(key);
    const trainer = trainers.find((t) => t.id === viewerId);
    if (!trainer) {
      skipPersistRef.current = true;
      setDraftIds([]);
      setDraftHydrated(true);
      return;
    }
    const valid = new Set(livingBox(trainer).map((p) => p.id));
    const fromStorage = stored.entryIds.filter((id) => valid.has(id));
    skipPersistRef.current = true;
    setDraftIds(
      fromStorage.length > 0 ? fromStorage : defaultDraftIds(trainer),
    );
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

  const draft = useMemo(
    () =>
      draftIds
        .map((id) => poolById.get(id))
        .filter((m): m is PokemonEntry => m != null),
    [draftIds, poolById],
  );

  const coverage = useMemo(() => offensiveCoverage(draft), [draft]);
  const defense = useMemo(() => teamDefensiveProfile(draft), [draft]);

  const gymPreps = useMemo(
    () =>
      EMERALD_GUIDE.steps
        .filter(
          (s) =>
            s.gymPrep != null && s.chapterId !== "elite-four",
        )
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

  function toggleDraft(entryId: string) {
    setDraftIds((prev) => {
      if (prev.includes(entryId)) {
        return prev.filter((id) => id !== entryId);
      }
      if (prev.length >= PLANNER_DRAFT_MAX) return prev;
      return [...prev, entryId];
    });
  }

  function resetToMain() {
    if (!viewer) return;
    const next = defaultDraftIds(viewer);
    setDraftIds(next);
    setPlannerDraftIds(plannerDraftStorageKey(slug, viewerId), next);
  }

  function clearDraft() {
    setDraftIds([]);
    clearPlannerDraft(plannerDraftStorageKey(slug, viewerId));
  }

  if (trainers.length === 0) {
    return (
      <p className="text-sm text-muted">
        No trainers on this season yet — join a board to plan a team.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Team Planner modes"
        className="flex flex-wrap gap-1.5"
      >
        {MODES.map((entry) => {
          const active = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectMode(entry.id)}
              className={`pressable rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[10rem] space-y-1 text-xs font-semibold text-muted">
          Plan for
          <select
            value={viewerId}
            onChange={(e) => setViewerId(e.target.value)}
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
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
          <label className="min-w-[10rem] space-y-1 text-xs font-semibold text-muted">
            Opponent
            <select
              value={opponentId}
              onChange={(e) => setOpponentId(e.target.value)}
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayName(t)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2 pb-0.5">
          <button type="button" className={CTA_SECONDARY_SM} onClick={resetToMain}>
            Reset to Main
          </button>
          <button type="button" className={CTA_SECONDARY_SM} onClick={clearDraft}>
            Clear draft
          </button>
        </div>
      </div>

      <Frame title={frameCountTitle("Planned Main", draft.length)}>
        <p className="mb-3 text-xs text-muted">
          Sandbox only — does not change your board. Click pool sprites to add
          or remove (max {PLANNER_DRAFT_MAX}).
        </p>
        {draft.length === 0 ? (
          <p className="text-sm text-muted">
            Empty draft — pick from your living box below.
          </p>
        ) : (
          <DraftSpriteRow
            pokemon={draft}
            onToggle={toggleDraft}
            selected
          />
        )}
      </Frame>

      <Frame title={frameCountTitle("Living box", pool.length)}>
        {pool.length === 0 ? (
          <p className="text-sm text-muted">
            No Main or Reserve Pokémon on this board yet.
          </p>
        ) : (
          <DraftSpriteRow
            pokemon={pool}
            onToggle={toggleDraft}
            selectedIds={new Set(draftIds)}
            dimUnselected
          />
        )}
      </Frame>

      {mode === "coverage" ? (
        <CoveragePanels coverage={coverage} defense={defense} draft={draft} />
      ) : null}

      {mode === "prep" ? (
        <PrepPanels
          slug={slug}
          draft={draft}
          gymPreps={gymPreps}
        />
      ) : null}

      {mode === "vs" ? (
        <VsTrainerPanel
          draft={draft}
          opponent={opponent}
          opponentMain={opponentMain}
        />
      ) : null}
    </div>
  );
}

function DraftSpriteRow({
  pokemon,
  onToggle,
  selected,
  selectedIds,
  dimUnselected,
}: {
  pokemon: PokemonEntry[];
  onToggle: (id: string) => void;
  selected?: boolean;
  selectedIds?: Set<string>;
  dimUnselected?: boolean;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {pokemon.map((entry) => {
        const isOn =
          selected === true || (selectedIds?.has(entry.id) ?? false);
        const dim = dimUnselected && !isOn;
        const label = monLabel(entry);
        return (
          <li key={entry.id}>
            <PokemonHoverPreview pokemon={entry}>
              <button
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggle(entry.id)}
                className={`pressable flex w-full flex-col items-center gap-1 rounded-md border px-1.5 py-2 transition-colors ${
                  isOn
                    ? "border-interactive/50 bg-interactive-soft/40"
                    : "border-frame/50 bg-surface/70 hover:border-interactive/35"
                } ${dim ? "opacity-45" : ""}`}
              >
                <PokemonSpriteImage
                  alt={label}
                  className="pixelated h-14 w-14 object-contain sm:h-16 sm:w-16"
                  height={64}
                  loading="lazy"
                  pokedexId={entry.pokedexId}
                  shiny={entry.isShiny}
                  species={entry.species}
                  width={64}
                />
                <span className="max-w-full truncate text-center text-[11px] font-semibold leading-tight text-ink">
                  {label}
                </span>
                <span className="flex flex-wrap justify-center gap-0.5">
                  {entry.types.map((t) => (
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
}: {
  coverage: ReturnType<typeof offensiveCoverage>;
  defense: ReturnType<typeof teamDefensiveProfile>;
  draft: PokemonEntry[];
}) {
  if (draft.length === 0) {
    return (
      <Frame title="Coverage">
        <p className="text-sm text-muted">
          Add Pokémon to the draft to see offensive coverage and defensive holes.
        </p>
      </Frame>
    );
  }

  return (
    <div className="space-y-4">
      <Frame title="Offensive coverage">
        <p className="mb-3 text-xs text-muted">
          Best hit from the draft into each defending type (STAB or known
          damaging moves). Accent = ≥2×; muted = gap.
        </p>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-6">
          {coverage.cells.map((cell) => {
            const good = cell.bestMult >= 2;
            const via = draft.find((p) => p.id === cell.viaEntryId);
            return (
              <li
                key={cell.defendingType}
                className={`rounded-md border px-2 py-1.5 ${
                  good
                    ? "border-accent/35 bg-accent/10"
                    : "border-frame/50 bg-surface-2/60"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <TypeBadge type={cell.defendingType as PokemonType} size="sm" />
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      good ? "text-ink" : "text-danger"
                    }`}
                  >
                    {formatMatchupMult(cell.bestMult)}
                  </span>
                </div>
                {via ? (
                  <p className="mt-1 truncate text-[10px] text-muted">
                    {monLabel(via)}
                    {cell.viaMove ? ` · ${cell.viaMove}` : " · STAB"}
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-muted">No hit</p>
                )}
              </li>
            );
          })}
        </ul>
      </Frame>

      <Frame title={frameCountTitle("Coverage gaps", coverage.gaps.length)}>
        {coverage.gaps.length === 0 ? (
          <p className="text-sm text-muted">
            Every type has at least a 2× answer from this draft.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {coverage.gaps.map((gap) => (
              <li
                key={gap.defendingType}
                className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-1.5 py-1"
              >
                <TypeBadge type={gap.defendingType as PokemonType} size="sm" />
                <span className="text-[10px] font-bold tabular-nums text-muted">
                  {formatMatchupMult(gap.bestMult)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Frame>

      <Frame title="Shared defensive holes">
        <p className="mb-3 text-xs text-muted">
          Attack types that hit two or more draft mons for ≥2×.
        </p>
        {defense.sharedHoles.length === 0 ? (
          <p className="text-sm text-muted">
            No shared ≥2× holes across this draft.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {defense.sharedHoles.map((hole) => (
              <li
                key={hole.attackType}
                className="inline-flex items-center gap-1.5 rounded-lg border border-frame/40 bg-surface-2 px-1.5 py-1"
              >
                <TypeBadge type={hole.attackType as PokemonType} size="sm" />
                <span className="text-[10px] font-bold tabular-nums text-muted">
                  {formatMatchupMult(hole.worstMult)} · {hole.weakCount}/
                  {draft.length}
                </span>
              </li>
            ))}
          </ul>
        )}
        {defense.teamImmunities.length > 0 ? (
          <div className="mt-3 border-t border-frame/50 pt-3">
            <p className="mb-1.5 text-xs font-semibold text-muted">
              Team immunities
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {defense.teamImmunities.map((t) => (
                <li key={t}>
                  <TypeBadge type={t as PokemonType} size="sm" variant="soft" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
    <div className="space-y-4">
      <Frame title="Elite Four + Champion">
        <p className="mb-3 text-xs text-muted">
          Specialty checklists for the League gauntlet. Matches use your draft,
          not the locked Main Squad.{" "}
          <Link
            href={toolsHref(slug, "guide", { chapter: "elite-four" })}
            className="font-semibold text-interactive underline decoration-interactive/35 underline-offset-2"
          >
            Open Game Guide
          </Link>
        </p>
        <ul className="space-y-3">
          {ELITE_FOUR_PREP.map((prep) => (
            <PrepCard key={prep.id} prep={prep} draft={draft} />
          ))}
        </ul>
      </Frame>

      <Frame title="Gym leaders">
        <ul className="space-y-3">
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

  return (
    <li className="rounded-md border border-frame/70 bg-surface-2/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-tight text-ink">
          {prep.leaderName}
          {subtitle ? (
            <span className="ml-1.5 font-medium text-muted">· {subtitle}</span>
          ) : null}
        </p>
        {guideHref ? (
          <Link
            href={guideHref}
            className="text-[11px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2"
          >
            Guide
          </Link>
        ) : null}
      </div>
      <div className="mt-2 space-y-1.5">
        <TypeRow label="Specialty" types={prep.specialtyTypes} />
        <TypeRow label="Bring" types={prep.recommendedTypes} />
        {prep.cautionTypes?.length ? (
          <TypeRow label="Be careful" types={prep.cautionTypes} />
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{prep.partyNotes}</p>
      {draft.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">
          Draft Pokémon to see type matches.
        </p>
      ) : matches.length > 0 ? (
        <div className="mt-2 space-y-2 border-t border-frame/60 pt-2">
          <p className="text-[0.7rem] font-semibold text-muted">
            Draft matches
          </p>
          <ul className="flex flex-wrap gap-2">
            {matches.map(({ entry, matchedTypes }) => (
              <li
                key={entry.id}
                className="flex items-center gap-1.5 rounded-md border border-frame/50 bg-surface/70 px-2 py-1.5"
              >
                <PokemonSpriteImage
                  alt={monLabel(entry)}
                  className="pixelated h-8 w-8 object-contain"
                  height={32}
                  loading="lazy"
                  pokedexId={entry.pokedexId}
                  shiny={entry.isShiny}
                  species={entry.species}
                  width={32}
                />
                <span className="text-xs font-semibold text-ink">
                  {monLabel(entry)}
                </span>
                <span className="flex gap-0.5">
                  {matchedTypes.map((t) => (
                    <TypeBadge
                      key={`${entry.id}-${t}`}
                      type={t}
                      size="sm"
                      variant="soft"
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted">
          No draft mon overlaps {prep.recommendedTypes.join(" / ")} — check
          Reserve or the Pokédex.
        </p>
      )}
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
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
      <Frame title="vs Trainer">
        <p className="text-sm text-muted">Pick an opponent board.</p>
      </Frame>
    );
  }

  if (opponentMain.length === 0) {
    return (
      <Frame title={`vs ${displayName(opponent)}`}>
        <p className="text-sm text-muted">
          {displayName(opponent)} has no Main Squad yet.
        </p>
      </Frame>
    );
  }

  if (draft.length === 0) {
    return (
      <Frame title={`vs ${displayName(opponent)}`}>
        <p className="text-sm text-muted">
          Draft Pokémon to see counter tips into their Main.
        </p>
      </Frame>
    );
  }

  return (
    <Frame title={`vs ${displayName(opponent)}`}>
      <p className="mb-3 text-xs text-muted">
        Counter tips from your draft into each of their Main types (uses stored
        damaging moves when present).
      </p>
      <ul className="space-y-3">
        {opponentMain.map((target) => {
          const tips = recommendDraftCoverageTips(target.types, draft, {
            limit: 3,
            minMult: 2,
          });
          return (
            <li
              key={target.id}
              className="rounded-md border border-frame/70 bg-surface-2/60 p-3"
            >
              <div className="flex items-center gap-2">
                <PokemonSpriteImage
                  alt={monLabel(target)}
                  className="pixelated h-12 w-12 object-contain"
                  height={48}
                  loading="lazy"
                  pokedexId={target.pokedexId}
                  shiny={target.isShiny}
                  species={target.species}
                  width={48}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {monLabel(target)}
                  </p>
                  <span className="mt-0.5 flex flex-wrap gap-0.5">
                    {target.types.map((t) => (
                      <TypeBadge key={`${target.id}-${t}`} type={t} size="sm" />
                    ))}
                  </span>
                </div>
              </div>
              {tips.length === 0 ? (
                <p className="mt-2 text-[11px] text-muted">
                  No ≥2× answers in the draft — add coverage or check moves.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 border-t border-frame/50 pt-2">
                  {tips.map((tip) => {
                    const tipMon = draft.find((p) => p.id === tip.entryId);
                    return (
                      <li
                        key={tip.entryId}
                        className="flex items-start gap-2 text-xs"
                      >
                        {tipMon ? (
                          <PokemonSpriteImage
                            alt={tip.displayName}
                            className="pixelated h-8 w-8 shrink-0 object-contain"
                            height={32}
                            loading="lazy"
                            pokedexId={tipMon.pokedexId}
                            shiny={tipMon.isShiny}
                            species={tipMon.species}
                            width={32}
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {tip.displayName}{" "}
                            <span className="font-bold tabular-nums text-accent">
                              {formatMatchupMult(tip.mult)}
                            </span>
                          </p>
                          <p className="text-[11px] leading-snug text-muted">
                            {tip.reason}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
