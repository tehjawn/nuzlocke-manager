import assert from "node:assert/strict";
import test from "node:test";
import {
  heldItemDescription,
  heldItemSpriteUrl,
} from "@/data/pokemon-index";

test("heldItemDescription resolves catalog names and slugs", () => {
  assert.match(
    heldItemDescription("Leftovers") ?? "",
    /1\/16 of its max HP/i,
  );
  assert.equal(
    heldItemDescription("leftovers"),
    heldItemDescription("Leftovers"),
  );
  assert.equal(
    heldItemDescription("life-orb"),
    heldItemDescription("Life Orb"),
  );
  assert.equal(heldItemDescription(""), null);
  assert.equal(heldItemDescription("Not A Real Item"), null);
});

test("heldItemSpriteUrl proxies through same-origin itemicons", () => {
  assert.equal(
    heldItemSpriteUrl("Leftovers"),
    "/api/sprites/itemicons/leftovers.png",
  );
  assert.equal(
    heldItemSpriteUrl("Never-Melt Ice"),
    "/api/sprites/itemicons/never-melt-ice.png",
  );
});
