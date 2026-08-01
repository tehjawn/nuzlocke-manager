import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseCustomTextureUrl,
  isOwnedCustomTextureUrl,
  parseCustomTextureUrl,
} from "@/lib/custom-texture";
import {
  CUSTOM_IMAGE_URL_MAX_LENGTH,
  avatarImageClassName,
  avatarImageUrl,
  avatarStillImageUrl,
  canUseCustomAvatarUrl,
  customAvatarKey,
  customImageKeyFromInput,
  isAllowedCustomAvatarUrl,
  isOwnedCustomAvatarUrl,
  isVercelBlobCustomUrl,
  normalizeCustomImageUrl,
  parseAvatarKey,
  pokemonAnimatedAvatarKey,
  pokemonAnimatedSpriteId,
  pokemonAnimatedSpriteUrl,
  pokemonSpriteUrl,
} from "@/lib/sprites";

const BLOB_AVATAR =
  "https://abc123.public.blob.vercel-storage.com/avatars/user-1/avatar.png";
const BLOB_BACKDROP =
  "https://abc123.public.blob.vercel-storage.com/avatar-bgs/user-1/backdrop.png";
const HOTLINK = "https://cdn.example.com/sprites/may.gif";

test("accepts public HTTPS hotlinks and Vercel Blob URLs", () => {
  assert.equal(isAllowedCustomAvatarUrl(HOTLINK), true);
  assert.equal(isAllowedCustomAvatarUrl(BLOB_AVATAR), true);
  assert.equal(isVercelBlobCustomUrl(HOTLINK), false);
  assert.equal(isVercelBlobCustomUrl(BLOB_AVATAR), true);
});

test("rejects non-https, local, and CSS-breakout URLs", () => {
  assert.equal(isAllowedCustomAvatarUrl("http://cdn.example.com/a.png"), false);
  assert.equal(isAllowedCustomAvatarUrl("https://localhost/a.png"), false);
  assert.equal(isAllowedCustomAvatarUrl("https://127.0.0.1/a.png"), false);
  assert.equal(
    isAllowedCustomAvatarUrl('https://cdn.example.com/a.png")'),
    false,
  );
  assert.equal(
    isAllowedCustomAvatarUrl("https://cdn.example.com/a png"),
    false,
  );
  assert.equal(
    isAllowedCustomAvatarUrl(`https://cdn.example.com/${"a".repeat(CUSTOM_IMAGE_URL_MAX_LENGTH)}.png`),
    false,
  );
});

test("normalizeCustomImageUrl accepts raw URLs and custom: keys", () => {
  assert.equal(normalizeCustomImageUrl(HOTLINK), HOTLINK);
  assert.equal(
    normalizeCustomImageUrl(customAvatarKey(HOTLINK)),
    HOTLINK,
  );
  assert.equal(normalizeCustomImageUrl("not a url"), null);
  assert.equal(
    customImageKeyFromInput(HOTLINK),
    customAvatarKey(HOTLINK),
  );
});

test("parseAvatarKey keeps hotlinked custom avatars", () => {
  const parsed = parseAvatarKey(customAvatarKey(HOTLINK));
  assert.deepEqual(parsed, { kind: "custom", url: HOTLINK });
});

test("pokemon animated avatar keys resolve to Showdown ani GIFs", () => {
  assert.equal(pokemonAnimatedAvatarKey(306), "pokeani:306");
  assert.deepEqual(parseAvatarKey("pokeani:306"), {
    kind: "pokemon-ani",
    pokedexId: 306,
    species: "306",
  });
  assert.equal(
    pokemonAnimatedSpriteId("Charizard-Mega-X"),
    "charizard-megax",
  );
  assert.equal(
    pokemonAnimatedSpriteUrl("venusaur-mega"),
    "https://play.pokemonshowdown.com/sprites/ani/venusaur-mega.gif",
  );
  assert.equal(
    pokemonAnimatedSpriteUrl("Charizard-Mega-X", { shiny: true }),
    "https://play.pokemonshowdown.com/sprites/ani-shiny/charizard-megax.gif",
  );
  assert.equal(
    avatarImageUrl("pokeani:306"),
    "https://play.pokemonshowdown.com/sprites/ani/aggron.gif",
  );
  // Forme ids (≥10000) still round-trip via index slug → Showdown ani stem.
  assert.equal(
    avatarImageUrl("pokeani:10034"),
    "https://play.pokemonshowdown.com/sprites/ani/charizard-megax.gif",
  );
  assert.equal(
    avatarImageUrl("pokeani:10091"),
    "https://play.pokemonshowdown.com/sprites/ani/rattata-alola.gif",
  );
  assert.equal(
    avatarStillImageUrl("pokeani:306"),
    pokemonSpriteUrl("306", { pokedexId: 306 }),
  );
  assert.equal(avatarStillImageUrl("poke:306"), null);
  assert.match(avatarImageClassName("pokeani:306", "h-10"), /^h-10 /);
  assert.doesNotMatch(
    avatarImageClassName("pokeani:306", "h-10"),
    /pixelated/,
  );
});

test("parseCustomTextureUrl accepts hotlinked textures", () => {
  assert.equal(
    parseCustomTextureUrl(customAvatarKey(HOTLINK)),
    HOTLINK,
  );
  assert.equal(
    parseCustomTextureUrl(customAvatarKey(BLOB_BACKDROP)),
    BLOB_BACKDROP,
  );
});

test("blob ownership still gates uploaded avatars", () => {
  assert.equal(isOwnedCustomAvatarUrl(BLOB_AVATAR, "user-1"), true);
  assert.equal(isOwnedCustomAvatarUrl(BLOB_AVATAR, "user-2"), false);
  assert.equal(isOwnedCustomAvatarUrl(HOTLINK, "user-1"), false);

  assert.equal(canUseCustomAvatarUrl(HOTLINK, "user-1", false), true);
  assert.equal(canUseCustomAvatarUrl(BLOB_AVATAR, "user-1", false), true);
  assert.equal(canUseCustomAvatarUrl(BLOB_AVATAR, "user-2", false), false);
  assert.equal(canUseCustomAvatarUrl(BLOB_AVATAR, "user-2", true), true);
});

test("blob ownership still gates uploaded textures; hotlinks are free", () => {
  assert.equal(
    isOwnedCustomTextureUrl(BLOB_BACKDROP, "user-1", "avatar-bg"),
    true,
  );
  assert.equal(
    isOwnedCustomTextureUrl(BLOB_BACKDROP, "user-2", "avatar-bg"),
    false,
  );
  assert.equal(
    isOwnedCustomTextureUrl(HOTLINK, "user-1", "avatar-bg"),
    false,
  );

  assert.equal(
    canUseCustomTextureUrl(HOTLINK, "avatar-bg", "user-1", null, false),
    true,
  );
  assert.equal(
    canUseCustomTextureUrl(BLOB_BACKDROP, "avatar-bg", "user-1", null, false),
    true,
  );
  assert.equal(
    canUseCustomTextureUrl(BLOB_BACKDROP, "avatar-bg", "user-2", null, false),
    false,
  );
  assert.equal(
    canUseCustomTextureUrl(
      BLOB_BACKDROP,
      "avatar-bg",
      "user-2",
      "user-1",
      false,
    ),
    true,
  );
});
