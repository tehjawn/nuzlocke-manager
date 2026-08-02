import assert from "node:assert/strict";
import test from "node:test";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import {
  guideChapterLabel,
  guideChapterNumber,
  squadMatchesForGymPrep,
} from "@/features/guide/guide-gym-prep";
import type { PokemonEntry } from "@/lib/challenge-types";

function mon(
  partial: Partial<PokemonEntry> &
    Pick<PokemonEntry, "id" | "species" | "slot" | "types">,
): PokemonEntry {
  return {
    partyIndex: 0,
    nickname: null,
    pokedexId: null,
    isShiny: false,
    nature: null,
    level: null,
    ability: null,
    catchRoute: null,
    heldItem: null,
    moves: [],
    ivs: null,
    evs: null,
    causeOfDeath: null,
    diedOnRun: null,
    runId: null,
    ...partial,
  };
}

test("chapter numbers are 1-based from sortOrder", () => {
  const prologue = EMERALD_GUIDE.chapters.find((c) => c.id === "prologue")!;
  const fallarbor = EMERALD_GUIDE.chapters.find((c) => c.id === "fallarbor")!;
  assert.equal(guideChapterNumber(prologue), 1);
  assert.equal(guideChapterNumber(fallarbor), 5);
  assert.equal(
    guideChapterLabel(fallarbor),
    "Ch. 5 · Fallarbor & Meteor Falls",
  );
});

test("guide inserts Fallarbor between Mauville and Lavaridge", () => {
  const ordered = EMERALD_GUIDE.chapters
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => c.id);
  const mauville = ordered.indexOf("mauville");
  const fallarbor = ordered.indexOf("fallarbor");
  const lavaridge = ordered.indexOf("lavaridge");
  assert.ok(mauville >= 0 && fallarbor >= 0 && lavaridge >= 0);
  assert.equal(fallarbor, mauville + 1);
  assert.equal(lavaridge, fallarbor + 1);
});

test("every gym step has gym prep with recommended types", () => {
  const gymSteps = EMERALD_GUIDE.steps.filter((s) =>
    /Defeat (Roxanne|Brawly|Wattson|Flannery|Norman|Winona|Tate|Juan)|Elite Four/i.test(
      s.title,
    ),
  );
  assert.ok(gymSteps.length >= 8);
  for (const step of gymSteps) {
    assert.ok(step.gymPrep, `${step.id} missing gymPrep`);
    assert.ok(step.gymPrep!.recommendedTypes.length > 0);
    assert.ok(step.gymPrep!.specialtyTypes.length > 0);
  }
});

test("squadMatchesForGymPrep only uses Main/Reserve type overlap", () => {
  const prep = EMERALD_GUIDE.steps.find((s) => s.id === "rustboro-roxanne")!
    .gymPrep!;
  const matches = squadMatchesForGymPrep(
    [
      mon({
        id: "1",
        species: "Marshtomp",
        slot: "MAIN",
        types: ["Water", "Ground"],
        partyIndex: 0,
      }),
      mon({
        id: "2",
        species: "Torchic",
        slot: "RESERVE",
        types: ["Fire"],
        partyIndex: 0,
      }),
      mon({
        id: "3",
        species: "Lotad",
        slot: "GRAVEYARD",
        types: ["Water", "Grass"],
        partyIndex: 0,
      }),
      mon({
        id: "4",
        species: "Makuhita",
        slot: "MAIN",
        types: ["Fighting"],
        partyIndex: 1,
        nickname: "Punchy",
      }),
    ],
    prep,
  );

  assert.deepEqual(
    matches.map((m) => m.entry.id),
    ["1", "4"],
  );
  assert.deepEqual(matches[0]!.matchedTypes, ["Water"]);
  assert.deepEqual(matches[1]!.matchedTypes, ["Fighting"]);
});
