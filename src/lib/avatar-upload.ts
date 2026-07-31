/** Client-side helpers for custom trainer avatar imports. */

import {
  assertCustomImageSize,
  CUSTOM_IMAGE_DIMENSIONS_ERROR,
  CUSTOM_IMAGE_MAX_EDGE_PX,
  isWithinCustomImageDimensions,
} from "@/lib/custom-image-upload";

export const AVATAR_MAX_EDGE_PX = CUSTOM_IMAGE_MAX_EDGE_PX;
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function isAllowedAvatarMime(type: string): boolean {
  return ALLOWED_TYPES.has(type);
}

/**
 * Downscale/crop to a square WebP (or PNG fallback) for compact blob storage.
 * Compliant GIFs stay intact so their animation is preserved.
 */
export async function prepareAvatarFile(file: File): Promise<File> {
  if (!isAllowedAvatarMime(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image");
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (file.type === "image/gif") {
      if (!isWithinCustomImageDimensions(bitmap.width, bitmap.height)) {
        throw new Error(CUSTOM_IMAGE_DIMENSIONS_ERROR);
      }
      assertCustomImageSize(file);
      return file;
    }

    const edge = Math.min(
      AVATAR_MAX_EDGE_PX,
      Math.max(bitmap.width, bitmap.height),
    );
    const scale = edge / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");

    ctx.clearRect(0, 0, edge, edge);
    const dx = Math.round((edge - width) / 2);
    const dy = Math.round((edge - height) / 2);
    ctx.drawImage(bitmap, dx, dy, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.9);
    });
    if (!blob) {
      const png = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (!png) throw new Error("Could not process image");
      const prepared = new File([png], "avatar.png", { type: "image/png" });
      assertCustomImageSize(prepared);
      return prepared;
    }
    // Browsers without WebP encoding may still return a non-null PNG blob.
    const type = blob.type || "image/png";
    const ext = type === "image/webp" ? "webp" : "png";
    const prepared = new File([blob], `avatar.${ext}`, { type });
    assertCustomImageSize(prepared);
    return prepared;
  } finally {
    bitmap.close();
  }
}
