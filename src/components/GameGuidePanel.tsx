"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Frame } from "@/components/Frame";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { TypeBadge } from "@/components/TypeBadge";
import { triggerFx } from "@/features/fx";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  clearGuideCheckoffs,
  guideCheckoffsStorageKey,
  readGuideCheckoffs,
  setGuideStepChecked,
  subscribeGuideCheckoffs,
} from "@/features/guide/guide-checkoffs";
import {
  guideChapterLabel,
  guideChapterNumber,
  squadMatchesForGymPrep,
} from "@/features/guide/guide-gym-prep";
import {
  resolveGuideProgress,
  stepMatchesCatchRoutes,
} from "@/features/guide/guide-progress";
import type {
  GuideChapter,
  GuideProgressSnapshot,
  ResolvedGuideStep,
} from "@/features/guide/guide-types";
import type { TrainerProfile } from "@/lib/challenge-types";
import type { PokemonType } from "@/lib/pokemon-types";

/** Shown when every story step (incl. Discord lock-in) is checked. */
const GUIDE_COMPLETE_COPY = {
  title: "Congrats!",
  body: "You're ready to participate in the Nuzlocke tournament.",
  dateLine: "Tentative tournament date — October 24th, 2026.",
  signoff: "See you there!",
} as const;

type GameGuidePanelProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
};

type StepCounts = {
  storyDone: number;
  storyTotal: number;
  optionalDone: number;
  optionalTotal: number;
  percent: number;
};

function uniqueCatchRoutes(trainer: TrainerProfile | null): string[] {
  if (!trainer) return [];
  const routes = new Set<string>();
  for (const mon of trainer.pokemon) {
    if (mon.catchRoute?.trim()) routes.add(mon.catchRoute.trim());
  }
  return [...routes];
}

function countSteps(
  steps: ReadonlyArray<{ priority: string; completed: boolean }>,
): StepCounts {
  let storyDone = 0;
  let storyTotal = 0;
  let optionalDone = 0;
  let optionalTotal = 0;
  for (const step of steps) {
    if (step.priority === "optional") {
      optionalTotal += 1;
      if (step.completed) optionalDone += 1;
    } else {
      storyTotal += 1;
      if (step.completed) storyDone += 1;
    }
  }
  return {
    storyDone,
    storyTotal,
    optionalDone,
    optionalTotal,
    percent: storyTotal === 0 ? 0 : Math.round((storyDone / storyTotal) * 100),
  };
}

function GuideMeter({
  label,
  counts,
  size = "md",
}: {
  label: string;
  counts: StepCounts;
  size?: "sm" | "md";
}) {
  const trackH = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span
          className={`font-semibold tracking-tight ${
            size === "sm" ? "text-xs text-muted" : "text-sm"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-muted">
          <span className="tabular-nums font-semibold text-ink">
            {counts.storyDone}/{counts.storyTotal}
          </span>{" "}
          story
          {counts.optionalTotal > 0 ? (
            <>
              {" · "}
              <span className="tabular-nums">
                {counts.optionalDone}/{counts.optionalTotal}
              </span>{" "}
              optional
            </>
          ) : null}
        </span>
      </div>
      <div
        className={`overflow-hidden rounded-full bg-surface-2 ${trackH}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={counts.percent}
        aria-label={`${label}: ${counts.percent}% of story steps done`}
      >
        <div
          className={`${trackH} rounded-full bg-interactive transition-[width] duration-500 ease-out motion-reduce:transition-none`}
          style={{ width: `${counts.percent}%` }}
        />
      </div>
    </div>
  );
}

/** Doubles as the step number and the checkbox control. */
function StepMarker({
  index,
  checked,
}: {
  index: number;
  checked: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold tabular-nums transition-colors ${
        checked
          ? "border-interactive bg-interactive text-[var(--surface)]"
          : "border-frame bg-surface-2 text-muted group-hover:border-interactive group-hover:bg-interactive-soft group-hover:text-interactive"
      }`}
    >
      {checked ? "✓" : index}
    </span>
  );
}

function StepChips({ step }: { step: ResolvedGuideStep }) {
  const chips: string[] = [];
  if (step.priority === "critical") chips.push("Required");
  if (step.priority === "optional") chips.push("Optional");
  if (step.gymPrep) chips.push("Gym prep");
  if (chips.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className={`rounded-full border px-1.5 py-px text-[0.65rem] font-semibold tracking-tight ${
            chip === "Required"
              ? "border-interactive/40 bg-interactive-soft/60 text-interactive"
              : chip === "Gym prep"
                ? "border-amber-700/35 bg-amber-700/10 text-amber-900 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-100"
                : "border-frame/70 text-muted"
          }`}
        >
          {chip}
        </span>
      ))}
    </span>
  );
}

function TypeRow({
  label,
  types,
}: {
  label: string;
  types: readonly PokemonType[];
}) {
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.7rem] font-semibold text-muted">{label}</span>
      {types.map((type) => (
        <TypeBadge key={`${label}-${type}`} type={type} size="sm" />
      ))}
    </div>
  );
}

function GymPrepDetails({
  step,
  trainer,
}: {
  step: ResolvedGuideStep;
  trainer: TrainerProfile | null;
}) {
  const prep = step.gymPrep;
  if (!prep) return null;

  const matches = trainer ? squadMatchesForGymPrep(trainer.pokemon, prep) : [];

  return (
    <div className="mt-3 space-y-2 rounded-md border border-frame/70 bg-surface-2/60 p-3">
      <p className="text-xs font-semibold tracking-tight text-ink">
        Gym prep — {prep.leaderName}
      </p>
      <TypeRow label="Specialty" types={prep.specialtyTypes} />
      <TypeRow label="Bring" types={prep.recommendedTypes} />
      {prep.cautionTypes?.length ? (
        <TypeRow label="Be careful" types={prep.cautionTypes} />
      ) : null}
      <p className="text-xs leading-relaxed text-muted">{prep.partyNotes}</p>
      {trainer ? (
        matches.length > 0 ? (
          <div className="space-y-2 border-t border-frame/60 pt-2">
            <p className="text-[0.7rem] font-semibold text-muted">
              On {trainer.handle}&apos;s Main / Reserve
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {matches.map(({ entry, matchedTypes }) => {
                const label = entry.nickname?.trim() || entry.species;
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col items-center gap-1.5 rounded-md border border-frame/50 bg-surface/70 px-2 py-2.5"
                  >
                    <PokemonSpriteImage
                      alt={label}
                      className="pixelated h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                      height={72}
                      loading="lazy"
                      pokedexId={entry.pokedexId}
                      shiny={entry.isShiny}
                      species={entry.species}
                      width={72}
                    />
                    <span className="max-w-full truncate text-center text-xs font-semibold leading-tight text-ink">
                      {label}
                    </span>
                    <span className="text-[0.65rem] font-medium text-muted">
                      {entry.slot === "MAIN" ? "Main" : "Reserve"}
                    </span>
                    <span className="flex flex-wrap items-center justify-center gap-1">
                      {matchedTypes.map((type) => (
                        <TypeBadge
                          key={`${entry.id}-${type}`}
                          type={type}
                          size="sm"
                        />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="border-t border-frame/60 pt-2 text-xs text-muted">
            No Main / Reserve mons match the recommended types yet — check the
            Pokédex tool or your boxes for {prep.recommendedTypes.join(" / ")}.
          </p>
        )
      ) : null}
    </div>
  );
}

function StepRow({
  step,
  index,
  onToggle,
  nearRoute,
  expanded,
  onToggleExpand,
  trainer,
}: {
  step: ResolvedGuideStep;
  index: number;
  onToggle: () => void;
  nearRoute: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  trainer: TrainerProfile | null;
}) {
  const done = step.completed;
  const hasDetails = Boolean(
    step.detail ||
      step.hms?.length ||
      step.keyItems?.length ||
      step.nuzlockeNote ||
      step.gymPrep,
  );

  return (
    <li
      className={`group overflow-hidden rounded-lg border transition-colors ${
        done
          ? "border-frame/60 bg-surface-2/50"
          : "border-frame/80 bg-surface hover:border-interactive/55"
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        title={done ? "Mark as not done" : "Mark as done"}
        className="flex w-full cursor-pointer items-start gap-3 p-3.5 text-left transition-colors hover:bg-interactive-soft/30 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-interactive"
      >
        <StepMarker index={index} checked={done} />

        <span className="min-w-0 flex-1">
          <span
            className={`block text-[0.9375rem] font-semibold leading-snug ${
              done ? "text-muted line-through" : "text-ink"
            }`}
          >
            {step.title}
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            {step.summary}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <StepChips step={step} />
            {nearRoute && !done ? (
              <span className="text-[0.65rem] font-medium text-muted">
                You have an encounter here
              </span>
            ) : null}
          </span>
        </span>

        <span className="hidden shrink-0 self-center text-[0.7rem] font-semibold text-interactive opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          {done ? "Undo" : "Mark done"}
        </span>
      </button>

      {hasDetails ? (
        <div className="border-t border-frame/60">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="flex w-full items-center gap-1.5 px-3.5 py-2 text-left text-xs font-semibold text-interactive transition-colors hover:bg-interactive-soft/25"
          >
            <span
              aria-hidden
              className={`inline-block transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            >
              ▸
            </span>
            {expanded ? "Hide details" : "How to do this"}
          </button>

          {expanded ? (
            <div className="px-3.5 pb-3.5">
              {step.detail ? <MarkdownContent content={step.detail} /> : null}
              <GymPrepDetails step={step} trainer={trainer} />
              {step.hms?.length ? (
                <p className="mt-2 text-xs text-muted">
                  HM: {step.hms.join(", ")}
                </p>
              ) : null}
              {step.keyItems?.length ? (
                <p className="mt-1 text-xs text-muted">
                  Key item: {step.keyItems.join(", ")}
                </p>
              ) : null}
              {step.nuzlockeNote ? (
                <p className="mt-1 text-xs text-muted">{step.nuzlockeNote}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function chapterStatusLabel({
  cleared,
  isActive,
  reachable,
}: {
  cleared: boolean;
  isActive: boolean;
  reachable: boolean;
}): string {
  if (cleared) return "Done";
  if (isActive) return "Current";
  if (!reachable) return "Locked";
  return "Upcoming";
}

function storyGuideComplete(snapshot: GuideProgressSnapshot): boolean {
  return snapshot.chapters.every((chapter) =>
    chapter.steps
      .filter((step) => step.priority !== "optional")
      .every((step) => step.completed),
  );
}

function ChapterAccordion({
  chapter,
  steps,
  reachable,
  unlockHint,
  cleared,
  isActive,
  open,
  onToggle,
  catchRoutes,
  expandedStepId,
  onToggleExpand,
  onToggleStep,
  trainer,
}: {
  chapter: GuideChapter;
  steps: ResolvedGuideStep[];
  reachable: boolean;
  unlockHint: string | null;
  cleared: boolean;
  isActive: boolean;
  open: boolean;
  onToggle: () => void;
  catchRoutes: string[];
  expandedStepId: string | null;
  onToggleExpand: (stepId: string) => void;
  onToggleStep: (step: ResolvedGuideStep) => void;
  trainer: TrainerProfile | null;
}) {
  const counts = countSteps(steps);
  const status = chapterStatusLabel({ cleared, isActive, reachable });
  const lockHint =
    !reachable && unlockHint ? `Finish ${unlockHint} first` : null;
  const panelId = `guide-chapter-panel-${chapter.id}`;
  const headerId = `guide-chapter-header-${chapter.id}`;

  return (
    <section
      className={`gba-frame overflow-hidden transition-[opacity,filter] duration-500 ${
        cleared
          ? "guide-chapter--cleared opacity-[0.78]"
          : isActive
            ? "ring-1 ring-interactive/35"
            : ""
      }`}
    >
      <h3 className="gba-frame-title relative z-[1] m-0">
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/5 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-interactive dark:hover:bg-white/5"
        >
          <span
            aria-hidden
            className={`text-xs text-[var(--on-chrome)]/70 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                aria-hidden
                className="shrink-0 rounded-md border border-[var(--on-chrome)]/25 bg-black/10 px-1.5 py-px text-[0.65rem] font-bold tabular-nums text-[var(--on-chrome)]/85 dark:bg-white/10"
              >
                Ch. {guideChapterNumber(chapter)}
              </span>
              <span className="truncate text-sm font-semibold sm:text-base">
                {chapter.title}
              </span>
              <span
                className={`rounded-full border px-1.5 py-px text-[0.65rem] font-semibold tracking-tight ${
                  cleared
                    ? "border-emerald-700/35 bg-emerald-700/15 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-200"
                    : isActive
                      ? "border-interactive/45 bg-interactive-soft/70 text-interactive"
                      : "border-frame/70 text-[var(--on-chrome)]/70"
                }`}
              >
                {status}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-[var(--on-chrome)]/75">
            {counts.storyDone}/{counts.storyTotal}
          </span>
        </button>
      </h3>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="relative z-[1] space-y-3 p-4 sm:p-5"
        >
          <p className="text-sm text-muted">{chapter.summary}</p>
          <GuideMeter label="Chapter progress" counts={counts} size="sm" />
          {lockHint ? <p className="text-xs text-muted">{lockHint}</p> : null}
          <ul className="space-y-2">
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index + 1}
                nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                expanded={expandedStepId === step.id}
                onToggleExpand={() => onToggleExpand(step.id)}
                onToggle={() => onToggleStep(step)}
                trainer={trainer}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function GameGuidePanel({
  slug,
  trainers,
  myTrainerId = null,
}: GameGuidePanelProps) {
  const searchParams = useSearchParams();
  const chapterParam = searchParams.get("chapter");

  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(
    () => myTrainerId ?? trainers[0]?.id ?? "",
  );

  const selectedTrainer =
    trainers.find((t) => t.id === selectedTrainerId) ?? null;

  const storageKey = guideCheckoffsStorageKey(
    slug,
    selectedTrainer?.id ?? "anon",
  );

  const checkoffs = useSyncExternalStore(
    (onStoreChange) => subscribeGuideCheckoffs(storageKey, onStoreChange),
    () => readGuideCheckoffs(storageKey),
    () => readGuideCheckoffs(storageKey),
  );

  const catchRoutes = useMemo(
    () => uniqueCatchRoutes(selectedTrainer),
    [selectedTrainer],
  );

  const progress = useMemo(
    () =>
      resolveGuideProgress(EMERALD_GUIDE, {
        earnedBadgeKeys: selectedTrainer?.earnedBadgeKeys ?? [],
        catchRoutes,
        checkedStepIds: checkoffs.checkedStepIds,
      }),
    [selectedTrainer, catchRoutes, checkoffs.checkedStepIds],
  );

  const overallCounts = useMemo(
    () => countSteps(progress.chapters.flatMap((c) => c.steps)),
    [progress.chapters],
  );

  const guideComplete = storyGuideComplete(progress);

  const defaultOpenChapterId =
    chapterParam &&
    progress.chapters.some((c) => c.chapter.id === chapterParam)
      ? chapterParam
      : guideComplete
        ? null
        : progress.activeChapterId;

  const [openChapterId, setOpenChapterId] = useState<string | null>(
    defaultOpenChapterId,
  );
  const [prevDefaultOpenChapterId, setPrevDefaultOpenChapterId] = useState(
    defaultOpenChapterId,
  );
  if (prevDefaultOpenChapterId !== defaultOpenChapterId) {
    setPrevDefaultOpenChapterId(defaultOpenChapterId);
    setOpenChapterId(defaultOpenChapterId);
  }

  const [expandedStepId, setExpandedStepId] = useState<string | null>(
    () => progress.nextSteps[0]?.id ?? null,
  );

  function toggleStep(step: ResolvedGuideStep) {
    const checking = !step.completed;
    const before = progress;
    const nextCheckoffs = setGuideStepChecked(
      storageKey,
      step.id,
      checking,
    );
    if (!checking) return;

    const after = resolveGuideProgress(EMERALD_GUIDE, {
      earnedBadgeKeys: selectedTrainer?.earnedBadgeKeys ?? [],
      catchRoutes,
      checkedStepIds: nextCheckoffs.checkedStepIds,
    });

    if (storyGuideComplete(after)) {
      triggerFx("guide_complete");
      return;
    }

    const clearedChapter = after.chapters.find(
      (chapter) =>
        chapter.cleared &&
        !before.chapters.find((c) => c.chapter.id === chapter.chapter.id)
          ?.cleared,
    );
    if (clearedChapter) {
      triggerFx("guide_chapter_cleared", {
        guideChapterIndex: clearedChapter.chapter.sortOrder,
      });
      return;
    }

    triggerFx("guide_step_checked");
  }

  function toggleExpanded(stepId: string) {
    setExpandedStepId((id) => (id === stepId ? null : stepId));
  }

  function toggleChapter(chapterId: string) {
    setOpenChapterId((current) => (current === chapterId ? null : chapterId));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted">
          Story beats for {EMERALD_GUIDE.gameLabel} — focused on easy-to-miss
          gates (Steven, Rock Smash / Rusturf, Dive), not 100% completion.
        </p>
        {trainers.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm sm:min-w-[12rem]">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Progress from
            </span>
            <select
              className="rounded-md border border-frame bg-surface px-2.5 py-2 text-sm"
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.handle}
                  {t.id === myTrainerId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <Frame
        title="Overall progress"
        actions={
          <button
            type="button"
            className="text-xs font-semibold text-[var(--on-chrome)]/80 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            disabled={checkoffs.checkedStepIds.length === 0}
            onClick={() => clearGuideCheckoffs(storageKey)}
          >
            Reset progress
          </button>
        }
      >
        <GuideMeter label={EMERALD_GUIDE.gameLabel} counts={overallCounts} />
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          Check off steps as you complete them — progress is saved on this
          device for the selected trainer. Optional pickups like Cut don’t
          affect the bar.
        </p>
      </Frame>

      {guideComplete ? (
        <Frame title="You're ready">
          <div className="space-y-2">
            <p className="text-base font-semibold tracking-tight text-ink">
              {GUIDE_COMPLETE_COPY.title} {GUIDE_COMPLETE_COPY.body}
            </p>
            <p className="text-sm leading-relaxed text-muted">
              {GUIDE_COMPLETE_COPY.dateLine}
            </p>
            <p className="text-sm font-medium text-interactive">
              {GUIDE_COMPLETE_COPY.signoff}
            </p>
          </div>
        </Frame>
      ) : (
        <Frame title="Next steps">
          {progress.nextSteps.length === 0 ? (
            <p className="text-sm text-muted">
              No open recommendations for this board — browse chapters below or
              mark remaining beats.
            </p>
          ) : (
            <ul className="space-y-2">
              {progress.nextSteps.map((step, index) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={index + 1}
                  nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                  expanded={expandedStepId === step.id}
                  onToggleExpand={() => toggleExpanded(step.id)}
                  onToggle={() => toggleStep(step)}
                  trainer={selectedTrainer}
                />
              ))}
            </ul>
          )}
        </Frame>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Chapters</h3>
        <div className="space-y-3">
          {progress.chapters.map(
            ({ chapter, steps, reachable, cleared, isActive }, index) => (
              <ChapterAccordion
                key={chapter.id}
                chapter={chapter}
                steps={steps}
                reachable={reachable}
                unlockHint={
                  progress.chapters[index - 1]
                    ? guideChapterLabel(progress.chapters[index - 1]!.chapter)
                    : null
                }
                cleared={cleared}
                isActive={isActive}
                open={openChapterId === chapter.id}
                onToggle={() => toggleChapter(chapter.id)}
                catchRoutes={catchRoutes}
                expandedStepId={expandedStepId}
                onToggleExpand={toggleExpanded}
                onToggleStep={toggleStep}
                trainer={selectedTrainer}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
