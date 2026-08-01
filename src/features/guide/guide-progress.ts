import type {
  GuideChapter,
  GuideDocument,
  GuideProgressInput,
  GuideProgressSnapshot,
  GuideStep,
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

function stepIsComplete(
  step: GuideStep,
  earned: ReadonlySet<string>,
  checked: ReadonlySet<string>,
): { completed: boolean; completedVia: "manual" | "badge" | null } {
  if (step.autoCompleteWhenBadge && earned.has(step.autoCompleteWhenBadge)) {
    return { completed: true, completedVia: "badge" };
  }
  if (checked.has(step.id)) {
    return { completed: true, completedVia: "manual" };
  }
  return { completed: false, completedVia: null };
}

function buildCompletedIds(
  doc: GuideDocument,
  earned: ReadonlySet<string>,
  checked: ReadonlySet<string>,
): Set<string> {
  const completedIds = new Set<string>();
  for (const step of doc.steps) {
    if (stepIsComplete(step, earned, checked).completed) {
      completedIds.add(step.id);
    }
  }
  return completedIds;
}

/**
 * Earliest reachable chapter that still has incomplete critical steps.
 * Falls back to the furthest reachable chapter.
 */
export function resolveActiveChapterId(
  doc: GuideDocument,
  earnedBadgeKeys: readonly string[],
  checkedStepIds: GuideProgressInput["checkedStepIds"] = [],
): string {
  const earned = new Set(earnedBadgeKeys);
  const checked = asCheckedSet(checkedStepIds);
  const completedIds = buildCompletedIds(doc, earned, checked);
  const chapters = [...doc.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  let lastReachable = chapters[0]?.id ?? "";

  for (const chapter of chapters) {
    if (!chapterReachable(chapter, earned)) break;
    lastReachable = chapter.id;
    const criticalIncomplete = doc.steps.some(
      (s) =>
        s.chapterId === chapter.id &&
        s.priority === "critical" &&
        !completedIds.has(s.id),
    );
    if (criticalIncomplete) return chapter.id;
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
 * Compute next steps + per-chapter checklists from board badges and checkoffs.
 */
export function resolveGuideProgress(
  doc: GuideDocument,
  input: GuideProgressInput,
): GuideProgressSnapshot {
  const earned = new Set(input.earnedBadgeKeys);
  const checked = asCheckedSet(input.checkedStepIds);
  const chapterById = new Map(doc.chapters.map((c) => [c.id, c]));
  const completedIds = buildCompletedIds(doc, earned, checked);

  const activeChapterId = resolveActiveChapterId(
    doc,
    input.earnedBadgeKeys,
    input.checkedStepIds,
  );

  function toResolved(step: GuideStep): ResolvedGuideStep {
    const chapter = chapterById.get(step.chapterId);
    const { completed, completedVia } = stepIsComplete(step, earned, checked);
    const blockedBySteps = (step.requiresSteps ?? []).filter(
      (id) => !completedIds.has(id),
    );
    return {
      ...step,
      chapterTitle: chapter?.title ?? step.chapterId,
      completed,
      completedVia,
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
      const criticalDone = steps
        .filter((s) => s.priority === "critical")
        .every((s) => s.completed);
      return {
        chapter,
        steps,
        completedCount: steps.filter((s) => s.completed).length,
        reachable: chapterReachable(chapter, earned),
        cleared: chapterCleared(chapter, earned) && criticalDone,
        isActive: chapter.id === activeChapterId,
      };
    });

  const nextSteps: ResolvedGuideStep[] = [];

  const candidates = doc.steps
    .map(toResolved)
    .filter((s) => !s.completed)
    .filter((s) => stepAvailable(s, earned, completedIds))
    .filter((s) => s.priority !== "optional")
    .sort((a, b) => {
      const aActive = a.chapterId === activeChapterId ? 0 : 1;
      const bActive = b.chapterId === activeChapterId ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      }
      const aChapter = chapterById.get(a.chapterId)?.sortOrder ?? 0;
      const bChapter = chapterById.get(b.chapterId)?.sortOrder ?? 0;
      if (aChapter !== bChapter) return aChapter - bChapter;
      return a.sortOrder - b.sortOrder;
    });

  for (const step of candidates) {
    nextSteps.push(step);
    if (nextSteps.length >= NEXT_STEP_LIMIT) break;
  }

  if (nextSteps.length === 0) {
    const fallback = doc.steps
      .map(toResolved)
      .filter((s) => s.chapterId === activeChapterId && !s.completed)
      .filter((s) => stepAvailable(s, earned, completedIds))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, NEXT_STEP_LIMIT);
    nextSteps.push(...fallback);
  }

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
