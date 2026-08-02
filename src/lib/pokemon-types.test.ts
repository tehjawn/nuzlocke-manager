import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastInkForHex,
  TYPE_COLORS,
  typeBadgeInk,
} from "@/lib/pokemon-types";

test("light type fills get dark ink", () => {
  assert.equal(typeBadgeInk("Electric"), "#111827");
  assert.equal(typeBadgeInk("Ground"), "#111827");
  assert.equal(typeBadgeInk("Ice"), "#111827");
  assert.equal(typeBadgeInk("Fairy"), "#111827");
  assert.equal(typeBadgeInk("Steel"), "#111827");
});

test("deep type fills get white ink", () => {
  assert.equal(typeBadgeInk("Fighting"), "#ffffff");
  assert.equal(typeBadgeInk("Poison"), "#ffffff");
  assert.equal(typeBadgeInk("Ghost"), "#ffffff");
  assert.equal(typeBadgeInk("Dragon"), "#ffffff");
  assert.equal(typeBadgeInk("Dark"), "#ffffff");
});

test("mid type fills prefer dark ink when it contrasts better", () => {
  // Water/Fire/Psychic look “dark,” but WCAG contrast is stronger with near-black.
  assert.equal(typeBadgeInk("Water"), "#111827");
  assert.equal(typeBadgeInk("Fire"), "#111827");
  assert.equal(typeBadgeInk("Psychic"), "#111827");
});

test("contrastInkForHex prefers the stronger of black vs white", () => {
  assert.equal(contrastInkForHex("#ffffff"), "#111827");
  assert.equal(contrastInkForHex("#000000"), "#ffffff");
  assert.equal(contrastInkForHex(TYPE_COLORS.Electric), "#111827");
});
