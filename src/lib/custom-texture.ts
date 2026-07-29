/**
 * Client + shared helpers for custom avatar backdrops and card backgrounds.
 * Stored values reuse the avatar `custom:https://…` prefix.
 */

import {
  CUSTOM_AVATAR_PREFIX,
  isAllowedCustomAvatarUrl,
} from "@/lib/sprites";

export type TextureKind = "avatar-bg" | "card-bg";

export const TEXTURE_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const TEXTURE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Avatar stage plate — keep alpha; modest square-ish edge. */
export const AVATAR_BG_MAX_EDGE_PX = 384;
/** League card chrome — landscape-ish cover. */
export const CARD_BG_MAX_WIDTH_PX = 960;
export const CARD_BG_MAX_HEIGHT_PX = 720;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function isAllowedTextureMime(type: string): boolean {
  return ALLOWED_TYPES.has(type);
}

export function customTextureKey(url: string): string {
  return `${CUSTOM_AVATAR_PREFIX}${url.trim()}`;
}

/** Extract blob URL from a stored `custom:https://…` key, else null. */
export function parseCustomTextureUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value.toLowerCase().startsWith(CUSTOM_AVATAR_PREFIX)) return null;
  const url = value.slice(CUSTOM_AVATAR_PREFIX.length).trim();
  return isAllowedCustomAvatarUrl(url) ? url : null;
}

export function isCustomTextureKey(value: unknown): value is string {
  return typeof value === "string" && parseCustomTextureUrl(value) != null;
}

export function textureBlobFolder(kind: TextureKind): string {
  return kind === "avatar-bg" ? "avatar-bgs" : "card-bgs";
}

/** True when the blob path was uploaded under this user's texture folder. */
export function isOwnedCustomTextureUrl(
  url: string,
  userId: string,
  kind: TextureKind,
): boolean {
  if (!userId || !isAllowedCustomAvatarUrl(url)) return false;
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const marker = `/${textureBlobFolder(kind)}/${userId}/`;
    return path.includes(marker) || path.startsWith(marker.slice(1));
  } catch {
    return false;
  }
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  preferPng: boolean,
  basename: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const finish = (blob: Blob | null, type: string, ext: string) => {
      if (!blob) {
        reject(new Error("Could not process image"));
        return;
      }
      resolve(new File([blob], `${basename}.${ext}`, { type }));
    };

    if (preferPng) {
      canvas.toBlob((blob) => finish(blob, "image/png", "png"), "image/png");
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          finish(blob, "image/webp", "webp");
          return;
        }
        canvas.toBlob(
          (png) => finish(png, "image/png", "png"),
          "image/png",
        );
      },
      "image/webp",
      0.9,
    );
  });
}

/**
 * Downscale backdrop art; preserve aspect + transparency (PNG preferred).
 * Small GIFs kept intact for simple animated stages.
 */
export async function prepareAvatarBackdropFile(file: File): Promise<File> {
  if (!isAllowedTextureMime(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image");
  }
  if (file.size > TEXTURE_MAX_UPLOAD_BYTES) {
    throw new Error("Image must be 2 MB or smaller");
  }
  if (file.type === "image/gif" && file.size <= 512 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = Math.max(bitmap.width, bitmap.height);
    const scale =
      maxEdge > AVATAR_BG_MAX_EDGE_PX ? AVATAR_BG_MAX_EDGE_PX / maxEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Prefer PNG so stage sprites keep alpha.
    return canvasToFile(canvas, true, "backdrop");
  } finally {
    bitmap.close();
  }
}

/** Cover-crop card chrome into a landscape plate; WebP when possible. */
export async function prepareCardBackgroundFile(file: File): Promise<File> {
  if (!isAllowedTextureMime(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image");
  }
  if (file.size > TEXTURE_MAX_UPLOAD_BYTES) {
    throw new Error("Image must be 2 MB or smaller");
  }
  if (file.type === "image/gif" && file.size <= 512 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const targetW = CARD_BG_MAX_WIDTH_PX;
    const targetH = CARD_BG_MAX_HEIGHT_PX;
    const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
    const drawW = Math.round(bitmap.width * scale);
    const drawH = Math.round(bitmap.height * scale);
    const dx = Math.round((targetW - drawW) / 2);
    const dy = Math.round((targetH - drawH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.drawImage(bitmap, dx, dy, drawW, drawH);

    return canvasToFile(canvas, false, "card-bg");
  } finally {
    bitmap.close();
  }
}

export function prepareTextureFile(
  kind: TextureKind,
  file: File,
): Promise<File> {
  return kind === "avatar-bg"
    ? prepareAvatarBackdropFile(file)
    : prepareCardBackgroundFile(file);
}
