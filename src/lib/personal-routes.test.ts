import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { buildPersonalRouteStatus } from "@/lib/personal-routes";

function mon(
  partial: Pick<PokemonEntry, "id" | "slot" | "catchRoute"> &
    Partial<PokemonEntry>,
): PokemonEntry {
  return {
    ability: null,
    causeOfDeath: null,
    diedOnRun: null,
    evs: null,
    heldItem: null,
    isShiny: false,
    ivs: null,
    level: null,
    moves: [],
    nature: null,
    nickname: null,
    partyIndex: 0,
    pokedexId: null,
    runId: null,
    species: "Zigzagoon",
    types: ["Normal"],
    ...partial,
  };
}

function trainer(pokemon: PokemonEntry[]): TrainerProfile {
  return {
    activeRunNumber: 1,
    avatarBackgroundKey: null,
    avatarSpriteKey: "brendan",
    cardBackgroundKey: null,
    discordDisplayName: null,
    discordUsername: null,
    earnedBadgeKeys: [],
    handle: "Ash",
    id: "trainer-1",
    mainSquadLocked: false,
    pokemon,
    realName: null,
    reviveUsed: false,
    sortOrder: 0,
    statusEmoji: null,
    statusText: null,
    updatedAt: null,
    userId: null,
    wipeCount: 0,
    money: null,
  };
}

test("matches trimmed catalog routes across every board slot", () => {
  const status = buildPersonalRouteStatus(
    trainer([
      mon({ catchRoute: " route 101 ", id: "main", slot: "MAIN" }),
      mon({ catchRoute: "ROUTE 102", id: "reserve", slot: "RESERVE" }),
      mon({ catchRoute: "Route 103", id: "grave", slot: "GRAVEYARD" }),
      mon({
        catchRoute: "Route 104",
        id: "encountered",
        slot: "ENCOUNTERED",
      }),
    ]),
    ["Route 101", "Route 102", "Route 103", "Route 104", "Route 105"],
  );

  assert.deepEqual(
    status.claimedRoutes.map((group) => group.route),
    ["Route 101", "Route 102", "Route 103", "Route 104"],
  );
  assert.deepEqual(
    status.claimedRoutes.map((group) => group.claims[0]?.slot),
    ["MAIN", "RESERVE", "GRAVEYARD", "ENCOUNTERED"],
  );
  assert.deepEqual(status.openRoutes, ["Route 105"]);
});

test("keeps custom locations separate without changing catalog availability", () => {
  const status = buildPersonalRouteStatus(
    trainer([
      mon({ catchRoute: "Secret Meadow", id: "custom-1", slot: "MAIN" }),
      mon({
        catchRoute: " secret meadow ",
        id: "custom-2",
        slot: "GRAVEYARD",
      }),
    ]),
    ["Route 101", "Route 102"],
  );

  assert.deepEqual(status.openRoutes, ["Route 101", "Route 102"]);
  assert.equal(status.claimedRoutes.length, 0);
  assert.equal(status.otherRoutes.length, 1);
  assert.equal(status.otherRoutes[0]?.route, "Secret Meadow");
  assert.equal(status.otherRoutes[0]?.claims.length, 2);
});

test("reports the all-open and fully-claimed boundaries", () => {
  const catalog = ["Route 101", "Route 102"];
  const allOpen = buildPersonalRouteStatus(trainer([]), catalog);
  const fullyClaimed = buildPersonalRouteStatus(
    trainer([
      mon({ catchRoute: "Route 101", id: "one", slot: "MAIN" }),
      mon({ catchRoute: "Route 102", id: "two", slot: "RESERVE" }),
    ]),
    catalog,
  );

  assert.deepEqual(allOpen.openRoutes, catalog);
  assert.equal(allOpen.claimedRoutes.length, 0);
  assert.deepEqual(fullyClaimed.openRoutes, []);
  assert.equal(fullyClaimed.claimedRoutes.length, catalog.length);
});

test("does not let an unspecified Safari claim expanded Safari areas", () => {
  const safariAreas = [
    "Safari Zone (South)",
    "Safari Zone (Southwest)",
    "Safari Zone (Northwest)",
    "Safari Zone (North)",
    "Safari Zone (Southeast)",
    "Safari Zone (Northeast)",
  ];
  const status = buildPersonalRouteStatus(
    trainer([mon({ catchRoute: "Safari Zone", id: "legacy", slot: "MAIN" })]),
    safariAreas,
  );

  assert.deepEqual(status.openRoutes, safariAreas);
  assert.equal(status.claimedRoutes.length, 0);
  assert.equal(status.otherRoutes[0]?.route, "Safari Zone");
});

test("legacy Safari Zone claims only the umbrella catalog entry", () => {
  const catalog = [
    "Safari Zone (South)",
    "Safari Zone (Southwest)",
    "Safari Zone",
  ];
  const status = buildPersonalRouteStatus(
    trainer([
      mon({ catchRoute: "Safari Zone", id: "legacy", slot: "MAIN" }),
      mon({
        catchRoute: "Safari Zone (South)",
        id: "south",
        slot: "RESERVE",
      }),
    ]),
    catalog,
  );

  assert.deepEqual(
    status.claimedRoutes.map((g) => g.route),
    ["Safari Zone (South)", "Safari Zone"],
  );
  assert.deepEqual(status.openRoutes, ["Safari Zone (Southwest)"]);
});
