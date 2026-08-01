import assert from "node:assert/strict";
import test from "node:test";
import {
  GUIDE_CHAPTER_SFX_SRC,
  guideChapterConfettiCount,
  resolveGuideChapterSfxSrc,
} from "@/features/fx/guide-chapter-sfx";
import { SFX_SRC } from "@/features/fx/fx-events";

test("chapter SFX rises through the story arc and clamps at the top", () => {
  assert.equal(GUIDE_CHAPTER_SFX_SRC.length, 10);
  assert.equal(
    resolveGuideChapterSfxSrc(0),
    "/sfx/guide-chapters/chapter-0.wav",
  );
  assert.equal(
    resolveGuideChapterSfxSrc(9),
    "/sfx/guide-chapters/chapter-9.wav",
  );
  assert.equal(
    resolveGuideChapterSfxSrc(99),
    "/sfx/guide-chapters/chapter-9.wav",
  );
  assert.equal(resolveGuideChapterSfxSrc(undefined), SFX_SRC.guide_chapter);
  assert.equal(resolveGuideChapterSfxSrc(-1), SFX_SRC.guide_chapter);
});

test("chapter confetti intensifies but stays under the finale", () => {
  assert.equal(guideChapterConfettiCount(0), 14);
  assert.equal(guideChapterConfettiCount(9), 41);
  assert.ok(guideChapterConfettiCount(9)! < 48);
  assert.equal(guideChapterConfettiCount(undefined), 18);
});
