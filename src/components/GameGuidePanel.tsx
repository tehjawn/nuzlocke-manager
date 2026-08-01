"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Frame } from "@/components/Frame";
import { MarkdownContent } from "@/components/MarkdownContent";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  clearGuideCheckoffs,
  guideCheckoffsStorageKey,
  readGuideCheckoffs,
  setGuideStepChecked,
  subscribeGuideCheckoffs,
} from "@/features/guide/guide-checkoffs";
import {
  resolveGuideProgress,
  stepMatchesCatchRoutes,
} from "@/features/guide/guide-progress";
import type { ResolvedGuideStep } from "@/features/guide/guide-types";
import type { TrainerProfile } from "@/lib/challenge-types";
import { toolsHref } from "@/lib/tools-routes";

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
  if (chips.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className={`rounded-full border px-1.5 py-px text-[0.65rem] font-semibold tracking-tight ${
            chip === "Required"
              ? "border-interactive/40 bg-interactive-soft/60 text-interactive"
              : "border-frame/70 text-muted"
          }`}
        >
          {chip}
        </span>
      ))}
    </span>
  );
}

function StepRow({
  step,
  index,
  onToggle,
  nearRoute,
  expanded,
  onToggleExpand,
}: {
  step: ResolvedGuideStep;
  index: number;
  onToggle: () => void;
  nearRoute: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const done = step.completed;
  const hasDetails = Boolean(
    step.detail ||
      step.hms?.length ||
      step.keyItems?.length ||
      step.nuzlockeNote,
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

  const focusedChapterId =
    chapterParam &&
    progress.chapters.some((c) => c.chapter.id === chapterParam)
      ? chapterParam
      : progress.activeChapterId;

  const [expandedStepId, setExpandedStepId] = useState<string | null>(
    () => progress.nextSteps[0]?.id ?? null,
  );
  const [showFuture, setShowFuture] = useState(false);

  const visibleChapters = progress.chapters.filter((c) => {
    if (showFuture) return true;
    if (c.reachable) return true;
    return c.chapter.id === focusedChapterId;
  });

  function toggleStep(step: ResolvedGuideStep) {
    setGuideStepChecked(storageKey, step.id, !step.completed);
  }

  function toggleExpanded(stepId: string) {
    setExpandedStepId((id) => (id === stepId ? null : stepId));
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

      <Frame title="Overall progress">
        <GuideMeter label={EMERALD_GUIDE.gameLabel} counts={overallCounts} />
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          Check off steps as you complete them — progress is saved on this
          device for the selected trainer. Optional pickups like Cut don’t
          affect the bar.
        </p>
      </Frame>

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
              />
            ))}
          </ul>
        )}
      </Frame>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Chapters</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--interactive)]"
              checked={showFuture}
              onChange={(e) => setShowFuture(e.target.checked)}
            />
            Show locked chapters
          </label>
          <button
            type="button"
            className="text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
            onClick={() => clearGuideCheckoffs(storageKey)}
          >
            Reset checkoffs
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {visibleChapters.map(
          ({ chapter, steps, reachable, cleared, isActive }) => {
            const isFocused = chapter.id === focusedChapterId;
            const chapterCounts = countSteps(steps);
            return (
              <Frame
                key={chapter.id}
                title={`${chapter.title}${
                  cleared ? " · done" : isActive ? " · current" : ""
                }`}
                actions={
                  <Link
                    href={toolsHref(slug, "guide", { chapter: chapter.id })}
                    className="text-xs font-semibold text-[var(--on-chrome)]/80 underline-offset-2 hover:underline"
                  >
                    {isFocused ? "Focused" : "Focus"}
                  </Link>
                }
              >
                <p className="text-sm text-muted">{chapter.summary}</p>
                <div className="mt-3">
                  <GuideMeter
                    label="Chapter progress"
                    counts={chapterCounts}
                    size="sm"
                  />
                </div>
                {!reachable ? (
                  <p className="mt-2 text-xs text-muted">
                    Locked until you earn more badges
                  </p>
                ) : null}
                {isFocused || isActive ? (
                  <ul className="mt-3 space-y-2">
                    {steps.map((step, index) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        index={index + 1}
                        nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                        expanded={expandedStepId === step.id}
                        onToggleExpand={() => toggleExpanded(step.id)}
                        onToggle={() => toggleStep(step)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    <Link
                      href={toolsHref(slug, "guide", { chapter: chapter.id })}
                      className="font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
                    >
                      Open checklist
                    </Link>
                  </p>
                )}
              </Frame>
            );
          },
        )}
      </div>
    </div>
  );
}
