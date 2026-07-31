/**
 * Client + shared helpers for custom avatar backdrops and card backgrounds.
 * Stored values reuse the avatar `custom:https://…` prefix.
 */

import {
  assertCustomImageSize,
  CUSTOM_IMAGE_MAX_EDGE_PX,
} from "@/lib/custom-image-upload";
import {
  CUSTOM_AVATAR_PREFIX,
  isAllowedCustomAvatarUrl,
} from "@/lib/sprites";

export type TextureKind = "avatar-bg" | "card-bg";

export const TEXTURE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Avatar stage plate — keep alpha and preserve its aspect ratio. */
export const AVATAR_BG_MAX_EDGE_PX = CUSTOM_IMAGE_MAX_EDGE_PX;
/** League card chrome — landscape-ish cover. */
export const CARD_BG_MAX_WIDTH_PX = CUSTOM_IMAGE_MAX_EDGE_PX;
export const CARD_BG_MAX_HEIGHT_PX = 750;

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

/**
 * Safe CSS `url(...)` wrapper. Always JSON-stringify so quotes/parens in a
 * hostile string cannot break out of the declaration.
 */
export function cssTextureUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

/**
 * Extract a canonical blob URL from a stored `custom:https://…` key.
 * Returns `null` for missing / non-blob values. Rejects raw CSS-breakout
 * characters in the candidate; always returns `URL.href`.
 */
export function parseCustomTextureUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value.toLowerCase().startsWith(CUSTOM_AVATAR_PREFIX)) return null;
  const candidate = value.slice(CUSTOM_AVATAR_PREFIX.length).trim();
  // Block raw breakout chars before the URL parser percent-encodes them.
  if (/["'()\\\s<>]/.test(candidate)) return null;
  if (!isAllowedCustomAvatarUrl(candidate)) return null;
  try {
    const href = new URL(candidate).href;
    if (!isAllowedCustomAvatarUrl(href)) return null;
    return href;
  } catch {
    return null;
  }
}

export function isCustomTextureKey(value: unknown): value is string {
  return typeof value === "string" && parseCustomTextureUrl(value) != null;
}

export function textureBlobFolder(kind: TextureKind): string {
  return kind === "avatar-bg" ? "avatar-bgs" : "card-bgs";
}

/**
 * True when the blob path was uploaded under this user's texture folder.
 * Uses path segments (folder / userId / file) rather than substring match.
 */
export function isOwnedCustomTextureUrl(
  url: string,
  userId: string,
  kind: TextureKind,
): boolean {
  if (!userId || !isAllowedCustomAvatarUrl(url)) return false;
  try {
    const href = new URL(url).href;
    const segments = decodeURIComponent(new URL(href).pathname)
      .split("/")
      .filter(Boolean);
    const folder = textureBlobFolder(kind);
    const folderIdx = segments.indexOf(folder);
    return (
      folderIdx >= 0 &&
      segments[folderIdx + 1] === userId &&
      typeof segments[folderIdx + 2] === "string" &&
      segments[folderIdx + 2]!.length > 0
    );
  } catch {
    return false;
  }
}

/** Acting editor or the profile owner may re-apply an already-uploaded texture. */
export function canUseCustomTextureUrl(
  url: string,
  kind: TextureKind,
  actingUserId: string,
  trainerUserId: string | null | undefined,
  alreadySaved: boolean,
): boolean {
  if (alreadySaved) return true;
  if (isOwnedCustomTextureUrl(url, actingUserId, kind)) return true;
  if (
    trainerUserId &&
    trainerUserId !== actingUserId &&
    isOwnedCustomTextureUrl(url, trainerUserId, kind)
  ) {
    return true;
  }
  return false;
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  preferPng: boolean,
  basename: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const finish = (blob: Blob | null) => {
      if (!blob) {
        reject(new Error("Could not process image"));
        return;
      }
      const type = blob.type === "image/webp" ? "image/webp" : "image/png";
      const ext = type === "image/webp" ? "webp" : "png";
      const prepared = new File([blob], `${basename}.${ext}`, { type });
      try {
        assertCustomImageSize(prepared);
        resolve(prepared);
      } catch (error) {
        reject(error);
      }
    };

    if (preferPng) {
      canvas.toBlob(finish, "image/png");
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          finish(blob);
          return;
        }
        canvas.toBlob(finish, "image/png");
      },
      "image/webp",
      0.9,
    );
  });
}

/**
 * Downscale backdrop art; preserve aspect + transparency (PNG preferred).
 * Canvas encoding also flattens animated sources to their first frame.
 */
export async function prepareAvatarBackdropFile(file: File): Promise<File> {
  if (!isAllowedTextureMime(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image");
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
