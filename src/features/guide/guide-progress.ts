import type {
  GuideChapter,
  GuideDocument,
  GuideProgressInput,
  GuideProgressSnapshot,
  GuideStep,
  GuideStepPriority,
  ResolvedGuideStep,
} from "@/features/guide/guide-types";

function asCheckedSet(
  checked: GuideProgressInput["checkedStepIds"],
): Set<string> {
  if (checked instanceof Set) return checked;
  return new Set(checked);
}

function hasAllBadges(
  earned: ReadonlySet<string>,
  required: readonly string[] | undefined,
): boolean {
  if (!required?.length) return true;
  return required.every((key) => earned.has(key));
}

/** Critical + recommended count as story; optional never blocks chapter progress. */
function isStoryPriority(priority: GuideStepPriority): boolean {
  return priority !== "optional";
}

export function chapterReachable(
  chapter: GuideChapter,
  earnedBadgeKeys: ReadonlySet<string> | readonly string[],
): boolean {
  const earned =
    earnedBadgeKeys instanceof Set
      ? earnedBadgeKeys
      : new Set(earnedBadgeKeys);
  return hasAllBadges(earned, chapter.requiresBadges);
}

export function chapterCleared(
  chapter: GuideChapter,
  earnedBadgeKeys: ReadonlySet<string> | readonly string[],
): boolean {
  if (!chapter.clearsWithBadge) return false;
  const earned =
    earnedBadgeKeys instanceof Set
      ? earnedBadgeKeys
      : new Set(earnedBadgeKeys);
  return earned.has(chapter.clearsWithBadge);
}

/**
 * Earliest reachable chapter that still has incomplete story steps
 * (critical + recommended). Optional pickups never hold the chapter open.
 */
export function resolveActiveChapterId(
  doc: GuideDocument,
  earnedBadgeKeys: readonly string[],
  checkedStepIds: GuideProgressInput["checkedStepIds"] = [],
): string {
  const earned = new Set(earnedBadgeKeys);
  const completedIds = asCheckedSet(checkedStepIds);
  const chapters = [...doc.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  let lastReachable = chapters[0]?.id ?? "";

  for (const chapter of chapters) {
    if (!chapterReachable(chapter, earned)) break;
    lastReachable = chapter.id;
    const storyIncomplete = doc.steps.some(
      (s) =>
        s.chapterId === chapter.id &&
        isStoryPriority(s.priority) &&
        !completedIds.has(s.id),
    );
    if (storyIncomplete) return chapter.id;
  }

  return lastReachable;
}

function stepAvailable(
  step: GuideStep,
  earned: ReadonlySet<string>,
  completedIds: ReadonlySet<string>,
): boolean {
  if (!hasAllBadges(earned, step.requiresBadges)) return false;
  for (const req of step.requiresSteps ?? []) {
    if (!completedIds.has(req)) return false;
  }
  return true;
}

const NEXT_STEP_LIMIT = 3;
const PRIORITY_RANK = { critical: 0, recommended: 1, optional: 2 } as const;

/**
 * Compute next steps + per-chapter checklists from manual checkoffs.
 * Badges only gate chapter reachability — they never auto-complete steps.
 * Next steps stay on the active chapter until its story beats are done.
 */
export function resolveGuideProgress(
  doc: GuideDocument,
  input: GuideProgressInput,
): GuideProgressSnapshot {
  const earned = new Set(input.earnedBadgeKeys);
  const completedIds = asCheckedSet(input.checkedStepIds);
  const chapterById = new Map(doc.chapters.map((c) => [c.id, c]));

  const activeChapterId = resolveActiveChapterId(
    doc,
    input.earnedBadgeKeys,
    input.checkedStepIds,
  );

  function toResolved(step: GuideStep): ResolvedGuideStep {
    const chapter = chapterById.get(step.chapterId);
    const completed = completedIds.has(step.id);
    const blockedBySteps = (step.requiresSteps ?? []).filter(
      (id) => !completedIds.has(id),
    );
    return {
      ...step,
      chapterTitle: chapter?.title ?? step.chapterId,
      completed,
      blockedBySteps,
    };
  }

  const chapters = [...doc.chapters]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((chapter) => {
      const steps = doc.steps
        .filter((s) => s.chapterId === chapter.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(toResolved);
      const storyDone = steps
        .filter((s) => isStoryPriority(s.priority))
        .every((s) => s.completed);
      return {
        chapter,
        steps,
        completedCount: steps.filter((s) => s.completed).length,
        reachable: chapterReachable(chapter, earned),
        cleared: chapterCleared(chapter, earned) && storyDone,
        isActive: chapter.id === activeChapterId,
      };
    });

  // Stay on the active chapter — don't leak later-chapter beats into Next steps
  // while earlier story steps (incl. recommended) are still open.
  const nextSteps = doc.steps
    .map(toResolved)
    .filter((s) => s.chapterId === activeChapterId)
    .filter((s) => !s.completed)
    .filter((s) => stepAvailable(s, earned, completedIds))
    .filter((s) => isStoryPriority(s.priority))
    .sort((a, b) => {
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      }
      return a.sortOrder - b.sortOrder;
    })
    .slice(0, NEXT_STEP_LIMIT);

  return {
    activeChapterId,
    nextSteps,
    chapters,
  };
}

/** Soft hint: any claimed catch route overlaps the step’s locations. */
export function stepMatchesCatchRoutes(
  step: GuideStep,
  catchRoutes: readonly string[],
): boolean {
  if (!step.locations?.length || !catchRoutes.length) return false;
  const claimed = new Set(catchRoutes.map((r) => r.toLowerCase()));
  return step.locations.some((loc) => claimed.has(loc.toLowerCase()));
}
