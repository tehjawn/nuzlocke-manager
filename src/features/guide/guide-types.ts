/** Curated story-guide content for “what do I do next?” (not 100% completion). */

import type { PokemonType } from "@/lib/pokemon-types";

export type GuideStepPriority = "critical" | "recommended" | "optional";

/** Beginner-friendly gym prep attached to gym-leader steps. */
export type GuideGymPrep = {
  leaderName: string;
  specialtyTypes: PokemonType[];
  /** Types that generally hit the gym hard. */
  recommendedTypes: PokemonType[];
  /** Types that often struggle into this gym’s specialty. */
  cautionTypes?: PokemonType[];
  /**
   * Highest level on the leader’s party — the recommended fight level and
   * Trash Pack house-rule cap for the next undefeated gym. Modern Emerald
   * Normal keeps vanilla Emerald gym / E4 parties; Hard+ may buff them.
   */
  aceLevel: number;
  /**
   * Soft badge key (`gym-1`…`championship`) for progress context — cleared
   * vs live cap vs upcoming target.
   */
  badgeKey?: string;
  /**
   * Short party note. Vanilla Emerald baseline — Modern Emerald Normal keeps
   * gym parties; Hard+ may differ.
   */
  partyNotes: string;
};

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
  /** Display-only gates until bag/HM save parse exists. */
  hms?: string[];
  keyItems?: string[];
  nuzlockeNote?: string;
  /** Shown on gym-leader steps for squad type matching. */
  gymPrep?: GuideGymPrep;
  priority: GuideStepPriority;
  sortOrder: number;
};

/** Story spine vs bonus post-champion content (separate progress / UI section). */
export type GuideChapterSection = "story" | "post-game";

export type GuideChapter = {
  id: string;
  title: string;
  summary: string;
  /**
   * Badges the player should already have to treat this chapter as reachable.
   * Empty = available from the start of the run.
   */
  requiresBadges: string[];
  /** Earning this badge marks the chapter as past (soft chapter nav only). */
  clearsWithBadge?: string;
  /**
   * `post-game` chapters are excluded from story progress / active-chapter
   * resolution and render in a separate guide section.
   * Defaults to `"story"` when omitted.
   */
  section?: GuideChapterSection;
  /** Places associated with this chapter (soft “near route” hints). */
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
  /** Soft chapter gating only — does not auto-complete steps. */
  earnedBadgeKeys: readonly string[];
  /** Soft “near a claimed route” hints only. */
  catchRoutes?: readonly string[];
  /** Manually completed step ids (local checkoffs). */
  checkedStepIds: ReadonlySet<string> | readonly string[];
};

export type ResolvedGuideStep = GuideStep & {
  completed: boolean;
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
