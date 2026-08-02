import assert from "node:assert/strict";
import test from "node:test";
import { decryptGen3Money, formatPokedollars } from "@/lib/gen3-save/money";

test("decryptGen3Money XORs encryption key", () => {
  const key = 0x1234_5678;
  const amount = 48_250;
  const encrypted = (amount ^ key) >>> 0;
  assert.equal(decryptGen3Money(encrypted, key), amount);
  assert.equal(decryptGen3Money(0, 0), 0);
  assert.equal(decryptGen3Money(999_999, 0), 999_999);
  assert.equal(decryptGen3Money(1_000_000, 0), null);
  assert.equal(decryptGen3Money((1_000_000 ^ key) >>> 0, key), null);
});

test("formatPokedollars", () => {
  assert.equal(formatPokedollars(0), "$0");
  assert.equal(formatPokedollars(48250), "$48,250");
});
