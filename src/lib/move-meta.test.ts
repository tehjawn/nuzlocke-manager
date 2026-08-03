import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMoveMetaTip,
  lookupMoveMeta,
  moveTypeWashStyle,
} from "@/lib/move-meta";

test("lookupMoveMeta resolves common damaging and status moves", () => {
  const flame = lookupMoveMeta("Flamethrower");
  assert.ok(flame);
  assert.equal(flame.type, "Fire");
  assert.equal(flame.category, "Special");
  assert.equal(flame.power, 90);
  assert.equal(flame.description, "10% chance to burn the target.");

  const soft = lookupMoveMeta("Softboiled");
  assert.ok(soft);
  assert.equal(soft.category, "Status");
  assert.equal(soft.power, 0);
  assert.equal(soft.description, "Heals the user by 50% of its max HP.");

  assert.equal(lookupMoveMeta("not-a-real-move"), null);
});

test("formatMoveMetaTip combines battle metadata with effect descriptions", () => {
  assert.equal(
    formatMoveMetaTip({
      category: "Special",
      description: "10% chance to burn the target.",
      name: "Flamethrower",
      power: 90,
      type: "Fire",
    }),
    "Fire · Special · 90 power — 10% chance to burn the target.",
  );
  assert.equal(
    formatMoveMetaTip({
      category: "Status",
      description: "Heals the user by 50% of its max HP.",
      name: "Softboiled",
      power: 0,
      type: "Normal",
    }),
    "Normal · Status — Heals the user by 50% of its max HP.",
  );
});

test("formatMoveMetaTip falls back to battle metadata without a description", () => {
  assert.equal(
    formatMoveMetaTip({
      category: "Status",
      description: "",
      name: "Custom Move",
      power: 0,
      type: "Normal",
    }),
    "Normal · Status",
  );
});

test("moveTypeWashStyle gradients known moves and skips unknowns", () => {
  const wash = moveTypeWashStyle("Flamethrower");
  assert.ok(wash);
  assert.match(wash.backgroundImage, /linear-gradient/i);
  assert.match(wash.backgroundImage, /var\(--info\)/);
  assert.match(wash.backgroundImage, /f08030/i);
  assert.match(wash.borderColor, /f08030/i);
  assert.equal(moveTypeWashStyle("not-a-real-move"), undefined);
});
