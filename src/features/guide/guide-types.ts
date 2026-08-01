/** Curated story-guide content for “what do I do next?” (not 100% completion). */

export type GuideStepPriority = "critical" | "recommended" | "optional";

export type GuideStep = {
  id: string;
  chapterId: string;
  title: string;
  /** One-liner shown in Next steps. */
  summary: string;
  /** Longer how/where/why (markdown). */
  detail?: string;
  /** Soft location hints (match against catch routes). */
  locations?: string[];
  /** Badge keys required before this step is relevant. */
  requiresBadges?: string[];
  /** Prior step ids that should be done first. */
  requiresSteps?: string[];
  /** When this badge is earned, treat the step as done. */
  autoCompleteWhenBadge?: string;
  /** Display-only gates until bag/HM save parse exists. */
  hms?: string[];
  keyItems?: string[];
  nuzlockeNote?: string;
  priority: GuideStepPriority;
  sortOrder: number;
};

export type GuideChapter = {
  id: string;
  title: string;
  summary: string;
  /**
   * Badges the player should already have to treat this chapter as reachable.
   * Empty = available from the start of the run.
   */
  requiresBadges: string[];
  /** Earning this badge clears the chapter as “past”. */
  clearsWithBadge?: string;
  sortOrder: number;
};

export type GuideDocument = {
  id: string;
  gameLabel: string;
  chapters: GuideChapter[];
  steps: GuideStep[];
};

export type GuideProgressInput = {
  earnedBadgeKeys: readonly string[];
  /** Catch / claim routes from the board (soft signal). */
  catchRoutes?: readonly string[];
  /** Manually completed step ids. */
  checkedStepIds: ReadonlySet<string> | readonly string[];
};

export type ResolvedGuideStep = GuideStep & {
  completed: boolean;
  /** Why it counts as completed. */
  completedVia: "manual" | "badge" | null;
  blockedBySteps: string[];
  chapterTitle: string;
};

export type GuideProgressSnapshot = {
  activeChapterId: string;
  nextSteps: ResolvedGuideStep[];
  chapters: Array<{
    chapter: GuideChapter;
    steps: ResolvedGuideStep[];
    completedCount: number;
    reachable: boolean;
    cleared: boolean;
    isActive: boolean;
  }>;
};
