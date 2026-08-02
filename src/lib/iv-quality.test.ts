import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBattleStat,
  classifyEv,
  classifyIv,
  summarizeBattleStats,
  summarizeEvs,
  summarizeIvs,
} from "@/lib/iv-quality";

test("classifyIv bands", () => {
  assert.equal(classifyIv(31), "perfect");
  assert.equal(classifyIv(28), "strong");
  assert.equal(classifyIv(25), "strong");
  assert.equal(classifyIv(24), "average");
  assert.equal(classifyIv(5), "dump");
  assert.equal(classifyIv(0), "dump");
});

test("classifyEv bands ignore unused zeros", () => {
  assert.equal(classifyEv(252), "perfect");
  assert.equal(classifyEv(200), "strong");
  assert.equal(classifyEv(199), "average");
  assert.equal(classifyEv(0), "average");
});

test("classifyBattleStat uses max ratio", () => {
  assert.equal(classifyBattleStat(95, 100), "perfect");
  assert.equal(classifyBattleStat(85, 100), "strong");
  assert.equal(classifyBattleStat(60, 100), "average");
  assert.equal(classifyBattleStat(40, 100), "dump");
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

test("summarizeEvs highlights max investment", () => {
  const summary = summarizeEvs({
    hp: 0,
    atk: 252,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 220,
  });
  assert.ok(summary);
  assert.deepEqual(summary.perfect, ["atk"]);
  assert.deepEqual(summary.strong, ["spe"]);
  assert.match(summary.headline ?? "", /Max Atk/i);
  assert.match(summary.headline ?? "", /High Spe/i);
});

test("summarizeBattleStats highlights near-max rows", () => {
  const summary = summarizeBattleStats(
    { hp: 100, atk: 90, def: 40, spa: 50, spd: 50, spe: 96 },
    { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
  );
  assert.ok(summary);
  assert.deepEqual(summary.perfect, ["hp", "spe"]);
  assert.deepEqual(summary.strong, ["atk"]);
  assert.deepEqual(summary.dump, ["def"]);
  assert.match(summary.headline ?? "", /Near-max/i);
});
