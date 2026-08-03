import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  bestOffenseVsType,
  coverageOffenseGrid,
  coverageOffenseTiers,
  coverageVerdict,
  offensiveCoverage,
  recommendDraftCoverageTips,
  teamCoverageSummary,
  teamDefensiveProfile,
  vsTrainerMatchup,
  vsTrainerOffenseGrid,
} from "@/lib/team-coverage";

function mon(
  partial: Partial<PokemonEntry> & Pick<PokemonEntry, "id" | "species">,
): PokemonEntry {
  return {
    id: partial.id,
    slot: partial.slot ?? "MAIN",
    partyIndex: partial.partyIndex ?? 0,
    nickname: partial.nickname ?? null,
    species: partial.species,
    pokedexId: partial.pokedexId ?? null,
    isShiny: partial.isShiny ?? false,
    types: partial.types ?? ["Normal"],
    nature: partial.nature ?? null,
    level: partial.level ?? null,
    ability: partial.ability ?? null,
    catchRoute: partial.catchRoute ?? null,
    heldItem: partial.heldItem ?? null,
    moves: partial.moves ?? [],
    ivs: partial.ivs ?? null,
    evs: partial.evs ?? null,
    causeOfDeath: partial.causeOfDeath ?? null,
    diedOnRun: partial.diedOnRun ?? null,
    runId: partial.runId ?? null,
  };
}

test("bestOffenseVsType uses STAB when no moves", () => {
  const swampert = mon({
    id: "1",
    species: "Swampert",
    types: ["Water", "Ground"],
  });
  const vsFire = bestOffenseVsType(swampert, "Fire");
  assert.equal(vsFire.mult, 2);
  assert.equal(vsFire.attackType, "Water");
  assert.equal(vsFire.viaMove, null);

  const vsElectric = bestOffenseVsType(swampert, "Electric");
  assert.equal(vsElectric.mult, 2);
  assert.equal(vsElectric.attackType, "Ground");
});

test("bestOffenseVsType prefers coverage move over weaker STAB", () => {
  const monWithIce = mon({
    id: "2",
    species: "Swampert",
    types: ["Water", "Ground"],
    moves: ["Ice Beam", "Surf", "Earthquake"],
  });
  const vsDragon = bestOffenseVsType(monWithIce, "Dragon");
  assert.equal(vsDragon.mult, 2);
  assert.equal(vsDragon.attackType, "Ice");
  assert.equal(vsDragon.viaMove, "Ice Beam");
});

test("offensiveCoverage finds gaps for mono-Normal team", () => {
  const draft = [
    mon({ id: "a", species: "Slaking", types: ["Normal"] }),
    mon({ id: "b", species: "Linoone", types: ["Normal"] }),
  ];
  const coverage = offensiveCoverage(draft);
  assert.equal(coverage.cells.length, 18);

  const rock = coverage.cells.find((c) => c.defendingType === "Rock");
  assert.ok(rock);
  assert.equal(rock!.bestMult, 0.5);

  const ghost = coverage.cells.find((c) => c.defendingType === "Ghost");
  assert.ok(ghost);
  assert.equal(ghost!.bestMult, 0);

  assert.ok(coverage.gaps.some((g) => g.defendingType === "Rock"));
  assert.ok(coverage.gaps.some((g) => g.defendingType === "Ghost"));
  assert.ok(coverage.gaps.some((g) => g.defendingType === "Steel"));
});

test("offensiveCoverage marks Fighting covered by Fighting STAB", () => {
  const draft = [
    mon({ id: "a", species: "Hariyama", types: ["Fighting"] }),
    mon({ id: "b", species: "Swellow", types: ["Normal", "Flying"] }),
  ];
  const coverage = offensiveCoverage(draft);
  const normal = coverage.cells.find((c) => c.defendingType === "Normal");
  assert.ok(normal);
  assert.equal(normal!.bestMult, 2);
  assert.ok(!coverage.gaps.some((g) => g.defendingType === "Normal"));
});

test("teamDefensiveProfile flags shared holes", () => {
  const draft = [
    mon({ id: "a", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "b", species: "Ludicolo", types: ["Water", "Grass"] }),
    mon({ id: "c", species: "Milotic", types: ["Water"] }),
  ];
  const profile = teamDefensiveProfile(draft);
  // Grass hits Swampert 4×, Ludicolo 0.5×, Milotic 2× → shared hole (2 weak)
  const grass = profile.sharedHoles.find((h) => h.attackType === "Grass");
  assert.ok(grass);
  assert.equal(grass!.weakCount, 2);
  assert.ok(grass!.weakEntryIds.includes("a"));
  assert.ok(grass!.weakEntryIds.includes("c"));

  // Electric: Swampert immune, Ludicolo 0.5, Milotic 2 → only 1 weak, not shared
  assert.ok(!profile.sharedHoles.some((h) => h.attackType === "Electric"));
});

test("teamDefensiveProfile team immunities when all immune", () => {
  const draft = [
    mon({ id: "a", species: "Gengar", types: ["Ghost", "Poison"] }),
    mon({ id: "b", species: "Misdreavus", types: ["Ghost"] }),
  ];
  const profile = teamDefensiveProfile(draft);
  assert.ok(profile.teamImmunities.includes("Normal"));
  assert.ok(profile.teamImmunities.includes("Fighting"));
});

test("empty draft returns empty coverage", () => {
  const coverage = offensiveCoverage([]);
  assert.equal(coverage.cells.length, 18);
  assert.ok(coverage.cells.every((c) => c.bestMult === 0));
  assert.equal(coverage.gaps.length, 18);

  const profile = teamDefensiveProfile([]);
  assert.equal(profile.perMon.length, 0);
  assert.equal(profile.sharedHoles.length, 0);
  assert.equal(profile.teamImmunities.length, 0);
});

test("recommendDraftCoverageTips falls back to STAB", () => {
  const draft = [
    mon({ id: "a", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "b", species: "Gardevoir", types: ["Psychic", "Fairy"] }),
  ];
  const tips = recommendDraftCoverageTips(["Dragon"], draft);
  assert.ok(tips.length >= 1);
  assert.equal(tips[0]!.attackType, "Fairy");
  assert.equal(tips[0]!.mult, 2);
  assert.equal(tips[0]!.viaMove, null);
});

test("teamCoverageSummary highlights gaps and shared holes", () => {
  const draft = [
    mon({ id: "a", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "b", species: "Ludicolo", types: ["Water", "Grass"] }),
    mon({ id: "c", species: "Milotic", types: ["Water"] }),
  ];
  const coverage = offensiveCoverage(draft);
  const defense = teamDefensiveProfile(draft);
  const bullets = teamCoverageSummary(draft, coverage, defense);
  assert.ok(bullets.length >= 2);
  assert.ok(bullets.some((b) => /Water/i.test(b.text)));
  assert.ok(bullets.some((b) => /hole|coverage|Soft|solid/i.test(b.text)));
});

test("teamCoverageSummary empty draft", () => {
  const bullets = teamCoverageSummary(
    [],
    offensiveCoverage([]),
    teamDefensiveProfile([]),
  );
  assert.equal(bullets.length, 1);
  assert.match(bullets[0]!.text, /Empty/i);
});

test("coverageOffenseTiers buckets by best mult", () => {
  const draft = [
    mon({ id: "a", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "b", species: "Gardevoir", types: ["Psychic", "Fairy"] }),
  ];
  const tiers = coverageOffenseTiers(offensiveCoverage(draft));
  assert.ok(tiers.S.includes("Fire")); // Water STAB
  assert.ok(tiers.S.includes("Dragon")); // Fairy STAB
  assert.ok(tiers.S.includes("Fighting")); // Fairy/Psychic
  const total =
    tiers.S.length + tiers.A.length + tiers.B.length + tiers.F.length;
  assert.equal(total, 18);
  assert.ok(!tiers.S.some((t) => tiers.F.includes(t)));
});

test("vsTrainerMatchup favors a typed answer squad", () => {
  const draft = [
    mon({ id: "d1", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "d2", species: "Sceptile", types: ["Grass"] }),
    mon({ id: "d3", species: "Gardevoir", types: ["Psychic"] }),
  ];
  const opponent = [
    mon({ id: "o1", species: "Camerupt", types: ["Fire", "Ground"] }),
    mon({ id: "o2", species: "Sharpedo", types: ["Water", "Dark"] }),
    mon({ id: "o3", species: "Machamp", types: ["Fighting"] }),
  ];
  const matchup = vsTrainerMatchup(draft, opponent);
  assert.ok(matchup.answeredCount >= 2);
  assert.ok(matchup.score >= 48);
  assert.ok(
    matchup.verdict === "favorable" || matchup.verdict === "even",
  );
  assert.ok(matchup.recommendation.length > 10);
  assert.ok(matchup.bullets.length >= 2);
});

test("vsTrainerMatchup flags a bad Fire-into-Water board", () => {
  const draft = [
    mon({ id: "d1", species: "Camerupt", types: ["Fire", "Ground"] }),
    mon({ id: "d2", species: "Torkoal", types: ["Fire"] }),
    mon({ id: "d3", species: "Magcargo", types: ["Fire", "Rock"] }),
  ];
  const opponent = [
    mon({ id: "o1", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "o2", species: "Milotic", types: ["Water"] }),
    mon({ id: "o3", species: "Ludicolo", types: ["Water", "Grass"] }),
  ];
  const matchup = vsTrainerMatchup(draft, opponent);
  assert.ok(matchup.blindCount + matchup.softCount >= 2);
  assert.ok(
    matchup.verdict === "risky" || matchup.verdict === "unfavorable",
  );
  assert.ok(matchup.bullets.some((b) => b.tone === "warn"));
});

test("vsTrainerMatchup empty sides", () => {
  const matchup = vsTrainerMatchup([], []);
  assert.equal(matchup.targets.length, 0);
  assert.match(matchup.recommendation, /Place|Need/i);
});

test("vsTrainerOffenseGrid is opponent rows × draft columns", () => {
  const draft = [
    mon({ id: "d1", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "d2", species: "Sceptile", types: ["Grass"] }),
  ];
  const opponent = [
    mon({ id: "o1", species: "Camerupt", types: ["Fire", "Ground"] }),
    mon({ id: "o2", species: "Sharpedo", types: ["Water", "Dark"] }),
  ];
  const grid = vsTrainerOffenseGrid(draft, opponent);
  assert.equal(grid.length, 2);
  assert.equal(grid[0]!.length, 2);
  assert.equal(grid[0]![0]!.draftId, "d1");
  assert.equal(grid[0]![0]!.targetId, "o1");
  // Swampert Water into Camerupt Fire/Ground
  assert.ok(grid[0]![0]!.mult >= 2);
  // Sceptile Grass into Sharpedo Water/Dark
  assert.ok(grid[1]![1]!.mult >= 2);
});

test("coverageOffenseGrid is type rows × draft columns", () => {
  const draft = [
    mon({ id: "d1", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "d2", species: "Sceptile", types: ["Grass"] }),
  ];
  const rows = coverageOffenseGrid(draft);
  assert.equal(rows.length, 18);
  assert.equal(rows[0]!.cells.length, 2);
  const fire = rows.find((r) => r.defendingType === "Fire");
  assert.ok(fire);
  assert.equal(fire!.status, "covered");
  assert.ok(fire!.cells.some((c) => c.draftId === "d1" && c.mult >= 2));
});

test("coverageVerdict labels solid and leaky boards", () => {
  const solidDraft = [
    mon({ id: "a", species: "Swampert", types: ["Water", "Ground"] }),
    mon({ id: "b", species: "Sceptile", types: ["Grass"] }),
    mon({ id: "c", species: "Gardevoir", types: ["Psychic"] }),
    mon({ id: "d", species: "Aerodactyl", types: ["Rock", "Flying"] }),
    mon({ id: "e", species: "Manectric", types: ["Electric"] }),
    mon({ id: "f", species: "Breloom", types: ["Grass", "Fighting"] }),
  ];
  const solidCoverage = offensiveCoverage(solidDraft);
  const solidDefense = teamDefensiveProfile(solidDraft);
  const solid = coverageVerdict(solidDraft, solidCoverage, solidDefense);
  assert.ok(solid.coveredCount >= 14);
  assert.ok(solid.line.length > 0);

  const leakyDraft = [
    mon({ id: "n1", species: "Rattata", types: ["Normal"] }),
    mon({ id: "n2", species: "Meowth", types: ["Normal"] }),
  ];
  const leaky = coverageVerdict(
    leakyDraft,
    offensiveCoverage(leakyDraft),
    teamDefensiveProfile(leakyDraft),
  );
  assert.equal(leaky.label, "Leaky");
  assert.equal(leaky.tone, "warn");
  assert.ok(leaky.coveredCount < 10);
});
