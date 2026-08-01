import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_IMPORT_REPLACE_SLOTS,
  graveDedupeKey,
  importedGravesToAppend,
} from "@/lib/import-memorial";

test("DEFAULT_IMPORT_REPLACE_SLOTS excludes GRAVEYARD", () => {
  assert.deepEqual(DEFAULT_IMPORT_REPLACE_SLOTS, [
    "MAIN",
    "RESERVE",
    "ENCOUNTERED",
  ]);
  assert.ok(!DEFAULT_IMPORT_REPLACE_SLOTS.includes("GRAVEYARD"));
});

test("graveDedupeKey normalizes species and nickname", () => {
  assert.equal(
    graveDedupeKey({ species: " Zigzagoon ", nickname: " Ziggy " }),
    "zigzagoon|ziggy",
  );
  assert.equal(
    graveDedupeKey({ species: "Ralts", nickname: null }),
    "ralts|",
  );
  assert.equal(
    graveDedupeKey({ species: "Ralts", nickname: "  " }),
    "ralts|",
  );
});

test("importedGravesToAppend keeps existing and skips duplicates", () => {
  const { toCreate, nextPartyIndex } = importedGravesToAppend(
    [
      { species: "Zigzagoon", nickname: "Ziggy", partyIndex: 0 },
      { species: "Ralts", nickname: null, partyIndex: 2 },
    ],
    [
      { species: "Zigzagoon", nickname: "Ziggy" },
      { species: "Taillow", nickname: "Ace" },
      { species: "ralts", nickname: "" },
      { species: "Taillow", nickname: "Ace" },
    ],
  );

  assert.equal(nextPartyIndex, 3);
  assert.deepEqual(toCreate, [{ species: "Taillow", nickname: "Ace" }]);
});

test("importedGravesToAppend starts at 0 when memorial is empty", () => {
  const { toCreate, nextPartyIndex } = importedGravesToAppend(
    [],
    [{ species: "Wurmple", nickname: "Silk" }],
  );
  assert.equal(nextPartyIndex, 0);
  assert.equal(toCreate.length, 1);
});
