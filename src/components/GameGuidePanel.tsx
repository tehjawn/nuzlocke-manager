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

function uniqueCatchRoutes(trainer: TrainerProfile | null): string[] {
  if (!trainer) return [];
  const routes = new Set<string>();
  for (const mon of trainer.pokemon) {
    if (mon.catchRoute?.trim()) routes.add(mon.catchRoute.trim());
  }
  return [...routes];
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

function StepRow({
  step,
  onToggle,
  nearRoute,
  expanded,
  onExpand,
}: {
  step: ResolvedGuideStep;
  onToggle: () => void;
  nearRoute: boolean;
  expanded: boolean;
  onExpand: () => void;
}) {
  const done = step.completed;
  const badgeLocked = step.completedVia === "badge";

  return (
    <li
      className={`rounded-md border border-[var(--border)]/70 ${
        done ? "opacity-70" : "bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--interactive)]"
          checked={done}
          disabled={badgeLocked}
          onChange={onToggle}
          aria-label={`Mark “${step.title}” ${done ? "incomplete" : "done"}`}
        />
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
          <button
            type="button"
            onClick={onExpand}
            className="mt-0.5 w-full text-left"
          >
            <span
              className={`text-sm font-semibold ${done ? "line-through" : ""}`}
            >
              {step.title}
            </span>
            <p className="mt-0.5 text-sm text-muted">{step.summary}</p>
          </button>
          {expanded && (step.detail || step.hms || step.keyItems || step.nuzlockeNote) ? (
            <div className="mt-2 border-t border-[var(--border)]/60 pt-2">
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
                <ul className="min-w-0 flex-1 list-none">
                  <StepRow
                    step={step}
                    nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                    expanded={expandedStepId === step.id}
                    onExpand={() =>
                      setExpandedStepId((id) =>
                        id === step.id ? null : step.id,
                      )
                    }
                    onToggle={() => toggleStep(step)}
                  />
                </ul>
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
          ({ chapter, steps, completedCount, reachable, cleared, isActive }) => {
            const isFocused = chapter.id === focusedChapterId;
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
                <p className="mt-1 text-xs text-muted">
                  {completedCount}/{steps.length} steps
                  {!reachable ? " · locked by badges" : null}
                </p>
                {(isFocused || isActive) && (
                  <ul className="mt-3 space-y-2">
                    {steps.map((step) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        nearRoute={stepMatchesCatchRoutes(step, catchRoutes)}
                        expanded={expandedStepId === step.id}
                        onExpand={() =>
                          setExpandedStepId((id) =>
                            id === step.id ? null : step.id,
                          )
                        }
                        onToggle={() => toggleStep(step)}
                      />
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
