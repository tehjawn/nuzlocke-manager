import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  CUSTOM_IMAGE_DIMENSIONS_ERROR,
  CUSTOM_IMAGE_MAX_UPLOAD_BYTES,
  CUSTOM_IMAGE_SIZE_ERROR,
} from "@/lib/custom-image-upload";
import {
  validateImageUpload,
  versionBlobUrl,
} from "@/lib/server-image-upload";

test("accepts a static image within the upload limits", async () => {
  const png = await sharp({
    create: {
      background: "red",
      channels: 4,
      height: 1000,
      width: 1000,
    },
  })
    .png()
    .toBuffer();

  const error = await validateImageUpload(imageFile(png, "image/png"), {
    allowAnimation: false,
  });

  assert.equal(error, null);
});

test("rejects an image above 1000 pixels on either edge", async () => {
  const png = await sharp({
    create: {
      background: "red",
      channels: 4,
      height: 1,
      width: 1001,
    },
  })
    .png()
    .toBuffer();

  const error = await validateImageUpload(imageFile(png, "image/png"), {
    allowAnimation: true,
  });

  assert.equal(error, CUSTOM_IMAGE_DIMENSIONS_ERROR);
});

test("rejects animation for textures but permits it for avatars", async () => {
  const webp = await animatedWebp();
  const file = imageFile(webp, "image/webp");

  const textureError = await validateImageUpload(file, {
    allowAnimation: false,
  });
  const avatarError = await validateImageUpload(file, {
    allowAnimation: true,
  });

  assert.equal(
    textureError,
    "Animated backdrops and backgrounds are not supported",
  );
  assert.equal(avatarError, null);
});

test("rejects a post-processing payload above 5 MB", async () => {
  const oversized = new Uint8Array(CUSTOM_IMAGE_MAX_UPLOAD_BYTES + 1);
  const file = new File([oversized], "large.png", { type: "image/png" });

  const error = await validateImageUpload(file, { allowAnimation: true });

  assert.equal(error, CUSTOM_IMAGE_SIZE_ERROR);
});

test("rejects files whose MIME type does not match their contents", async () => {
  const png = await sharp({
    create: {
      background: "red",
      channels: 4,
      height: 2,
      width: 2,
    },
  })
    .png()
    .toBuffer();

  const error = await validateImageUpload(imageFile(png, "image/jpeg"), {
    allowAnimation: true,
  });

  assert.equal(error, "Image contents do not match the selected file type");
});

test("adds a cache version without changing the blob pathname", () => {
  const url = "https://store.public.blob.vercel-storage.com/avatars/user/avatar";
  const versioned = new URL(versionBlobUrl(url, 1234));

  assert.equal(versioned.pathname, "/avatars/user/avatar");
  assert.equal(versioned.searchParams.get("v"), "ya");
});

function imageFile(buffer: Buffer, type: string): File {
  return new File([Uint8Array.from(buffer)], "image", { type });
}

async function animatedWebp(): Promise<Buffer> {
  const pixels = Buffer.alloc(2 * 4 * 4);
  for (let index = 0; index < 4; index += 1) {
    pixels[index * 4] = 255;
    pixels[index * 4 + 3] = 255;
  }
  for (let index = 4; index < 8; index += 1) {
    pixels[index * 4 + 2] = 255;
    pixels[index * 4 + 3] = 255;
  }

  return sharp(pixels, {
    raw: {
      channels: 4,
      height: 4,
      pageHeight: 2,
      width: 2,
    },
  })
    .webp({ delay: [100, 100], loop: 0 })
    .toBuffer();
}
