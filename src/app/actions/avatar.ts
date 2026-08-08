"use server";

import { put } from "@vercel/blob";
import { requireUserId } from "@/lib/permissions";
import { isAllowedAvatarMime } from "@/lib/avatar-upload";
import {
  validateImageUpload,
  versionBlobUrl,
} from "@/lib/server-image-upload";
import { customAvatarKey } from "@/lib/sprites";

export type UploadCustomAvatarResult =
  | { ok: true; avatarSpriteKey: string }
  | { ok: false; error: string };

export async function uploadCustomAvatarAction(
  formData: FormData,
): Promise<UploadCustomAvatarResult> {
  try {
    const userId = await requireUserId();

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return {
        ok: false,
        error:
          "Missing BLOB_READ_WRITE_TOKEN. Add it to .env.local and restart the dev server.",
      };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image to upload" };
    }
    if (!isAllowedAvatarMime(file.type)) {
      return { ok: false, error: "Use a PNG, JPEG, WebP, or GIF image" };
    }
    const validationError = await validateImageUpload(file, {
      allowAnimation: true,
    });
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const blob = await put(`avatars/${userId}/avatar`, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      // URLs are version-busted with `?v=`; long TTL is safe for overwrites.
      cacheControlMaxAge: 60 * 60 * 24 * 30,
      contentType: file.type,
      token,
    });

    return {
      ok: true,
      avatarSpriteKey: customAvatarKey(versionBlobUrl(blob.url)),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
