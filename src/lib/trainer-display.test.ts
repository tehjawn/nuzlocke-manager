import assert from "node:assert/strict";
import test from "node:test";
import { sortTrainersForViewer } from "@/lib/trainer-display";

test("sortTrainersForViewer pins the viewer first", () => {
  const ordered = sortTrainersForViewer(
    [
      { id: "a", sortOrder: 1, updatedAt: "2026-08-01T12:00:00.000Z" },
      { id: "me", sortOrder: 9, updatedAt: "2026-07-01T12:00:00.000Z" },
      { id: "b", sortOrder: 2, updatedAt: "2026-08-01T18:00:00.000Z" },
    ],
    "me",
  );
  assert.deepEqual(
    ordered.map((t) => t.id),
    ["me", "b", "a"],
  );
});

test("sortTrainersForViewer sorts others by updatedAt newest first", () => {
  const ordered = sortTrainersForViewer(
    [
      { id: "old", sortOrder: 1, updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "mid", sortOrder: 2, updatedAt: "2026-07-01T00:00:00.000Z" },
      { id: "new", sortOrder: 3, updatedAt: "2026-08-01T00:00:00.000Z" },
    ],
    null,
  );
  assert.deepEqual(
    ordered.map((t) => t.id),
    ["new", "mid", "old"],
  );
});

test("sortTrainersForViewer puts missing updatedAt after known stamps", () => {
  const ordered = sortTrainersForViewer(
    [
      { id: "unknown", sortOrder: 0, updatedAt: null },
      { id: "recent", sortOrder: 5, updatedAt: "2026-08-01T00:00:00.000Z" },
    ],
    null,
  );
  assert.deepEqual(
    ordered.map((t) => t.id),
    ["recent", "unknown"],
  );
});

test("sortTrainersForViewer breaks equal timestamps with sortOrder", () => {
  const stamp = "2026-08-01T00:00:00.000Z";
  const ordered = sortTrainersForViewer(
    [
      { id: "second", sortOrder: 2, updatedAt: stamp },
      { id: "first", sortOrder: 1, updatedAt: stamp },
    ],
    null,
  );
  assert.deepEqual(
    ordered.map((t) => t.id),
    ["first", "second"],
  );
});
