import type {
  GuideChapter,
  GuideDocument,
  GuideProgressInput,
  GuideProgressSnapshot,
  GuideStep,
  GuideStepCompletionSource,
  ResolvedGuideStep,
} from "@/features/guide/guide-types";

function asSet(
  value: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> {
  if (!value) return new Set<string>();
  if (value instanceof Set) return value;
  return new Set(value);
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
  return hasAllBadges(asSet(earnedBadgeKeys), chapter.requiresBadges);
}

export function chapterCleared(
  chapter: GuideChapter,
  earnedBadgeKeys: ReadonlySet<string> | readonly string[],
): boolean {
  if (!chapter.clearsWithBadge) return false;
  return asSet(earnedBadgeKeys).has(chapter.clearsWithBadge);
}

/**
 * Chapter the board says the player is currently standing in.
 *
 * Catch routes are the strong signal: reaching a chapter's map means every
 * earlier chapter was played through. Badges are deliberately weaker — a gym
 * win only proves the chapter it clears was entered, since chapters often
 * continue past their gym (Rustboro's Devon letter comes after Roxanne).
 */
export function resolveReachedChapterOrder(
  doc: GuideDocument,
  earnedBadgeKeys: readonly string[],
  catchRoutes: readonly string[] = [],
): number {
  const earned = asSet(earnedBadgeKeys);
  const claimed = new Set(catchRoutes.map((route) => route.trim().toLowerCase()));
  let reached = 0;

  for (const chapter of doc.chapters) {
    if (chapter.clearsWithBadge && earned.has(chapter.clearsWithBadge)) {
      reached = Math.max(reached, chapter.sortOrder);
    }
    if (claimed.size > 0) {
      const visited = chapter.locations.some((location) =>
        claimed.has(location.toLowerCase()),
      );
      if (visited) reached = Math.max(reached, chapter.sortOrder);
    }
  }

  return reached;
}

type CompletionContext = {
  earned: ReadonlySet<string>;
  checked: ReadonlySet<string>;
  unchecked: ReadonlySet<string>;
  hasPokemon: boolean;
  reachedChapterOrder: number;
  chapterOrderById: ReadonlyMap<string, number>;
};

function inferStepFromBoard(step: GuideStep, ctx: CompletionContext): boolean {
  if (step.autoCompleteWhenHasPokemon && ctx.hasPokemon) return true;
  if (step.skipInference || step.priority === "optional") return false;
  const chapterOrder = ctx.chapterOrderById.get(step.chapterId);
  if (chapterOrder == null) return false;
  return chapterOrder < ctx.reachedChapterOrder;
}

function stepCompletion(
  step: GuideStep,
  ctx: CompletionContext,
): { completed: boolean; completedVia: GuideStepCompletionSource | null; inferred: boolean } {
  const inferred = inferStepFromBoard(step, ctx);

  // Badges are authoritative — you cannot un-win a gym.
  if (step.autoCompleteWhenBadge && ctx.earned.has(step.autoCompleteWhenBadge)) {
    return { completed: true, completedVia: "badge", inferred };
  }
  if (ctx.unchecked.has(step.id)) {
    return { completed: false, completedVia: null, inferred };
  }
  if (ctx.checked.has(step.id)) {
    return { completed: true, completedVia: "manual", inferred };
  }
  if (inferred) {
    return { completed: true, completedVia: "inferred", inferred };
  }
  return { completed: false, completedVia: null, inferred };
}

function buildContext(
  doc: GuideDocument,
  input: GuideProgressInput,
): CompletionContext {
  return {
    earned: asSet(input.earnedBadgeKeys),
    checked: asSet(input.checkedStepIds),
    unchecked: asSet(input.uncheckedStepIds),
    hasPokemon: Boolean(input.hasPokemon),
    reachedChapterOrder: resolveReachedChapterOrder(
      doc,
      input.earnedBadgeKeys,
      input.catchRoutes ?? [],
    ),
    chapterOrderById: new Map(doc.chapters.map((c) => [c.id, c.sortOrder])),
  };
}

function buildCompletedIds(
  doc: GuideDocument,
  ctx: CompletionContext,
): Set<string> {
  const completedIds = new Set<string>();
  for (const step of doc.steps) {
    if (stepCompletion(step, ctx).completed) completedIds.add(step.id);
  }
  return completedIds;
}

/**
 * Earliest reachable chapter that still has incomplete critical steps.
 * Falls back to the furthest reachable chapter.
 */
export function resolveActiveChapterId(
  doc: GuideDocument,
  input: GuideProgressInput,
): string {
  const ctx = buildContext(doc, input);
  const completedIds = buildCompletedIds(doc, ctx);
  const chapters = [...doc.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  let lastReachable = chapters[0]?.id ?? "";

  for (const chapter of chapters) {
    if (!chapterReachable(chapter, ctx.earned)) break;
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
 * Compute next steps + per-chapter checklists from board signals and checkoffs.
 */
export function resolveGuideProgress(
  doc: GuideDocument,
  input: GuideProgressInput,
): GuideProgressSnapshot {
  const ctx = buildContext(doc, input);
  const chapterById = new Map(doc.chapters.map((c) => [c.id, c]));
  const completedIds = buildCompletedIds(doc, ctx);
  const activeChapterId = resolveActiveChapterId(doc, input);

  function toResolved(step: GuideStep): ResolvedGuideStep {
    const chapter = chapterById.get(step.chapterId);
    const { completed, completedVia, inferred } = stepCompletion(step, ctx);
    const blockedBySteps = (step.requiresSteps ?? []).filter(
      (id) => !completedIds.has(id),
    );
    return {
      ...step,
      chapterTitle: chapter?.title ?? step.chapterId,
      completed,
      completedVia,
      inferred,
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
        reachable: chapterReachable(chapter, ctx.earned),
        cleared: chapterCleared(chapter, ctx.earned) && criticalDone,
        isActive: chapter.id === activeChapterId,
      };
    });

  const nextSteps: ResolvedGuideStep[] = [];

  const candidates = doc.steps
    .map(toResolved)
    .filter((s) => !s.completed)
    .filter((s) => stepAvailable(s, ctx.earned, completedIds))
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
      .filter((s) => stepAvailable(s, ctx.earned, completedIds))
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
