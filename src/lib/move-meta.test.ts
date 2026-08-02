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

  const soft = lookupMoveMeta("Softboiled");
  assert.ok(soft);
  assert.equal(soft.category, "Status");
  assert.equal(soft.power, 0);

  assert.equal(lookupMoveMeta("not-a-real-move"), null);
});

test("formatMoveMetaTip includes power only for damaging moves", () => {
  assert.equal(
    formatMoveMetaTip({
      name: "Flamethrower",
      type: "Fire",
      category: "Special",
      power: 90,
    }),
    "Fire · Special · 90 power",
  );
  assert.equal(
    formatMoveMetaTip({
      name: "Softboiled",
      type: "Normal",
      category: "Status",
      power: 0,
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
