import assert from "node:assert/strict";
import test from "node:test";
import { typeBadgeSoftStyle } from "@/components/TypeBadge";
import { TYPE_COLORS } from "@/lib/pokemon-types";

test("soft type badges wash the type color instead of solid fill", () => {
  const style = typeBadgeSoftStyle(TYPE_COLORS.Electric);
  assert.match(style.borderColor, /color-mix/);
  assert.match(style.backgroundColor, /color-mix/);
  assert.match(style.color, /var\(--ink\)/);
  assert.match(style.color, /#f8d030/i);
  assert.notEqual(style.backgroundColor, TYPE_COLORS.Electric);
});
