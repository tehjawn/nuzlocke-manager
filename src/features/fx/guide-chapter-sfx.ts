/**
 * Chapter-clear SFX crescendo — same motif, rising pitch + denser flourishes.
 * Index matches GuideChapter.sortOrder for story chapters (0 = prologue).
 * The Discord lock-in finale uses `guide_complete` instead.
 */

import { SFX_SRC } from "@/features/fx/fx-events";

/** Ascending one-shots under `public/sfx/guide-chapters/`. */
export const GUIDE_CHAPTER_SFX_SRC: readonly string[] = [
  "/sfx/guide-chapters/chapter-0.wav",
  "/sfx/guide-chapters/chapter-1.wav",
  "/sfx/guide-chapters/chapter-2.wav",
  "/sfx/guide-chapters/chapter-3.wav",
  "/sfx/guide-chapters/chapter-4.wav",
  "/sfx/guide-chapters/chapter-5.wav",
  "/sfx/guide-chapters/chapter-6.wav",
  "/sfx/guide-chapters/chapter-7.wav",
  "/sfx/guide-chapters/chapter-8.wav",
  "/sfx/guide-chapters/chapter-9.wav",
];

export function resolveGuideChapterSfxSrc(
  chapterIndex: number | undefined,
): string {
  if (
    typeof chapterIndex !== "number" ||
    !Number.isFinite(chapterIndex) ||
    chapterIndex < 0
  ) {
    return SFX_SRC.guide_chapter;
  }
  const clamped = Math.min(
    Math.floor(chapterIndex),
    GUIDE_CHAPTER_SFX_SRC.length - 1,
  );
  return GUIDE_CHAPTER_SFX_SRC[clamped] ?? SFX_SRC.guide_chapter;
}

/**
 * Mini-confetti particle budget — grows with chapter index, capped below the
 * guide-complete finale (48).
 */
export function guideChapterConfettiCount(
  chapterIndex: number | undefined,
): number {
  if (typeof chapterIndex !== "number" || !Number.isFinite(chapterIndex)) {
    return 18;
  }
  const clamped = Math.max(0, Math.min(9, Math.floor(chapterIndex)));
  return 14 + clamped * 3;
}
