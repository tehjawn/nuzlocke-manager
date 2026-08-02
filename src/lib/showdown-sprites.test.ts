/**
 * Showdown sprite path allowlist + same-origin proxy URL builders.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseShowdownSpritePath,
  showdownProxyUrl,
  SHOWDOWN_ORIGIN,
} from "@/lib/showdown-sprites";

test("parseShowdownSpritePath accepts allowed trainer / gen5 / ani / itemicons", () => {
  assert.deepEqual(parseShowdownSpritePath(["trainers", "red.png"]), {
    folder: "trainers",
    file: "red.png",
    upstreamUrl: `${SHOWDOWN_ORIGIN}/sprites/trainers/red.png`,
  });
  assert.deepEqual(parseShowdownSpritePath(["gen5-shiny", "charizard.png"]), {
    folder: "gen5-shiny",
    file: "charizard.png",
    upstreamUrl: `${SHOWDOWN_ORIGIN}/sprites/gen5-shiny/charizard.png`,
  });
  assert.deepEqual(parseShowdownSpritePath(["ani", "charizard-megax.gif"]), {
    folder: "ani",
    file: "charizard-megax.gif",
    upstreamUrl: `${SHOWDOWN_ORIGIN}/sprites/ani/charizard-megax.gif`,
  });
  assert.deepEqual(parseShowdownSpritePath(["itemicons", "leftovers.png"]), {
    folder: "itemicons",
    file: "leftovers.png",
    upstreamUrl: `${SHOWDOWN_ORIGIN}/sprites/itemicons/leftovers.png`,
  });
});

test("parseShowdownSpritePath rejects traversal, wrong ext, and unknown folders", () => {
  assert.equal(parseShowdownSpritePath(["trainers", "../etc/passwd"]), null);
  assert.equal(parseShowdownSpritePath(["trainers", "red.gif"]), null);
  assert.equal(parseShowdownSpritePath(["ani", "pikachu.png"]), null);
  assert.equal(parseShowdownSpritePath(["dex", "bulbasaur.png"]), null);
  assert.equal(parseShowdownSpritePath(["trainers"]), null);
  assert.equal(
    parseShowdownSpritePath(["trainers", "sub", "red.png"]),
    null,
  );
  assert.equal(parseShowdownSpritePath(["trainers", "red.png?x=1"]), null);
});

test("showdownProxyUrl builds same-origin paths", () => {
  assert.equal(
    showdownProxyUrl("trainers", "red.png"),
    "/api/sprites/trainers/red.png",
  );
  assert.equal(
    showdownProxyUrl("ani-shiny", "rattata-alola.gif"),
    "/api/sprites/ani-shiny/rattata-alola.gif",
  );
});
