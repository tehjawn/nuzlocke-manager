import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAIN_PARTY_SIZE,
  firstOpenMainPartyIndex,
} from "@/lib/pokemon-board-dnd";

describe("firstOpenMainPartyIndex", () => {
  it("returns 0 when Main Squad is empty", () => {
    assert.equal(firstOpenMainPartyIndex([]), 0);
  });

  it("returns the first hole when slots are sparse", () => {
    assert.equal(
      firstOpenMainPartyIndex([
        { slot: "MAIN", partyIndex: 0 },
        { slot: "MAIN", partyIndex: 2 },
        { slot: "RESERVE", partyIndex: 1 },
      ]),
      1,
    );
  });

  it("returns null when all six Main slots are filled", () => {
    const full = Array.from({ length: MAIN_PARTY_SIZE }, (_, partyIndex) => ({
      slot: "MAIN" as const,
      partyIndex,
    }));
    assert.equal(firstOpenMainPartyIndex(full), null);
  });
});
