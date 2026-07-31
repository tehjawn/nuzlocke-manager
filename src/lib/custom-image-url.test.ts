import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseCustomTextureUrl,
  isOwnedCustomTextureUrl,
  parseCustomTextureUrl,
} from "@/lib/custom-texture";
import {
  CUSTOM_IMAGE_URL_MAX_LENGTH,
  canUseCustomAvatarUrl,
  customAvatarKey,
  customImageKeyFromInput,
  isAllowedCustomAvatarUrl,
  isOwnedCustomAvatarUrl,
  isVercelBlobCustomUrl,
  normalizeCustomImageUrl,
  parseAvatarKey,
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
