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
  /** Owning any Pokémon proves this step happened (e.g. the starter). */
  autoCompleteWhenHasPokemon?: boolean;
  /**
   * Never infer this step from travel — it is skippable content the player
   * can walk past (e.g. Rusturf / Strength).
   */
  skipInference?: boolean;
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
  /**
   * Places the player physically visits during this chapter. A claimed catch
   * route here proves every earlier chapter was completed.
   */
  locations: string[];
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
  /** Catch / claim routes from the board — proves where the player has been. */
  catchRoutes?: readonly string[];
  /** Board has at least one Pokémon (party, box, or graveyard). */
  hasPokemon?: boolean;
  /** Manually completed step ids. */
  checkedStepIds: ReadonlySet<string> | readonly string[];
  /** Steps the player explicitly un-checked, overriding inference. */
  uncheckedStepIds?: ReadonlySet<string> | readonly string[];
};

export type GuideStepCompletionSource = "manual" | "badge" | "inferred";

export type ResolvedGuideStep = GuideStep & {
  completed: boolean;
  /** Why it counts as completed. */
  completedVia: GuideStepCompletionSource | null;
  /** Board-derived completion the player can override by clicking. */
  inferred: boolean;
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
