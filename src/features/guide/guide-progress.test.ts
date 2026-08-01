import assert from "node:assert/strict";
import test from "node:test";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  resolveActiveChapterId,
  resolveGuideProgress,
  resolveReachedChapterOrder,
  stepMatchesCatchRoutes,
} from "@/features/guide/guide-progress";

function stepById(snapshot: ReturnType<typeof resolveGuideProgress>, id: string) {
  return snapshot.chapters.flatMap((c) => c.steps).find((s) => s.id === id);
}

test("active chapter starts at prologue with an empty board", () => {
  assert.equal(
    resolveActiveChapterId(EMERALD_GUIDE, {
      earnedBadgeKeys: [],
      checkedStepIds: [],
    }),
    "prologue",
  );
});

test("owning any Pokémon completes the random starter step", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: [],
    hasPokemon: true,
    checkedStepIds: [],
  });
  const starter = stepById(snap, "prologue-starter");
  assert.ok(starter);
  assert.equal(starter!.completed, true);
  assert.equal(starter!.completedVia, "inferred");
});

test("catching in Rustboro implies the Petalburg prologue is done", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: [],
    catchRoutes: ["Rustboro City"],
    checkedStepIds: [],
  });
  const dad = stepById(snap, "prologue-oldale-petalburg");
  assert.ok(dad);
  assert.equal(dad!.completed, true);
  assert.equal(dad!.completedVia, "inferred");
  assert.equal(snap.activeChapterId, "rustboro");
});

test("a gym badge alone does not imply later steps in its own chapter", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: [],
  });
  const letter = stepById(snap, "rustboro-devon-letter");
  assert.ok(letter);
  assert.equal(letter!.completed, false);

  const roxanne = stepById(snap, "rustboro-roxanne");
  assert.equal(roxanne!.completedVia, "badge");
});

test("reaching Dewford implies the Rustboro letter chain is done", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    catchRoutes: ["Granite Cave"],
    checkedStepIds: [],
  });
  const letter = stepById(snap, "rustboro-devon-letter");
  assert.equal(letter!.completed, true);
  assert.equal(letter!.completedVia, "inferred");
  assert.equal(snap.activeChapterId, "dewford");
});

test("optional and skippable steps never infer from travel", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1", "gym-2", "gym-3", "gym-4"],
    catchRoutes: ["Lavaridge Town"],
    checkedStepIds: [],
  });
  assert.equal(stepById(snap, "rustboro-get-cut")!.completed, false);
  assert.equal(stepById(snap, "mauville-rock-smash")!.completed, false);
});

test("an explicit un-check overrides board inference", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: [],
    hasPokemon: true,
    checkedStepIds: [],
    uncheckedStepIds: ["prologue-starter"],
  });
  const starter = stepById(snap, "prologue-starter");
  assert.equal(starter!.completed, false);
  assert.equal(starter!.inferred, true);
});

test("badge completion cannot be overridden by an un-check", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: [],
    uncheckedStepIds: ["rustboro-roxanne"],
  });
  assert.equal(stepById(snap, "rustboro-roxanne")!.completed, true);
});

test("reached chapter order prefers the furthest board signal", () => {
  assert.equal(resolveReachedChapterOrder(EMERALD_GUIDE, [], []), 0);
  assert.equal(resolveReachedChapterOrder(EMERALD_GUIDE, ["gym-1"], []), 1);
  assert.equal(
    resolveReachedChapterOrder(EMERALD_GUIDE, ["gym-1"], ["Mossdeep City"]),
    7,
  );
});

test("next steps surface the Devon letter after Stone Badge", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    hasPokemon: true,
    catchRoutes: ["Rustboro City"],
    checkedStepIds: [],
  });
  assert.equal(snap.activeChapterId, "rustboro");
  const ids = snap.nextSteps.map((s) => s.id);
  assert.ok(
    ids.includes("rustboro-devon-letter"),
    `expected Devon letter in next steps, got ${ids.join(", ")}`,
  );
  assert.ok(
    !ids.includes("rustboro-get-cut"),
    "Cut is optional and should not appear in Next steps",
  );
});

test("Cut is optional and not story-blocking", () => {
  const cut = EMERALD_GUIDE.steps.find((s) => s.id === "rustboro-get-cut");
  assert.ok(cut);
  assert.equal(cut!.priority, "optional");
});

test("Rusturf progress is Rock Smash, not Cut", () => {
  const smash = EMERALD_GUIDE.steps.find((s) => s.id === "mauville-rock-smash");
  assert.ok(smash);
  assert.equal(smash!.priority, "critical");
  assert.ok(smash!.hms?.includes("Rock Smash"));
  assert.ok(smash!.summary.toLowerCase().includes("rusturf"));
});

test("starter step reflects Modern Emerald random starter", () => {
  const starter = EMERALD_GUIDE.steps.find((s) => s.id === "prologue-starter");
  assert.ok(starter);
  assert.match(starter!.summary, /random/i);
});

test("catch route soft match is case-insensitive", () => {
  const step = EMERALD_GUIDE.steps.find((s) => s.id === "dewford-find-steven")!;
  assert.equal(stepMatchesCatchRoutes(step, ["granite cave"]), true);
  assert.equal(stepMatchesCatchRoutes(step, ["Route 101"]), false);
});

test("guide document has unique step ids and known chapters", () => {
  const ids = EMERALD_GUIDE.steps.map((s) => s.id);
  assert.equal(ids.length, new Set(ids).size);
  const chapterIds = new Set(EMERALD_GUIDE.chapters.map((c) => c.id));
  for (const step of EMERALD_GUIDE.steps) {
    assert.ok(chapterIds.has(step.chapterId), `unknown chapter ${step.chapterId}`);
  }
});
