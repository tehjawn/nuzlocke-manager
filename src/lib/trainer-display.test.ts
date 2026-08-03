import assert from "node:assert/strict";
import test from "node:test";
import {
  livingPokemonCount,
  sortTrainersForViewer,
} from "@/lib/trainer-display";

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

test("sortTrainersForViewer badges mode ranks by earned badge count", () => {
  const ordered = sortTrainersForViewer(
    [
      {
        id: "few",
        sortOrder: 0,
        earnedBadgeKeys: ["stone"],
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "many",
        sortOrder: 1,
        earnedBadgeKeys: ["stone", "knuckle", "dynamo"],
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "none",
        sortOrder: 2,
        earnedBadgeKeys: [],
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    ],
    null,
    "badges",
  );
  assert.deepEqual(
    ordered.map((t) => t.id),
    ["many", "few", "none"],
  );
});

test("sortTrainersForViewer pokemon mode uses living box only", () => {
  const ordered = sortTrainersForViewer(
    [
      {
        id: "graves",
        sortOrder: 0,
        pokemon: [
          { slot: "MAIN" },
          { slot: "GRAVEYARD" },
          { slot: "GRAVEYARD" },
          { slot: "GRAVEYARD" },
        ],
      },
      {
        id: "stacked",
        sortOrder: 1,
        pokemon: [
          { slot: "MAIN" },
          { slot: "MAIN" },
          { slot: "RESERVE" },
          { slot: "ENCOUNTERED" },
        ],
      },
    ],
    null,
    "pokemon",
  );
  assert.deepEqual(
    ordered.map((t) => t.id),
    ["stacked", "graves"],
  );
});

test("sortTrainersForViewer name modes are case-insensitive", () => {
  const trainers = [
    { id: "z", sortOrder: 0, handle: "zack" },
    { id: "a", sortOrder: 1, handle: "Ash" },
    { id: "m", sortOrder: 2, handle: "misty" },
  ];
  assert.deepEqual(
    sortTrainersForViewer(trainers, null, "name-asc").map((t) => t.id),
    ["a", "m", "z"],
  );
  assert.deepEqual(
    sortTrainersForViewer(trainers, null, "name-desc").map((t) => t.id),
    ["z", "m", "a"],
  );
});

test("sortTrainersForViewer keeps viewer pinned in non-recent modes", () => {
  const ordered = sortTrainersForViewer(
    [
      {
        id: "leader",
        sortOrder: 0,
        handle: "zzz",
        earnedBadgeKeys: ["a", "b", "c"],
      },
      {
        id: "me",
        sortOrder: 9,
        handle: "aaa",
        earnedBadgeKeys: [],
      },
    ],
    "me",
    "badges",
  );
  assert.equal(ordered[0]?.id, "me");
  assert.equal(ordered[1]?.id, "leader");
});

test("livingPokemonCount counts MAIN and RESERVE only", () => {
  assert.equal(
    livingPokemonCount({
      pokemon: [
        { slot: "MAIN" },
        { slot: "RESERVE" },
        { slot: "GRAVEYARD" },
        { slot: "ENCOUNTERED" },
      ],
    }),
    2,
  );
});
