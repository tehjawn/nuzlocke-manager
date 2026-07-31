import assert from "node:assert/strict";
import test from "node:test";
import { trashPack2026 } from "@/data/trash-pack-2026";
import {
  getSquadCounterReroll,
  recommendSquadCounters,
} from "@/lib/pokedex-squad-counter";

const squad = trashPack2026.trainers[0]!.pokemon.filter(
  (pokemon) => pokemon.slot === "MAIN" || pokemon.slot === "RESERVE",
);

test("does not offer a reroll when the first batch contains every counter", () => {
  const suggestions = recommendSquadCounters(["Water"], squad, { limit: 3 });

  assert.equal(suggestions.length, 2);
  assert.equal(
    getSquadCounterReroll(["Water"], squad, suggestions, [], { limit: 3 }),
    null,
  );
});

test("advances to remaining counters and then offers to restart", () => {
  const first = recommendSquadCounters(["Dragon"], squad, { limit: 3 });
  const more = getSquadCounterReroll(["Dragon"], squad, first, [], {
    limit: 3,
  });

  assert.equal(more?.action, "more");
  assert.deepEqual(
    more?.excludeEntryIds,
    first.map((suggestion) => suggestion.entryId),
  );

  const second = recommendSquadCounters(["Dragon"], squad, {
    excludeEntryIds: more?.excludeEntryIds,
    limit: 3,
  });
  const restart = getSquadCounterReroll(
    ["Dragon"],
    squad,
    second,
    more?.excludeEntryIds ?? [],
    { limit: 3 },
  );

  assert.equal(second.length, 1);
  assert.deepEqual(restart, { action: "restart", excludeEntryIds: [] });
});
