import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POKEMON_SPRITE_PREFERENCE,
  isPokemonSpritePreference,
} from "@/features/preferences/pokemon-sprite-prefs";

test("recognizes supported Pokémon sprite preferences", () => {
  assert.equal(DEFAULT_POKEMON_SPRITE_PREFERENCE, "2d");
  assert.equal(isPokemonSpritePreference("2d"), true);
  assert.equal(isPokemonSpritePreference("animated"), true);
  assert.equal(isPokemonSpritePreference("3d"), false);
  assert.equal(isPokemonSpritePreference(null), false);
});
