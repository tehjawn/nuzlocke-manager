import assert from "node:assert/strict";
import test from "node:test";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  resolveActiveChapterId,
  resolveGuideProgress,
  stepMatchesCatchRoutes,
} from "@/features/guide/guide-progress";

function stepById(
  snapshot: ReturnType<typeof resolveGuideProgress>,
  id: string,
) {
  return snapshot.chapters.flatMap((c) => c.steps).find((s) => s.id === id);
}

test("active chapter starts at prologue with no checkoffs", () => {
  assert.equal(resolveActiveChapterId(EMERALD_GUIDE, [], []), "prologue");
});

test("steps only complete via manual checkoffs", () => {
  const empty = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1", "gym-2"],
    catchRoutes: ["Rustboro City", "Granite Cave"],
    checkedStepIds: [],
  });
  assert.equal(stepById(empty, "prologue-starter")!.completed, false);
  assert.equal(stepById(empty, "rustboro-roxanne")!.completed, false);
  assert.equal(stepById(empty, "dewford-find-steven")!.completed, false);

  const marked = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: ["prologue-starter", "rustboro-roxanne"],
  });
  assert.equal(stepById(marked, "prologue-starter")!.completed, true);
  assert.equal(stepById(marked, "rustboro-roxanne")!.completed, true);
  assert.equal(stepById(marked, "rustboro-devon-letter")!.completed, false);
});

test("active chapter advances once prior critical steps are checked", () => {
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

test("next steps highlight starting the Nuzlocke after the starter", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: [],
    checkedStepIds: ["prologue-starter"],
  });
  assert.equal(snap.activeChapterId, "prologue");
  assert.ok(
    snap.nextSteps.some((s) => s.id === "prologue-start-nuzlocke"),
    `expected start-nuzlocke in next steps, got ${snap.nextSteps.map((s) => s.id).join(", ")}`,
  );
});

test("next steps stay on prologue until Head toward Rustboro is checked", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: [
      "prologue-starter",
      "prologue-start-nuzlocke",
      "prologue-oldale-petalburg",
    ],
  });
  assert.equal(snap.activeChapterId, "prologue");
  const ids = snap.nextSteps.map((s) => s.id);
  assert.deepEqual(ids, ["prologue-route-104"]);
  assert.ok(!ids.includes("rustboro-devon-letter"));
  assert.ok(!ids.includes("rustboro-petalburg-woods"));
});

test("next steps highlight Devon letter after Rustboro gym is checked", () => {
  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: ["gym-1"],
    checkedStepIds: [
      "prologue-starter",
      "prologue-start-nuzlocke",
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

test("start-nuzlocke step sits between starter and Petalburg", () => {
  const starter = EMERALD_GUIDE.steps.find((s) => s.id === "prologue-starter")!;
  const start = EMERALD_GUIDE.steps.find(
    (s) => s.id === "prologue-start-nuzlocke",
  )!;
  const petalburg = EMERALD_GUIDE.steps.find(
    (s) => s.id === "prologue-oldale-petalburg",
  )!;
  assert.ok(starter.sortOrder < start.sortOrder);
  assert.ok(start.sortOrder < petalburg.sortOrder);
  assert.deepEqual(start.requiresSteps, ["prologue-starter"]);
  assert.deepEqual(petalburg.requiresSteps, ["prologue-start-nuzlocke"]);
  assert.match(start.summary, /100 Poké Balls|Pokédex/i);
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

test("Fallarbor chapter covers Meteor Falls and Go-Goggles before Lavaridge", () => {
  const meteor = EMERALD_GUIDE.steps.find((s) => s.id === "fallarbor-meteor-falls");
  const goggles = EMERALD_GUIDE.steps.find((s) => s.id === "fallarbor-go-goggles");
  const chimney = EMERALD_GUIDE.steps.find((s) => s.id === "lavaridge-mt-chimney");
  assert.ok(meteor);
  assert.ok(goggles);
  assert.equal(meteor!.chapterId, "fallarbor");
  assert.equal(goggles!.chapterId, "fallarbor");
  assert.ok(goggles!.keyItems?.includes("Go-Goggles"));
  assert.equal(chimney!.chapterId, "lavaridge");
  assert.equal(
    EMERALD_GUIDE.steps.some((s) => s.id === "mauville-to-desert"),
    false,
  );
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

test("guide document has unique step ids", () => {
  const ids = EMERALD_GUIDE.steps.map((s) => s.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("every step prerequisite points at a real earlier step", () => {
  const order = new Map(
    EMERALD_GUIDE.chapters.map((c) => [c.id, c.sortOrder]),
  );
  const byId = new Map(EMERALD_GUIDE.steps.map((s) => [s.id, s]));
  for (const step of EMERALD_GUIDE.steps) {
    for (const req of step.requiresSteps ?? []) {
      const prereq = byId.get(req);
      assert.ok(prereq, `${step.id} requires missing step ${req}`);
      const stepChapter = order.get(step.chapterId)!;
      const prereqChapter = order.get(prereq!.chapterId)!;
      assert.ok(
        prereqChapter < stepChapter ||
          (prereqChapter === stepChapter &&
            prereq!.sortOrder < step.sortOrder),
        `${step.id} requires ${req}, which does not come earlier`,
      );
    }
  }
});

test("no story step is gated behind an optional prerequisite", () => {
  const byId = new Map(EMERALD_GUIDE.steps.map((s) => [s.id, s]));
  for (const step of EMERALD_GUIDE.steps) {
    if (step.priority === "optional") continue;
    for (const req of step.requiresSteps ?? []) {
      assert.notEqual(
        byId.get(req)!.priority,
        "optional",
        `${step.id} would stall behind optional ${req}`,
      );
    }
  }
});

test("checking off Next steps walks the entire guide with no dead ends", () => {
  const checked = new Set<string>();
  const visitedChapters: string[] = [];
  const totalStory = EMERALD_GUIDE.steps.filter(
    (s) => s.priority !== "optional",
  ).length;

  // No badges at all — the worst case for a player who only uses checkoffs.
  for (let guard = 0; guard <= totalStory + 5; guard += 1) {
    const snap = resolveGuideProgress(EMERALD_GUIDE, {
      earnedBadgeKeys: [],
      checkedStepIds: checked,
    });

    if (visitedChapters.at(-1) !== snap.activeChapterId) {
      visitedChapters.push(snap.activeChapterId);
    }

    if (checked.size === totalStory) {
      assert.deepEqual(snap.nextSteps, []);
      break;
    }

    assert.ok(
      snap.nextSteps.length > 0,
      `dead end in ${snap.activeChapterId} after ${checked.size}/${totalStory} steps`,
    );
    for (const step of snap.nextSteps) checked.add(step.id);
  }

  assert.equal(checked.size, totalStory);
  assert.deepEqual(
    visitedChapters,
    EMERALD_GUIDE.chapters
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.id),
  );
});

test("finishing a chapter unlocks the next one without badges", () => {
  const throughDewford = EMERALD_GUIDE.steps
    .filter((s) =>
      ["prologue", "rustboro", "dewford"].includes(s.chapterId),
    )
    .filter((s) => s.priority !== "optional")
    .map((s) => s.id);

  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: [],
    checkedStepIds: throughDewford,
  });

  const mauville = snap.chapters.find((c) => c.chapter.id === "mauville")!;
  assert.equal(mauville.reachable, true);
  assert.equal(snap.activeChapterId, "mauville");
  assert.ok(snap.nextSteps.length > 0);

  const dewford = snap.chapters.find((c) => c.chapter.id === "dewford")!;
  assert.equal(dewford.cleared, true);
});

test("last step is Discord lock-in after the Champion", () => {
  const throughLeague = EMERALD_GUIDE.steps
    .filter((s) => s.chapterId !== "last-step")
    .filter((s) => s.priority !== "optional")
    .map((s) => s.id);

  const snap = resolveGuideProgress(EMERALD_GUIDE, {
    earnedBadgeKeys: [],
    checkedStepIds: throughLeague,
  });

  assert.equal(snap.activeChapterId, "last-step");
  assert.deepEqual(
    snap.nextSteps.map((s) => s.id),
    ["last-step-lock-in"],
  );

  const step = snap.nextSteps[0]!;
  assert.match(step.summary, /#gaming/i);
  assert.match(step.summary, /Oubori/);
  assert.match(step.summary, /jawn/);
  assert.match(step.summary, /chedda/i);
  assert.ok(step.detail?.includes("one trainer per player"));
});
