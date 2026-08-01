import assert from "node:assert/strict";
import test from "node:test";
import {
  isThemePreference,
  resolveThemePreference,
} from "@/lib/theme";

test("accepts explicit and system theme preferences", () => {
  assert.equal(isThemePreference("light"), true);
  assert.equal(isThemePreference("dark"), true);
  assert.equal(isThemePreference("system"), true);
  assert.equal(isThemePreference("auto"), false);
  assert.equal(isThemePreference(null), false);
});

test("resolves system themes while preserving explicit choices", () => {
  assert.equal(resolveThemePreference("system", "dark"), "dark");
  assert.equal(resolveThemePreference("system", "light"), "light");
  assert.equal(resolveThemePreference("light", "dark"), "light");
  assert.equal(resolveThemePreference("dark", "light"), "dark");
});
