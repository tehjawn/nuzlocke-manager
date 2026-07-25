"use server";

import { put } from "@vercel/blob";
import { requireUserId } from "@/lib/permissions";
import {
  AVATAR_MAX_UPLOAD_BYTES,
  isAllowedAvatarMime,
} from "@/lib/avatar-upload";
import { customAvatarKey } from "@/lib/sprites";

export type UploadCustomAvatarResult =
  | { ok: true; avatarSpriteKey: string }
  | { ok: false; error: string };

export async function uploadCustomAvatarAction(
  formData: FormData,
): Promise<UploadCustomAvatarResult> {
  try {
    const userId = await requireUserId();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: false,
        error: "Custom uploads aren’t set up on this environment yet.",
      };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an image to upload" };
    }
    if (!isAllowedAvatarMime(file.type)) {
      return { ok: false, error: "Use a PNG, JPEG, WebP, or GIF image" };
    }
    if (file.size > AVATAR_MAX_UPLOAD_BYTES) {
      return { ok: false, error: "Image must be 2 MB or smaller" };
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/gif"
            ? "gif"
            : "webp";

    const blob = await put(`avatars/${userId}/avatar.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return { ok: true, avatarSpriteKey: customAvatarKey(blob.url) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
