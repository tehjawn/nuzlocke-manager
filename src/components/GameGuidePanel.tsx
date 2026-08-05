"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Frame } from "@/components/Frame";
import { HatchSafeSpotsNote } from "@/components/HatchSafeSpotsNote";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { TypeBadge } from "@/components/TypeBadge";
import { triggerFx } from "@/features/fx";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  clearGuideCheckoffs,
  EMPTY_GUIDE_CHECKOFFS,
  guideCheckoffsStorageKey,
  readGuideCheckoffs,
  setGuideStepChecked,
  subscribeGuideCheckoffs,
} from "@/features/guide/guide-checkoffs";
import {
  formatGymPrepLevelVerdict,
  guideChapterLabel,
  guideChapterNumber,
  gymPrepCapRole,
  levelVerdictForGymPrep,
  squadMatchesForGymPrep,
} from "@/features/guide/guide-gym-prep";
import {
  isPostGameChapter,
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
  mode = "story",
}: {
  label: string;
  counts: StepCounts;
  size?: "sm" | "md";
  /** Post-game meters are optional-only bonus checklists. */
  mode?: "story" | "post-game";
}) {
  const trackH = size === "sm" ? "h-1.5" : "h-2.5";
  const percent =
    mode === "post-game"
      ? counts.optionalTotal === 0
        ? 0
        : Math.round((counts.optionalDone / counts.optionalTotal) * 100)
      : counts.percent;
  const ariaLabel =
    mode === "post-game"
      ? `${label}: ${percent}% of post-game steps done`
      : `${label}: ${percent}% of story steps done`;

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
          {mode === "post-game" ? (
            <>
              <span className="tabular-nums font-semibold text-ink">
                {counts.optionalDone}/{counts.optionalTotal}
              </span>{" "}
              optional
            </>
          ) : (
            <>
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
            </>
          )}
        </span>
      </div>
      <div
        className={`overflow-hidden rounded-full bg-surface-2 ${trackH}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={ariaLabel}
      >
        <div
          className={`${trackH} rounded-full bg-interactive transition-[width] duration-500 ease-out motion-reduce:transition-none`}
          style={{ width: `${percent}%` }}
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
                ? // Theme tokens only — no Tailwind `dark:` (prefers-color-scheme ≠ [data-theme]).
                  "border-accent-2/45 bg-accent-2/15 text-ink"
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
        <TypeBadge
          key={`${label}-${type}`}
          type={type}
          size="sm"
          variant="soft"
        />
      ))}
    </div>
  );
}

function GymPrepDetails({
  step,
  trainer,
  earnedBadgeKeys,
}: {
  step: ResolvedGuideStep;
  trainer: TrainerProfile | null;
  earnedBadgeKeys: readonly string[];
}) {
  const prep = step.gymPrep;
  if (!prep) return null;

  const matches = trainer ? squadMatchesForGymPrep(trainer.pokemon, prep) : [];
  const capRole = gymPrepCapRole(prep.badgeKey, earnedBadgeKeys);
  const levelLabel =
    capRole === "cleared"
      ? `Lv. ${prep.aceLevel} (cleared)`
      : capRole === "live"
        ? `Lv. ${prep.aceLevel} · live cap`
        : `Lv. ${prep.aceLevel} · target`;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-frame/70 bg-surface-2/60 p-3">
      <p className="text-xs font-semibold tracking-tight text-ink">
        Gym prep — {prep.leaderName}
        <span className="ml-1.5 font-medium tabular-nums text-muted">
          {levelLabel}
        </span>
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
              Effective Pokémon you can use
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {matches.map(({ entry, typeMatches }) => {
                const label = entry.nickname?.trim() || entry.species;
                const verdict = levelVerdictForGymPrep(
                  entry.level,
                  prep.aceLevel,
                );
                return (
                  <li
                    key={entry.id}
                    className={`flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 ${
                      verdict?.state === "under"
                        ? "border-danger/40 bg-danger/5"
                        : verdict?.state === "over" && capRole === "live"
                          ? "border-accent-2/45 bg-accent-2/10"
                          : "border-frame/50 bg-surface/70"
                    }`}
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
                    {verdict ? (
                      <span
                        className={`text-[0.65rem] font-semibold tabular-nums ${
                          verdict.state === "under"
                            ? "text-danger"
                            : verdict.state === "over" && capRole === "live"
                              ? "text-accent-2"
                              : "text-muted"
                        }`}
                        title={
                          verdict.state === "over" && capRole === "live"
                            ? "Above the house-rule cap for the next undefeated gym"
                            : verdict.state === "under"
                              ? "Below the recommended fight level"
                              : undefined
                        }
                      >
                        {formatGymPrepLevelVerdict(verdict, capRole)}
                      </span>
                    ) : null}
                    <span className="flex flex-wrap items-center justify-center gap-1">
                      {typeMatches.map(({ type, viaMove }) => (
                        <span
                          key={`${entry.id}-${type}`}
                          className="inline-flex items-center gap-1"
                          title={
                            viaMove
                              ? `${type} coverage from ${viaMove}`
                              : `${type} typing`
                          }
                        >
                          <TypeBadge type={type} size="sm" variant="soft" />
                          {viaMove ? (
                            <span className="text-[0.6rem] font-medium text-muted">
                              via {viaMove}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="border-t border-frame/60 pt-2 text-xs text-muted">
            No Main / Reserve mons match the recommended types — by typing or by
            a known damaging move — yet. Check the Pokédex tool or your boxes
            for {prep.recommendedTypes.join(" / ")}.
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
  earnedBadgeKeys,
}: {
  step: ResolvedGuideStep;
  index: number;
  onToggle: () => void;
  nearRoute: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  trainer: TrainerProfile | null;
  earnedBadgeKeys: readonly string[];
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
              <GymPrepDetails
                step={step}
                trainer={trainer}
                earnedBadgeKeys={earnedBadgeKeys}
              />
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
  postGame,
}: {
  cleared: boolean;
  isActive: boolean;
  reachable: boolean;
  postGame: boolean;
}): string {
  if (cleared) return "Done";
  if (postGame) return reachable ? "Open" : "Locked";
  if (isActive) return "Current";
  if (!reachable) return "Locked";
  return "Upcoming";
}

function storyGuideComplete(snapshot: GuideProgressSnapshot): boolean {
  return snapshot.chapters
    .filter((chapter) => !isPostGameChapter(chapter.chapter))
    .every((chapter) =>
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
  earnedBadgeKeys,
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
  earnedBadgeKeys: readonly string[];
}) {
  const counts = countSteps(steps);
  const postGame = isPostGameChapter(chapter);
  const status = chapterStatusLabel({
    cleared,
    isActive,
    reachable,
    postGame,
  });
  const lockHint =
    !reachable && unlockHint
      ? postGame
        ? unlockHint
        : `Finish ${unlockHint} first`
      : null;
  const panelId = `guide-chapter-panel-${chapter.id}`;
  const headerId = `guide-chapter-header-${chapter.id}`;
  const headerCount = postGame
    ? `${counts.optionalDone}/${counts.optionalTotal}`
    : `${counts.storyDone}/${counts.storyTotal}`;

  return (
    <section
      className={`gba-frame overflow-hidden transition-[opacity,filter] duration-500 ${
        cleared
          ? "guide-chapter--cleared opacity-[0.78]"
          : isActive && !postGame
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
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-interactive"
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
              {postGame ? (
                <span
                  aria-hidden
                  className="shrink-0 rounded-md border border-accent-2/40 bg-accent-2/15 px-1.5 py-px text-[0.65rem] font-bold tracking-tight text-ink"
                >
                  Post-game
                </span>
              ) : (
                <span
                  aria-hidden
                  className="shrink-0 rounded-md border border-[var(--on-chrome)]/25 bg-[var(--on-chrome)]/10 px-1.5 py-px text-[0.65rem] font-bold tabular-nums text-[var(--on-chrome)]/85"
                >
                  Ch. {guideChapterNumber(chapter)}
                </span>
              )}
              <span className="truncate text-sm font-semibold sm:text-base">
                {chapter.title}
              </span>
              <span
                className={`rounded-full border px-1.5 py-px text-[0.65rem] font-semibold tracking-tight ${
                  cleared
                    ? "border-accent/35 bg-accent/15 text-accent-deep"
                    : isActive && !postGame
                      ? "border-interactive/45 bg-interactive-soft/70 text-interactive"
                      : "border-frame/70 text-[var(--on-chrome)]/70"
                }`}
              >
                {status}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-[var(--on-chrome)]/75">
            {headerCount}
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
          <GuideMeter
            label="Chapter progress"
            counts={counts}
            size="sm"
            mode={postGame ? "post-game" : "story"}
          />
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
                earnedBadgeKeys={earnedBadgeKeys}
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
    // Must match SSR (no localStorage) — never read the client store here.
    () => EMPTY_GUIDE_CHECKOFFS,
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
    () =>
      countSteps(
        progress.chapters
          .filter((c) => !isPostGameChapter(c.chapter))
          .flatMap((c) => c.steps),
      ),
    [progress.chapters],
  );

  const postGameChapters = useMemo(
    () => progress.chapters.filter((c) => isPostGameChapter(c.chapter)),
    [progress.chapters],
  );

  const storyChapters = useMemo(
    () => progress.chapters.filter((c) => !isPostGameChapter(c.chapter)),
    [progress.chapters],
  );

  const postGameCounts = useMemo(
    () => countSteps(postGameChapters.flatMap((c) => c.steps)),
    [postGameChapters],
  );

  const showPostGame = postGameChapters.length > 0;

  const guideComplete = storyGuideComplete(progress);

  const chapterFromParam = chapterParam
    ? progress.chapters.find((c) => c.chapter.id === chapterParam)
    : undefined;

  const defaultOpenChapterId = chapterFromParam
    ? chapterFromParam.chapter.id
    : guideComplete
      ? (showPostGame ? (postGameChapters[0]?.chapter.id ?? null) : null)
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

    if (!storyGuideComplete(before) && storyGuideComplete(after)) {
      triggerFx("guide_complete");
      return;
    }

    const clearedChapter = after.chapters.find(
      (chapter) =>
        chapter.cleared &&
        !isPostGameChapter(chapter.chapter) &&
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
          affect the story bar. Post-game steps use their own checklist below.
        </p>
        <HatchSafeSpotsNote className="mt-3" randomizerContext />
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
                  earnedBadgeKeys={selectedTrainer?.earnedBadgeKeys ?? []}
                />
              ))}
            </ul>
          )}
        </Frame>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Chapters</h3>
        <div className="space-y-3">
          {storyChapters.map(
            ({ chapter, steps, reachable, cleared, isActive }, index) => (
              <ChapterAccordion
                key={chapter.id}
                chapter={chapter}
                steps={steps}
                reachable={reachable}
                unlockHint={
                  storyChapters[index - 1]
                    ? guideChapterLabel(storyChapters[index - 1]!.chapter)
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
                earnedBadgeKeys={selectedTrainer?.earnedBadgeKeys ?? []}
              />
            ),
          )}
        </div>
      </div>

      {showPostGame ? (
        <div className="space-y-4">
          <div
            role="separator"
            aria-hidden
            className="border-t border-frame/80 pt-1"
          />
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight">
                Post-game
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                Bonus Modern Emerald epilogue — separate from the story
                checklist above. Most of this unlocks after the League;
                browse anytime. Species names are vanilla slot labels; your
                randomizer may put something else there. Skip freely;
                tournament readiness doesn’t depend on these.
              </p>
            </div>
            <Frame title="Post-game progress">
              <GuideMeter
                label="Optional epilogue"
                counts={postGameCounts}
                mode="post-game"
              />
            </Frame>
            <div className="space-y-3">
              {postGameChapters.map(
                ({ chapter, steps, reachable, cleared }) => (
                  <ChapterAccordion
                    key={chapter.id}
                    chapter={chapter}
                    steps={steps}
                    reachable={reachable}
                    unlockHint={null}
                    cleared={cleared}
                    isActive={false}
                    open={openChapterId === chapter.id}
                    onToggle={() => toggleChapter(chapter.id)}
                    catchRoutes={catchRoutes}
                    expandedStepId={expandedStepId}
                    onToggleExpand={toggleExpanded}
                    onToggleStep={toggleStep}
                    trainer={selectedTrainer}
                    earnedBadgeKeys={selectedTrainer?.earnedBadgeKeys ?? []}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
