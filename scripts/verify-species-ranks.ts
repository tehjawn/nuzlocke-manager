/**
 * Manual QA check for the Pokédex F→S base-stat ranks.
 *
 *   npx tsx scripts/verify-species-ranks.ts
 *
 * Not a test suite (this repo keeps none — see AGENTS.md): it's a smoke check
 * to run after `npm run data:base-stats` regenerates the catalog, since the
 * rank thresholds are derived from that data and drift silently otherwise.
 * Exits non-zero on a mismatch and prints the current threshold table.
 */
import { modernEmeraldNationalIds } from "@/lib/modern-emerald-dex";
import {
  baseStatRanksFor,
  rankForPercentile,
  STAT_RANKS,
  type StatRank,
} from "@/lib/species-ranks";
import {
  baseStatsForSpecies,
  bstOf,
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
} from "@/lib/stats";

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) return;
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

type Column = StatKey | "bst";
const COLUMNS: Column[] = [...STAT_KEYS, "bst"];

/** Independent peer pool — plain arrays, no binary search, to catch bounds bugs. */
const pool: Record<Column, number[]> = {
  hp: [],
  atk: [],
  def: [],
  spa: [],
  spd: [],
  spe: [],
  bst: [],
};
const ranked: number[] = [];
for (const id of modernEmeraldNationalIds()) {
  const stats = baseStatsForSpecies(id);
  if (!stats) continue;
  ranked.push(id);
  for (const key of STAT_KEYS) pool[key].push(stats[key]);
  pool.bst.push(bstOf(stats));
}

/** Midrank percentile, computed the slow obvious way. */
function naivePercentile(values: number[], value: number): number {
  let below = 0;
  let ties = 0;
  for (const v of values) {
    if (v < value) below += 1;
    else if (v === value) ties += 1;
  }
  return (below + ties / 2) / values.length;
}

console.log(`Peer pool: ${ranked.length} Modern Emerald species with base stats`);
const statless = modernEmeraldNationalIds().filter(
  (id) => !baseStatsForSpecies(id),
);
console.log(`Excluded (no catalogued stats): ${statless.join(", ") || "none"}`);

console.log("\n1. Percentiles + letters match an independent computation");
for (const id of ranked) {
  const result = baseStatRanksFor(id);
  if (!result) {
    check(`#${id} ranks`, false, "helper returned null for a pooled species");
    continue;
  }
  const stats = baseStatsForSpecies(id)!;
  for (const key of STAT_KEYS) {
    const expected = naivePercentile(pool[key], stats[key]);
    const actual = result.perStat[key];
    check(
      `#${id} ${key} percentile`,
      Math.abs(actual.percentile - expected) < 1e-9,
      `expected ${expected}, got ${actual.percentile}`,
    );
    check(
      `#${id} ${key} letter`,
      actual.rank === rankForPercentile(expected),
      `expected ${rankForPercentile(expected)}, got ${actual.rank}`,
    );
    check(`#${id} ${key} value`, actual.value === stats[key]);
  }
  const expectedBst = naivePercentile(pool.bst, bstOf(stats));
  check(
    `#${id} BST percentile`,
    Math.abs(result.bst.percentile - expectedBst) < 1e-9,
  );
  check(`#${id} BST value`, result.bst.value === bstOf(stats));
  check(`#${id} peerCount`, result.peerCount === ranked.length);
}

console.log("2. Bucket boundaries are inclusive at the cutoff");
const BOUNDARIES: Array<[number, StatRank]> = [
  [1, "S"],
  [0.9, "S"],
  [0.8999999, "A"],
  [0.75, "A"],
  [0.7499999, "B"],
  [0.55, "B"],
  [0.5499999, "C"],
  [0.35, "C"],
  [0.3499999, "D"],
  [0.15, "D"],
  [0.1499999, "F"],
  [0, "F"],
];
for (const [percentile, expected] of BOUNDARIES) {
  const actual = rankForPercentile(percentile);
  check(
    `rankForPercentile(${percentile})`,
    actual === expected,
    `expected ${expected}, got ${actual}`,
  );
}

console.log("3. Ranks are monotonic in raw value");
for (const column of COLUMNS) {
  const sorted = [...new Set(pool[column])].sort((a, b) => a - b);
  let lastRankIndex = -1;
  for (const value of sorted) {
    const index = STAT_RANKS.indexOf(
      rankForPercentile(naivePercentile(pool[column], value)),
    );
    check(
      `${column} monotonic at ${value}`,
      index >= lastRankIndex,
      `rank fell going up in value`,
    );
    lastRankIndex = Math.max(lastRankIndex, index);
  }
}

console.log("4. Species with no catalogued base stats rank as null");
for (const id of [...statless, 10004, 99999]) {
  check(`#${id} → null`, baseStatRanksFor(id) === null);
}
for (const id of [null, undefined, 0, -1]) {
  check(`${id} → null`, baseStatRanksFor(id) === null);
}

console.log("5. Anchor species land on the expected tiers");
const ANCHORS: Array<[string, number, Partial<Record<Column, StatRank>>]> = [
  ["Blissey", 242, { hp: "S", atk: "F", spd: "S", bst: "S" }],
  ["Shuckle", 213, { def: "S", spd: "S", spe: "F", bst: "A" }],
  ["Metagross", 376, { bst: "S" }],
  ["Swampert", 260, { bst: "A" }],
  ["Ninjask", 291, { spe: "S", def: "D" }],
  ["Magikarp", 129, { bst: "F" }],
  ["Shedinja", 292, { hp: "F" }],
];
for (const [name, id, expected] of ANCHORS) {
  const result = baseStatRanksFor(id);
  if (!result) {
    check(`${name} ranks`, false, "returned null");
    continue;
  }
  for (const [column, rank] of Object.entries(expected) as Array<
    [Column, StatRank]
  >) {
    const actual = column === "bst" ? result.bst.rank : result.perStat[column].rank;
    check(`${name} ${column}`, actual === rank, `expected ${rank}, got ${actual}`);
  }
}

console.log("\nRaw thresholds over the current pool:");
const header = ["Column", ...[...STAT_RANKS].reverse().slice(0, 5)].map((h) =>
  String(h).padStart(7),
);
console.log(header.join(""), " (min raw value for each tier)");
for (const column of COLUMNS) {
  const sorted = [...pool[column]].sort((a, b) => a - b);
  const counts: Record<StatRank, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
  const mins: Partial<Record<StatRank, number>> = {};
  for (const value of sorted) {
    const rank = rankForPercentile(naivePercentile(pool[column], value));
    counts[rank] += 1;
    if (mins[rank] == null) mins[rank] = value;
  }
  const label = column === "bst" ? "BST" : STAT_LABELS[column];
  const cells = (["S", "A", "B", "C", "D"] as StatRank[]).map((r) =>
    String(mins[r] ?? "—").padStart(7),
  );
  const tally = (["S", "A", "B", "C", "D", "F"] as StatRank[])
    .map((r) => `${r}:${counts[r]}`)
    .join(" ");
  console.log(`${label.padStart(7)}${cells.join("")}   ${tally}`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
