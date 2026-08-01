/**
 * Single entry point for game-event feedback.
 * Call after a successful client mutation: `triggerFx("badge_earned", { badgeKey })`.
 */

import { playSfx, playSfxSrc } from "@/features/fx/audio-engine";
import { resolveBadgeSfxSrc } from "@/features/fx/badge-sfx";
import { pushCelebration } from "@/features/fx/CelebrationHost";
import { FX_CATALOG, type FxEvent } from "@/features/fx/fx-events";
import { readFxPrefs } from "@/features/fx/fx-prefs";
import {
  guideChapterConfettiCount,
  resolveGuideChapterSfxSrc,
} from "@/features/fx/guide-chapter-sfx";

export type TriggerFxPayload = {
  /** BadgeDefinition.key — picks a themed earn sting for `badge_earned`. */
  badgeKey?: string;
  /**
   * GuideChapter.sortOrder — picks the crescendo chapter-clear sting +
   * confetti intensity for `guide_chapter_cleared`.
   */
  guideChapterIndex?: number;
};

export function triggerFx(event: FxEvent, payload: TriggerFxPayload = {}) {
  if (typeof window === "undefined") return;

  const recipe = FX_CATALOG[event];
  const prefs = readFxPrefs();

  if (event === "badge_earned") {
    playSfxSrc(resolveBadgeSfxSrc(payload.badgeKey));
  } else if (event === "guide_chapter_cleared") {
    playSfxSrc(resolveGuideChapterSfxSrc(payload.guideChapterIndex));
  } else if (recipe.sfx) {
    playSfx(recipe.sfx);
  }

  if (recipe.celebration && prefs.celebrationsEnabled) {
    const confettiCount =
      event === "guide_chapter_cleared"
        ? guideChapterConfettiCount(payload.guideChapterIndex)
        : undefined;
    pushCelebration(recipe.celebration, recipe.celebrationMs, {
      confettiCount,
    });
  }
}
