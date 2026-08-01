"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useMemo,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Frame } from "@/components/Frame";
import { MarkdownContent } from "@/components/MarkdownContent";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  clearGuideCheckoffs,
  guideCheckoffsStorageKey,
  readGuideCheckoffs,
  subscribeGuideCheckoffs,
  toggleGuideStepChecked,
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

function countSteps(steps: ReadonlyArray<{ priority: string; completed: boolean }>): StepCounts {
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
  const trackH = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span
          className={`font-semibold tracking-tight ${
            size === "sm" ? "text-xs" : "text-sm"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-muted">
          {counts.storyDone}/{counts.storyTotal} story
          {counts.optionalTotal > 0
            ? ` · ${counts.optionalDone}/${counts.optionalTotal} optional`
            : null}
          <span className="ml-1.5 tabular-nums text-ink/80">{counts.percent}%</span>
        </span>
      </div>
      <div
        className={`overflow-hidden rounded-full bg-surface-2 ${trackH}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={counts.percent}
        aria-label={`${label}: ${counts.percent}%`}
      >
        <div
          className={`${trackH} rounded-full bg-interactive transition-[width] duration-300 ease-out motion-reduce:transition-none`}
          style={{ width: `${counts.percent}%` }}
        />
      </div>
    </div>
  );
}

function PriorityLabel({
  priority,
}: {
  priority: ResolvedGuideStep["priority"];
}) {
  const label =
    priority === "critical"
      ? "Critical"
      : priority === "recommended"
        ? "Recommended"
        : "Optional";
  return (
    <span
      className={`text-[0.65rem] font-semibold uppercase tracking-wide ${
        priority === "critical" ? "text-interactive" : "text-muted"
      }`}
    >
      {label}
    </span>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-[0.7rem] font-bold transition-colors ${
        checked
          ? "border-interactive bg-interactive text-[var(--surface)]"
          : "border-[var(--border)] bg-surface text-transparent"
      }`}
    >
      ✓
    </span>
  );
}

function StepRow({
  step,
  onToggle,
  nearRoute,
  expanded,
  onToggleExpand,
}: {
  step: ResolvedGuideStep;
  onToggle: () => void;
  nearRoute: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const done = step.completed;
  const badgeLocked = step.completedVia === "badge";
  const hasDetails = Boolean(
    step.detail || step.hms?.length || step.keyItems?.length || step.nuzlockeNote,
  );

  function handleActivate() {
    if (badgeLocked) return;
    onToggle();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleActivate();
    }
  }

  function handleDetailsClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onToggleExpand();
  }

  return (
      <div
        role="checkbox"
        aria-checked={done}
        aria-disabled={badgeLocked || undefined}
        tabIndex={badgeLocked ? -1 : 0}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        className={`group w-full rounded-md border border-[var(--border)]/70 text-left transition-colors ${
          badgeLocked
            ? "cursor-default opacity-75"
            : "cursor-pointer hover:border-interactive/45 hover:bg-interactive-soft/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive"
        } ${done ? "bg-surface-2/60" : "bg-surface"}`}
      >
        <div className="flex items-start gap-3 p-3">
          <CheckMark checked={done} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <PriorityLabel priority={step.priority} />
              {nearRoute ? (
                <span className="text-[0.65rem] font-medium text-muted">
                  Near a claimed route
                </span>
              ) : null}
              {step.completedVia === "badge" ? (
                <span className="text-[0.65rem] font-medium text-muted">
                  From badge
                </span>
              ) : null}
            </div>
            <p
              className={`mt-0.5 text-sm font-semibold ${
                done ? "text-muted line-through" : ""
              }`}
            >
              {step.title}
            </p>
            <p className="mt-0.5 text-sm text-muted">{step.summary}</p>

            {hasDetails ? (
              <button
                type="button"
                onClick={handleDetailsClick}
                className="mt-2 text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
                aria-expanded={expanded}
              >
                {expanded ? "Hide details" : "Show details"}
              </button>
            ) : null}

            {expanded && hasDetails ? (
              <div
                className="mt-2 border-t border-[var(--border)]/60 pt-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
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
        </div>
      </div>
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
    if (step.completedVia === "badge") return;
    toggleGuideStepChecked(storageKey, step.id);
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
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm"
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
        <p className="mt-2 text-xs text-muted">
          Story steps are critical + recommended beats. Optional items (like Cut)
          don’t block the bar.
        </p>
      </Frame>

      <Frame title="Next steps">
        {progress.nextSteps.length === 0 ? (
          <p className="text-sm text-muted">
            No open recommendations for this board — browse chapters below or
            mark remaining beats.
          </p>
        ) : (
          <ol className="space-y-2">
            {progress.nextSteps.map((step, index) => (
              <li key={step.id} className="flex gap-2">
                <span className="mt-3 w-4 shrink-0 text-xs font-semibold text-muted">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <StepRow
                    step={step}
                    nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                    expanded={expandedStepId === step.id}
                    onToggleExpand={() =>
                      setExpandedStepId((id) =>
                        id === step.id ? null : step.id,
                      )
                    }
                    onToggle={() => toggleStep(step)}
                  />
                </div>
              </li>
            ))}
          </ol>
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
                  <p className="mt-2 text-xs text-muted">Locked by badges</p>
                ) : null}
                {(isFocused || isActive) && (
                  <ul className="mt-3 space-y-2">
                    {steps.map((step) => (
                      <li key={step.id}>
                        <StepRow
                          step={step}
                          nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                          expanded={expandedStepId === step.id}
                          onToggleExpand={() =>
                            setExpandedStepId((id) =>
                              id === step.id ? null : step.id,
                            )
                          }
                          onToggle={() => toggleStep(step)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {!isFocused && !isActive ? (
                  <p className="mt-3 text-xs text-muted">
                    <Link
                      href={toolsHref(slug, "guide", { chapter: chapter.id })}
                      className="font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
                    >
                      Open checklist
                    </Link>
                  </p>
                ) : null}
              </Frame>
            );
          },
        )}
      </div>
    </div>
  );
}
