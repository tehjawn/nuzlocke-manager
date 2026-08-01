import assert from "node:assert/strict";
import test from "node:test";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  resolveActiveChapterId,
  resolveGuideProgress,
  stepMatchesCatchRoutes,
} from "@/features/guide/guide-progress";

test("active chapter starts at prologue with no badges", () => {
  assert.equal(resolveActiveChapterId(EMERALD_GUIDE, []), "prologue");
});

test("active chapter stays on rustboro until critical gates are done", () => {
  const prologueDone = EMERALD_GUIDE.steps
    .filter((s) => s.chapterId === "prologue" && s.priority === "critical")
    .map((s) => s.id);
  assert.equal(
    resolveActiveChapterId(EMERALD_GUIDE, ["gym-1"], [
      ...prologueDone,
      "rustboro-petalburg-woods",
      "rustboro-roxanne",
    ]),
    "rustboro",
  );
});

test("active chapter advances once prior critical steps are complete", () => {
  const priorCriticalDone = EMERALD_GUIDE.steps
    .filter(
      (s) =>
        (s.chapterId === "prologue" || s.chapterId === "rustboro") &&
        s.priority === "critical",
    )
    .map((s) => s.id);
  assert.equal(
    resolveActiveChapterId(EMERALD_GUIDE, ["gym-1"], priorCriticalDone),
    "dewford",
  );
});

test("next steps highlight Devon letter after Stone Badge", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: [
      "prologue-starter",
      "prologue-oldale-petalburg",
      "prologue-route-104",
      "rustboro-petalburg-woods",
      "rustboro-roxanne",
    ],
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

test("gym badges auto-complete matching steps", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: [],
  });
  const roxanne = snap.chapters
    .flatMap((c) => c.steps)
    .find((s) => s.id === "rustboro-roxanne");
  assert.ok(roxanne);
  assert.equal(roxanne!.completed, true);
  assert.equal(roxanne!.completedVia, "badge");
});

test("Steven step appears once Dewford chapter is active", () => {
  const priorCriticalDone = EMERALD_GUIDE.steps
    .filter(
      (s) =>
        (s.chapterId === "prologue" || s.chapterId === "rustboro") &&
        s.priority === "critical",
    )
    .map((s) => s.id);
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: priorCriticalDone,
  });
  assert.equal(snap.activeChapterId, "dewford");
  assert.ok(snap.nextSteps.some((s) => s.id === "dewford-find-steven"));
});

test("catch route soft match is case-insensitive", () => {
  const step = EMERALD_GUIDE.steps.find((s) => s.id === "dewford-find-steven")!;
  assert.equal(stepMatchesCatchRoutes(step, ["granite cave"]), true);
  assert.equal(stepMatchesCatchRoutes(step, ["Route 101"]), false);
});

test("guide document has unique step ids", () => {
  const ids = EMERALD_GUIDE.steps.map((s) => s.id);
  assert.equal(ids.length, new Set(ids).size);
});
