import assert from "node:assert/strict";
import test from "node:test";
import { classifyIv, summarizeIvs } from "@/lib/iv-quality";

test("classifyIv bands", () => {
  assert.equal(classifyIv(31), "perfect");
  assert.equal(classifyIv(28), "strong");
  assert.equal(classifyIv(25), "strong");
  assert.equal(classifyIv(24), "average");
  assert.equal(classifyIv(5), "dump");
  assert.equal(classifyIv(0), "dump");
});

test("summarizeIvs lists perfect and strong", () => {
  const summary = summarizeIvs({
    hp: 31,
    atk: 31,
    def: 20,
    spa: 0,
    spd: 26,
    spe: 31,
  });
  assert.ok(summary);
  assert.deepEqual(summary.perfect, ["hp", "atk", "spe"]);
  assert.deepEqual(summary.strong, ["spd"]);
  assert.deepEqual(summary.dump, ["spa"]);
  assert.equal(summary.cracked, true);
  assert.match(summary.headline ?? "", /Perfect/i);
  assert.match(summary.headline ?? "", /Cracked/i);
});

test("summarizeIvs returns null headline when flat mid IVs", () => {
  const summary = summarizeIvs({
    hp: 15,
    atk: 16,
    def: 14,
    spa: 18,
    spd: 12,
    spe: 10,
  });
  assert.ok(summary);
  assert.equal(summary.headline, null);
  assert.equal(summary.cracked, false);
});

test("summarizeIvs null when missing", () => {
  assert.equal(summarizeIvs(null), null);
  assert.equal(summarizeIvs(undefined), null);
});
