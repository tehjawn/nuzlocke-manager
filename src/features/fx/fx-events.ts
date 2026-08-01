/**
 * Game moments that can fire SFX / celebrations / (future) music cues.
 * Aligns with Prisma `ActivityType` where possible; adds client-only kinds
 * (shiny catch, evolution) until those exist as first-class activity types.
 */

export type FxEvent =
  | "catch"
  | "shiny_catch"
  | "death"
  | "badge_earned"
  | "badge_revoked"
  | "revive_used"
  | "wipe"
  | "main_squad_locked"
  | "champion"
  | "member_joined"
  | "ui_success"
  | "ui_error"
  | "guide_step_checked"
  | "guide_chapter_cleared"
  | "guide_complete";

export type SfxId =
  | "catch"
  | "shiny"
  | "death"
  | "badge"
  | "revive"
  | "wipe"
  | "lock"
  | "champion"
  | "join"
  | "success"
  | "error"
  | "guide_check"
  | "guide_chapter"
  | "guide_complete";

export type CelebrationKind =
  | "catch"
  | "shiny"
  | "badge"
  | "champion"
  | "lock"
  | "join"
  | "guide_chapter"
  | "guide_complete";

export type FxRecipe = {
  /** One-shot SFX to play (if sfxEnabled). */
  sfx?: SfxId;
  /** Overlay celebration (if celebrationsEnabled + not reduced motion). */
  celebration?: CelebrationKind;
  /** How long the celebration stays visible. */
  celebrationMs?: number;
};

/**
 * Canonical mapping: event → sensory recipe.
 * Call sites should only know `FxEvent`; assets + intensity live here.
 */
export const FX_CATALOG: Record<FxEvent, FxRecipe> = {
  catch: { sfx: "catch", celebration: "catch", celebrationMs: 1400 },
  shiny_catch: { sfx: "shiny", celebration: "shiny", celebrationMs: 2200 },
  death: { sfx: "death" },
  badge_earned: { celebration: "badge", celebrationMs: 1800 },
  badge_revoked: { sfx: "success" },
  revive_used: { sfx: "revive" },
  wipe: { sfx: "wipe" },
  main_squad_locked: {
    sfx: "lock",
    celebration: "lock",
    celebrationMs: 2000,
  },
  champion: { sfx: "champion", celebration: "champion", celebrationMs: 2800 },
  member_joined: { sfx: "join", celebration: "join", celebrationMs: 1200 },
  ui_success: { sfx: "success" },
  ui_error: { sfx: "error" },
  guide_step_checked: { sfx: "guide_check" },
  guide_chapter_cleared: {
    sfx: "guide_chapter",
    celebration: "guide_chapter",
    celebrationMs: 1800,
  },
  guide_complete: {
    sfx: "guide_complete",
    celebration: "guide_complete",
    celebrationMs: 4200,
  },
};

/** Public asset paths — short WAV one-shots in `public/sfx/`. */
export const SFX_SRC: Record<SfxId, string> = {
  catch: "/sfx/catch.wav",
  shiny: "/sfx/shiny.wav",
  death: "/sfx/death.wav",
  badge: "/sfx/badge.wav",
  revive: "/sfx/revive.wav",
  wipe: "/sfx/wipe.wav",
  lock: "/sfx/lock.wav",
  champion: "/sfx/champion.wav",
  join: "/sfx/join.wav",
  success: "/sfx/success.wav",
  error: "/sfx/error.wav",
  guide_check: "/sfx/guide-check.wav",
  guide_chapter: "/sfx/guide-chapter.wav",
  guide_complete: "/sfx/guide-complete.wav",
};
