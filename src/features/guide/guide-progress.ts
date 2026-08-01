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

function sortedChapters(doc: GuideDocument): GuideChapter[] {
  return [...doc.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
}

function chapterStorySteps(doc: GuideDocument, chapterId: string): GuideStep[] {
  return doc.steps.filter(
    (s) => s.chapterId === chapterId && isStoryPriority(s.priority),
  );
}

function chapterStoryDone(
  doc: GuideDocument,
  chapterId: string,
  completedIds: ReadonlySet<string>,
): boolean {
  return chapterStorySteps(doc, chapterId).every((s) => completedIds.has(s.id));
}

/**
 * A chapter opens when the previous chapter's story steps are checked off.
 * Badges are only a shortcut — a player who already has the badges can jump
 * ahead without back-filling checkoffs, but missing badges never block a
 * player who is working through the list.
 */
export function chapterReachable(
  doc: GuideDocument,
  chapter: GuideChapter,
  earnedBadgeKeys: ReadonlySet<string> | readonly string[],
  checkedStepIds: GuideProgressInput["checkedStepIds"] = [],
): boolean {
  const chapters = sortedChapters(doc);
  const index = chapters.findIndex((c) => c.id === chapter.id);
  if (index <= 0) return true;

  const earned =
    earnedBadgeKeys instanceof Set
      ? earnedBadgeKeys
      : new Set(earnedBadgeKeys);
  if (hasAllBadges(earned, chapter.requiresBadges)) return true;

  const completedIds = asCheckedSet(checkedStepIds);
  const previous = chapters[index - 1]!;
  return chapterStoryDone(doc, previous.id, completedIds);
}

/** Cleared once every story step is checked off. */
export function chapterCleared(
  doc: GuideDocument,
  chapter: GuideChapter,
  checkedStepIds: GuideProgressInput["checkedStepIds"] = [],
): boolean {
  const steps = chapterStorySteps(doc, chapter.id);
  if (steps.length === 0) return false;
  return chapterStoryDone(doc, chapter.id, asCheckedSet(checkedStepIds));
}

/**
 * First chapter (in story order) that still has incomplete story steps.
 * Never stops early on badge gates — checkoffs alone always move forward.
 */
export function resolveActiveChapterId(
  doc: GuideDocument,
  _earnedBadgeKeys: readonly string[],
  checkedStepIds: GuideProgressInput["checkedStepIds"] = [],
): string {
  const completedIds = asCheckedSet(checkedStepIds);
  const chapters = sortedChapters(doc);

  for (const chapter of chapters) {
    if (!chapterStoryDone(doc, chapter.id, completedIds)) return chapter.id;
  }

  return chapters.at(-1)?.id ?? "";
}

/** Steps unlock from their own prerequisites only — badges never gate them. */
function stepAvailable(
  step: GuideStep,
  completedIds: ReadonlySet<string>,
): boolean {
  for (const req of step.requiresSteps ?? []) {
    if (!completedIds.has(req)) return false;
  }
  return true;
}

const NEXT_STEP_LIMIT = 3;
const PRIORITY_RANK = { critical: 0, recommended: 1, optional: 2 } as const;

/**
 * Compute next steps + per-chapter checklists from manual checkoffs.
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

  const chapters = sortedChapters(doc).map((chapter) => {
    const steps = doc.steps
      .filter((s) => s.chapterId === chapter.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toResolved);
    return {
      chapter,
      steps,
      completedCount: steps.filter((s) => s.completed).length,
      reachable: chapterReachable(doc, chapter, earned, completedIds),
      cleared: chapterCleared(doc, chapter, completedIds),
      isActive: chapter.id === activeChapterId,
    };
  });

  // Stay on the active chapter — don't leak later-chapter beats into Next steps
  // while earlier story steps (incl. recommended) are still open.
  const nextSteps = doc.steps
    .map(toResolved)
    .filter((s) => s.chapterId === activeChapterId)
    .filter((s) => !s.completed)
    .filter((s) => isStoryPriority(s.priority))
    .filter((s) => stepAvailable(s, completedIds))
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
