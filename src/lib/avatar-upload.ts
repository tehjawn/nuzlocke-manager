/** Client-side helpers for custom trainer avatar imports. */

export const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_EDGE_PX = 256;
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
 * GIFs are returned as-is when already small enough — animated frames are kept.
 */
export async function prepareAvatarFile(file: File): Promise<File> {
  if (!isAllowedAvatarMime(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image");
  }
  if (file.size > AVATAR_MAX_UPLOAD_BYTES) {
    throw new Error("Image must be 2 MB or smaller");
  }

  // Keep small GIFs intact so short animations survive.
  if (file.type === "image/gif" && file.size <= 512 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
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
      return new File([png], "avatar.png", { type: "image/png" });
    }
    return new File([blob], "avatar.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
