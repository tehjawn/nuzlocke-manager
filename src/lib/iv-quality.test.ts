import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBattleStat,
  classifyEv,
  classifyIv,
  specimenIsCracked,
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

test("summarizeIvs prefixes cracked headline with four perfect IVs", () => {
  const summary = summarizeIvs({
    hp: 31,
    atk: 31,
    def: 31,
    spa: 31,
    spd: 10,
    spe: 12,
  });
  assert.ok(summary);
  assert.equal(summary.perfect.length, 4);
  assert.equal(summary.cracked, true);
  assert.equal(summary.headline, "Cracked — 4 perfect IVs");
});

test("summarizeIvs marks randomizer standouts cracked (1 perfect + 2 strong)", () => {
  // Snoop the Gloom: 31 Spe · 27 SpA · 28 SpD
  const summary = summarizeIvs({
    hp: 19,
    atk: 9,
    def: 13,
    spa: 27,
    spd: 28,
    spe: 31,
  });
  assert.ok(summary);
  assert.deepEqual(summary.perfect, ["spe"]);
  assert.deepEqual(summary.strong, ["spa", "spd"]);
  assert.equal(summary.cracked, true);
  assert.equal(summary.headline, "Cracked — Perfect Spe · Strong SpA · SpD");
});

test("summarizeIvs does not crack a lone perfect or two strong", () => {
  assert.equal(
    summarizeIvs({
      hp: 15,
      atk: 16,
      def: 14,
      spa: 18,
      spd: 12,
      spe: 31,
    })?.cracked,
    false,
  );
  assert.equal(
    summarizeIvs({
      hp: 15,
      atk: 16,
      def: 14,
      spa: 27,
      spd: 28,
      spe: 10,
    })?.cracked,
    false,
  );
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

test("specimenIsCracked detects strong IV or EV spreads", () => {
  assert.equal(
    specimenIsCracked({
      ivs: { hp: 31, atk: 31, def: 31, spa: 10, spd: 10, spe: 10 },
    }),
    true,
  );
  assert.equal(
    specimenIsCracked({
      // Snoop-class randomizer hit
      ivs: { hp: 19, atk: 9, def: 13, spa: 27, spd: 28, spe: 31 },
    }),
    true,
  );
  assert.equal(
    specimenIsCracked({
      evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
    }),
    true,
  );
  assert.equal(
    specimenIsCracked({
      ivs: { hp: 15, atk: 16, def: 14, spa: 18, spd: 12, spe: 10 },
    }),
    false,
  );
});
